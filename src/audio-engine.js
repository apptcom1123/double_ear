import { binauralFrequencies, carrierStack, clamp, seededRandom } from "./audio-utils.js";
import { arpeggioStyles } from "./experiments.js";

const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.nodes = [];
    this.timers = [];
    this.playing = false;
    this.volume = 0.28;
    this.meterValue = 0;
  }

  async ensureContext() {
    if (!AudioContextClass) throw new Error("此瀏覽器不支援 Web Audio API");
    if (!this.context) {
      this.context = new AudioContextClass({ latencyHint: "interactive" });
      this.master = this.context.createGain();
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 8;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.18;
      this.master.connect(this.compressor).connect(this.context.destination);
      this.master.gain.value = 0;
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  setVolume(value) {
    this.volume = clamp(Number(value), 0, 0.7);
    if (this.master && this.playing) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.04);
  }

  track(...nodes) {
    this.nodes.push(...nodes);
    return nodes[0];
  }

  connectVoice(oscillator, gain, pan, destination) {
    oscillator.connect(gain).connect(pan).connect(destination);
    this.track(oscillator, gain, pan);
  }

  createBinaural(config, destination) {
    const carriers = carrierStack(config);
    const level = config.binauralLevel / Math.sqrt(carriers.length);

    carriers.forEach((carrier, index) => {
      const { left, right } = binauralFrequencies(carrier, config.beat);
      const leftOsc = this.context.createOscillator();
      const rightOsc = this.context.createOscillator();
      const leftGain = this.context.createGain();
      const rightGain = this.context.createGain();
      const leftPan = this.context.createStereoPanner();
      const rightPan = this.context.createStereoPanner();
      leftOsc.type = config.waveform;
      rightOsc.type = config.waveform;
      leftOsc.frequency.value = left;
      rightOsc.frequency.value = right;
      leftGain.gain.value = level * 0.18;
      rightGain.gain.value = level * 0.18;
      leftPan.pan.value = -1;
      rightPan.pan.value = 1;

      if (config.swing > 0) {
        const swingOsc = this.context.createOscillator();
        const leftSwing = this.context.createGain();
        const rightSwing = this.context.createGain();
        swingOsc.frequency.value = 1 / config.swingPeriod;
        leftSwing.gain.value = -config.swing / 2;
        rightSwing.gain.value = config.swing / 2;
        swingOsc.connect(leftSwing).connect(leftOsc.frequency);
        swingOsc.connect(rightSwing).connect(rightOsc.frequency);
        swingOsc.start();
        this.track(swingOsc, leftSwing, rightSwing);
      }

      if (config.motionRate > 0 && config.motionDepth > 0) {
        const motion = this.context.createOscillator();
        const leftMotion = this.context.createGain();
        const rightMotion = this.context.createGain();
        motion.frequency.value = config.motionRate;
        leftPan.pan.value = -1 + config.motionDepth;
        rightPan.pan.value = 1 - config.motionDepth;
        leftMotion.gain.value = config.motionDepth;
        rightMotion.gain.value = -config.motionDepth;
        motion.connect(leftMotion).connect(leftPan.pan);
        motion.connect(rightMotion).connect(rightPan.pan);
        motion.start();
        this.track(motion, leftMotion, rightMotion);
      }

      this.connectVoice(leftOsc, leftGain, leftPan, destination);
      this.connectVoice(rightOsc, rightGain, rightPan, destination);
      leftOsc.start(this.context.currentTime + index * 0.006);
      rightOsc.start(this.context.currentTime + index * 0.006);
    });
  }

  createNoise(config, destination, random) {
    if (config.noise === "off" || config.noiseLevel <= 0) return;
    const length = this.context.sampleRate * 4;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < length; i += 1) {
      const white = random() * 2 - 1;
      if (config.noise === "brown") {
        brown = (brown + 0.018 * white) / 1.018;
        data[i] = brown * 3.2;
      } else data[i] = white;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = config.noiseLevel * 0.34;
    if (config.noise === "green") {
      filter.type = "bandpass";
      filter.frequency.value = 650;
      filter.Q.value = 0.55;
    } else {
      filter.type = "highpass";
      filter.frequency.value = 25;
    }
    source.connect(filter).connect(gain).connect(destination);
    source.start();
    this.track(source, filter, gain);
  }

  createToneEvent({ frequency, time, duration, level, pan = 0, type = "sine" }, destination) {
    if (!this.playing || time < this.context.currentTime - 0.05) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    panner.pan.value = clamp(pan, -1, 1);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), time + Math.min(0.012, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain).connect(panner).connect(destination);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); panner.disconnect(); };
  }

  createArpeggio(config, destination, random) {
    const style = arpeggioStyles[config.arpeggio];
    if (!style || style.density === 0 || config.arpeggioLevel <= 0) return;
    let cursor = 0;
    let sequenceIndex = 0;
    let walkIndex = Math.floor(style.notes.length / 2);
    let nextTime = this.context.currentTime + 0.12;

    const schedule = () => {
      const horizon = this.context.currentTime + 0.7;
      while (nextTime < horizon && this.playing) {
        let noteIndex;
        if (style.walk) {
          walkIndex = clamp(walkIndex + (random() > 0.5 ? 1 : -1), 0, style.notes.length - 1);
          noteIndex = walkIndex;
        } else if (style.sequence) {
          noteIndex = sequenceIndex % style.notes.length;
          sequenceIndex += 1;
        } else noteIndex = Math.floor(random() * style.notes.length);
        const semitone = style.notes[noteIndex] + style.octave * 12;
        const frequency = config.arpeggioRoot * 2 ** (semitone / 12);
        const pan = style.wide ? random() * 2 - 1 : (random() - 0.5) * 0.8;
        this.createToneEvent({ frequency, time: nextTime, duration: style.duration, level: config.arpeggioLevel * 0.22, pan }, destination);
        cursor += 1;
        const burstGap = style.burst && cursor % 5 !== 0 ? 0.055 + random() * 0.08 : 0;
        const regularGap = (0.55 + random() * 0.9) / style.density;
        nextTime += burstGap || regularGap;
      }
    };
    schedule();
    this.timers.push(setInterval(schedule, 250));
  }

  createRhythm(config, destination) {
    if (config.rhythm === "off" || config.rhythmLevel <= 0) return;
    const [leftCount, rightCount] = config.rhythm.split(":").map(Number);
    const barDuration = (60 / config.bpm) * 4;
    let nextBar = this.context.currentTime + 0.15;
    const schedule = () => {
      const horizon = this.context.currentTime + 1;
      while (nextBar < horizon && this.playing) {
        for (let i = 0; i < leftCount; i += 1) {
          this.createToneEvent({ frequency: 1320, time: nextBar + i * barDuration / leftCount, duration: .035, level: config.rhythmLevel * .24, pan: -.85, type: "square" }, destination);
        }
        for (let i = 0; i < rightCount; i += 1) {
          this.createToneEvent({ frequency: 1760, time: nextBar + i * barDuration / rightCount, duration: .028, level: config.rhythmLevel * .2, pan: .85, type: "square" }, destination);
        }
        nextBar += barDuration;
      }
    };
    schedule();
    this.timers.push(setInterval(schedule, 350));
  }

  async start(config) {
    await this.ensureContext();
    if (this.playing) this.stop(true);
    this.playing = true;
    const mix = this.context.createGain();
    mix.gain.value = 1;
    mix.connect(this.master);
    this.track(mix);
    const random = seededRandom(config.seed);
    this.createBinaural(config, mix);
    this.createNoise(config, mix, random);
    this.createArpeggio(config, mix, random);
    this.createRhythm(config, mix);
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0.0001, now);
    this.master.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume), now + 1.2);
  }

  stop(immediate = false) {
    if (!this.context || !this.playing) return;
    this.playing = false;
    this.timers.forEach(clearInterval);
    this.timers = [];
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
    this.master.gain.exponentialRampToValueAtTime(0.0001, now + (immediate ? .04 : .35));
    const stale = this.nodes.splice(0);
    setTimeout(() => stale.forEach((node) => {
      try { if (typeof node.stop === "function") node.stop(); } catch {}
      try { node.disconnect(); } catch {}
    }), immediate ? 60 : 420);
  }
}
