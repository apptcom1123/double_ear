export const NOTE_NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const SCALES = {
  chromatic: { name: '半音階', intervals: [0,1,2,3,4,5,6,7,8,9,10,11] },
  major: { name: '大調', intervals: [0,2,4,5,7,9,11] },
  minor: { name: '自然小調', intervals: [0,2,3,5,7,8,10] },
  pentatonic: { name: '五聲音階', intervals: [0,2,4,7,9] },
  dorian: { name: 'Dorian', intervals: [0,2,3,5,7,9,10] }
};
export const PROGRESSIONS = {
  pop: { name: '流行 I–V–vi–IV', degrees: [0,4,5,3] },
  jazz: { name: '爵士 ii–V–I–vi', degrees: [1,4,0,5] },
  lofi: { name: 'Lo-Fi i–VI–III–VII', degrees: [0,5,2,6] }
};
export const DRUMS = ['Kick','Snare','Closed Hat','Open Hat','Clap','Low Tom','High Tom','Rim','Cowbell','Shaker','Crash','Ride','Clave','Bongo','Zap','Perc'];
export const KITS = { '808':'808 Electronic', lofi:'Lo-Fi Vintage', pop:'Pop Acoustic', soviet:'Soviet / Obscure', edm:'Modern EDM', industrial:'Industrial Metal' };
export const DRUM_FX = { clean:'Clean', newyork:'New York Parallel Distortion', bitcrusher:'Bitcrusher / Sample Rate Reduction', transient:'Transient Shaper', reverse:'Reverse Reverb Snare Snap', sidechain:'Aggressive Sidechain' };
export const INSTRUMENTS = {
  electric70: { name:'70s Vintage Electric Piano', wave:'sine', harmonics:[1,2,3.01], gains:[1,.3,.12], attack:.008, release:.5 },
  fmPiano: { name:'FM Digital Electric Piano', wave:'sine', harmonics:[1,2.01,6.98], gains:[1,.38,.16], attack:.004, release:.65 },
  synthPiano: { name:'Synth Electric Piano', wave:'triangle', harmonics:[1,2,4], gains:[1,.22,.08], attack:.012, release:.75 },
  churchOrgan: { name:'Church Pipe Organ', wave:'sine', harmonics:[.5,1,2,3], gains:[.32,1,.42,.2], attack:.16, release:1.3 },
  jazzOrgan: { name:'Jazz Tonewheel Organ', wave:'sine', harmonics:[1,2,3,4,6], gains:[1,.45,.28,.16,.08], attack:.025, release:.35 },
  rockOrgan: { name:'Rock Organ', wave:'square', harmonics:[1,2,3], gains:[1,.28,.12], attack:.008, release:.28 },
  synthLead: { name:'Synth Lead', wave:'sawtooth', harmonics:[1,1.005,2], gains:[.7,.55,.12], attack:.006, release:.22 },
  sciFiPad: { name:'Sci-Fi Pad', wave:'sine', harmonics:[.5,1,1.5,2], gains:[.25,1,.3,.15], attack:.65, release:2.2 },
  housePiano: { name:'Classic 90s House Piano', wave:'square', harmonics:[1,2,4,6], gains:[1,.35,.15,.08], attack:.003, release:.42 },
  pianoPad: { name:'Layered Piano + Sci-Fi Pad', wave:'triangle', harmonics:[.5,1,2,3], gains:[.22,1,.28,.12], attack:.18, release:1.7 }
};
export const FX = {
  clean: 'Clean', distortion: 'Distortion', vintage: 'Lo-Fi / Vintage', ambient: 'New Age / Ambient', crystal: 'Crystal Freeze', cavern: 'Cave Space'
};

export function isScaleNote(midi, root = 0, scale = 'chromatic') {
  const pitch = ((midi - root) % 12 + 12) % 12;
  return (SCALES[scale] || SCALES.chromatic).intervals.includes(pitch);
}

export function scaleChord(midi, root = 0, scale = 'major', size = 3) {
  if (scale === 'chromatic') return Array.from({ length: size }, (_, i) => midi + [0,4,7,11][i]);
  const notes = [];
  for (let note = midi; notes.length < size * 2 - 1 && note < midi + 36; note++) if (isScaleNote(note, root, scale)) notes.push(note);
  const chord = [];
  for (let i = 0; i < size; i++) chord.push(notes[i * 2]);
  return chord;
}

export function degreeMidi(octave, root, scale, degree) {
  const intervals = (SCALES[scale] || SCALES.major).intervals;
  const normalized = ((degree % intervals.length) + intervals.length) % intervals.length;
  return (octave + 1) * 12 + root + intervals[normalized];
}
