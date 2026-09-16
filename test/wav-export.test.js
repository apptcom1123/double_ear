import test from 'node:test';
import assert from 'node:assert/strict';
import { audioBufferToWav } from '../src/wav-export.js';

test('WAV export writes a valid stereo PCM header and samples', () => {
  const channels = [new Float32Array([0, 1, -1]), new Float32Array([.5, -.5, 0])];
  const wav = audioBufferToWav({ numberOfChannels: 2, length: 3, sampleRate: 48000, getChannelData: index => channels[index] });
  const view = new DataView(wav);
  const text = (offset, length) => String.fromCharCode(...new Uint8Array(wav, offset, length));
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(text(36, 4), 'data');
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint32(40, true), 12);
  assert.equal(view.getInt16(48, true), 32767);
  assert.equal(view.getInt16(50, true), -16384);
});
