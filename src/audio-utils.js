export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function carrierStack(config) {
  const frequencies = Array.isArray(config.extraCarriers)
    ? [config.carrier, ...config.extraCarriers.slice(0, 3)]
    : Array.from({ length: Math.max(1, Math.min(4, config.layers || 1)) }, (_, i) => config.carrier + i * 24);
  if (frequencies.some(f => !Number.isFinite(f) || f <= 0)) throw new RangeError('基頻必須為正數');
  return [...new Set(frequencies)];
}

export function dbToGain(db) {
  return 10 ** (db / 20);
}

export function equalPowerPan(pan) {
  const normalized = (clamp(pan, -1, 1) + 1) * Math.PI / 4;
  return { left: Math.cos(normalized), right: Math.sin(normalized) };
}

export function seededRandom(seed = 1) {
  let state = Math.abs(Math.trunc(seed)) || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export function binauralFrequencies(carrier, beat) {
  if (carrier <= 0 || beat < 0 || beat >= carrier * 2) throw new RangeError("無效的載波或差頻");
  return { left: carrier - beat / 2, right: carrier + beat / 2 };
}

export function beatInterval(bpm, subdivision = 1) {
  if (bpm <= 0 || subdivision <= 0) throw new RangeError("BPM 與細分必須大於零");
  return 60 / bpm / subdivision;
}

export function formatValue(value, unit = "") {
  const rounded = Number.isInteger(value) ? value : Number(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${rounded}${unit}`;
}
