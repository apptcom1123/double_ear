import test from 'node:test';
import assert from 'node:assert/strict';
import { materials, dopplerRatios, trafficOffsets } from '../src/studio-engine.js';

test('new texture catalogue has unique searchable cards', () => {
  const ids = ['cyber-dystopia','glitch-grains','vhs-lofi','geological','subatomic','frog-choir','mushroom-signals','bianzhong','traffic-stage'];
  const cards = ids.map(id => materials.find(item => item.id === id));
  assert.ok(cards.every(Boolean));
  assert.equal(new Set(materials.map(item => item.id)).size, materials.length);
  assert.ok(cards.every(card => card.type.startsWith('texture-') && card.name && card.group && card.tags));
});

test('each new texture family exposes at least five variants', () => {
  const ids = ['cyber-dystopia','glitch-grains','vhs-lofi','geological','subatomic','frog-choir','mushroom-signals','bianzhong','traffic-stage'];
  assert.ok(ids.every(id => materials.find(item => item.id === id).variants.length >= 5));
});

test('traffic stage spreads a bounded count through each cycle and applies physical Doppler direction', () => {
  let value = 0;
  const offsets = trafficOffsets(5, 10, () => (value += .17) % 1);
  assert.equal(offsets.length, 5);
  assert.ok(offsets.every(offset => offset >= 0 && offset < 8.2));
  assert.deepEqual(offsets, [...offsets].sort((a,b) => a-b));
  const ratio = dopplerRatios(60);
  assert.ok(ratio.approach > 1);
  assert.ok(ratio.recede < 1);
});

test('fashion, bar, club and dancefloor each contain five cards', () => {
  for (const group of ['FASHION','BAR','CLUB','DANCE']) assert.equal(materials.filter(item => item.group === group).length, 5);
});
