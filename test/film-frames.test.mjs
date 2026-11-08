import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, barcodePlan, frameTimes } from '../scripts/film-frames.mjs';

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
