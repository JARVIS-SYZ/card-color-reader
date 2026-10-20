import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCard,readAfter,RANKS,SUITS,type Card} from '../src/lib/cards.ts';
const cards:Card[]=[{id:'0',rank:'K',suit:'diamonds'},{id:'1',rank:'9',suit:'spades'},{id:'2',rank:'3',suit:'hearts'},{id:'3',rank:'5',suit:'clubs'},{id:'4',rank:'7',suit:'diamonds'}];
test('excludes target and preceding cards; preserves spatial order and last card',()=>{const r=readAfter(cards,'1');assert.deepEqual(r.map(c=>c.color),['검정','빨강','검정']);assert.deepEqual(r.map(c=>c.position),[3,4,5]);assert.equal(r.at(-1)?.card.rank,'7');});
test('rightmost target produces no result',()=>assert.deepEqual(readAfter(cards,'4'),[]));
test('duplicate targets are distinguished by instance id',()=>assert.equal(readAfter([...cards,{id:'5',rank:'9',suit:'spades'}],'5').length,0));
test('missing target and unresolved suit are rejected',()=>{assert.throws(()=>readAfter(cards,'missing'));assert.throws(()=>readAfter([...cards,{id:'5',rank:'A',suit:''}],'1'));});
test('parses Korean, symbols and common English notation',()=>{for(const q of ['9스페이드','스페이드 9','♠9','9S'])assert.deepEqual(parseCard(q),{rank:'9',suit:'spades'});assert.deepEqual(parseCard('클로버10'),{rank:'10',suit:'clubs'});assert.equal(parseCard('119스페이드'),null);assert.equal(parseCard('9'),null);});
test('all 52 cards invert suit color consistently',()=>{for(const rank of RANKS)for(const suit of SUITS){const r=readAfter([cards[0],{id:'a',rank,suit}],'0');assert.equal(r[0].color,['hearts','diamonds'].includes(suit)?'검정':'빨강');}});
test('user photo: heart 9 to the last spade 8',()=>{
 const tail:Card[]=[['9','hearts'],['K','spades'],['6','diamonds'],['7','clubs'],['5','diamonds'],['A','clubs'],['3','spades'],['K','diamonds'],['Q','diamonds'],['8','spades']].map(([rank,suit],i)=>({id:String(i),rank,suit:suit as Card['suit']}));
 const result=readAfter(tail,'0');assert.deepEqual(result.map(x=>x.color),['빨강','검정','빨강','검정','빨강','빨강','검정','검정','빨강']);assert.equal(result.at(-1)?.card.rank,'8');
});
