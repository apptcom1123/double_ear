import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPool, snapshotCard, makeTake, MAX_TAKE_MS } from '../src/cards-store.js';

test('draw never duplicates a card or offers a held card; maximum four', () => {
  const catalogue = Array.from({length:15}, (_,i) => ({id:String(i)}));
  const pool = drawPool(catalogue, ['0','1'], () => .3);
  assert.equal(pool.length, 4); assert.equal(new Set(pool.map(c => c.id)).size, 4);
  assert.ok(pool.every(c => !['0','1'].includes(c.id)));
  assert.deepEqual(drawPool(catalogue, catalogue.map(c=>c.id)), []);
});
test('base card snapshots include muted held tracks and per-card EQ without later mutation', () => {
  const state = {handIds:['a','b'], layers:[{id:'a',enabled:true,eq:{bands:[{gain:4}]}},{id:'b',enabled:false},{id:'c',enabled:true}]};
  const card = snapshotCard(' Test ',state); state.layers[0].eq.bands[0].gain=9;
  assert.deepEqual(card.state.layers.map(l=>l.id),['a','b']); assert.equal(card.state.layers[0].eq.bands[0].gain,4);
  assert.equal(card.state.layers[1].enabled,false); assert.equal(card.name,'Test');
});
test('recording limit clips late actions, keeps order and embeds independent slot snapshots', () => {
  const initial={slots:[{card:{name:'Base'}}]};
  const take=makeTake('Take', initial, [{t:90001,type:'noteOn'},{t:20,type:'noteOff'},{t:10,type:'noteOn'},{t:90000,type:'noteOff'}], 100000);
  initial.slots[0].card.name='Changed';
  assert.equal(take.duration,MAX_TAKE_MS); assert.deepEqual(take.events.map(e=>e.t),[10,20,90000]);
  assert.equal(take.initial.slots[0].card.name,'Base');
});
