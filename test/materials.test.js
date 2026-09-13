import test from 'node:test';
import assert from 'node:assert/strict';
import { materials } from '../src/studio-engine.js';

test('new texture catalogue has unique searchable cards', () => {
  const ids = ['cyber-dystopia','glitch-grains','vhs-lofi','geological','subatomic','frog-choir','mushroom-signals','bianzhong'];
  const cards = ids.map(id => materials.find(item => item.id === id));
  assert.ok(cards.every(Boolean));
  assert.equal(new Set(materials.map(item => item.id)).size, materials.length);
  assert.ok(cards.every(card => card.type.startsWith('texture-') && card.name && card.group && card.tags));
});

test('organic and bell cards expose the requested fixed variants', () => {
  assert.equal(materials.find(item => item.id === 'frog-choir').variants.length, 4);
  assert.equal(materials.find(item => item.id === 'mushroom-signals').variants.length, 5);
  assert.equal(materials.find(item => item.id === 'bianzhong').variants.length, 4);
});
