import test from 'node:test';
import assert from 'node:assert/strict';
import { carrierStack, binauralFrequencies } from '../src/audio-utils.js';
import { makeEntry } from '../src/library.js';

test('multiple carriers retain the shared beat and remove duplicate tones',()=>{
  const frequencies=carrierStack({carrier:100,extraCarriers:[150,200,100]});
  assert.deepEqual(frequencies,[100,150,200]);
  for(const frequency of frequencies){const pair=binauralFrequencies(frequency,4);assert.equal(pair.right-pair.left,4);}
});
test('old single-carrier presets still work and stacks are limited to four',()=>{
  assert.deepEqual(carrierStack({carrier:200}),[200]);
  assert.equal(carrierStack({carrier:100,extraCarriers:[150,200,432,852]}).length,4);
  assert.throws(()=>carrierStack({carrier:100,extraCarriers:[NaN]}),RangeError);
});
test('saved stacks remain independent of later edits',()=>{
  const state={config:{carrier:100,extraCarriers:[150,200]}};
  const saved=makeEntry(state,{name:'Stack',notes:'',duration:5},'stack');
  state.config.extraCarriers[0]=432;
  assert.deepEqual(saved.state.config.extraCarriers,[150,200]);
});
