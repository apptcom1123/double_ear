import { AudioEngine } from './audio-engine.js';
import { seededRandom } from './audio-utils.js';

export const materials = [
  { id: 'nebula', name: '星雲和弦', group: 'SPACE', note: '緩慢漂浮的寬幅和弦', type: 'pad', wave: 'sine', notes: [0,7,14,19], root: 110 },
  { id: 'engine', name: '深空引擎', group: 'SPACE', note: '低頻持續音與緩慢脈動', type: 'pad', wave: 'triangle', notes: [0,7,12], root: 55 },
  { id: 'radar', name: '軌道雷達', group: 'SPACE', note: '左右回音的探測訊號', type: 'sequence', wave: 'sine', notes: [12,19,24,7], root: 440, division: .5 },
  { id: 'tape', name: '磁帶暖墊', group: 'RETRO', note: '微幅走音的類比合成器', type: 'pad', wave: 'sawtooth', notes: [0,4,7,12], root: 130.81 },
  { id: 'arcade', name: '像素街機', group: 'RETRO', note: '隨節拍跳動的方波序列', type: 'sequence', wave: 'square', notes: [0,12,7,19,4,16,7,12], root: 220, division: 2 },
  { id: 'laser', name: '復古雷射', group: 'RETRO', note: '下滑音高與延遲尾音', type: 'sequence', wave: 'sawtooth', notes: [12,7,19,0], root: 440, division: .5, sweep: true },
  { id: 'frame-drum', name: '薩滿框鼓', group: 'SHAMAN', note: '深沉皮鼓與四拍呼吸', type: 'shaman-drum', tempo: true },
  { id: 'seed-rattle', name: '種籽沙鈴', group: 'SHAMAN', note: '細碎顆粒環繞移動', type: 'shaman-rattle', tempo: true },
  { id: 'overtone-chant', name: '泛音吟唱', group: 'SHAMAN', note: '低沉持續音與泛音漂移', type: 'shaman-drone' },
  { id: 'ritual-bell', name: '儀式金屬鈴', group: 'SHAMAN', note: '非整數泛音與長尾回聲', type: 'shaman-bell', tempo: true }
];

export class StudioEngine {
  constructor() {
    this.output = new AudioEngine();
    this.channels = new Map();
    this.radioCache = new Map();
    this.playing = false;
    this.version = 0;
    this.eqFilters = [];
  }
  prepareEQ() {
    if (this.analyser) return;
    const ctx = this.output.context;
    this.eqInput = ctx.createGain();
    let tail = this.eqInput;
    for (let i = 0; i < 5; i++) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking'; filter.Q.value = 1;
      tail.connect(filter); tail = filter; this.eqFilters.push(filter);
    }
    tail.connect(this.output.master);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 8192; this.analyser.smoothingTimeConstant = .8;
    this.output.compressor.disconnect();
    this.output.compressor.connect(this.analyser).connect(ctx.destination);
  }
  setEQ(eq) {
    if (!this.eqFilters.length || !eq) return;
    eq.bands.forEach((band, i) => {
      const filter = this.eqFilters[i]; if (!filter) return;
      const now = this.output.context.currentTime;
      filter.frequency.setTargetAtTime(band.frequency, now, .035);
      filter.gain.setTargetAtTime(eq.enabled ? band.gain : 0, now, .035);
      filter.Q.setTargetAtTime(band.q, now, .035);
    });
  }
  setVolume(value) { this.output.setVolume(value); }
  async start(state) {
    const version = ++this.version;
    await this.output.ensureContext();
    if (version !== this.version) return;
    this.prepareEQ();
    this.playing = this.output.playing = true;
    this.output.setVolume(this.output.volume);
    this.update(state);
  }
  dispose(channel) {
    if (!channel) return;
    channel.voice.playing = false;
    channel.voice.timers.forEach(clearInterval);
    const now = this.output.context.currentTime;
    channel.bus.gain.cancelScheduledValues(now);
    channel.bus.gain.setTargetAtTime(0, now, .035);
    setTimeout(() => {
      for (const node of channel.voice.nodes) {
        try { node.stop?.(); } catch {}
        node.disconnect();
      }
      channel.bus.disconnect();
    }, 200);
  }
  stop() {
    ++this.version;
    this.playing = this.output.playing = false;
    this.channels.forEach(channel => this.dispose(channel));
    this.channels.clear();
  }
  async update(state) {
    if (!this.playing) return;
    this.setEQ(state.eq);
    const config = { ...state.config };
    for (const layer of state.layers) {
      const relevant = layer.id === 'carrier' ? [config.carrier,config.extraCarriers,config.beat,config.swing,config.waveform,config.motionRate,config.motionDepth]
        : layer.id === 'noise' ? [config.noise]
        : layer.id === 'arp' ? [config.arpeggio, config.arpeggioRoot]
        : layer.id === 'rhythm' ? [config.bpm,config.rhythm]
        : layer.id === 'radio' ? [state.radioUrl]
        : [materials.find(item=>item.id===layer.id)?.tempo || materials.find(item=>item.id===layer.id)?.type === 'sequence' ? config.bpm : 0];
      const signature = JSON.stringify(relevant);
      const existing = this.channels.get(layer.id);
      if (!layer.enabled) {
        if (existing) this.dispose(existing);
        this.channels.delete(layer.id);
        continue;
      }
      if (existing?.signature === signature) {
        existing.bus.gain.setTargetAtTime(layer.level, this.output.context.currentTime, .04);
        continue;
      }
      this.dispose(existing);
      const context = this.output.context;
      const bus = context.createGain();
      bus.gain.value = 0;
      bus.connect(this.eqInput);
      const voice = new AudioEngine();
      voice.context = context;
      voice.playing = true;
      const channel = { bus, voice, signature };
      this.channels.set(layer.id, channel);
      const full = { ...config, binauralLevel: 1, noiseLevel: 1, arpeggioLevel: 1, rhythmLevel: 1 };
      if (layer.id === 'carrier') voice.createBinaural(full, bus);
      else if (layer.id === 'noise') voice.createNoise(full, bus, seededRandom(783));
      else if (layer.id === 'arp') voice.createArpeggio(full, bus, seededRandom(783));
      else if (layer.id === 'rhythm') voice.createRhythm(full, bus);
      else if (layer.id === 'radio') this.loadRadio(state.radioUrl, channel, layer.id);
      else this.synth(materials.find(item=>item.id===layer.id), voice, bus, config.bpm);
      bus.gain.setTargetAtTime(layer.level, context.currentTime, .12);
    }
  }
  async loadRadio(url, channel, id) {
    if (!url) return;
    this.onRadioStatus?.('正在載入廣播…');
    try {
      let pending = this.radioCache.get(url);
      if (!pending) {
        pending = fetch(url).then(response => {
          if (!response.ok) throw new Error('廣播檔案讀取失敗');
          return response.arrayBuffer();
        }).then(buffer => this.output.context.decodeAudioData(buffer));
        this.radioCache.set(url, pending);
        if (this.radioCache.size > 4) this.radioCache.delete(this.radioCache.keys().next().value);
      }
      const buffer = await pending;
      if (!this.playing || this.channels.get(id) !== channel) return;
      const source = this.output.context.createBufferSource();
      const filter = this.output.context.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 1300; filter.Q.value = .45;
      source.buffer = buffer; source.loop = true;
      source.connect(filter).connect(channel.bus);
      channel.voice.track(source, filter);
      source.start();
      this.onRadioStatus?.('廣播播放中 · 循環');
    } catch (error) {
      this.radioCache.delete(url);
      if (this.channels.get(id) === channel) this.onRadioStatus?.(error.message);
    }
  }
  shamanSynth(material, voice, bus, bpm) {
    const ctx = voice.context;
    const random = seededRandom(2027 + material.id.length);
    if (material.type === 'shaman-drone') {
      const filter = ctx.createBiquadFilter();
      const lfo = ctx.createOscillator();
      const sweep = ctx.createGain();
      filter.type = 'lowpass'; filter.frequency.value = 720; filter.Q.value = 5;
      lfo.frequency.value = .075; sweep.gain.value = 360;
      lfo.connect(sweep).connect(filter.frequency); filter.connect(bus);
      [1, 2, 3, 4.5].forEach((ratio, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const pan = ctx.createStereoPanner();
        oscillator.type = index === 0 ? 'sawtooth' : 'sine';
        oscillator.frequency.value = 65.41 * ratio;
        gain.gain.value = [.055, .028, .018, .012][index];
        pan.pan.value = [-.15, .2, -.35, .4][index];
        oscillator.connect(gain).connect(pan).connect(filter);
        oscillator.start(); voice.track(oscillator, gain, pan);
      });
      lfo.start(); voice.track(filter, lfo, sweep);
      return;
    }

    const delay = ctx.createDelay(2);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    delay.delayTime.value = material.type === 'shaman-bell' ? .46 : .23;
    feedback.gain.value = material.type === 'shaman-bell' ? .42 : .2;
    wet.gain.value = .28;
    bus.connect(delay); delay.connect(feedback).connect(delay); delay.connect(wet).connect(bus);
    voice.track(delay, feedback, wet);
    const rattleBuffer = material.type === 'shaman-rattle' ? (() => {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .16), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * .045));
      return buffer;
    })() : null;
    let next = ctx.currentTime + .06;
    let step = 0;
    const schedule = () => {
      while (voice.playing && next < ctx.currentTime + .18) {
        if (material.type === 'shaman-drum') {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          const accent = [1, .55, .78, .5][step % 4];
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(155, next);
          oscillator.frequency.exponentialRampToValueAtTime(46, next + .19);
          filter.type = 'lowpass'; filter.frequency.value = 520;
          gain.gain.setValueAtTime(.0001, next);
          gain.gain.exponentialRampToValueAtTime(.25 * accent, next + .006);
          gain.gain.exponentialRampToValueAtTime(.0001, next + .42);
          oscillator.connect(gain).connect(filter).connect(bus);
          oscillator.start(next); oscillator.stop(next + .44);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); filter.disconnect(); };
          next += 60 / bpm;
        } else if (material.type === 'shaman-rattle') {
          const source = ctx.createBufferSource();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          const pan = ctx.createStereoPanner();
          source.buffer = rattleBuffer;
          filter.type = 'bandpass'; filter.frequency.value = 2400 + random() * 1800; filter.Q.value = .7;
          gain.gain.value = (step % 4 === 0 ? .15 : .085) * (.75 + random() * .25);
          pan.pan.value = Math.sin(step * .8) * .72;
          source.connect(filter).connect(gain).connect(pan).connect(bus);
          source.start(next); source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); };
          next += 60 / bpm / 2;
        } else {
          const root = [293.66, 329.63, 392][step % 3];
          [1, 2.71, 5.43].forEach((ratio, index) => {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            const pan = ctx.createStereoPanner();
            oscillator.type = 'sine'; oscillator.frequency.value = root * ratio;
            pan.pan.value = index === 1 ? -.25 : .25;
            gain.gain.setValueAtTime(.0001, next);
            gain.gain.exponentialRampToValueAtTime([.11, .045, .018][index], next + .009);
            gain.gain.exponentialRampToValueAtTime(.0001, next + 1.8);
            oscillator.connect(gain).connect(pan).connect(bus);
            oscillator.start(next); oscillator.stop(next + 1.82);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); pan.disconnect(); };
          });
          next += 60 / bpm * 4;
        }
        step += 1;
      }
    };
    schedule(); voice.timers.push(setInterval(schedule, 60));
  }
  synth(material, voice, bus, bpm) {
    if (!material) return;
    if (material.type.startsWith('shaman-')) {
      this.shamanSynth(material, voice, bus, bpm);
      return;
    }
    const ctx = voice.context;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = material.id === 'tape' ? 1100 : 3800;
    const delay = ctx.createDelay(2), feedback = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = .375; feedback.gain.value = .32; wet.gain.value = .3;
    filter.connect(bus); filter.connect(delay); delay.connect(feedback).connect(delay); delay.connect(wet).connect(bus);
    voice.track(filter, delay, feedback, wet);
    if (material.type === 'pad') {
      material.notes.forEach((note,i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
        osc.type = material.wave; osc.frequency.value = material.root * 2**(note/12);
        gain.gain.value = .045; pan.pan.value = i % 2 ? .65 : -.65;
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = .08 + i*.027; depth.gain.value = material.id === 'tape' ? 9 : 4;
        lfo.connect(depth).connect(osc.detune);
        osc.connect(gain).connect(pan).connect(filter);
        voice.track(osc,gain,pan,lfo,depth); osc.start(); lfo.start();
      });
    } else {
      let next = ctx.currentTime + .05, index = 0;
      const schedule = () => {
        while (voice.playing && next < ctx.currentTime + .15) {
          const frequency = material.root * 2**(material.notes[index++ % material.notes.length]/12);
          if (material.sweep) {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = material.wave;
            osc.frequency.setValueAtTime(frequency, next);
            osc.frequency.exponentialRampToValueAtTime(80, next+.3);
            gain.gain.setValueAtTime(.0001,next);
            gain.gain.exponentialRampToValueAtTime(.09,next+.008);
            gain.gain.exponentialRampToValueAtTime(.0001,next+.32);
            osc.connect(gain).connect(filter); osc.start(next); osc.stop(next+.34);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
          } else voice.createToneEvent({frequency,time:next,duration:.18,level:.1,pan:index%2 ? -.65 : .65,type:material.wave},filter);
          next += 60/bpm/material.division;
        }
      };
      schedule(); voice.timers.push(setInterval(schedule,50));
    }
  }
}
