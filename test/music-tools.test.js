import test from 'node:test';
import assert from 'node:assert/strict';
import { isScaleNote, scaleChord, degreeMidi, DRUMS, KITS, DRUM_FX, INSTRUMENTS, FX } from '../src/music-tools.js';

test('scale lock filters pitch classes and builds diatonic chords', () => {
  assert.equal(isScaleNote(61, 0, 'major'), false);
  assert.equal(isScaleNote(64, 0, 'major'), true);
  assert.deepEqual(scaleChord(60, 0, 'major', 3), [60,64,67]);
  assert.deepEqual(scaleChord(62, 0, 'major', 4), [62,65,69,72]);
  assert.equal(degreeMidi(3, 0, 'major', 4), 55);
});

test('workstation exposes expanded instruments, drums and effects', () => {
  assert.equal(DRUMS.length, 16);
  assert.ok(Object.keys(KITS).length >= 6);
  assert.ok(Object.keys(DRUM_FX).length >= 6);
  assert.ok(Object.keys(INSTRUMENTS).length >= 10);
  assert.equal(Object.keys(FX).length, 6);
});
