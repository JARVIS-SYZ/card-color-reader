import test from 'node:test';
import assert from 'node:assert/strict';
import {rankByShape,type Shape} from '../src/lib/ocr.ts';
// Hole measurements taken from glyphs in a real fanned-deck photo.
const shape=(holes:{cy:number;area:number}[],bottom:number):Shape=>({mask:new Uint8Array(0),w:20,h:32,holes,bottom,bottomLeft:0});
test('Q', () => assert.equal(rankByShape(shape([{cy: .38, area: .247}, {cy: .8, area: .044}], .8)), 'Q'));
test('8', () => assert.equal(rankByShape(shape([{cy: .23, area: .158}, {cy: .68, area: .236}], .77)), '8'));
test('9', () => assert.equal(rankByShape(shape([{cy: .32, area: .268}], .74)), '9'));
test('6', () => assert.equal(rankByShape(shape([{cy: .63, area: .297}], .75)), '6'));
test('A', () => assert.equal(rankByShape(shape([{cy: .47, area: .089}], 1)), 'A'));
test('4', () => assert.equal(rankByShape(shape([{cy: .51, area: .094}], .38)), '4'));
test('no holes', () => assert.equal(rankByShape(shape([], .9)), null));
