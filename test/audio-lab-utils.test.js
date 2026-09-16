import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultAudioLabConfig,
  normalizeAudioLabConfig,
  pitchRatio,
  effectActive,
  nextPlayhead,
  sourceOffset,
  setRegionBoundary,
  playbackDuration,
  layerIntervals
} from '../src/audio-lab-utils.js';

test('audio lab regions stay inside the clip', () => {
  const config = normalizeAudioLabConfig({
    start: 12,
    end: -2,
    effectStart: -4,
    effectEnd: 99,
    freezeStart: -4,
    freezeEnd: 99
  }, 10);
  assert.equal(config.start, 9.99);
  assert.equal(config.end, 10);
  assert.equal(config.effectStart, 9.99);
  assert.equal(config.effectEnd, 10);
  assert.equal(config.freezeStart, 9.99);
  assert.equal(config.freezeEnd, 10);
});

test('speed advances time independently from pitch key', () => {
  const config = { ...defaultAudioLabConfig(), speed: .5, key: 12 };
  assert.equal(nextPlayhead(2, .2, config), 2.1);
  assert.equal(pitchRatio(config.key), 2);
  config.stretch = true;
  assert.equal(nextPlayhead(2, .2, config), 2.012);
  config.freeze = true;
  config.freezeStart = 1;
  config.freezeEnd = 1.5;
  assert.equal(nextPlayhead(1.49, .5, config), 1);
});

test('reverse maps the whole selected range from end to start', () => {
  const config = { start: 2, end: 8, reverse: true, freeze: false };
  assert.equal(sourceOffset(2, .5, config, 10), 2);
  assert.equal(sourceOffset(3, .5, config, 10), 3);
  assert.equal(sourceOffset(7.5, .5, config, 10), 7.5);
  config.reverse = false;
  assert.equal(sourceOffset(3, .5, config, 10), 3);
});

test('timeline handles keep clip, effect and freeze ranges ordered', () => {
  let config = normalizeAudioLabConfig({ start: 0, end: 10, effectStart: 2, effectEnd: 8, freezeStart: 3, freezeEnd: 5 }, 10);
  config = setRegionBoundary(config, 'effectStart', 7, 10);
  assert.equal(config.effectStart, 7);
  config = setRegionBoundary(config, 'effectEnd', 4, 10);
  assert.equal(config.effectEnd, 7.01);
  config = setRegionBoundary(config, 'freezeStart', 4.5, 10);
  assert.equal(config.freezeStart, 4.5);
  config = setRegionBoundary(config, 'start', 6, 10);
  assert.equal(config.start, 6);
  assert.ok(config.freezeStart >= config.start);
});

test('finite and frozen export durations are calculated separately', () => {
  const config = { start: 2, end: 8, speed: .5, stretch: false, freeze: false, loop: false, exportDuration: 15 };
  assert.equal(playbackDuration(config), 12);
  config.freeze = true;
  assert.equal(playbackDuration(config), 15);
});

test('effect regions and harmony layers are deterministic', () => {
  const config = { effectStart: 2, effectEnd: 4 };
  assert.equal(effectActive(1.99, config), false);
  assert.equal(effectActive(2, config), true);
  assert.equal(effectActive(4, config), true);
  assert.deepEqual(layerIntervals(5), [0, 4, 7, -12, 12]);
  assert.equal(layerIntervals(99).length, 12);
});
