export const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'] as const;
export const SUITS = ['spades','hearts','clubs','diamonds'] as const;
export type Suit = typeof SUITS[number];
export type Card = { id: string; rank: string; suit: Suit | ''; confidence?: number; box?: {x:number;y:number;width:number;height:number} };
export const SYMBOLS: Record<Suit,string> = { spades:'♠', hearts:'♥', clubs:'♣', diamonds:'♦' };
export const NAMES: Record<Suit,string> = { spades:'스페이드', hearts:'하트', clubs:'클로버', diamonds:'다이아' };
export const isRed = (suit: Suit) => suit === 'hearts' || suit === 'diamonds';
export const validCard = (c: Card) => RANKS.includes(c.rank as typeof RANKS[number]) && SUITS.includes(c.suit as Suit);
export const cardName = (c: Pick<Card,'rank'|'suit'>) => `${c.suit ? NAMES[c.suit] : '문양 미확인'} ${c.rank || '?'}`;
export function parseCard(text: string): {rank:string;suit:Suit} | null {
  let value = text.trim().toUpperCase().replace(/\s+/g, '');
  const aliases: [Suit, string[]][] = [ ['spades',['스페이드','스페이듀','스페','♠','SPADES','SPADE','S']], ['hearts',['하트','♥','HEARTS','HEART','H']], ['clubs',['클로버','클럽','♣','CLUBS','CLUB','C']], ['diamonds',['다이아몬드','다이아','♦','DIAMONDS','DIAMOND','D']] ];
  for (const [suit, names] of aliases) for (const name of names) {
    if (!value.includes(name)) continue;
    const rank=value.replace(name,'').replace('에이스','A').replace('킹','K').replace('퀸','Q').replace('잭','J');
    if (RANKS.includes(rank as typeof RANKS[number])) return {rank,suit};
  }
  return null;
}
export function readAfter(cards: Card[], id: string) {
  const index=cards.findIndex(c=>c.id===id);
  if(index<0) throw new Error('기준 카드를 찾지 못했어요.');
  if(cards.some(c=>!validCard(c))) throw new Error('모든 카드의 숫자와 문양을 확인해 주세요.');
  return cards.slice(index+1).map((card,i)=>({card,position:index+i+2,color:isRed(card.suit as Suit)?'검정':'빨강'}));
}
