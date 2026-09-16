import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultAudioLabConfig,
  normalizeAudioLabConfig,
  pitchRatio,
  effectActive,
  nextPlayhead,
  layerIntervals
} from '../src/audio-lab-utils.js';

test('audio lab regions stay inside the clip', () => {
  const config = normalizeAudioLabConfig({
    start: 12,
    end: -2,
    effectStart: -4,
    effectEnd: 99,
    freezeAt: 99
  }, 10);
  assert.equal(config.start, 9.99);
  assert.equal(config.end, 10);
  assert.equal(config.effectStart, 9.99);
  assert.equal(config.effectEnd, 10);
  assert.equal(config.freezeAt, 10);
});

test('speed advances time independently from pitch key', () => {
  const config = { ...defaultAudioLabConfig(), speed: .5, key: 12 };
  assert.equal(nextPlayhead(2, .2, config), 2.1);
  assert.equal(pitchRatio(config.key), 2);
  config.stretch = true;
  assert.equal(nextPlayhead(2, .2, config), 2.012);
  config.freeze = true;
  config.freezeAt = 1.25;
  assert.equal(nextPlayhead(2, .2, config), 1.25);
});

test('effect regions and harmony layers are deterministic', () => {
  const config = { effectStart: 2, effectEnd: 4 };
  assert.equal(effectActive(1.99, config), false);
  assert.equal(effectActive(2, config), true);
  assert.equal(effectActive(4, config), true);
  assert.deepEqual(layerIntervals(5), [0, 4, 7, -12, 12]);
  assert.equal(layerIntervals(99).length, 12);
});
