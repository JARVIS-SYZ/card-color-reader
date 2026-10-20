import type { Worker } from 'tesseract.js';

export async function ocrWorker(progress?:(s:string)=>void):Promise<Worker> {
  const {createWorker,PSM}=await import('tesseract.js');
  const at=(p:string)=>new URL(`${import.meta.env.BASE_URL}${p}`,window.location.origin).href;
  const worker=await createWorker('eng',1,{workerPath:at('ocr/worker.min.js'),corePath:at('ocr/core'),langPath:at('ocr/lang'),logger:m=>{if(progress&&m.status==='loading language traineddata')progress('문자 인식 엔진을 준비하고 있어요…');}});
  await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_WORD,tessedit_char_whitelist:'A234567891JQK0'});
  return worker;
}

// Tesseract reads isolated glyphs best around 60-80px tall with a generous margin.
export function upscale(glyph:HTMLCanvasElement,target=72):HTMLCanvasElement {
  const s=target/Math.max(1,glyph.height*.6),out=document.createElement('canvas');
  out.width=Math.round(glyph.width*s);out.height=Math.round(glyph.height*s);
  const ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.filter='blur(1px)';
  ctx.drawImage(glyph,0,0,out.width,out.height);return out;
}

// Binary shape facts used to settle look-alike ranks (9/Q, 4/A, 8).
export type Shape={mask:Uint8Array;w:number;h:number;holes:{cy:number;area:number}[];bottom:number;bottomLeft:number};
export function shapeOf(glyph:HTMLCanvasElement):Shape {
  const {width:W,height:H}=glyph,d=glyph.getContext('2d')!.getImageData(0,0,W,H).data;
  let x0=W,y0=H,x1=-1,y1=-1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(d[(y*W+x)*4]<128){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const w=Math.max(1,x1-x0+1),h=Math.max(1,y1-y0+1),mask=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)mask[y*w+x]=d[((y+y0)*W+x+x0)*4]<128?1:0;
  // background regions not touching the border are holes
  const seen=new Uint8Array(w*h),holes:{cy:number;area:number}[]=[];
  for(let i=0;i<w*h;i++){if(mask[i]||seen[i])continue;const st=[i];seen[i]=1;let n=0,sy=0,edge=false;
    while(st.length){const p=st.pop()!;n++;const x=p%w,y=(p-x)/w;sy+=y;if(x===0||y===0||x===w-1||y===h-1)edge=true;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,q=ny*w+nx;if(nx>=0&&ny>=0&&nx<w&&ny<h&&!mask[q]&&!seen[q]){seen[q]=1;st.push(q);}}}
    if(!edge&&n>=w*h*.012)holes.push({cy:+(sy/n/h).toFixed(2),area:+(n/(w*h)).toFixed(3)});}
  // ink extent across the bottom 12% of rows
  let bl=w,br=-1;for(let y=Math.floor(h*.88);y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){bl=Math.min(bl,x);br=Math.max(br,x);}
  return {mask,w,h,holes,bottom:+((br-bl+1)/w).toFixed(2),bottomLeft:+(bl/w).toFixed(2)};
}

const NO_HOLE=['2','3','5','7','J','K'];
// Holes decide most ranks; Tesseract only has to pick among the hole-free glyphs.
export function rankByShape(s:Shape):string|null {
  const [a,b]=s.holes;
  if(s.holes.length>=2)return b.cy>.6&&b.area<.08?'Q':'8';
  if(s.holes.length===1){
    if(a.cy<.42&&a.area>.15)return '9';
    if(a.cy>.55)return '6';
    if(a.area<.14)return s.bottom>.8?'A':'4';
    return null;
  }
  return null;
}
const PASSES:[string,number][]=[['10',0],['10',48],['8',48],['8',100]];
export async function readRanks(worker:Worker,glyphs:{glyph:HTMLCanvasElement;parts:number}[]):Promise<string[]> {
  const shapes=glyphs.map(g=>shapeOf(g.glyph)),out:string[]=glyphs.map((g,i)=>g.parts===2?'10':rankByShape(shapes[i])??'');
  const todo=out.map((r,i)=>r?-1:i).filter(i=>i>=0);
  const votes=todo.map(()=>new Map<string,number>());
  for(const [psm,size] of PASSES){
    await worker.setParameters({tessedit_pageseg_mode:psm as never});
    for(const [k,i] of todo.entries()){
      const r=(await worker.recognize(size?upscale(glyphs[i].glyph,size):glyphs[i].glyph)).data;
      const t=r.text.trim();if(NO_HOLE.includes(t))votes[k].set(t,(votes[k].get(t)??0)+1+r.confidence/100);
    }
  }
  todo.forEach((i,k)=>{out[i]=[...votes[k]].sort((a,b)=>b[1]-a[1])[0]?.[0]??'';});
  return out;
}
