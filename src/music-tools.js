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
export const KITS = { '808':'808 電子鼓', lofi:'Lo-Fi 復古鼓', pop:'Pop 原聲鼓' };
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
