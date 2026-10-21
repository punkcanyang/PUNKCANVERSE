// The v0.2 content migration adds only medium to the existing prompt records.
// Use this as the expected baseline; never strip fields from the actual data.
export function withMediumBaseline(baseline) {
  const expected = structuredClone(baseline);
  for (const entry of expected.entries) {
    if (!Object.hasOwn(entry, 'medium')) entry.medium = 'video';
  }
  return expected;
}
