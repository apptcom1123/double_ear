export const defaultAudioLabConfig = () => ({
  start:0,end:0,effectStart:0,effectEnd:0,speed:1,key:0,reverse:false,loop:false,
  eqLow:0,eqMid:0,eqHigh:0,telephone:false,delay:.12,reverb:.18,spatial:.2,
  fadeIn:.15,fadeOut:.25,granular:false,grainSize:.16,density:18,
  layering:false,layers:5,freeze:false,freezeAt:0,stretch:false,vinyl:false
});

export function normalizeAudioLabConfig(config, duration) {
  const value = { ...defaultAudioLabConfig(), ...config };
  const limit = Math.max(.01, Number(duration) || .01);
  const number = (candidate, fallback) => Number.isFinite(Number(candidate)) ? Number(candidate) : fallback;
  value.start = Math.max(0, Math.min(Math.max(0, limit - .01), number(value.start, 0)));
  value.end = Math.max(value.start + .01, Math.min(limit, number(value.end, limit) || limit));
  value.effectStart = Math.max(value.start, Math.min(value.end, number(value.effectStart, value.start)));
  value.effectEnd = Math.max(value.effectStart, Math.min(value.end, number(value.effectEnd, value.end) || value.end));
  value.freezeAt = Math.max(value.start, Math.min(value.end, number(value.freezeAt, value.start)));
  value.speed = Math.max(.05, Math.min(2, number(value.speed, 1)));
  value.layers = Math.max(1, Math.min(12, Math.round(number(value.layers, 1))));
  value.density = Math.max(4, Math.min(40, number(value.density, 18)));
  value.grainSize = Math.max(.03, Math.min(1.5, number(value.grainSize, .16)));
  return value;
}
export const pitchRatio = semitones => 2 ** (Number(semitones) / 12);
export const effectActive = (time, config) => time >= config.effectStart && time <= config.effectEnd;
export function nextPlayhead(time, hop, config) { return config.freeze ? config.freezeAt : time + hop * config.speed * (config.stretch ? .12 : 1); }
export function layerIntervals(count) { return [0,4,7,-12,12,3,-5,16,19,-24,24,11].slice(0,Math.max(1,Math.min(12,Math.round(count)))); }
