import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Approved, original video stills. This manifest pins each source, path and byte hash.
export const OFFICIAL_FRAMES = JSON.parse(readFileSync(new URL('./official-frames.json', import.meta.url), 'utf8'));
export const frameMetadata = frame => Object.fromEntries(['src','width','height','sourceMedia'].map(key => [key, frame[key]]));

export function validateOfficialFrame(entry, required = false) {
  const approved = OFFICIAL_FRAMES[entry.id];
  if (!Object.hasOwn(entry, 'officialThumb') && !required) return;
  if (Object.hasOwn(entry, 'officialThumb')) assert.equal(entry.source, 'official', 'Only official examples may use sample frames');
  if (approved == null) {
    assert.ok(!Object.hasOwn(entry, 'officialThumb') || entry.officialThumb === null, `${entry.id}: unapproved official frame`);
    return;
  }
  assert.equal(entry.source, 'official', 'Only official examples may use sample frames');
  assert.equal(entry.officialUrl, approved.officialUrl, `${entry.id}: frame source page`);
  assert.deepEqual(entry.officialThumb, frameMetadata(approved), `${entry.id}: exact approved frame metadata required`);
}

export function isOfficialFramePath(path) {
  return Object.values(OFFICIAL_FRAMES).some(frame => frame && [
    `web${frame.src}`, `dist${frame.src}`,
  ].includes(path));
}

export function validateFrameBytes(bytes, frame) {
  assert.equal(bytes.length, frame.bytes, 'Official frame byte length changed');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), frame.sha256, 'Official frame bytes changed');
}

// Extend the committed baseline by exactly the approved field, leaving every
// other field subject to the existing deep comparison and v0.5.1 fingerprints.
export function withOfficialFrameBaseline(baseline) {
  const expected = structuredClone(baseline);
  for (const entry of expected.entries) {
    const frame = OFFICIAL_FRAMES[entry.id];
    if (frame && entry.source === 'official') entry.officialThumb = frameMetadata(frame);
  }
  return expected;
}
