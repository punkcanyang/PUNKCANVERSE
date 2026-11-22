import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderOpportunities, validateOpportunities } from '../lib/opportunities.mjs';
import { closesAt } from '../web/opportunity-status.mjs';

const directory = JSON.parse(await readFile(new URL('../content/opportunities.json',import.meta.url)));
test('both editions list every official link once, newest additions first', () => {
  validateOpportunities(directory);
  for (const section of ['cpp','competitions']) {
    const rows = directory.entries.filter(row => row.section === section);
    const links = locale => {
      const {body} = renderOpportunities(directory,section,locale);
      const dates = [...body.matchAll(/class="opp-date"><small>[^<]+<\/small><time datetime="([^"]+)"/g)].map(m => m[1]);
      assert.deepEqual(dates,rows.map(r=>r.added).sort().reverse());
      return [...body.matchAll(/<a href="([^"]+)" target="_blank"/g)].map(m => m[1]);
    };
    const en = links('en');
    assert.deepEqual(en,links('zh'));
    assert.deepEqual([...en].sort(),rows.map(r=>r.source).sort());
  }
});
test('stage cutoffs preserve time-zone precision and do not prematurely close a festival', () => {
  const {body} = renderOpportunities(directory,'competitions','zh',Date.parse('2027-02-01T00:00Z'));
  const rows = body.split('<article>');
  assert.match(rows.find(r => r.includes('FilmyAI')), /2026-11-23 02:29 \(台北\).*2026-11-22 23:59/);
  const festival = rows.find(r => r.includes('Outronox'));
  assert.match(festival,/早鳥截止<\/dt>[^]*?data-closes-at="\d+">已截止/);
  assert.match(festival,/最終截止<\/dt>[^]*?data-closes-at="\d+" hidden>已截止/);
  assert.equal(closesAt('2027-09-25'),Date.parse('2027-09-26T12:00:00Z'));
});
