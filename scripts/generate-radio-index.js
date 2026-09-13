import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const radioDirectory = join(process.cwd(), 'assets', 'radio');
const outputFile = join(process.cwd(), 'assets', 'radio-index.json');
const names = await readdir(radioDirectory);
const tracks = names
  .filter(name => /\.(mp3|wav|ogg)$/i.test(name))
  .sort((a, b) => a.localeCompare(b, 'en'))
  .map(name => ({
    name: name.replace(/^OldRadio_Adv--/, '').replace(/\.[^.]+$/, '').replaceAll('_', ' '),
    url: `/assets/radio/${encodeURIComponent(name)}`
  }));

await writeFile(outputFile, `${JSON.stringify(tracks, null, 2)}\n`, 'utf8');
console.log(`Generated ${tracks.length} radio tracks in assets/radio-index.json`);
