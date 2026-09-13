import test from "node:test";
import assert from "node:assert/strict";
import { beatInterval, binauralFrequencies, clamp, equalPowerPan, seededRandom } from "../src/audio-utils.js";

test("binaural frequencies are symmetric around carrier", () => {
  assert.deepEqual(binauralFrequencies(200, 4), { left: 198, right: 202 });
  assert.deepEqual(binauralFrequencies(432, 7.83), { left: 428.085, right: 435.915 });
});

test("invalid binaural values are rejected", () => {
  assert.throws(() => binauralFrequencies(0, 4), RangeError);
  assert.throws(() => binauralFrequencies(200, -1), RangeError);
});

test("seeded random is deterministic", () => {
  const first = seededRandom(783);
  const second = seededRandom(783);
  assert.deepEqual(Array.from({ length: 8 }, first), Array.from({ length: 8 }, second));
});

test("beat interval and clamping are correct", () => {
  assert.equal(beatInterval(120), 0.5);
  assert.equal(beatInterval(80, 2), 0.375);
  assert.equal(clamp(12, 0, 10), 10);
});

test("equal-power pan keeps edge channels isolated", () => {
  assert.ok(Math.abs(equalPowerPan(-1).right) < 1e-12);
  assert.ok(Math.abs(equalPowerPan(1).left) < 1e-12);
});
