'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, ImagePlus, RefreshCw, ShieldCheck, ScanLine, Plus, ChevronLeft, ChevronRight, Check, X, Copy, Layers, CircleHelp, LoaderCircle } from 'lucide-react';
import { RANKS, SUITS, SYMBOLS, NAMES, isRed, validCard, cardName, parseCard, readAfter, type Card, type Suit } from './lib/cards';
import { loadPhoto, recognizeCards } from './lib/recognize';

const EXAMPLE:Card[]=[{id:'demo-1',rank:'K',suit:'diamonds'},{id:'demo-2',rank:'9',suit:'spades'},{id:'demo-3',rank:'3',suit:'hearts'},{id:'demo-4',rank:'5',suit:'clubs'},{id:'demo-5',rank:'7',suit:'diamonds'},{id:'demo-6',rank:'A',suit:'spades'}];
function Face({card,small=false}:{card:Pick<Card,'rank'|'suit'>;small?:boolean}){return <div className={`playing-card ${small?'small':''} ${card.suit&&isRed(card.suit)?'red-ink':''}`} aria-label={cardName(card)}><div className="corner">{card.rank||'?'}<span>{card.suit?SYMBOLS[card.suit]:'?'}</span></div><span className="pip">{card.suit?SYMBOLS[card.suit]:'?'}</span><div className="corner bottom">{card.rank||'?'}<span>{card.suit?SYMBOLS[card.suit]:'?'}</span></div></div>}

export default function Home(){
  const [cards,setCards]=useState<Card[]>([]),[photo,setPhoto]=useState(''),[demo,setDemo]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [band,setBand]=useState<[number,number]>([0,60]),[query,setQuery]=useState('9스페이드'),[target,setTarget]=useState('');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[copied,setCopied]=useState(false),[help,setHelp]=useState(false);
  const [bulk,setBulk]=useState('');
  const [activeCard,setActiveCard]=useState(''),[addRank,setAddRank]=useState('A'),[addSuit,setAddSuit]=useState<Suit>('spades');
  const canvasRef=useRef<HTMLCanvasElement|null>(null),fileRef=useRef<HTMLInputElement>(null),cameraRef=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),run=useRef(0);
  const resultRef=useRef<HTMLElement>(null);
  useEffect(()=>()=>{controller.current?.abort();},[]);
  const invalidate=()=>{setConfirmed(false);setTarget('');setCopied(false);};
  function updateCards(next:Card[]){setCards(next);invalidate();setMessage('');}
  async function upload(file?:File){
    if(!file)return;const n=++run.current;controller.current?.abort();setBusy(true);setProgress('사진을 불러오고 있어요…');setMessage('');invalidate();
    try{const canvas=await loadPhoto(file);if(run.current!==n)return;canvasRef.current=canvas;setPhoto(canvas.toDataURL('image/jpeg',.92));setDemo(false);setCards([]);setBand([0,60]);invalidate();}
    catch(e){if(run.current===n)setMessage((e as Error).message);}
    finally{if(run.current===n)setBusy(false);}
  }
  async function analyze(){
    if(!canvasRef.current||busy)return;const n=++run.current;const abort=new AbortController();controller.current=abort;setBusy(true);setMessage('');invalidate();
    try{const found=await recognizeCards(canvasRef.current,band,setProgress,abort.signal);if(run.current!==n)return;setCards(found);setMessage(`${found.length}개의 카드 후보를 찾았어요. 사진과 비교해 빠진 카드와 문양을 확인해 주세요.`);}
    catch(e){if(run.current===n&&!abort.signal.aborted)setMessage((e as Error).message||'사진을 읽지 못했어요. 다시 시도하거나 카드를 직접 추가해 주세요.');}
    finally{if(run.current===n)setBusy(false);}
  }
  function cancel(){run.current++;controller.current?.abort();setBusy(false);setMessage('인식을 취소했어요.');}
  function reset(){run.current++;controller.current?.abort();setBusy(false);setCards([]);setPhoto('');canvasRef.current=null;setDemo(false);setMessage('');invalidate();}
  function example(){reset();setCards(EXAMPLE.map(c=>({...c})));setDemo(true);setQuery('9스페이드');}
  function edit(id:string,field:'rank'|'suit',value:string){updateCards(cards.map(c=>c.id===id?{...c,[field]:value}:c));}
  function move(index:number,direction:number){const copy=[...cards];[copy[index],copy[index+direction]]=[copy[index+direction],copy[index]];updateCards(copy);}
  const matches=(()=>{const parsed=parseCard(query);return parsed?cards.filter(c=>c.rank===parsed.rank&&c.suit===parsed.suit):[];})();
  const selected=cards.find(c=>c.id===target);
  const output=selected&&confirmed?readAfter(cards,target):[];
  const missing=cards.filter(c=>!validCard(c)).length;
  function search(){
    setMessage('');setTarget('');setCopied(false);
    if(!confirmed){setMessage('카드 배열을 먼저 확인해 주세요.');return;}
    if(!parseCard(query)){setMessage('숫자와 문양을 함께 입력해 주세요. 예: 9스페이드, 하트A, ♣10');return;}
    if(!matches.length){setMessage('입력한 카드가 배열에 없어요. 입력값과 카드 배열을 확인해 주세요.');return;}
    if(matches.length===1){setTarget(matches[0].id);setTimeout(()=>resultRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'}),50);}
    else setMessage('같은 카드가 여러 장 있어요. 시작할 위치를 아래에서 선택해 주세요.');
  }
  async function copy(){const text=output.map(x=>x.color).join(' → ');try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setMessage('복사하지 못했어요. 아래 결과를 직접 선택해 복사해 주세요.');}}

  return <div className="app-shell">
    <header className="site-header"><a className="brand" href={import.meta.env.BASE_URL} aria-label="카드 컬러 리더 홈"><span className="brand-icon">♠<i>♦</i></span><span>FLIPSIDE<span className="brand-sub">카드 컬러 리더</span></span></a><div className="header-actions"><span className="private-label"><span/> 기기 안에서 처리</span><button className="icon-button" onClick={()=>setHelp(!help)} aria-label="사용 방법" aria-expanded={help}><CircleHelp size={20}/></button></div></header>
    <main>
      <div className="intro"><div><p className="eyebrow">A DIFFERENT WAY TO READ CARDS</p><h1>다음 카드부터,<br className="mobile-break"/> 반대 색으로.</h1><p className="intro-text">사진 속 기준 카드를 찾고, 오른쪽 끝까지<br className="mobile-break"/> 반대 색을 순서대로 확인하세요.</p></div><div className="rule"><span className="dot black"/> 검정 <ArrowRight size={14}/><span className="dot red"/> 빨강 <span className="rule-divider"/><span className="dot red"/> 빨강 <ArrowRight size={14}/><span className="dot black"/> 검정</div></div>
      {help&&<aside className="help"><strong>이렇게 촬영하면 좋아요</strong><p>카드를 한 줄로 놓고 위에서 똑바로 찍어 주세요. 각 카드의 왼쪽 위 숫자와 바로 아래 문양이 모두 보여야 합니다. 인식 범위에 그 부분이 들어오도록 조절해 주세요.</p><p>현재는 일반 트럼프 카드(A–K, 4가지 문양)의 실험적 인식을 지원합니다. 여러 줄, 심한 기울어짐·겹침, 조커는 지원하지 않습니다. 자동 인식은 카드를 빠뜨릴 수 있으므로 결과를 꼭 확인하세요.</p></aside>}
      <div className="workspace">
        <div className="left-column">
          <section className="panel photo-panel"><div className="panel-heading"><div className="step-title"><span className="step">01</span><h2>카드 사진</h2></div><button className="text-button" onClick={example} disabled={busy}>예제로 체험 <ArrowRight size={14}/></button></div>
            <div className={`photo-stage ${photo?'has-photo':''}`}>
              {photo?<div className="image-wrap"><img src={photo} alt="선택한 카드 배열 사진"/><div className="crop-shade top-shade" style={{height:`${band[0]}%`}}/><div className="crop-shade bottom-shade" style={{height:`${100-band[1]}%`}}/><div className="band-edge" style={{top:`${band[0]}%`,height:`${band[1]-band[0]}%`}}/>{cards.map((c,i)=>c.box&&<button aria-label={`${i+1}번째 카드 ${cardName(c)}`} className={`detected-box ${activeCard===c.id?'active':''}`} key={c.id} style={{left:`${c.box.x*100}%`,top:`${c.box.y*100}%`,width:`${c.box.width*100}%`,height:`${Math.min(c.box.height,1-c.box.y)*100}%`}} onClick={()=>setActiveCard(c.id)}><span>{i+1}</span></button>)}</div>:<div className="stage-content"><span className="stage-label">{demo?'예제 배열 · 실제 사진 아님':'YOUR NEXT PERSPECTIVE'}</span><div className={`card-fan ${demo?'demo-spread':''}`}>{(demo?EXAMPLE:[{rank:'9',suit:'spades'},{rank:'3',suit:'hearts'},{rank:'5',suit:'clubs'}] as Card[]).map((card,i)=><div className="fan-card" key={i} style={{'--i':i} as React.CSSProperties}><Face card={card}/></div>)}</div><p>{demo?'스페이드 9 다음은 어떤 색일까요?':'카드 배열을 한 장에 담아 주세요'}</p><span className="stage-hint">{demo?'아래 카드 배열을 확인하고 결과를 만들어 보세요.':'숫자와 문양이 보이도록, 한 줄로 나란히'}</span></div>}
            </div>
            <div className="photo-controls"><input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
              <div className="button-row"><button className="primary" disabled={busy} onClick={()=>cameraRef.current?.click()}><Camera size={18}/>사진 촬영</button><button className="secondary" disabled={busy} onClick={()=>fileRef.current?.click()}><ImagePlus size={18}/>{photo?'사진 변경':'사진 가져오기'}</button></div>
              {photo&&<div className="crop-controls"><div><strong>인식 범위</strong><span>숫자와 그 아래 문양을 포함해 주세요.</span></div><label>위쪽 <input type="range" min="0" max="90" value={band[0]} disabled={busy} onChange={e=>{setBand([Math.min(+e.target.value,band[1]-10),band[1]]);invalidate();}}/><output>{band[0]}%</output></label><label>아래쪽 <input type="range" min="10" max="100" value={band[1]} disabled={busy} onChange={e=>{setBand([band[0],Math.max(+e.target.value,band[0]+10)]);invalidate();}}/><output>{band[1]}%</output></label><button className="primary recognize" disabled={busy} onClick={analyze}><ScanLine size={18}/>{cards.length?'다시 인식하기':'카드 인식하기'}</button></div>}
              <p className="privacy"><ShieldCheck size={14}/>사진은 서버로 전송하지 않아요. 인식 API 요금이 없어요.</p>
            </div>
          </section>
          <div className="small-note"><span>실험적 자동 인식</span><p>카드가 겹치거나 문양이 작으면 인식이 어려울 수 있어요.<br/>인식한 배열을 사진과 비교해 수정해 주세요.</p></div>
        </div>
        <div className="right-column">
          <section className="panel cards-panel"><div className="panel-heading"><div className="step-title"><span className="step">02</span><h2>카드 배열 확인</h2></div><span className="count">{cards.length}장</span></div><div className="panel-body">
            <div className="section-description"><p>사진의 왼쪽부터 오른쪽 순서예요.</p><span>숫자·문양·순서를 직접 수정할 수 있어요.</span></div>
            {cards.length?<div className="card-list">{cards.map((c,i)=><div className={`card-row ${activeCard===c.id?'focused':''}`} key={c.id} onFocus={()=>setActiveCard(c.id)}><span className="card-index">{String(i+1).padStart(2,'0')}</span><span className={`mini-suit ${c.suit&&isRed(c.suit)?'red-ink':''}`}>{c.suit?SYMBOLS[c.suit]:'?'}</span><select aria-label={`${i+1}번째 카드 숫자`} value={c.rank} onChange={e=>edit(c.id,'rank',e.target.value)} disabled={busy}>{RANKS.map(r=><option key={r}>{r}</option>)}</select><select aria-label={`${i+1}번째 카드 문양`} value={c.suit} onChange={e=>edit(c.id,'suit',e.target.value)} disabled={busy}><option value="">문양 확인</option>{SUITS.map(s=><option value={s} key={s}>{SYMBOLS[s]} {NAMES[s]}</option>)}</select><div className="row-actions"><button className="icon-button" aria-label={`${i+1}번째 카드 앞으로`} disabled={!i||busy} onClick={()=>move(i,-1)}><ChevronLeft size={16}/></button><button className="icon-button" aria-label={`${i+1}번째 카드 뒤로`} disabled={i===cards.length-1||busy} onClick={()=>move(i,1)}><ChevronRight size={16}/></button><button className="icon-button delete" aria-label={`${i+1}번째 카드 삭제`} disabled={busy} onClick={()=>updateCards(cards.filter(v=>v.id!==c.id))}><X size={16}/></button></div></div>)}</div>:<div className="empty-cards"><Layers size={30} strokeWidth={1.2}/><p>아직 카드가 없어요</p><span>사진을 인식하거나 직접 추가해 주세요.</span></div>}
            <div className="add-card"><select aria-label="추가할 카드 숫자" value={addRank} onChange={e=>setAddRank(e.target.value)}>{RANKS.map(r=><option key={r}>{r}</option>)}</select><select aria-label="추가할 카드 문양" value={addSuit} onChange={e=>setAddSuit(e.target.value as Suit)}>{SUITS.map(s=><option key={s} value={s}>{SYMBOLS[s]} {NAMES[s]}</option>)}</select><button className="secondary" disabled={busy||cards.length>=52} onClick={()=>updateCards([...cards,{id:crypto.randomUUID(),rank:addRank,suit:addSuit}])}><Plus size={16}/>추가</button></div>
            <details className="bulk-entry"><summary>카드 배열을 한 번에 입력</summary><label htmlFor="bulk">왼쪽부터 쉼표로 구분해 입력하세요.</label><textarea id="bulk" value={bulk} onChange={e=>setBulk(e.target.value)} placeholder="9하트, K스페이드, 6다이아, 7클로버" rows={3}/><button className="secondary" disabled={busy||!bulk.trim()} onClick={()=>{const items=bulk.split(/[,，;\n]+/).map(x=>x.trim()).filter(Boolean);const parsed=items.map(parseCard);if(items.length>52||!items.length||parsed.some(x=>!x)){setMessage('최대 52장까지 숫자와 문양을 쉼표로 구분해 입력해 주세요.');return;}updateCards(parsed.map(c=>({...c!,id:crypto.randomUUID()})));}}>입력한 배열로 교체</button></details>
            {cards.length>0&&<><p className="check-note">{missing?`문양을 확인해야 하는 카드가 ${missing}장 있어요.`:'누락된 카드가 없는지, 순서와 문양이 맞는지 확인해 주세요.'}</p><button className={`confirm-button ${confirmed?'confirmed':''}`} disabled={!!missing||busy} onClick={()=>{setConfirmed(true);setMessage('');}}><Check size={17}/>{confirmed?'카드 배열 확인 완료':'이 배열이 맞아요'}</button></>}
          </div></section>
          <section className="panel target-panel"><div className="panel-heading"><div className="step-title"><span className="step">03</span><h2>어느 카드 다음부터 읽을까요?</h2></div></div><div className="panel-body"><label className="input-label" htmlFor="target">기준 카드</label><form className="search-row" onSubmit={e=>{e.preventDefault();search();}}><input id="target" value={query} disabled={busy} placeholder="예: 9스페이드" onChange={e=>{setQuery(e.target.value);setTarget('');setCopied(false);setMessage('');}}/><button className="primary" disabled={!confirmed||busy}>찾기 <ArrowRight size={16}/></button></form><p className="input-help">예: 9스페이드, 하트A, ♣10 · 기준 카드는 결과에서 제외돼요.</p>{matches.length>1&&confirmed&&<div className="duplicate-options"><p>같은 카드가 여러 장이에요. 기준 위치를 선택하세요.</p>{matches.map(c=><button className="secondary" key={c.id} onClick={()=>{setTarget(c.id);setMessage('');}}>{cards.indexOf(c)+1}번째 {cardName(c)}</button>)}</div>}</div></section>
        </div>
      </div>
      {busy&&<div className="status" role="status"><LoaderCircle className="spin" size={20}/><span>{progress}</span><button className="text-button" onClick={cancel}>취소</button></div>}
      {message&&<div className="notice" role="status">{message}<button className="icon-button" onClick={()=>setMessage('')} aria-label="안내 닫기"><X size={16}/></button></div>}
      <section className={`result-panel ${selected&&confirmed?'has-result':''}`} ref={resultRef} aria-live="polite"><div className="result-top"><div><p className="eyebrow">THE OTHER SIDE</p><h2>반대 색 읽기</h2></div>{selected&&output.length>0&&<button className="secondary" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'복사 완료':'결과 복사'}</button>}</div>{selected&&confirmed?<><p className="result-description"><strong>{cards.findIndex(c=>c.id===target)+1}번째 {cardName(selected)}</strong> 바로 오른쪽부터 <strong>{output.length}장</strong></p>{output.length?<><div className="color-results">{output.map((item,i)=><div className="result-item" key={item.card.id}><span className="result-order">{String(i+1).padStart(2,'0')}</span><span className={`color-chip ${item.color==='빨강'?'red':'black'}`}>{item.color}</span><span className="source-card">{item.card.suit?SYMBOLS[item.card.suit]:''} {item.card.rank}{i===output.length-1&&<small>마지막 카드</small>}</span></div>)}</div><div className="sequence">{output.map(x=>x.color).join(' → ')}</div></>:<div className="end-state">기준 카드가 맨 오른쪽에 있어요. 다음 카드가 없습니다.</div>}</>:<div className="result-empty"><span className="empty-dots"><i/><i/><i/><i/></span><p>카드 배열을 확인하고 기준 카드를 찾아 주세요.</p><span>결과가 이곳에 왼쪽부터 차례로 표시돼요.</span></div>}</section>
      <footer><span>FLIPSIDE <span className="footer-dot">·</span> 한 장씩, 다른 관점으로.</span><button className="text-button" onClick={reset} disabled={busy||(!photo&&!cards.length)}><RefreshCw size={14}/>처음부터</button></footer>
    </main>
  </div>;
}
