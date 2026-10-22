import { validateFullPrompt } from './fulltext.mjs';

// The v0.2 content migration adds only medium to the existing prompt records.
// Use this as the expected baseline; never strip fields from the actual data.
export function withMediumBaseline(baseline) {
  const expected = structuredClone(baseline);
  for (const entry of expected.entries) {
    if (!Object.hasOwn(entry, 'medium')) entry.medium = 'video';
  }
  return expected;
}

// Build the exact permitted migration from a committed snapshot. Every other
// field stays in the baseline, so a deep comparison still rejects unrelated edits.
export function withFullPromptBaseline(baseline, currentEntries, manifest) {
  const expected=structuredClone(baseline);
  for(const entry of expected.entries) {
    if(entry.prompt!==null)continue;
    const current=currentEntries.find(row=>row.id===entry.id);
    const source=manifest.entries.find(row=>row.id===entry.id);
    validateFullPrompt(current,source);
    if(!entry.isLong||!source.restored)throw Error(`${entry.id}: unapproved full-text migration`);
    entry.prompt=current.prompt;
    entry.promptExcerpt=null;
  }
  return expected;
}
