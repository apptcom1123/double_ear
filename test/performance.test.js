import test from 'node:test';
import assert from 'node:assert/strict';
import { Performance } from '../src/performance.js';

function clockedDesk() {
  const desk = new Performance(() => {});
  desk.host.context = { currentTime: 10 };
  desk.ready = async () => {};
  desk.preload = async () => {};
  desk.syncSlots = async () => {};
  desk.syncMasterUI = () => {};
  return desk;
}

test('recording auto-stops at 90 seconds with a bounded event timeline', async () => {
  const desk = clockedDesk();
  try {
    await desk.record();
    desk.host.context.currentTime = 11;
    desk.capture({ type: 'slot', index: 0, patch: { level: .3 } });
    desk.host.context.currentTime = 101;
    desk.tick();
    assert.equal(desk.active, false);
    assert.equal(desk.recording, false);
    assert.equal(desk.draft.duration, 90000);
    assert.equal(desk.draft.events[0].t, 1000);
    assert.equal(desk.notes.size, 0);
  } finally { desk.stop(); }
});

test('stopping during preload cannot restart recording after the request resolves', async () => {
  const desk = clockedDesk();
  let complete, entered;
  const loading = new Promise(resolve => { entered = resolve; });
  desk.preload = () => { entered(); return new Promise(resolve => { complete = resolve; }); };
  const pending = desk.record();
  await loading;
  desk.stop(); complete(); await pending;
  assert.equal(desk.active, false);
  assert.equal(!!desk.recording, false);
  assert.equal(desk.timer, undefined);
});

test('replay restores initial slots then applies timestamped automation and stops', async () => {
  const desk = clockedDesk();
  const initial = { slots: structuredClone(desk.slots), master: .2, octave: 4 };
  try {
    await desk.replay({ name: 'Clock test', initial, duration: 300,
      events: [{ t: 50, type: 'slot', index: 1, patch: { level: .8 } }, { t: 100, type: 'master', value: .3 }] });
    assert.equal(desk.slots[1].level, .5);
    desk.host.context.currentTime = 10.15; desk.tick();
    assert.equal(desk.slots[1].level, .8);
    assert.equal(desk.host.volume, .3);
    assert.equal(initial.slots[1].level, .5);
    desk.host.context.currentTime = 10.4; desk.tick();
    assert.equal(desk.active, false);
    assert.equal(desk.replaying, false);
  } finally { desk.stop(); }
});
