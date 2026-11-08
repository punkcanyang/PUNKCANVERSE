// Build the colour barcode and scrub frames for one film from a local video file.
//
//   node scripts/film-frames.mjs <slug> <video-file> [--frames 16] [--width 960] [--height 48] [--out web/img/films]
//
// Output, in <out>/<slug>/:
//   barcode.png   one column per sample: the frame squeezed to 1 px wide, keeping
//                 its vertical colour (sky over sea over ground); --height 1 gives flat mean colours
//   01.webp ...   evenly spaced frames used for scrubbing and as the poster
//   film.json     duration, size, barcode sampling and frame times
//
// The video file itself never enters the repository. Needs ffmpeg and ffprobe;
// uses cwebp for WebP when it is installed, otherwise writes JPEG.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_COLUMNS = 1200;

export function parseArgs(argv) {
  const opts = { frames: 16, width: 960, height: 48, out: 'web/img/films' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--frames' || a === '--width' || a === '--height' || a === '--out') {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      opts[a.slice(2)] = a === '--out' ? v : Number(v);
    } else rest.push(a);
  }
  const [slug, input] = rest;
  if (!slug || !input) throw new Error('usage: node scripts/film-frames.mjs <slug> <video-file> [--frames 16] [--width 960] [--out dir]');
  if (!SLUG.test(slug)) throw new Error(`slug must be lowercase letters, digits and dashes: ${slug}`);
  if (!Number.isInteger(opts.frames) || opts.frames < 4 || opts.frames > 60) throw new Error('--frames must be an integer from 4 to 60');
  if (!Number.isInteger(opts.width) || opts.width < 320 || opts.width > 1920) throw new Error('--width must be an integer from 320 to 1920');
  if (!Number.isInteger(opts.height) || opts.height < 1 || opts.height > 256) throw new Error('--height must be an integer from 1 to 256');
  return { slug, input, ...opts };
}

// Two samples a second, fewer for long films so the barcode stays under MAX_COLUMNS.
export function barcodePlan(duration) {
  const perSecond = Math.min(2, MAX_COLUMNS / duration);
  const columns = Math.max(1, Math.round(duration * perSecond));
  return { columns, secondsPerColumn: duration / columns };
}

// Frame i sits at the middle of its slice, so frame index = floor(position * count).
export function frameTimes(duration, count) {
  return Array.from({ length: count }, (_, i) => +(((i + 0.5) / count) * duration).toFixed(3));
}

async function probe(input) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration', '-of', 'json', input]);
  const data = JSON.parse(stdout);
  const duration = Number(data.format?.duration);
  const { width, height } = data.streams?.[0] ?? {};
  if (!(duration > 0) || !width || !height) throw new Error(`no video stream or duration in ${input}`);
  return { duration, width, height };
}

async function hasCwebp() {
  try { await run('cwebp', ['-version']); return true; } catch { return false; }
}

export async function filmFrames({ slug, input, frames, width, height = 48, out }) {
  await stat(input);
  const meta = await probe(input);
  const dir = resolve(out, slug);
  await mkdir(dir, { recursive: true });

  const plan = barcodePlan(meta.duration);
  await run('ffmpeg', ['-v', 'error', '-y', '-i', input, '-an',
    '-vf', `fps=${plan.columns}/${meta.duration},scale=1:${height}:flags=area,tile=${plan.columns}x1`,
    '-frames:v', '1', join(dir, 'barcode.png')]);

  const webp = await hasCwebp();
  const ext = webp ? 'webp' : 'jpg';
  const tmp = await mkdtemp(join(tmpdir(), 'film-frames-'));
  const times = frameTimes(meta.duration, frames);
  const list = [];
  try {
    for (const [i, t] of times.entries()) {
      const name = `${String(i + 1).padStart(2, '0')}.${ext}`;
      const scale = `scale=${width}:-2:flags=lanczos`;
      if (webp) {
        const png = join(tmp, `${i}.png`);
        await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', input, '-frames:v', '1', '-vf', scale, png]);
        await run('cwebp', ['-quiet', '-q', '72', '-m', '6', png, '-o', join(dir, name)]);
      } else {
        await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', input, '-frames:v', '1', '-vf', scale, '-q:v', '4', join(dir, name)]);
      }
      list.push({ t, src: name });
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  const film = {
    slug,
    duration: +meta.duration.toFixed(3),
    width: meta.width,
    height: meta.height,
    barcode: { src: 'barcode.png', columns: plan.columns, height, secondsPerColumn: +plan.secondsPerColumn.toFixed(4) },
    frames: list,
  };
  await writeFile(join(dir, 'film.json'), JSON.stringify(film, null, 2) + '\n');
  return { dir, film };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { dir, film } = await filmFrames(parseArgs(process.argv.slice(2)));
    console.log(`${film.slug}: ${film.duration}s, ${film.barcode.columns} barcode columns, ${film.frames.length} frames -> ${dir}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
