import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPUTER_KEY_OFFSETS } from '../src/performance-workstation.js';

test('computer keyboard follows one piano octave layout', () => {
  assert.deepEqual(
    ['s','d','f','g','h','j','k','l'].map(key => COMPUTER_KEY_OFFSETS[key]),
    [0,2,4,5,7,9,11,12]
  );
  assert.deepEqual(
    ['e','r','y','u','i'].map(key => COMPUTER_KEY_OFFSETS[key]),
    [1,3,6,8,10]
  );
  assert.equal(COMPUTER_KEY_OFFSETS.w, undefined);
});
