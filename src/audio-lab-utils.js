export const defaultAudioLabConfig = () => ({
  start:0,end:0,effectStart:0,effectEnd:0,speed:1,key:0,reverse:false,loop:false,
  eqLow:0,eqMid:0,eqHigh:0,telephone:false,delay:.12,reverb:.18,spatial:.2,
  fadeIn:.15,fadeOut:.25,granular:false,grainSize:.16,density:18,
  layering:false,layers:5,freeze:false,freezeStart:0,freezeEnd:0,stretch:false,vinyl:false,
  exportDuration:15
});

export function normalizeAudioLabConfig(config, duration) {
  const value = { ...defaultAudioLabConfig(), ...config };
  const limit = Math.max(.01, Number(duration) || .01);
  const number = (candidate, fallback) => Number.isFinite(Number(candidate)) ? Number(candidate) : fallback;
  value.start = Math.max(0, Math.min(Math.max(0, limit - .01), number(value.start, 0)));
  value.end = Math.max(value.start + .01, Math.min(limit, number(value.end, limit) || limit));
  value.effectStart = Math.max(value.start, Math.min(value.end - .01, number(value.effectStart, value.start)));
  value.effectEnd = Math.max(value.effectStart + .01, Math.min(value.end, number(value.effectEnd, value.end) || value.end));
  const legacyFreeze = config.freezeAt === undefined ? value.start : number(config.freezeAt, value.start);
  value.freezeStart = Math.max(value.start, Math.min(value.end - .01, number(config.freezeStart, legacyFreeze)));
  value.freezeEnd = Math.max(value.freezeStart + .01, Math.min(value.end, number(config.freezeEnd, Math.min(value.end, value.freezeStart + 1)) || value.end));
  value.speed = Math.max(.05, Math.min(2, number(value.speed, 1)));
  value.layers = Math.max(1, Math.min(12, Math.round(number(value.layers, 1))));
  value.density = Math.max(4, Math.min(40, number(value.density, 18)));
  value.grainSize = Math.max(.03, Math.min(4, number(value.grainSize, .16)));
  value.exportDuration = Math.max(1, Math.min(90, number(value.exportDuration, 15)));
  return value;
}
export const pitchRatio = semitones => 2 ** (Number(semitones) / 12);
export const effectActive = (time, config) => time >= config.effectStart && time <= config.effectEnd;
export function nextPlayhead(time, hop, config) {
  if (!config.freeze) return time + hop * config.speed * (config.stretch ? .12 : 1);
  const start = config.freezeStart;
  const length = Math.max(.01, config.freezeEnd - start);
  const next = time + hop * config.speed * (config.stretch ? .04 : .16);
  return start + ((next - start) % length + length) % length;
}
export function sourceOffset(position, sourceDuration, config, duration) {
  const limit = Math.max(0, duration - sourceDuration);
  if (!config.reverse) return Math.max(0, Math.min(limit, position));
  const rangeStart = config.freeze ? config.freezeStart : config.start;
  const rangeEnd = config.freeze ? config.freezeEnd : config.end;
  return Math.max(0, Math.min(limit, duration - rangeEnd + (position - rangeStart)));
}
export function setRegionBoundary(config, key, time, duration) {
  const value = { ...config };
  const limit = Math.max(.01, Number(duration) || .01);
  const point = Math.max(0, Math.min(limit, Number(time) || 0));
  if (key === 'start') value.start = Math.min(point, value.end - .01);
  if (key === 'end') value.end = Math.max(point, value.start + .01);
  if (key === 'effectStart') value.effectStart = Math.min(Math.max(point, value.start), value.effectEnd - .01);
  if (key === 'effectEnd') value.effectEnd = Math.max(Math.min(point, value.end), value.effectStart + .01);
  if (key === 'freezeStart') value.freezeStart = Math.min(Math.max(point, value.start), value.freezeEnd - .01);
  if (key === 'freezeEnd') value.freezeEnd = Math.max(Math.min(point, value.end), value.freezeStart + .01);
  return normalizeAudioLabConfig(value, limit);
}
export function playbackDuration(config) {
  if (config.freeze || config.loop) return config.exportDuration;
  return (config.end - config.start) / (config.speed * (config.stretch ? .12 : 1));
}
export function layerIntervals(count) { return [0,4,7,-12,12,3,-5,16,19,-24,24,11].slice(0,Math.max(1,Math.min(12,Math.round(count)))); }
