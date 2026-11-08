// Build the colour barcode and scrub frames for one film from a local video file.
//
//   node scripts/film-frames.mjs <slug> <video-file> [--frames 16] [--width 960] [--height 48] [--out web/img/films]
//
// Output, in <out>/<slug>/:
//   barcode.png   one column per sample: the frame squeezed to 1 px wide, keeping
//                 its vertical colour (sky over sea over ground); --height 1 gives flat mean colours
//   01.webp ...   evenly spaced frames used for scrubbing and as the poster
//   film.json     duration, size, barcode sampling, frame times and shots
//                 (start, end, mean colour) for the striped barcode
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

// Shot detection for the barcode: each sample is a tiny RGB thumbnail; a cut is a
// jump in mean absolute difference between neighbouring samples. Shots shorter than
// minSeconds fold into the shot before them (dissolves and flashes are not cuts).
export function segmentShots(samples, sampleSeconds, duration, { threshold = 26, minSeconds = 0.75 } = {}) {
  if (!samples.length) return [];
  const diff = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length; };
  const lookahead = Math.ceil(minSeconds / sampleSeconds);
  // A jump that returns to the pre-jump picture within minSeconds is a flash, not a cut.
  const returns = i => { for (let j = i + 1; j <= i + lookahead && j < samples.length; j++) if (diff(samples[j], samples[i - 1]) <= threshold) return true; return false; };
  const shots = [{ from: 0, samples: [samples[0]] }];
  let reference = samples[0];
  for (let i = 1; i < samples.length; i++) {
    if (diff(samples[i], reference) > threshold && !returns(i)) shots.push({ from: i, samples: [] });
    shots.at(-1).samples.push(samples[i]);
    if (diff(samples[i], reference) <= threshold || shots.at(-1).from === i) reference = samples[i];
  }
  const merged = [];
  for (const shot of shots) {
    const last = merged.at(-1);
    if (last && shot.samples.length * sampleSeconds < minSeconds) last.samples.push(...shot.samples);
    else merged.push(shot);
  }
  const hex = value => Math.round(value).toString(16).padStart(2, '0');
  return merged.map((shot, i) => {
    const sum = [0, 0, 0]; let n = 0;
    for (const sample of shot.samples) for (let p = 0; p < sample.length; p += 3) { sum[0] += sample[p]; sum[1] += sample[p + 1]; sum[2] += sample[p + 2]; n++; }
    const start = +(shot.from * sampleSeconds).toFixed(3);
    const end = i + 1 < merged.length ? +(merged[i + 1].from * sampleSeconds).toFixed(3) : +duration.toFixed(3);
    return { start, end, color: `#${sum.map(v => hex(v / n)).join('')}` };
  });
}

const SHOT_FPS = 4, SHOT_SIZE = 8;
async function detectShots(input, duration) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', input, '-an',
    '-vf', `fps=${SHOT_FPS},scale=${SHOT_SIZE}:${SHOT_SIZE}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
  const size = SHOT_SIZE * SHOT_SIZE * 3, samples = [];
  for (let offset = 0; offset + size <= stdout.length; offset += size) samples.push(stdout.subarray(offset, offset + size));
  return segmentShots(samples, 1 / SHOT_FPS, duration);
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
    shots: await detectShots(input, meta.duration),
  };
  await writeFile(join(dir, 'film.json'), JSON.stringify(film, null, 2) + '\n');
  return { dir, film };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { dir, film } = await filmFrames(parseArgs(process.argv.slice(2)));
    console.log(`${film.slug}: ${film.duration}s, ${film.shots.length} shots, ${film.frames.length} frames -> ${dir}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
