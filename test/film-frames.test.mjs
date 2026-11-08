import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, barcodePlan, frameTimes, segmentShots } from '../scripts/film-frames.mjs';

test('barcode samples twice a second and caps long films at 1200 columns', () => {
  assert.deepEqual(barcodePlan(24), { columns: 48, secondsPerColumn: 0.5 });
  assert.deepEqual(barcodePlan(1800), { columns: 1200, secondsPerColumn: 1.5 });
  assert.equal(barcodePlan(0.2).columns, 1);
});

test('scrub frames sit at the middle of equal slices', () => {
  assert.deepEqual(frameTimes(10, 4), [1.25, 3.75, 6.25, 8.75]);
});

test('arguments are validated before any ffmpeg call', () => {
  assert.deepEqual(parseArgs(['my-film', 'a.mp4']), { slug: 'my-film', input: 'a.mp4', frames: 16, width: 960, height: 48, out: 'web/img/films' });
  assert.equal(parseArgs(['my-film', 'a.mp4', '--frames', '24', '--width', '1280']).frames, 24);
  assert.equal(parseArgs(['my-film', 'a.mp4', '--height', '1']).height, 1);
  assert.throws(() => parseArgs(['my-film', 'a.mp4', '--height', '0']), /--height/);
  assert.throws(() => parseArgs(['My Film', 'a.mp4']), /slug/);
  assert.throws(() => parseArgs(['my-film']), /usage/);
  assert.throws(() => parseArgs(['my-film', 'a.mp4', '--frames', '2']), /--frames/);
  assert.throws(() => parseArgs(['my-film', 'a.mp4', '--width']), /needs a value/);
});

test('shots: a jump between samples is a cut; short flashes fold into the previous shot', () => {
  const flat = (r, g, b) => Uint8Array.from({ length: 12 }, (_, i) => [r, g, b][i % 3]);
  const red = flat(200, 20, 20), blue = flat(20, 20, 200), white = flat(255, 255, 255);
  // 0.25 s per sample: 2 s red, 0.25 s white flash, 1 s red, 1.5 s blue
  const samples = [...Array(8).fill(red), white, ...Array(4).fill(red), ...Array(6).fill(blue)];
  const shots = segmentShots(samples, 0.25, 4.75);
  assert.deepEqual(shots.map(s => [s.start, s.end]), [[0, 3.25], [3.25, 4.75]]);
  assert.equal(shots[1].color, '#1414c8');
  assert.equal(shots[0].start, 0);
  assert.deepEqual(segmentShots([], 0.25, 0), []);
});
