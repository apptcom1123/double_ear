import { AudioEngine } from './audio-engine.js';
import {
  defaultAudioLabConfig, normalizeAudioLabConfig, pitchRatio, effectActive, nextPlayhead,
  sourceOffset, setRegionBoundary, playbackDuration, layerIntervals
} from './audio-lab-utils.js';
import { audioBufferToWav } from './wav-export.js';
import {
  putAudioAsset, listAudioAssets, getAudioAsset, deleteAudioAsset,
  putAudioProject, listAudioProjects, deleteAudioProject
} from './audio-lab-store.js';

const fmt = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${Math.floor(seconds % 1 * 10)}`;
const REGION_LABELS = {
  start: '片段開始', end: '片段結束', effectStart: 'FX 開始', effectEnd: 'FX 結束',
  freezeStart: 'Freeze 開始', freezeEnd: 'Freeze 結束'
};

export class AudioLab {
  constructor(onPlay) {
    this.onPlay = onPlay;
    this.host = new AudioEngine();
    this.config = defaultAudioLabConfig();
    this.assets = [];
    this.projects = [];
    this.sources = new Set();
    this.position = 0;
  }

  get playing() { return !!this.active; }
  setVolume(value) { this.host.setVolume(value); }
  message(text) { const element = this.root?.querySelector('#audio-lab-message'); if (element) element.textContent = text; }
  async ready() { await this.host.ensureContext(); this.host.playing = true; this.host.setVolume(this.host.volume); }

  render(root) {
    this.root = root;
    this.setVolume(document.querySelector('#master-volume')?.value ?? this.host.volume);
    root.innerHTML = `<div class="studio-heading"><div><small>08 / AUDIO LAB</small><h1>音檔合成與狀態工作台</h1></div><span class="tag">IndexedDB LOCAL</span></div>
    <section class="audio-lab-grid"><aside class="panel audio-assets"><div class="tool-title"><strong>本機音檔</strong><small>不會上傳伺服器</small></div><label id="audio-drop" class="audio-drop">拖入音檔或點擊選擇<input id="audio-upload" type="file" accept="audio/*" multiple></label><div id="audio-assets"></div></aside>
    <div class="audio-editor"><section class="panel audio-timeline"><div class="tool-title"><div><small id="audio-file-meta">NO AUDIO</small><h2 id="audio-file-name">先加入一個音檔</h2></div><output id="audio-position">0:00.0</output></div>
    <div class="wave-wrap"><canvas id="audio-waveform" aria-label="音訊波形"></canvas><i id="clip-region"></i><b id="effect-region"></b><em id="freeze-region"></em><span id="playhead"></span>${Object.entries(REGION_LABELS).map(([key, label]) => `<button class="region-handle ${key}" data-region-handle="${key}" aria-label="拖曳${label}" title="${label}"></button>`).join('')}</div>
    <div class="timeline-legend"><span>片段</span><span>FX</span><span>Freeze</span><small>拖曳波形上的控制點</small></div>
    <div class="region-controls"><label>片段開始<input data-region="start" type="number" min="0" step=".01"></label><label>片段結束<input data-region="end" type="number" min="0" step=".01"></label><label>FX 開始<input data-region="effectStart" type="number" min="0" step=".01"></label><label>FX 結束<input data-region="effectEnd" type="number" min="0" step=".01"></label></div>
    <div class="audio-lab-transport"><button id="audio-lab-play" class="primary">播放處理結果</button><button id="audio-lab-stop">停止</button><button id="audio-export">輸出 WAV</button><label><input data-config="loop" type="checkbox">循環</label></div></section>

    <section class="panel audio-process"><div class="tool-title"><strong>播放與區段效果</strong><small>只作用在橘色 FX 區段</small></div><div class="audio-control-grid">
      ${this.range('speed', '速度（保留音高）', .05, 2, .01, '×')}${this.range('key', 'Key', -12, 12, 1, ' st')}${this.range('fadeIn', '淡入', 0, 10, .05, ' s')}${this.range('fadeOut', '淡出', 0, 10, .05, ' s')}
      ${this.range('delay', 'Delay', 0, .8, .01, '')}${this.range('reverb', 'Reverb', 0, .9, .01, '')}${this.range('spatial', '3D Surround', 0, 1, .01, '')}
    </div><div class="process-toggles"><label><input data-config="reverse" type="checkbox"> Reverse 完整倒帶</label><label><input data-config="telephone" type="checkbox"> Telephone / Radio</label><label><input data-config="vinyl" type="checkbox"> Vinyl / Lo-Fi Degradation</label></div></section>

    <section class="panel audio-eq"><div class="tool-title"><strong>Independent EQ</strong><button id="reset-audio-eq" type="button">歸零</button></div><p class="hint">EQ 獨立作用於整個輸出，不受 FX 時間區段限制。</p><div class="audio-control-grid eq-controls">${this.range('eqLow', 'Low 180 Hz', -12, 12, .5, ' dB')}${this.range('eqMid', 'Mid 1.2 kHz', -12, 12, .5, ' dB')}${this.range('eqHigh', 'High 5.2 kHz', -12, 12, .5, ' dB')}</div></section>

    <section class="audio-lab-modes"><div class="panel mode-card"><label><input data-config="granular" type="checkbox"><strong>Grains 微粒</strong></label>${this.range('grainSize', '粒徑', .03, 4, .01, ' s')}${this.range('density', '密度', 4, 40, 1, '/s')}<p>重疊微粒碎片；長粒徑會保留更多片段細節。</p></div>
    <div class="panel mode-card"><label><input data-config="layering" type="checkbox"><strong>Vocal Layering & Harmonization</strong></label>${this.range('layers', '疊加軌數', 1, 12, 1, '')}<p>主音、高三／五度、低音與耳語感層次。</p></div>
    <div class="panel mode-card freeze-card"><label><input data-config="freeze" type="checkbox"><strong>Freeze Segment</strong></label><div class="freeze-inputs"><label>開始<input data-region="freezeStart" type="number" min="0" step=".01"></label><label>結束<input data-region="freezeEnd" type="number" min="0" step=".01"></label></div><label><input data-config="stretch" type="checkbox"> Long-grain Paulstretch</label><p>在藍色區段內慢速循環；Paulstretch 使用長微粒重疊，不再凍結單一瞬間。</p></div></section>

    <section class="panel audio-projects"><div class="tool-title"><strong>本機處理設定</strong><small>音檔與參數均存於此瀏覽器</small></div><div class="export-settings">${this.range('exportDuration', '循環／Freeze 輸出長度', 1, 90, 1, ' s')}</div><form id="save-audio-project"><input name="name" maxlength="100" placeholder="設定名稱" required><button>儲存設定</button></form><div id="audio-project-list"></div><p id="audio-lab-message" role="status"></p></section></div></section>`;
    this.bind();
    this.refreshCollections();
  }

  range(key, label, min, max, step, unit) {
    return `<label class="audio-control"><span>${label}<output data-output="${key}"></output></span><input data-config="${key}" type="range" min="${min}" max="${max}" step="${step}" data-unit="${unit}"></label>`;
  }

  bind() {
    const root = this.root, upload = root.querySelector('#audio-upload'), drop = root.querySelector('#audio-drop');
    upload.onchange = () => this.upload(upload.files);
    drop.ondragover = event => { event.preventDefault(); drop.classList.add('active'); };
    drop.ondragleave = () => drop.classList.remove('active');
    drop.ondrop = event => { event.preventDefault(); drop.classList.remove('active'); this.upload(event.dataTransfer.files); };
    root.querySelectorAll('[data-config]').forEach(input => {
      input.oninput = () => {
        this.config[input.dataset.config] = input.type === 'checkbox' ? input.checked : Number(input.value);
        if (input.dataset.config.startsWith('eq')) this.updateLiveEQ();
        this.syncControls(false);
      };
    });
    root.querySelectorAll('[data-region]').forEach(input => {
      input.oninput = () => {
        this.config = setRegionBoundary(this.config, input.dataset.region, Number(input.value), this.buffer?.duration || 1);
        this.syncControls();
      };
    });
    root.querySelector('#audio-lab-play').onclick = () => this.play();
    root.querySelector('#audio-lab-stop').onclick = () => this.stop();
    root.querySelector('#audio-export').onclick = () => this.exportWav();
    root.querySelector('#reset-audio-eq').onclick = () => { Object.assign(this.config, { eqLow: 0, eqMid: 0, eqHigh: 0 }); this.updateLiveEQ(); this.syncControls(); };
    root.querySelector('#audio-waveform').onclick = event => {
      if (!this.buffer || this.draggingRegion) return;
      const rect = event.currentTarget.getBoundingClientRect();
      this.position = Math.max(this.config.start, Math.min(this.config.end, (event.clientX - rect.left) / rect.width * this.buffer.duration));
      this.syncTimeline();
    };
    root.querySelector('#save-audio-project').onsubmit = event => { event.preventDefault(); this.saveProject(event.target.elements.name.value.trim()); };
    this.bindRegionHandles();
    this.syncControls();
  }

  bindRegionHandles() {
    const wrap = this.root.querySelector('.wave-wrap');
    const move = event => {
      if (!this.draggingRegion || !this.buffer) return;
      const rect = wrap.getBoundingClientRect();
      const time = (event.clientX - rect.left) / rect.width * this.buffer.duration;
      this.config = setRegionBoundary(this.config, this.draggingRegion, time, this.buffer.duration);
      this.position = Math.max(this.config.start, Math.min(this.config.end, this.position));
      this.syncControls();
    };
    wrap.querySelectorAll('[data-region-handle]').forEach(handle => {
      handle.onpointerdown = event => { event.preventDefault(); this.draggingRegion = handle.dataset.regionHandle; handle.setPointerCapture(event.pointerId); move(event); };
      handle.onpointermove = move;
      handle.onpointerup = handle.onpointercancel = event => {
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        this.draggingRegion = null;
      };
    });
  }

  async upload(files) {
    for (const file of files) {
      if (!file.type.startsWith('audio/')) continue;
      try { await putAudioAsset(file); } catch (error) { this.message(`無法保存 ${file.name}：${error.message}`); }
    }
    await this.refreshCollections();
    if (this.assets[0]) await this.selectAsset(this.assets[0].id);
  }

  async refreshCollections() {
    try {
      [this.assets, this.projects] = await Promise.all([listAudioAssets(), listAudioProjects()]);
      this.paintAssets(); this.paintProjects();
    } catch (error) { this.message(`本機資料庫無法使用：${error.message}`); }
  }

  paintAssets() {
    const host = this.root.querySelector('#audio-assets'); host.replaceChildren();
    for (const asset of this.assets) {
      const row = document.createElement('div'); row.className = 'audio-asset-row';
      const load = document.createElement('button'); load.textContent = asset.name; load.classList.toggle('active', asset.id === this.selectedId); load.onclick = () => this.selectAsset(asset.id);
      const remove = document.createElement('button'); remove.textContent = '×'; remove.ariaLabel = `移除 ${asset.name}`;
      remove.onclick = async () => { if (asset.id === this.selectedId) { this.stop(); this.selectedId = null; this.buffer = null; } await deleteAudioAsset(asset.id); await this.refreshCollections(); };
      row.append(load, remove); host.append(row);
    }
    if (!host.children.length) host.textContent = '尚未保存音檔';
  }

  async selectAsset(id) {
    this.stop();
    try {
      await this.ready();
      const asset = await getAudioAsset(id); if (!asset) throw new Error('找不到音檔');
      this.buffer = await this.host.context.decodeAudioData(await asset.blob.arrayBuffer());
      this.reverseBuffer = this.reverseAudio(this.buffer, this.host.context);
      this.selectedId = id; this.selectedAsset = asset;
      this.config = normalizeAudioLabConfig(defaultAudioLabConfig(), this.buffer.duration);
      this.position = this.config.start;
      this.paintAssets(); this.syncControls(); this.drawWaveform();
    } catch (error) { this.message(`音檔無法解碼：${error.message}`); }
  }

  reverseAudio(buffer, context) {
    const reversed = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const from = buffer.getChannelData(channel), to = reversed.getChannelData(channel);
      for (let index = 0; index < from.length; index++) to[index] = from[from.length - 1 - index];
    }
    return reversed;
  }

  syncControls(updateInputs = true) {
    if (this.buffer) this.config = normalizeAudioLabConfig(this.config, this.buffer.duration);
    if (updateInputs) {
      this.root.querySelectorAll('[data-config]').forEach(input => { const value = this.config[input.dataset.config]; if (input.type === 'checkbox') input.checked = !!value; else input.value = value; });
      this.root.querySelectorAll('[data-region]').forEach(input => { input.max = this.buffer?.duration || 0; input.value = Number(this.config[input.dataset.region] || 0).toFixed(2); });
    }
    this.root.querySelectorAll('[data-output]').forEach(output => { const input = this.root.querySelector(`[data-config="${output.dataset.output}"]`); output.textContent = `${this.config[output.dataset.output]}${input?.dataset.unit || ''}`; });
    this.syncTimeline();
  }

  syncTimeline() {
    if (!this.root?.querySelector('#audio-file-name')) return;
    const duration = this.buffer?.duration || 1, name = this.root.querySelector('#audio-file-name'), meta = this.root.querySelector('#audio-file-meta');
    name.textContent = this.selectedAsset?.name || '先加入一個音檔';
    meta.textContent = this.buffer ? `${fmt(duration)} · ${(this.selectedAsset.size / 1048576).toFixed(1)} MB` : 'NO AUDIO';
    const place = (selector, start, end) => { const element = this.root.querySelector(selector); element.style.left = `${start / duration * 100}%`; if (end !== undefined) element.style.width = `${(end - start) / duration * 100}%`; };
    place('#clip-region', this.config.start, this.config.end); place('#effect-region', this.config.effectStart, this.config.effectEnd); place('#freeze-region', this.config.freezeStart, this.config.freezeEnd); place('#playhead', this.position || 0);
    this.root.querySelectorAll('[data-region-handle]').forEach(handle => {
      const percent = this.config[handle.dataset.regionHandle] / duration * 100;
      handle.style.left = `${Math.max(1.5, Math.min(98.5, percent))}%`;
    });
    this.root.querySelector('#audio-position').textContent = fmt(this.position || 0);
  }

  drawWaveform() {
    const canvas = this.root.querySelector('#audio-waveform'), context = canvas.getContext('2d'), width = Math.max(600, canvas.clientWidth * devicePixelRatio), height = 150 * devicePixelRatio;
    canvas.width = width; canvas.height = height; context.clearRect(0, 0, width, height); context.strokeStyle = '#13231f'; context.globalAlpha = .55; context.beginPath();
    const data = this.buffer.getChannelData(0), step = Math.max(1, Math.floor(data.length / width));
    for (let x = 0; x < width; x++) { let min = 1, max = -1; for (let index = 0; index < step; index++) { const value = data[x * step + index] || 0; min = Math.min(min, value); max = Math.max(max, value); } context.moveTo(x, (1 + min) * height / 2); context.lineTo(x, (1 + max) * height / 2); }
    context.stroke(); this.syncTimeline();
  }

  async play() {
    if (!this.buffer) { this.message('請先加入並選擇音檔。'); return; }
    this.stop(false); await this.ready(); this.config = normalizeAudioLabConfig(this.config, this.buffer.duration);
    const playStart = this.config.freeze ? this.config.freezeStart : this.config.start, playEnd = this.config.freeze ? this.config.freezeEnd : this.config.end;
    if (this.position < playStart || this.position >= playEnd) this.position = playStart;
    this.prepareGraph(); this.active = true; this.nextTime = this.host.context.currentTime + .04; this.playhead = this.position; this.ending = false;
    this.schedule(); this.scheduler = setInterval(() => this.schedule(), 25); this.onPlay(true); this.paintPlaying();
  }

  createGraph(context, destination, config) {
    const dryBus = context.createGain(), processInput = context.createGain(), eqInput = context.createGain();
    const low = context.createBiquadFilter(), mid = context.createBiquadFilter(), high = context.createBiquadFilter(), phoneLow = context.createBiquadFilter(), phoneHigh = context.createBiquadFilter(), pan = context.createStereoPanner(), direct = context.createGain(), delay = context.createDelay(2), feedback = context.createGain(), delayWet = context.createGain(), convolver = context.createConvolver(), reverbWet = context.createGain();
    low.type = 'lowshelf'; low.frequency.value = 180; low.gain.value = config.eqLow;
    mid.type = 'peaking'; mid.frequency.value = 1200; mid.Q.value = .8; mid.gain.value = config.eqMid;
    high.type = 'highshelf'; high.frequency.value = 5200; high.gain.value = config.eqHigh;
    phoneHigh.type = 'highpass'; phoneHigh.frequency.value = config.telephone ? 320 : 20; phoneLow.type = 'lowpass'; phoneLow.frequency.value = config.telephone ? 3400 : 20000;
    delay.delayTime.value = .16 + config.delay * .55; feedback.gain.value = config.delay * .58; delayWet.gain.value = config.delay * .65; convolver.buffer = this.impulse(context, 1.2 + config.reverb * 2.8); reverbWet.gain.value = config.reverb * .55;
    dryBus.connect(eqInput); processInput.connect(phoneHigh).connect(phoneLow).connect(pan); pan.connect(direct).connect(eqInput); pan.connect(delay).connect(delayWet).connect(eqInput); delay.connect(feedback).connect(delay); pan.connect(convolver).connect(reverbWet).connect(eqInput); eqInput.connect(low).connect(mid).connect(high).connect(destination);
    return { dryBus, processInput, pan, eqFilters: [low, mid, high], nodes: [dryBus, processInput, eqInput, low, mid, high, phoneHigh, phoneLow, pan, direct, delay, feedback, delayWet, convolver, reverbWet] };
  }

  prepareGraph() {
    const graph = this.createGraph(this.host.context, this.host.master, this.config);
    this.dryBus = graph.dryBus; this.processInput = graph.processInput; this.processPan = graph.pan; this.eqFilters = graph.eqFilters; this.graphNodes = graph.nodes;
    if (this.config.vinyl) this.startVinyl(this.host.context, graph);
  }

  updateLiveEQ() {
    if (!this.eqFilters?.length || !this.host.context) return;
    const now = this.host.context.currentTime;
    [this.config.eqLow, this.config.eqMid, this.config.eqHigh].forEach((gain, index) => this.eqFilters[index].gain.setTargetAtTime(gain, now, .025));
  }

  impulse(context, seconds) {
    const length = Math.ceil(context.sampleRate * seconds), buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) { const data = buffer.getChannelData(channel); for (let index = 0; index < length; index++) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2.4; }
    return buffer;
  }

  startVinyl(context, graph, duration) {
    const seconds = duration || 2, length = Math.ceil(context.sampleRate * seconds), buffer = context.createBuffer(1, length, context.sampleRate), data = buffer.getChannelData(0);
    for (let index = 0; index < length; index++) data[index] = Math.random() < .0025 ? (Math.random() * 2 - 1) * .8 : (Math.random() * 2 - 1) * .015;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain(); source.buffer = buffer; source.loop = !duration; filter.type = 'bandpass'; filter.frequency.value = 2600; filter.Q.value = .35; gain.gain.value = .055;
    source.connect(filter).connect(gain).connect(graph.processInput); source.start(); if (duration) source.stop(duration); else this.vinylSource = source; graph.nodes.push(source, filter, gain);
  }

  grainHop(config) { return config.stretch ? Math.max(.08, Math.max(1.2, config.grainSize) / 4) : 1 / (config.granular ? config.density : 20); }

  schedule() {
    if (!this.active || this.ending) return;
    const context = this.host.context, config = this.config, hop = this.grainHop(config), windowEnd = context.currentTime + .24;
    while (this.nextTime < windowEnd) {
      if (!config.freeze && this.playhead >= config.end) {
        if (config.loop) this.playhead = config.start;
        else { this.ending = true; setTimeout(() => this.stop(false), Math.max(0, (this.nextTime - context.currentTime) * 1000)); break; }
      }
      this.scheduleGrainOn(context, { dryBus: this.dryBus, processInput: this.processInput, pan: this.processPan }, this.nextTime, this.playhead, config, this.buffer, this.reverseBuffer, true);
      this.nextTime += hop; this.playhead = nextPlayhead(this.playhead, hop, config);
    }
    this.position = this.playhead; this.syncTimeline();
  }

  scheduleGrainOn(context, graph, when, position, config, buffer, reverseBuffer, track = false) {
    const baseSize = config.stretch ? Math.max(1.2, config.grainSize) : config.granular ? config.grainSize : .16, intervals = config.layering ? layerIntervals(config.layers) : [0], processed = effectActive(position, config), destination = processed ? graph.processInput : graph.dryBus;
    const fadeIn = config.fadeIn ? Math.min(1, (position - config.start) / config.fadeIn) : 1, fadeOut = config.fadeOut ? Math.min(1, (config.end - position) / config.fadeOut) : 1, fade = Math.max(.001, Math.min(fadeIn, fadeOut)), wow = config.vinyl ? Math.sin(position * 4.3) * .003 : 0;
    const rangeStart = config.freeze ? config.freezeStart : config.start, rangeEnd = config.freeze ? config.freezeEnd : config.end;
    intervals.forEach((semitones, index) => {
      const ratio = pitchRatio(config.key + semitones), source = context.createBufferSource(), gain = context.createGain(), size = baseSize * (index ? 1.06 : 1), sourceDuration = Math.min(size * ratio, buffer.duration, Math.max(.01, rangeEnd - rangeStart));
      const jitterSize = config.freeze ? Math.min((rangeEnd - rangeStart) * .45, size * .3) : config.stretch ? .15 : 0;
      const logical = Math.max(rangeStart, Math.min(Math.max(rangeStart, rangeEnd - sourceDuration), position + (Math.random() - .5) * jitterSize + wow)), offset = sourceOffset(logical, sourceDuration, config, buffer.duration), level = .62 / Math.sqrt(intervals.length);
      source.buffer = config.reverse ? reverseBuffer : buffer; source.playbackRate.value = ratio; gain.gain.setValueAtTime(.0001, when); gain.gain.linearRampToValueAtTime(level * fade, when + size * .22); gain.gain.setValueAtTime(level * fade, when + size * .72); gain.gain.exponentialRampToValueAtTime(.0001, when + size);
      source.connect(gain).connect(destination); source.start(when, offset, sourceDuration); source.stop(when + size + .03);
      if (track) { this.sources.add(source); source.onended = () => { this.sources.delete(source); source.disconnect(); gain.disconnect(); }; }
    });
    if (processed && config.spatial) graph.pan.pan.setTargetAtTime(Math.sin(position * 1.7) * config.spatial, when, .04);
  }

  async exportWav() {
    if (!this.buffer) { this.message('請先加入並選擇音檔。'); return; }
    if (!globalThis.OfflineAudioContext) { this.message('此瀏覽器不支援離線音訊輸出。'); return; }
    const button = this.root.querySelector('#audio-export'); button.disabled = true; button.textContent = '正在輸出…';
    try {
      const config = normalizeAudioLabConfig(this.config, this.buffer.duration), duration = Math.max(.1, Math.min(90, playbackDuration(config))), tail = Math.max(.15, config.delay * 1.5, config.reverb * 3), sampleRate = Math.min(48000, this.buffer.sampleRate);
      const context = new OfflineAudioContext(2, Math.ceil((duration + tail) * sampleRate), sampleRate), graph = this.createGraph(context, context.destination, config), reversed = this.reverseAudio(this.buffer, context);
      if (config.vinyl) this.startVinyl(context, graph, duration);
      const layers = config.layering ? config.layers : 1; let hop = Math.max(this.grainHop(config), duration * layers / 12000), when = .02, position = config.freeze ? config.freezeStart : config.start;
      while (when < duration) { if (!config.freeze && position >= config.end) { if (config.loop) position = config.start; else break; } this.scheduleGrainOn(context, graph, when, position, config, this.buffer, reversed, false); when += hop; position = nextPlayhead(position, hop, config); }
      this.message(`正在渲染 ${fmt(duration)} WAV…`); const rendered = await context.startRendering(), blob = new Blob([audioBufferToWav(rendered)], { type: 'audio/wav' }), url = URL.createObjectURL(blob), link = document.createElement('a');
      const base = (this.selectedAsset?.name || 'double-ear').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-'); link.href = url; link.download = `${base}-processed.wav`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); this.message(`已輸出 ${fmt(rendered.duration)} 的 WAV 音檔。`);
    } catch (error) { this.message(`輸出失敗：${error.message}`); }
    finally { button.disabled = false; button.textContent = '輸出 WAV'; }
  }

  stop(reset = true) {
    clearInterval(this.scheduler); this.scheduler = null; this.active = false;
    for (const source of this.sources) { try { source.stop(); } catch {} } this.sources.clear();
    try { this.vinylSource?.stop(); } catch {} this.vinylSource = null;
    this.graphNodes?.forEach(node => { try { node.disconnect(); } catch {} }); this.graphNodes = []; this.eqFilters = [];
    if (reset && this.buffer) this.position = this.config.freeze ? this.config.freezeStart : this.config.start;
    this.onPlay(false); this.paintPlaying(); this.syncTimeline();
  }

  paintPlaying() { const button = this.root?.querySelector('#audio-lab-play'); if (button) button.textContent = this.active ? '重新播放' : '播放處理結果'; }

  async saveProject(name) {
    if (!this.selectedId) { this.message('請先選擇音檔。'); return; }
    const project = { id: crypto.randomUUID(), name: name || '未命名處理', assetId: this.selectedId, config: structuredClone(this.config), createdAt: new Date().toISOString() };
    await putAudioProject(project); this.message('音檔設定已保存於瀏覽器。'); await this.refreshCollections();
  }

  paintProjects() {
    const host = this.root.querySelector('#audio-project-list'); host.replaceChildren();
    for (const project of this.projects) {
      const row = document.createElement('div'); row.className = 'audio-project-row'; const load = document.createElement('button'); load.textContent = project.name;
      load.onclick = async () => { await this.selectAsset(project.assetId); this.config = normalizeAudioLabConfig(project.config, this.buffer.duration); this.position = this.config.freeze ? this.config.freezeStart : this.config.start; this.syncControls(); };
      const remove = document.createElement('button'); remove.textContent = '移除'; remove.onclick = async () => { await deleteAudioProject(project.id); await this.refreshCollections(); }; row.append(load, remove); host.append(row);
    }
    if (!host.children.length) host.textContent = '尚未保存處理設定';
  }

  unmount() { this.stop(); }
}
