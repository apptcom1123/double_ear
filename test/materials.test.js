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

test('each new texture family exposes at least five variants', () => {
  const ids = ['cyber-dystopia','glitch-grains','vhs-lofi','geological','subatomic','frog-choir','mushroom-signals','bianzhong'];
  assert.ok(ids.every(id => materials.find(item => item.id === id).variants.length >= 5));
});
