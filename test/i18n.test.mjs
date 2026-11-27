import test from 'node:test';
import assert from 'node:assert/strict';
import blocks from '../src/lang/blocks.js';
import ui from '../src/lang/ui.js';
import { SPEC } from '../src/blocks.js';
import { tr, setLang } from '../src/i18n.js';

const names = s => (s.match(/%[a-z]+/gi) || []).sort().join();
test('every translation is filled in and keeps the block inputs', () => {
  for (const row of [...blocks, ...ui]) {
    assert.equal(row.length, 3, row[0]); assert.ok(row[1] && row[2], row[0]);
    assert.equal(names(row[1]), names(row[0]), row[0]); assert.equal(names(row[2]), names(row[0]), row[0]);
  }
});
test('every visible block with words has a Kazakh and Russian text', () => {
  const known = new Set(blocks.map(r => r[0]));
  const missing = Object.values(SPEC).filter(s => s.cat !== 'note' || s.shape !== 'n')
    .map(s => s.text).filter(t => /[a-z]{2}/i.test(t.replace(/%\w+/g, '')) && !known.has(t));
  assert.deepEqual(missing, []);
});
test('simulator messages translate, English stays as written', () => {
  assert.equal(tr('Launched.'), 'Launched.');
  setLang('kk');
  assert.equal(tr('Launched.'), 'Бағдарлама басталды.');
  assert.equal(tr('[2:10] M11: the root cover is down. (simplified)'), '[2:10] M11: тамыр қақпағы түсті.');
  assert.equal(tr('Arm E: picked up Seed (5 g).'), 'E тетігі көтерді: Тұқым (5 г).');
  setLang('ru');
  assert.equal(tr('Bumped into the wall.'), 'Столкновение: стена.');
  setLang('en');
});
