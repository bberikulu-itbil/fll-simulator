import test from 'node:test';
import assert from 'node:assert/strict';
import { createFileStore, createProgramSession, freeName, fingerprint, isEmptyWork, downloadName, FILES_KEY } from '../src/files.js';

const memory = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), map: m }; };
const work = (v = 1, x = 240) => ({ version: 1, start: { x, y: 240, h: 0 }, workspace: { blocks: { languageVersion: 0, blocks: [{ type: 'sim_num', id: 'b' + v, fields: { V: v } }] } } });

test('create, list, update, rename and delete a file', () => {
  const store = createFileStore(memory(), () => 1000);
  const a = store.create('  Миссия   1 ', work(1));
  assert.equal(a.name, 'Миссия 1');
  const b = store.create('M02', work(2));
  assert.equal(store.list().length, 2);
  const a2 = store.update(a.id, work(3));
  assert.ok(a2.updated > a.updated, 'a new version has a later time even if the clock stands still');
  assert.equal(store.get(a.id).data.workspace.blocks.blocks[0].fields.V, 3);
  assert.equal(store.list()[0].id, a.id, 'newest first');
  store.rename(b.id, 'M02 жаңа');
  assert.equal(store.get(b.id).name, 'M02 жаңа');
  store.remove(a.id);
  assert.deepEqual(store.list().map(f => f.id), [b.id]);
  assert.equal(store.get(a.id), null);
});

test('names must be present, short and unique', () => {
  const store = createFileStore(memory());
  const a = store.create('Жүріс', work());
  assert.throws(() => store.create('   ', work()), /Type a file name/);
  assert.throws(() => store.create('x'.repeat(61), work()), /too long/);
  assert.throws(() => store.create('жүріс', work()), /already exists/);
  assert.throws(() => store.checkName('ЖҮРІС'), /already exists/);
  assert.equal(store.rename(a.id, 'ЖҮРІС').name, 'ЖҮРІС', 'a file may change the case of its own name');
});

test('two tabs sharing storage keep each other’s files', () => {
  const storage = memory(), one = createFileStore(storage), two = createFileStore(storage);
  one.create('one', work(1)); two.create('two', work(2)); one.create('three', work(3));
  assert.deepEqual(two.list().map(f => f.name).sort(), ['one', 'three', 'two']);
});

test('unreadable storage is never overwritten, and a full one reports it', () => {
  const storage = memory(); storage.map.set(FILES_KEY, '{broken');
  const store = createFileStore(storage);
  assert.throws(() => store.list(), /could not be read/);
  assert.throws(() => store.create('a', work()), /could not be read/);
  assert.equal(storage.map.get(FILES_KEY), '{broken');
  const full = createFileStore({ getItem: () => null, setItem: () => { throw new Error('quota'); } });
  assert.throws(() => full.create('a', work()), /Could not save/);
});

test('invalid work is rejected and a saved copy does not change with the original', () => {
  const store = createFileStore(memory());
  assert.throws(() => store.create('bad', { version: 1, workspace: {}, start: { x: 'no', y: 0, h: 0 } }), /starting pose/);
  const data = work(5), file = store.create('copy', data);
  data.start.x = 999;
  assert.equal(store.get(file.id).data.start.x, 240);
  assert.throws(() => store.update('missing', work()), /no longer exists/);
});

test('fingerprint ignores key order but sees real changes', () => {
  const a = work(1), reordered = { start: { h: 0, y: 240, x: 240 }, workspace: a.workspace, version: 1 };
  assert.equal(fingerprint(a), fingerprint(reordered));
  assert.notEqual(fingerprint(a), fingerprint(work(2)));
  assert.notEqual(fingerprint(a), fingerprint(work(1, 300)));
});

test('only a blank editor counts as empty', () => {
  const only = blocks => ({ workspace: { blocks: { languageVersion: 0, blocks } } });
  assert.ok(isEmptyWork({ workspace: {} }));
  assert.ok(isEmptyWork(only([{ type: 'sim_start' }])));
  assert.ok(!isEmptyWork(only([{ type: 'sim_start', next: { block: { type: 'sim_num' } } }])));
  assert.ok(!isEmptyWork(only([{ type: 'sim_num' }])));
});

test('download names are safe and keep Kazakh letters', () => {
  assert.equal(downloadName('Миссия 1: ұшу'), 'Миссия 1_ ұшу.llsp3');
  assert.equal(downloadName('../..\\x'), '_.._x.llsp3');
  assert.equal(downloadName(''), 'bioglow-sim.llsp3');
});

function session(storage = memory()) {
  const store = createFileStore(storage), asked = [];
  const editor = { data: work(0), doc: null, answer: true };
  const api = createProgramSession({
    store, getDoc: () => editor.doc, setDoc: d => editor.doc = d,
    capture: () => structuredClone(editor.data), restore: d => editor.data = structuredClone(d),
    blank: () => editor.data = { version: 1, start: editor.data.start, workspace: { blocks: { languageVersion: 0, blocks: [{ type: 'sim_start', id: 's' }] } } },
    ask: q => { asked.push(q); return editor.answer; }
  });
  api.detach();
  return { api, store, editor, asked, storage };
}

test('program session: save needs a name once, then updates the same file', () => {
  const { api, store, editor, asked } = session();
  assert.equal(api.isDirty(), false, 'the starting program has nothing to lose');
  assert.deepEqual(api.save(), { needName: true });
  const { file } = api.saveAs('M01');
  editor.data = work(7);
  assert.equal(api.isDirty(), true);
  api.save();
  assert.equal(api.isDirty(), false);
  assert.equal(store.list().length, 1);
  assert.equal(store.get(file.id).data.workspace.blocks.blocks[0].fields.V, 7);
  assert.equal(asked.length, 0);
});

test('program session: unsaved work is only thrown away after a yes', () => {
  const { api, editor, asked } = session();
  const first = api.saveAs('first').file;
  const second = api.newFile('second').file;
  assert.equal(api.current().id, second.id);
  editor.data = work(9); editor.answer = false;
  assert.deepEqual(api.open(first.id), { cancelled: true });
  assert.deepEqual(api.newFile('third'), { cancelled: true });
  assert.equal(editor.data.workspace.blocks.blocks[0].fields.V, 9);
  assert.equal(asked.length, 2);
  editor.answer = true; api.open(first.id);
  assert.equal(editor.data.workspace.blocks.blocks[0].fields.V, 0);
});

test('program session: another file is not replaced without a yes', () => {
  const { api, store, editor } = session();
  const first = api.saveAs('first').file;
  editor.data = work(2); api.saveAs('second');
  editor.data = work(3); editor.answer = false;
  assert.deepEqual(api.saveAs('FIRST'), { cancelled: true });
  assert.equal(store.get(first.id).data.workspace.blocks.blocks[0].fields.V, 0);
});

test('program session: a newer version from another tab is not silently overwritten', () => {
  const { api, store, editor, asked } = session();
  const file = api.saveAs('shared').file;
  store.update(file.id, work(50)); // the other tab
  editor.data = work(60); editor.answer = false;
  assert.deepEqual(api.save(), { cancelled: true });
  assert.equal(store.get(file.id).data.workspace.blocks.blocks[0].fields.V, 50);
  assert.match(asked.at(-1), /another tab/);
});

test('program session: after import or delete, Save asks for a name again', () => {
  const { api, store, editor } = session();
  const file = api.saveAs('mine').file;
  editor.data = work(4); api.detach('imported');
  assert.deepEqual(api.save(), { needName: true });
  assert.equal(editor.doc.suggest, 'imported');
  assert.equal(store.get(file.id).data.workspace.blocks.blocks[0].fields.V, 0, 'the old file keeps its own program');
  api.open(file.id); store.remove(file.id); api.removed(file.id);
  assert.deepEqual(api.save(), { needName: true });
  assert.equal(api.isDirty(), true, 'what is on screen is saved nowhere');
});

test('program session: a failed new file leaves the editor as it was', () => {
  const storage = memory(), { api, editor } = session(storage);
  editor.data = work(8);
  storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => api.newFile('x'), /Could not save/);
  assert.equal(editor.data.workspace.blocks.blocks[0].fields.V, 8);
});

test('freeName never reuses a taken name', () => {
  const store = createFileStore(memory());
  store.create('R', work()); store.create('r (2)', work());
  assert.equal(freeName(store, 'R'), 'R (3)');
  assert.equal(freeName(store, 'new'), 'new');
});
