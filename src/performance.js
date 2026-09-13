import { AudioEngine } from './audio-engine.js';
import { StudioEngine } from './studio-engine.js';
import { cardGesture } from './card-gesture.js';
import { CARD_KEY, TAKE_KEY, MAX_TAKE_MS, readCollection, saveCollection, makeTake, downloadJSON } from './cards-store.js';

export class Performance {
  constructor(onPlay) {
    this.onPlay = onPlay; this.host = new AudioEngine(); this.engines = Array.from({ length: 4 }, () => new StudioEngine());
    this.slots = Array.from({ length: 4 }, () => ({ card: null, enabled: false, level: .5 }));
    this.notes = new Map(); this.octave = 4; this.version = 0; this.elapsed = 0; this.loop = false;
    this.keyMap = ['a','w','s','e','d','f','t','g','y','h','u','j','k'];
  }
  get playing() { return !!this.active; }
  message(text) { const el = this.root?.querySelector('#performance-message'); if (el) el.textContent = text; }
  read(key) { try { return readCollection(key); } catch (error) { this.message(error.message); return []; } }
  async ready() {
    await this.host.ensureContext(); this.host.playing = true; this.host.setVolume(this.host.volume);
    for (const engine of this.engines) {
      engine.output.context = this.host.context; engine.output.destination = this.host.master;
      await engine.output.ensureContext(); engine.prepareEQ();
    }
  }
  async play() {
    const version = this.version;
    try { await this.ready(); if (version !== this.version) return; this.active = true; await this.syncSlots(); if (version === this.version) this.onPlay(true); }
    catch (error) { this.message(`播放失敗：${error.message}`); }
  }
  async syncSlots() { await Promise.all(this.slots.map((slot, index) => this.syncSlot(index))); }
  async syncSlot(index) {
    const slot = this.slots[index], engine = this.engines[index];
    if (!this.active || !slot.card || !slot.enabled) { engine.stop(); return; }
    engine.setVolume(slot.level * .5);
    await engine.start(slot.card.state);
  }
  setVolume(value, record = true) {
    this.host.setVolume(value);
    if (record) this.capture({ type: 'master', value: Number(value) });
  }
  capture(event) {
    if (!this.recording) return;
    const t = Math.min(MAX_TAKE_MS, Math.max(0, (this.host.context.currentTime - this.started) * 1000));
    this.events.push({ t: Math.round(t), ...structuredClone(event) });
  }
  changeSlot(index, patch, record = true) {
    if (this.replaying && record) return;
    const slot = this.slots[index];
    const replacement = patch.card !== undefined;
    Object.assign(slot, structuredClone(patch));
    if (record) this.capture({ type: 'slot', index, patch });
    if (replacement) this.engines[index].stop();
    if (Object.keys(patch).length === 1 && patch.level !== undefined) this.engines[index].setVolume(slot.level * .5);
    else this.syncSlot(index).catch(error => this.message(error.message));
    this.paintSlots();
  }
  noteOn(midi, record = true) {
    if (!this.active || this.notes.has(midi) || (this.replaying && record)) return;
    const ctx = this.host.context, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(.07, ctx.currentTime + .015);
    osc.connect(gain).connect(this.host.master); osc.start(); this.notes.set(midi, { osc, gain });
    if (record) this.capture({ type: 'noteOn', midi }); this.paintKeys();
  }
  noteOff(midi, record = true) {
    const note = this.notes.get(midi); if (!note) return;
    const now = this.host.context.currentTime;
    note.gain.gain.cancelScheduledValues(now); note.gain.gain.setTargetAtTime(0, now, .035); note.osc.stop(now + .2);
    note.osc.onended = () => { note.osc.disconnect(); note.gain.disconnect(); };
    this.notes.delete(midi); if (record) this.capture({ type: 'noteOff', midi }); this.paintKeys();
  }
  releaseNotes(record = true) { [...this.notes.keys()].forEach(midi => this.noteOff(midi, record)); }
  async record() {
    if (this.busy) return;
    this.stop(); this.busy = true; const version = this.version;
    try {
      await this.ready(); if (version !== this.version) return;
      await this.preload({ initial: { slots: this.slots }, events: [] }); if (version !== this.version) return;
      this.active = true; this.events = []; this.initial = structuredClone({ slots: this.slots, master: this.host.volume, octave: this.octave });
      this.started = this.host.context.currentTime; this.elapsed = 0; this.recording = true;
      await this.syncSlots(); if (version !== this.version) return;
      this.onPlay(true); this.timer = setInterval(() => this.tick(), 20); this.paint();
    } catch (error) { this.message(`無法開始錄製：${error.message}`); }
    finally { this.busy = false; }
  }
  async preload(take) {
    const cards = [...take.initial.slots.map(slot => slot.card), ...take.events.filter(e => e.type === 'slot' && e.patch.card).map(e => e.patch.card)].filter(Boolean);
    const urls = [...new Set(cards.flatMap(card => card.state.layers.filter(l => l.enabled && l.id === 'radio').map(l => l.radioUrl ?? card.state.radioUrl)))].filter(Boolean);
    await Promise.all(urls.map(async url => {
      let pending = this.engines[0].radioCache.get(url);
      if (!pending) pending = fetch(url).then(r => { if (!r.ok) throw new Error('廣播素材已不存在，請重新選曲'); return r.arrayBuffer(); }).then(data => this.host.context.decodeAudioData(data));
      this.engines.forEach(engine => engine.radioCache.set(url, pending)); await pending;
    }));
  }
  finishRecording() {
    if (!this.recording) return;
    this.releaseNotes(); this.elapsed = Math.min(MAX_TAKE_MS, (this.host.context.currentTime - this.started) * 1000);
    this.draft = makeTake('', this.initial, this.events, this.elapsed); this.recording = false;
    this.message('錄製完成，命名後儲存演奏。');
  }
  stop() {
    ++this.version; clearInterval(this.timer); this.finishRecording(); this.replaying = false; this.active = false;
    this.releaseNotes(false); this.engines.forEach(engine => engine.stop()); this.onPlay(false); this.paint();
  }
  tick() {
    this.elapsed = (this.host.context.currentTime - this.started) * 1000;
    if (this.recording && this.elapsed >= MAX_TAKE_MS) { this.stop(); return; }
    if (this.replaying) {
      while (this.eventIndex < this.take.events.length && this.take.events[this.eventIndex].t <= this.elapsed) this.applyEvent(this.take.events[this.eventIndex++]);
      if (this.elapsed >= this.take.duration) { const take = this.take, loop = this.loop; this.stop(); if (loop) this.replay(take); return; }
    }
    this.paint();
  }
  applyEvent(event) {
    if (event.type === 'slot') this.changeSlot(event.index, event.patch, false);
    if (event.type === 'master') { this.setVolume(event.value, false); this.syncMasterUI(); }
    if (event.type === 'noteOn') this.noteOn(event.midi, false);
    if (event.type === 'noteOff') this.noteOff(event.midi, false);
    if (event.type === 'octave') { this.octave = event.value; this.paintKeys(); }
  }
  async replay(take) {
    this.stop(); const version = this.version; this.message('準備重播…');
    try {
      await this.ready(); await this.preload(take); if (version !== this.version) return;
      this.slots = structuredClone(take.initial.slots); this.octave = take.initial.octave; this.setVolume(take.initial.master, false); this.syncMasterUI();
      this.active = true; this.replaying = true; this.take = structuredClone(take); this.eventIndex = 0;
      this.started = this.host.context.currentTime; this.elapsed = 0; await this.syncSlots(); if (version !== this.version) return;
      this.timer = setInterval(() => this.tick(), 16); this.onPlay(true); this.message(`重播：${take.name}`); this.paintSlots(); this.paintKeys();
    } catch (error) { if (version === this.version) { this.stop(); this.message(`重播失敗：${error.message}`); } }
  }
  syncMasterUI() { const input = document.querySelector('#master-volume'), value = document.querySelector('#master-volume-value'); if (input) input.value = this.host.volume; if (value) value.textContent = `${Math.round(this.host.volume * 100)}%`; }
  choose(index) {
    if (this.replaying) return;
    const dialog = this.root.querySelector('#slot-picker'), list = dialog.querySelector('.slot-choices'); list.replaceChildren();
    const cards = this.read(CARD_KEY);
    for (const card of cards) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = `${card.name} · ${card.state.layers.length} 層`;
      button.onclick = () => { this.changeSlot(index, { card, enabled: true }); dialog.close(); }; list.append(button);
    }
    if (!cards.length) list.textContent = '先到 06 保存一張基底聲卡。';
    const clear = document.createElement('button'); clear.textContent = '清空此槽'; clear.onclick = () => { this.changeSlot(index, { card: null, enabled: false }); dialog.close(); }; list.append(clear);
    dialog.showModal();
  }
  render(root) {
    this.root = root;
    this.setVolume(document.querySelector('#master-volume')?.value ?? this.host.volume, false);
    root.innerHTML = `<div class="studio-heading"><div><small>07 / PERFORMANCE</small><h1>四張聲卡，一段演奏。</h1></div><a href="#/mixer">回到 06 製作基底</a></div><p class="hint">點擊開關 · 上下拖曳音量 · 長按或 F2 更換聲卡</p><div id="performance-slots" class="performance-slots"></div><section class="panel keyboard-panel"><div class="pool-head"><strong>迷你鍵盤</strong><label>八度 <select id="keyboard-octave"><option value="3">C3–C4</option><option value="4">C4–C5</option><option value="5">C5–C6</option></select></label></div><div id="mini-keyboard" class="mini-keyboard" aria-label="迷你 MIDI 鍵盤"></div><p class="hint">觸控可同時按鍵；電腦可用 A W S E D F T G Y H U J K。</p></section><section class="panel recorder"><div class="record-controls"><button id="record-start" class="primary">開始錄製</button><button id="record-stop">停止</button><output id="record-clock">0.0 / 90 秒</output></div><progress id="record-progress" value="0" max="90000"></progress><form id="save-take"><input name="takeName" placeholder="演奏名稱" maxlength="100" aria-label="演奏名稱" required><button type="submit">儲存演奏</button></form><p id="performance-message" role="status"></p></section><section class="panel take-panel"><div class="pool-head"><h2>演奏收藏</h2><label><input id="take-loop" type="checkbox"> 循環重播</label></div><div id="take-list"></div></section><dialog id="slot-picker"><div class="pool-head"><h2>選擇基底聲卡</h2><button id="close-picker" aria-label="關閉">×</button></div><div class="slot-choices"></div></dialog>`;
    for (let index = 0; index < 4; index++) {
      const wrapper = document.createElement('div'); wrapper.className = 'slot-wrapper';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'performance-slot'; button.dataset.slot = index;
      button.innerHTML = `<small>SLOT 0${index + 1}</small><strong></strong><output></output>`;
      cardGesture(button, { value: () => this.slots[index].level, volume: value => this.changeSlot(index, { level: value }), select: () => { if (!this.slots[index].card) this.choose(index); else this.changeSlot(index, { enabled: !this.slots[index].enabled }); }, replace: () => this.choose(index) });
      const replace = document.createElement('button'); replace.type = 'button'; replace.className = 'slot-replace'; replace.textContent = '更換'; replace.setAttribute('aria-label', `更換聲卡 ${index + 1}`); replace.onclick = () => this.choose(index);
      wrapper.append(button, replace); root.querySelector('#performance-slots').append(wrapper);
    }
    for (let i = 0; i < 13; i++) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.semitone = i; const black = [1,3,6,8,10].includes(i);
      button.className = black ? 'piano-key black' : 'piano-key white'; button.textContent = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B','C'][i]; button.setAttribute('aria-label', `琴鍵 ${button.textContent} ${i}`);
      if (black) button.style.left = `${({1:1,3:2,6:4,8:5,10:6})[i] * 12.5 - 3.5}%`;
      let midi;
      button.onpointerdown = async e => { e.preventDefault(); button.setPointerCapture(e.pointerId); midi = (this.octave + 1) * 12 + i; const captured = midi; if (!this.active) await this.play(); if (midi === captured) this.noteOn(midi); };
      const up = () => { if (midi !== undefined) this.noteOff(midi); midi = undefined; }; button.onpointerup = up; button.onpointercancel = up; button.onlostpointercapture = up;
      root.querySelector('#mini-keyboard').append(button);
    }
    root.querySelector('#keyboard-octave').value = this.octave;
    root.querySelector('#keyboard-octave').onchange = e => { if (this.replaying) return; this.releaseNotes(); this.octave = Number(e.target.value); this.capture({ type: 'octave', value: this.octave }); this.paintKeys(); };
    root.querySelector('#record-start').onclick = () => this.record(); root.querySelector('#record-stop').onclick = () => this.stop();
    root.querySelector('#close-picker').onclick = () => root.querySelector('dialog').close();
    root.querySelector('#take-loop').checked = this.loop; root.querySelector('#take-loop').onchange = e => { this.loop = e.target.checked; };
    root.querySelector('#save-take').onsubmit = e => {
      e.preventDefault(); if (this.recording) this.stop(); if (!this.draft) { this.message('先錄製一段演奏。'); return; }
      try { const takes = readCollection(TAKE_KEY); const saved = { ...structuredClone(this.draft), id: crypto.randomUUID(), name: e.target.elements.takeName.value.trim() }; takes.push(saved); saveCollection(TAKE_KEY, takes); this.message('已儲存 JSON 操作時間軸。'); this.paintTakes(); } catch { this.message('儲存失敗，瀏覽器空間不足或資料無法讀取。'); }
    };
    this.heldKeys = new Map();
    this.keyDown = async e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || root.querySelector('dialog').open || e.repeat) return;
      const index = this.keyMap.indexOf(e.key.toLowerCase()); if (index < 0) return; e.preventDefault();
      const midi = (this.octave + 1) * 12 + index; this.heldKeys.set(e.code, midi); if (!this.active) await this.play(); if (this.heldKeys.has(e.code)) this.noteOn(midi);
    };
    this.keyUp = e => { const midi = this.heldKeys.get(e.code); if (midi !== undefined) this.noteOff(midi); this.heldKeys.delete(e.code); };
    this.blur = () => { this.releaseNotes(); this.heldKeys.clear(); };
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp); window.addEventListener('blur', this.blur);
    this.paintSlots(); this.paintTakes(); this.paint();
  }
  paintSlots() {
    this.root?.querySelectorAll('.performance-slot').forEach((button, i) => {
      const slot = this.slots[i]; button.querySelector('strong').textContent = slot.card?.name || '＋ 選擇聲卡';
      button.querySelector('output').textContent = `${slot.enabled ? 'ON' : 'OFF'} · ${Math.round(slot.level * 100)}%`; button.classList.toggle('enabled', slot.enabled); button.style.setProperty('--level', `${slot.level * 100}%`); button.setAttribute('aria-pressed', slot.enabled);
    });
  }
  paintKeys() { this.root?.querySelectorAll('.piano-key').forEach(key => key.classList.toggle('pressed', this.notes.has((this.octave + 1) * 12 + Number(key.dataset.semitone)))); const select = this.root?.querySelector('#keyboard-octave'); if (select) select.value = this.octave; }
  paint() {
    if (!this.root?.isConnected) return;
    const clock = this.root.querySelector('#record-clock'); if (!clock) return;
    clock.textContent = `${(Math.min(MAX_TAKE_MS, this.elapsed) / 1000).toFixed(1)} / ${this.replaying ? (this.take.duration / 1000).toFixed(1) : 90} 秒${this.recording ? ' · REC' : ''}`;
    this.root.querySelector('#record-progress').value = this.elapsed; this.root.querySelector('#record-start').disabled = !!this.recording;
  }
  paintTakes() {
    const list = this.root.querySelector('#take-list'); list.replaceChildren();
    for (const take of this.read(TAKE_KEY)) {
      const row = document.createElement('div'); row.className = 'take-row';
      const play = document.createElement('button'); play.textContent = `▶ ${take.name} · ${(take.duration / 1000).toFixed(1)} 秒`; play.onclick = () => this.replay(take);
      const exportButton = document.createElement('button'); exportButton.textContent = 'JSON'; exportButton.onclick = () => downloadJSON(take, 'double-ear-performance.json');
      const remove = document.createElement('button'); remove.textContent = '移除'; remove.onclick = () => { try { saveCollection(TAKE_KEY, readCollection(TAKE_KEY).filter(item => item.id !== take.id)); if (this.take?.id === take.id) this.stop(); this.paintTakes(); } catch { this.message('移除失敗'); } };
      row.append(play, exportButton, remove); list.append(row);
    }
    if (!list.children.length) list.textContent = '錄下第一段演奏，保存後在這裡重播。';
  }
  unmount() { this.stop(); window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur); this.root?.querySelector('dialog')?.close(); }
}
