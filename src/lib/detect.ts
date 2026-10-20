// Finds card corner indices (rank glyph with a small suit pip directly below it) in a photo.
export type Rect = {x0:number;y0:number;x1:number;y1:number};
export type Blob = Rect & {area:number;red:number;pts:Int32Array};
export type Index = {rank:Blob[];pip:Blob;red:boolean};

const w_=(r:Rect)=>r.x1-r.x0+1,h_=(r:Rect)=>r.y1-r.y0+1;

// Ink = print darker than its surroundings (black) or clearly red. Comparing with the local
// mean keeps thin anti-aliased strokes while ignoring soft shadows between cards.
function inkMap(pix:Uint8ClampedArray,w:number,h:number):Uint8Array {
  // integer luminance + Uint32 integral image keeps memory low on phones (255 x 16M px < 2^32)
  const lum=new Uint8Array(w*h);for(let i=0;i<w*h;i++)lum[i]=(pix[i*4]*77+pix[i*4+1]*151+pix[i*4+2]*28)>>8;
  const sum=new Uint32Array((w+1)*(h+1));
  for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=lum[y*w+x];sum[(y+1)*(w+1)+x+1]=sum[y*(w+1)+x+1]+row;}}
  const R=Math.max(6,Math.round(Math.max(w,h)/160)),kind=new Uint8Array(w*h);
  for(let y=0;y<h;y++){const ya=Math.max(0,y-R),yb=Math.min(h,y+R+1);for(let x=0;x<w;x++){
    const i=y*w+x,r=pix[i*4],g=pix[i*4+1],b=pix[i*4+2];
    const gb=Math.max(g,b);if(r-gb>28&&r>gb*1.6+8){kind[i]=2;continue;}
    const xa=Math.max(0,x-R),xb=Math.min(w,x+R+1);
    const mean=(sum[yb*(w+1)+xb]-sum[ya*(w+1)+xb]-sum[yb*(w+1)+xa]+sum[ya*(w+1)+xa])/((yb-ya)*(xb-xa));
    if(lum[i]<mean*.68&&lum[i]<165&&Math.max(r,g,b)-Math.min(r,g,b)<60)kind[i]=1;
  }}
  return kind;
}

export function inkKinds(c:HTMLCanvasElement){const {width:w,height:h}=c;return inkMap(c.getContext('2d')!.getImageData(0,0,w,h).data,w,h);}
export function blobs(c:HTMLCanvasElement,minArea=12,kind=inkKinds(c)):Blob[] {
  const {width:w,height:h}=c;
  const seen=new Uint8Array(w*h),out:Blob[]=[],stack=new Int32Array(w*h);
  for(let i=0;i<w*h;i++){
    if(seen[i]||!kind[i])continue;
    let sp=0,n=0,red=0,x0=w,y0=h,x1=0,y1=0;const pts:number[]=[];stack[sp++]=i;seen[i]=1;
    while(sp){const p=stack[--sp];pts.push(p);n++;if(kind[p]===2)red++;const x=p%w,y=(p-x)/w;
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const q=ny*w+nx;if(!seen[q]&&kind[q]){seen[q]=1;stack[sp++]=q;}}
    }
    if(n>=minArea)out.push({x0,y0,x1,y1,area:n,red:red/n,pts:Int32Array.from(pts)});
  }
  return out;
}

// A corner index is a rank glyph (or "10" pair) sitting just above a smaller pip of the same color.
export function findIndices(all:Blob[]):Index[] {
  const cand=all.filter(b=>h_(b)>=8&&h_(b)<=200&&w_(b)<=h_(b)*1.6);
  const found:Index[]=[];
  for(const pip of cand){
    const ph=h_(pip),pw=w_(pip);if(pw<ph*.6||pw>ph*1.5)continue;
    const fill=pip.area/(pw*ph);if(fill<.35)continue;
    const pc=(pip.x0+pip.x1)/2,isRed=pip.red>.5;
    // glyphs directly above the pip, same color, taller than the pip
    const above=cand.filter(g=>g!==pip&&(g.red>.5)===isRed&&g.y1<pip.y0+ph*.15&&pip.y0-g.y1<ph*.8&&h_(g)>=ph*1.05&&h_(g)<=ph*2.6);
    if(!above.length)continue;
    const main=above.filter(g=>Math.abs((g.x0+g.x1)/2-pc)<Math.max(w_(g),pw)*.75).sort((a,b)=>(pip.y0-a.y1)-(pip.y0-b.y1))[0];
    if(!main)continue;
    // "10": a second glyph of the same height right beside the first
    const mate=above.find(g=>g!==main&&Math.abs(g.y0-main.y0)<h_(main)*.2&&Math.abs(h_(g)-h_(main))<h_(main)*.2&&(Math.abs(g.x0-main.x1)<h_(main)*.35||Math.abs(main.x0-g.x1)<h_(main)*.35));
    const rank=mate?[main,mate].sort((a,b)=>a.x0-b.x0):[main];
    found.push({rank,pip,red:isRed});
  }
  // Keep only indices with the dominant glyph size (removes big centre pips and art).
  if(!found.length)return found;
  const sizes=found.map(f=>h_(f.rank[0])).sort((a,b)=>a-b),med=sizes[Math.floor(sizes.length/2)];
  return found.filter(f=>Math.abs(h_(f.rank[0])-med)<med*.3).sort((a,b)=>a.rank[0].x0-b.rank[0].x0);
}

// Least-squares quadratic y = a + b x + c x^2, refit after dropping outliers.
function fitArc(pts:[number,number][]) {
  let use=pts,coef=[0,0,0];
  for(let iter=0;iter<3;iter++){
    const S=Array.from({length:3},()=>[0,0,0,0]);
    for(const [x,y] of use){const v=[1,x,x*x];for(let i=0;i<3;i++){for(let j=0;j<3;j++)S[i][j]+=v[i]*v[j];S[i][3]+=v[i]*y;}}
    for(let i=0;i<3;i++){const p=S[i][i]||1e-9;for(let j=i;j<4;j++)S[i][j]/=p;for(let k=0;k<3;k++)if(k!==i){const f=S[k][i];for(let j=i;j<4;j++)S[k][j]-=f*S[i][j];}}
    coef=S.map(r=>r[3]);
    const res=pts.map(([x,y])=>Math.abs(y-(coef[0]+coef[1]*x+coef[2]*x*x)));
    const sorted=[...res].sort((a,b)=>a-b),cut=Math.max(8,sorted[Math.floor(sorted.length*.8)]*2);
    use=pts.filter((_,i)=>res[i]<=cut);
  }
  return (x:number)=>coef[0]+coef[1]*x+coef[2]*x*x;
}

export type Corner = {rank:Blob[];red:boolean|null};
// Anchors (glyph + separate pip) give glyph size and the arc of card tops; then every
// glyph-sized blob on that arc is accepted even when its pip touches neighbouring print.
export function findCorners(all:Blob[]):{corners:Corner[];H:number} {
  const anchors=findIndices(all);
  if(anchors.length<2)return {corners:anchors.map(a=>({rank:a.rank,red:a.red})),H:anchors[0]?h_(anchors[0].rank[0]):0};
  const H=[...anchors.map(a=>h_(a.rank[0]))].sort((a,b)=>a-b)[Math.floor(anchors.length/2)];
  const arc=fitArc(anchors.map(a=>[(a.rank[0].x0+a.rank[0].x1)/2,a.rank[0].y0]));
  const onArc=(b:Rect)=>Math.abs(b.y0-arc((b.x0+b.x1)/2))<H*.6;
  const isGlyph=(b:Rect)=>h_(b)>=H*.8&&h_(b)<=H*1.2&&w_(b)<=h_(b)*.9;
  // Thin strokes can split a glyph (the bar of a "7"); rejoin stacked fragments.
  const pieces=all.filter(b=>h_(b)<H*.8&&w_(b)<H*.9&&onArc(b));
  const joined:Blob[]=[];
  for(const top of pieces)for(const low of pieces){
    if(low===top||low.y0<=top.y1||low.y0-top.y1>3||low.x0>top.x1||low.x1<top.x0)continue;
    const m={x0:Math.min(top.x0,low.x0),y0:top.y0,x1:Math.max(top.x1,low.x1),y1:Math.max(top.y1,low.y1),area:top.area+low.area,red:(top.red*top.area+low.red*low.area)/(top.area+low.area),pts:Int32Array.from([...top.pts,...low.pts])};
    if(isGlyph(m))joined.push(m);
  }
  const anchorGlyphs=new Set(anchors.flatMap(a=>a.rank));
  const glyphs=[...all.filter(b=>anchorGlyphs.has(b)||isGlyph(b)&&onArc(b)),...joined].sort((a,b)=>a.x0-b.x0);
  const corners:Corner[]=[];
  for(const g of glyphs){
    const last=corners.at(-1)?.rank;
    // overlapping duplicates (an anchor glyph also rebuilt from fragments)
    if(corners.some(c=>c.rank.some(r=>g.x0<=r.x1&&g.x1>=r.x0&&g.y0<=r.y1&&g.y1>=r.y0)))continue;
    // "10": a narrow "1" immediately left of the "0", top and bottom aligned
    if(last&&last.length===1&&w_(last[0])<H*.35&&g.x0-last[0].x1<H*.35&&g.x0>last[0].x1-2&&Math.abs(g.y0-last[0].y0)<H*.15&&Math.abs(g.y1-last[0].y1)<H*.15){last.push(g);continue;}
    corners.push({rank:[g],red:null});
  }
  // A lone narrow sliver (card edge, stray stroke) is not a rank: "1" only occurs inside "10".
  return {corners:corners.filter(c=>c.rank.length===2||w_(c.rank[0])>=H*.3),H};
}

export type Suit='spades'|'hearts'|'clubs'|'diamonds';
export type CornerRead={glyph:HTMLCanvasElement;parts:number;box:Rect;H:number;red:boolean;suit:Suit|'';feat:number[]};

// Row-width profile of the suit pip found just under the rank glyph (12 rows, 0..1 of max width).
function pipProfile(kind:Uint8Array,w:number,box:Rect,H:number,want:number):number[]|null {
  const cx=(box.x0+box.x1)/2,x0=Math.round(cx-H*.55),x1=Math.round(cx+H*.55),y0=box.y1+1,y1=Math.round(box.y1+H*1.05);
  const rw=x1-x0+1,rh=y1-y0+1,m=new Uint8Array(rw*rh);
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const X=x0+x,Y=y0+y;if(X>=0&&X<w&&kind[Y*w+X]===want)m[y*rw+x]=1;}
  // component closest to the top centre of the crop
  const seen=new Uint8Array(rw*rh);let best:number[]|null=null,bestScore=Infinity;
  for(let i=0;i<rw*rh;i++){if(!m[i]||seen[i])continue;const st=[i],pts:number[]=[];seen[i]=1;
    while(st.length){const p=st.pop()!;pts.push(p);const x=p%rw,y=(p-x)/rw;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,q=ny*rw+nx;if(nx>=0&&ny>=0&&nx<rw&&ny<rh&&m[q]&&!seen[q]){seen[q]=1;st.push(q);}}}
    if(pts.length<H*H*.08)continue;
    let sx=0,sy=0;for(const p of pts){sx+=p%rw;sy+=Math.floor(p/rw);}const score=Math.abs(sx/pts.length-rw/2)+sy/pts.length*.5;
    if(score<bestScore){bestScore=score;best=pts;}}
  if(!best)return null;
  let bx0=rw,by0=rh,bx1=0,by1=0;for(const p of best){const x=p%rw,y=(p-x)/rw;bx0=Math.min(bx0,x);bx1=Math.max(bx1,x);by0=Math.min(by0,y);by1=Math.max(by1,y);}
  const rows=12,prof=new Array(rows).fill(0),bh=by1-by0+1;
  const minX=new Array(rows).fill(Infinity),maxX=new Array(rows).fill(-1);
  for(const p of best){const x=p%rw,y=(p-x)/rw,r=Math.min(rows-1,Math.floor((y-by0)/bh*rows));minX[r]=Math.min(minX[r],x);maxX[r]=Math.max(maxX[r],x);}
  for(let r=0;r<rows;r++)prof[r]=maxX[r]<0?0:maxX[r]-minX[r]+1;
  const mx=Math.max(...prof);const out=prof.map(v=>+(v/mx).toFixed(2));
  // notch: is the top-centre column empty in the top rows (heart lobes)?
  let top=0,topC=0;for(const p of best){const x=p%rw,y=(p-x)/rw;if(y-by0<bh*.18){top++;if(Math.abs(x-(bx0+bx1)/2)<(bx1-bx0)*.12)topC++;}}
  out.push(+(topC/Math.max(1,top)).toFixed(2),+((bx1-bx0+1)/bh).toFixed(2),+(best.length/((bx1-bx0+1)*bh)).toFixed(2));
  return out;
}

// Hearts are wide right at the top (two lobes), diamonds come to a point. Spades widen
// steadily from the tip; a club's top lobe stays narrow until the side lobes start.
function suitOf(f:number[],red:boolean):Suit|'' {
  if(f.length<12)return '';
  return red?(f[1]>.75?'hearts':'diamonds'):(f[3]-f[1]<.15?'clubs':'spades');
}

export function readCorners(c:HTMLCanvasElement):CornerRead[] {
  const kind=inkKinds(c),{corners,H}=findCorners(blobs(c,12,kind));
  return corners.map(cn=>{
    const box={x0:Math.min(...cn.rank.map(b=>b.x0)),y0:Math.min(...cn.rank.map(b=>b.y0)),x1:Math.max(...cn.rank.map(b=>b.x1)),y1:Math.max(...cn.rank.map(b=>b.y1))};
    const red=cn.rank.reduce((s,b)=>s+b.red*b.area,0)/cn.rank.reduce((s,b)=>s+b.area,0)>.5;
    // clean black-on-white glyph for OCR, padded
    const pad=Math.round(H*.4),g=document.createElement('canvas');g.width=w_(box)+pad*2;g.height=h_(box)+pad*2;
    const ctx=g.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,g.width,g.height);ctx.fillStyle='#000';
    for(const b of cn.rank)for(const p of b.pts)ctx.fillRect(p%c.width-box.x0+pad,Math.floor(p/c.width)-box.y0+pad,1,1);
    const feat=pipProfile(kind,c.width,box,H,red?2:1)??[];
    return {glyph:g,parts:cn.rank.length,box,H,red,suit:suitOf(feat,red),feat};
  });
}
