import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEntry, nextIndex } from '../src/library.js';
import { defaultEQ, frequencyX, xFrequency } from '../src/equalizer.js';

test('saved configuration is isolated from subsequent live mixing and includes EQ',()=>{
  const state={config:{beat:4},eq:defaultEQ(),layers:[{id:'radio',enabled:true,level:.2}],radioUrl:'/assets/radio/test.mp3',masterVolume:.2};
  const entry=makeEntry(state,{name:' My mix ',notes:' calm ',duration:5},'test');
  state.eq.bands[0].gain=8;state.layers[0].level=.8;
  assert.equal(entry.state.eq.bands[0].gain,0);
  assert.equal(entry.state.layers[0].level,.2);
  assert.equal(entry.state.radioUrl,state.radioUrl);
  assert.equal(entry.notes,'calm');assert.equal(entry.duration,300);
});
test('repeat controls distinguish automatic advance and manual next',()=>{
  assert.equal(nextIndex(1,3,'one'),1);
  assert.equal(nextIndex(1,3,'one',false),2);
  assert.equal(nextIndex(2,3,'all'),0);
  assert.equal(nextIndex(2,3,'off'),-1);
  assert.equal(nextIndex(0,0,'all'),-1);
});
test('EQ logarithmic frequency mapping round trips and clamps pointer edges',()=>{
  for(const f of [20,80,1000,12000,20000])assert.ok(Math.abs(xFrequency(frequencyX(f))-f)<1e-7);
  assert.equal(xFrequency(-1),20);assert.equal(xFrequency(2),20000);
});
