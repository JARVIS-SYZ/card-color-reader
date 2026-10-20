import type { Card, Suit } from './cards';
import { RANKS, SYMBOLS } from './cards';
import type { Worker } from 'tesseract.js';

type Box = {x0:number;y0:number;x1:number;y1:number};
type Candidate = {text:string;confidence:number;bbox:Box};
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;};

export async function loadPhoto(file: File): Promise<HTMLCanvasElement> {
  if (file.size > 25*1024*1024) throw new Error('25MB 이하의 사진을 선택해 주세요.');
  const url=URL.createObjectURL(file);
  try {
    const img=new Image();img.src=url;await img.decode();
    if (!img.width || !img.height) throw new Error();
    const scale=Math.min(1,2400/Math.max(img.width,img.height));
    const c=canvas(img.width*scale,img.height*scale);c.getContext('2d')!.drawImage(img,0,0,c.width,c.height);return c;
  } catch { throw new Error('사진을 열 수 없어요. JPG, PNG 또는 WebP 사진을 사용해 주세요.'); }
  finally {URL.revokeObjectURL(url);}
}

function ink(r:number,g:number,b:number) {return Math.min(r,g,b)<150 && (r+g+b)/3<200;}
function redRatio(data:Uint8ClampedArray) {
  let total=0,red=0;
  for(let i=0;i<data.length;i+=4) if(ink(data[i],data[i+1],data[i+2])){total++;if(data[i]>data[i+1]*1.35&&data[i]>data[i+2]*1.25)red++;}
  return total ? red/total : 0;
}
// Find the first isolated ink component below the rank, then compare its silhouette.
function component(c:HTMLCanvasElement):HTMLCanvasElement|null {
  const {width:w,height:h}=c;const pix=c.getContext('2d')!.getImageData(0,0,w,h).data;
  const visited=new Uint8Array(w*h);const groups:{pts:number[];x0:number;y0:number;x1:number;y1:number}[]=[];
  for(let i=0;i<w*h;i++){
    if(visited[i]||!ink(pix[i*4],pix[i*4+1],pix[i*4+2]))continue;
    const stack=[i],pts:number[]=[];visited[i]=1;let x0=w,y0=h,x1=0,y1=0;
    while(stack.length){const p=stack.pop()!;pts.push(p);const x=p%w,y=Math.floor(p/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){const nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx<0||ny<0||nx>=w||ny>=h||visited[n])continue;visited[n]=1;if(ink(pix[n*4],pix[n*4+1],pix[n*4+2]))stack.push(n);}
    }
    if(pts.length>=10&&y1-y0>=4&&x1-x0>=3)groups.push({pts,x0,y0,x1,y1});
  }
  const group=groups.filter(g=>g.x1-g.x0<w*.95&&g.y1-g.y0<h*.95).sort((a,b)=>(a.y0+Math.abs((a.x0+a.x1)/2-w/2)*.6)-(b.y0+Math.abs((b.x0+b.x1)/2-w/2)*.6))[0];
  if(!group)return null;
  const out=canvas(group.x1-group.x0+1,group.y1-group.y0+1),ctx=out.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,out.width,out.height);ctx.fillStyle='black';
  for(const p of group.pts)ctx.fillRect(p%w-group.x0,Math.floor(p/w)-group.y0,1,1);return out;
}
function normalized(c:HTMLCanvasElement) {const out=canvas(32,40);const ctx=out.getContext('2d')!;ctx.drawImage(c,0,0,32,40);const p=ctx.getImageData(0,0,32,40).data;return Array.from({length:1280},(_,i)=>p[i*4]<150?1:0);}
let templates:{suit:Suit;mask:number[]}[]|null=null;
function suitTemplates() {
  if(templates)return templates;templates=[];
  for(const suit of Object.keys(SYMBOLS) as Suit[])for(const font of ['Arial','Georgia','Times New Roman','serif']){
    const c=canvas(100,120),ctx=c.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,100,120);ctx.fillStyle='black';ctx.font=`72px ${font}`;ctx.textAlign='center';ctx.fillText(SYMBOLS[suit],50,88);const shape=component(c);if(shape)templates.push({suit,mask:normalized(shape)});
  }return templates;
}
function guessSuit(source:HTMLCanvasElement,box:Box,red:boolean):Suit|'' {
  const rankH=box.y1-box.y0,rankW=box.x1-box.x0;
  const x=Math.max(0,box.x0-rankW*.35),y=Math.min(source.height-1,box.y1+rankH*.08);
  const w=Math.min(source.width-x,Math.max(rankW*1.7,rankH*1.25)),h=Math.min(source.height-y,rankH*1.9);
  const crop=canvas(w,h);crop.getContext('2d')!.drawImage(source,x,y,w,h,0,0,crop.width,crop.height);
  const shape=component(crop);if(!shape)return '';
  const mask=normalized(shape);const allowed=red?['hearts','diamonds']:['spades','clubs'];
  const scores=suitTemplates().filter(t=>allowed.includes(t.suit)).map(t=>({...t,score:t.mask.reduce((s,v,i)=>s+(v===mask[i]?0:1),0)/mask.length})).sort((a,b)=>a.score-b.score);
  const best=scores[0],second=scores.find(s=>s.suit!==best.suit);
  return best&&best.score<.25&&second&&second.score-best.score>.025 ? best.suit : '';
}

export async function recognizeCards(source:HTMLCanvasElement, band:[number,number], progress:(s:string)=>void, signal:AbortSignal):Promise<Card[]> {
  let worker:Worker|undefined;
  const stop=()=>{void worker?.terminate();};signal.addEventListener('abort',stop,{once:true});
  try {
    progress('문자 인식 엔진을 준비하고 있어요…');
    const {createWorker,PSM}=await import('tesseract.js');
    worker=await createWorker('eng',1,{workerPath:new URL(`${import.meta.env.BASE_URL}ocr/worker.min.js`,window.location.origin).href,corePath:new URL(`${import.meta.env.BASE_URL}ocr/core`,window.location.origin).href,langPath:new URL(`${import.meta.env.BASE_URL}ocr/lang`,window.location.origin).href,logger:m=>{if(m.status==='recognizing text')progress(`카드 숫자를 읽고 있어요… ${Math.round(m.progress*100)}%`);}});
    if(signal.aborted)throw new DOMException('취소됨','AbortError');
    await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,tessedit_char_whitelist:'A2345678910JQK',preserve_interword_spaces:'1'});
    const y=Math.floor(source.height*band[0]/100),height=Math.max(1,Math.floor(source.height*(band[1]-band[0])/100));
    const crop=canvas(source.width,height);crop.getContext('2d')!.drawImage(source,0,y,source.width,height,0,0,crop.width,crop.height);
    const result=await worker.recognize(crop,{}, {blocks:true,text:true});
    if(signal.aborted)throw new DOMException('취소됨','AbortError');
    const words:Candidate[]=[];
    for(const block of result.data.blocks??[])for(const para of block.paragraphs)for(const line of para.lines)for(const word of line.words){
      const text=word.text.trim();if(RANKS.includes(text as typeof RANKS[number])&&word.bbox.y1-word.bbox.y0>=9&&word.confidence>=15)words.push({text,confidence:word.confidence,bbox:word.bbox});
    }
    if(!words.length)throw new Error('카드 숫자를 찾지 못했어요. 숫자와 바로 아래 문양이 보이도록 인식 범위를 조절하거나 직접 추가해 주세요.');
    // Use the strongest horizontal row, avoiding inverted bottom-corner indices and pip artifacts.
    const rows:Candidate[][]=[];
    for(const word of words.sort((a,b)=>a.bbox.y0-b.bbox.y0)){
      const row=rows.find(r=>Math.abs(r[0].bbox.y0-word.bbox.y0)<Math.max(r[0].bbox.y1-r[0].bbox.y0,word.bbox.y1-word.bbox.y0)*.65);
      if(row)row.push(word);else rows.push([word]);
    }
    const row=rows.sort((a,b)=>b.length-a.length||a[0].bbox.y0-b[0].bbox.y0)[0].sort((a,b)=>a.bbox.x0-b.bbox.x0).slice(0,52);
    return row.map((word,i)=>{
      const b={...word.bbox,y0:word.bbox.y0+y,y1:word.bbox.y1+y};
      const pixels=source.getContext('2d')!.getImageData(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0).data;
      return {id:`ocr-${Date.now()}-${i}`,rank:word.text,suit:guessSuit(source,b,redRatio(pixels)>.35),confidence:word.confidence,box:{x:b.x0/source.width,y:b.y0/source.height,width:(b.x1-b.x0)/source.width,height:(b.y1-b.y0)*2.6/source.height}};
    });
  } finally {signal.removeEventListener('abort',stop);await worker?.terminate().catch(()=>{});}
}
