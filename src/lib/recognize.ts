import type { Card } from './cards';
import { readCorners } from './detect';
import { ocrWorker, readRanks } from './ocr';
import type { Worker } from 'tesseract.js';

const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;};

export async function loadPhoto(file: File): Promise<HTMLCanvasElement> {
  if (file.size > 25*1024*1024) throw new Error('25MB 이하의 사진을 선택해 주세요.');
  const url=URL.createObjectURL(file);
  try {
    const img=new Image();img.src=url;await img.decode();
    if (!img.width || !img.height) throw new Error();
    const scale=Math.min(1,4096/Math.max(img.width,img.height));
    const c=canvas(img.width*scale,img.height*scale);c.getContext('2d')!.drawImage(img,0,0,c.width,c.height);return c;
  } catch { throw new Error('사진을 열 수 없어요. JPG, PNG 또는 WebP 사진을 사용해 주세요.'); }
  finally {URL.revokeObjectURL(url);}
}

function scaled(source:HTMLCanvasElement,maxSide:number):HTMLCanvasElement {
  const s=Math.min(1,maxSide/Math.max(source.width,source.height));if(s===1)return source;
  const c=canvas(source.width*s,source.height*s),ctx=c.getContext('2d')!;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,c.width,c.height);return c;
}
// Detection is tuned for rank glyphs ~30-40px tall. Start at a modest size and, when the
// glyphs come out small (cards far away), retry at higher resolution within a memory budget.
const GLYPH=34,MAX_PIXELS=9_000_000;
function detectAtBestScale(source:HTMLCanvasElement) {
  const full=Math.min(Math.max(source.width,source.height),Math.sqrt(MAX_PIXELS*Math.max(source.width,source.height)/Math.min(source.width,source.height)));
  let used=scaled(source,Math.min(full,2400)),corners=readCorners(used);
  const H=corners[0]?.H??0,side=Math.max(used.width,used.height);
  if((!H||H<GLYPH*.85)&&full>side*1.1){
    const next=scaled(source,Math.min(full,H?side*GLYPH/H:full)),more=readCorners(next);
    if(more.length>=corners.length){used=next;corners=more;}
  }
  return {corners,used};
}

const aborted=()=>new DOMException('취소됨','AbortError');
const tick=()=>new Promise(r=>setTimeout(r,0));

// Corner indices are located by shape (rank glyph above a suit pip, along the arc of card tops);
// colour and suit come from the pip, and OCR is only used for ranks the glyph's holes leave open.
export async function recognizeCards(source:HTMLCanvasElement, progress:(s:string)=>void, signal:AbortSignal):Promise<Card[]> {
  let worker:Worker|undefined;
  const stop=()=>{void worker?.terminate();};signal.addEventListener('abort',stop,{once:true});
  try {
    progress('카드 모서리를 찾고 있어요…');await tick();
    const {corners,used}=detectAtBestScale(source);
    if(signal.aborted)throw aborted();
    if(!corners.length)throw new Error('카드 모서리를 찾지 못했어요. 카드 왼쪽 위 숫자와 문양이 보이도록 다시 찍거나 직접 추가해 주세요.');
    progress(`카드 ${corners.length}장의 숫자를 읽고 있어요…`);
    worker=await ocrWorker(progress);
    if(signal.aborted)throw aborted();
    const ranks=await readRanks(worker,corners.slice(0,52));
    if(signal.aborted)throw aborted();
    return corners.slice(0,52).map((c,i)=>({id:`ocr-${Date.now()}-${i}`,rank:ranks[i],suit:c.suit,box:{x:c.box.x0/used.width,y:c.box.y0/used.height,width:(c.box.x1-c.box.x0+1)/used.width,height:(c.box.y1-c.box.y0+1+c.H)/used.height}}));
  } finally {signal.removeEventListener('abort',stop);await worker?.terminate().catch(()=>{});}
}
