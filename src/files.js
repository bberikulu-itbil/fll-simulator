// Named programs kept in this browser ("My files"). A file holds the raw block workspace and the
// start position; the robot setup belongs to the device and is not part of a file.
import { encodeSave } from './save-format.js';

export const FILES_KEY = 'bioglow-files-v1';
export const MAX_NAME = 60;
export const MAX_FILES = 200;

const sorted = v => Array.isArray(v) ? v.map(sorted)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
// One text per distinct piece of work, whatever order the keys come in.
export const fingerprint = data => JSON.stringify(sorted({ workspace: data.workspace, start: data.start }));

// Nothing to lose: no blocks at all, or just an empty "when program starts".
export function isEmptyWork(data) {
  const blocks = data.workspace?.blocks?.blocks || [];
  return blocks.every(b => b.type === 'sim_start' && !b.next && !b.icons);
}

// A name that is safe to use for a downloaded file on Windows, macOS and ChromeOS.
export function downloadName(name, fallback = 'bioglow-sim') {
  const safe = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^[. ]+|[. ]+$/g, '');
  return (safe || fallback) + '.llsp3';
}

// Programs: the raw workspace is validated (shape and size) and copied.
export const createFileStore = (storage, now) => createStore(storage, FILES_KEY, data => JSON.parse(encodeSave(data)), now);

// A named list kept under one storage key. `clean` validates an entry's data and returns a copy.
// Every call reads storage again, so two open tabs never overwrite each other's list.
export function createStore(storage, key, clean, now = () => Date.now()) {
  function read() {
    const text = storage.getItem(key);
    if (text === null || text === undefined) return [];
    let list;
    try { list = JSON.parse(text).files; } catch { list = null; }
    // Never write over something we cannot read.
    if (!Array.isArray(list)) throw new Error('The saved files could not be read. Nothing was changed.');
    return list;
  }
  function write(files) {
    try { storage.setItem(key, JSON.stringify({ version: 1, files })); }
    catch { throw new Error('Could not save: browser storage is full or blocked.'); }
  }
  function cleanName(name, files, ownId) {
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean) throw new Error('Type a file name.');
    if (clean.length > MAX_NAME) throw new Error('The file name is too long.');
    if (files.some(f => f.id !== ownId && f.name.toLowerCase() === clean.toLowerCase()))
      throw new Error('A file with this name already exists.');
    return clean;
  }
  const find = (files, id) => {
    const file = files.find(f => f.id === id);
    if (!file) throw new Error('This file no longer exists.');
    return file;
  };
  // Strictly later than the previous version, even within the same millisecond.
  const stamp = previous => Math.max(now(), (previous || 0) + 1);

  return {
    list: () => read().slice().sort((a, b) => b.updated - a.updated),
    get(id) {
      const file = read().find(f => f.id === id);
      return file ? { ...file, data: clean(file.data) } : null;
    },
    checkName(name) { return cleanName(name, read()); },
    create(name, data) {
      const files = read();
      if (files.length >= MAX_FILES) throw new Error('Too many saved files. Delete some first.');
      const updated = stamp();
      const file = { id: 'f' + updated.toString(36) + Math.random().toString(36).slice(2, 8), name: cleanName(name, files), updated, data: clean(data) };
      files.push(file); write(files);
      return file;
    },
    update(id, data) {
      const files = read(), file = find(files, id);
      file.data = clean(data); file.updated = stamp(file.updated); write(files);
      return file;
    },
    rename(id, name) {
      const files = read(), file = find(files, id);
      file.name = cleanName(name, files, id); write(files);
      return file;
    },
    remove(id) {
      const files = read(); find(files, id);
      write(files.filter(f => f.id !== id));
    }
  };
}

// "name", or "name (2)", "name (3)"… if it is already taken.
export function freeName(store, name) {
  const taken = new Set(store.list().map(f => f.name.toLowerCase()));
  const base = String(name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME - 6) || 'file';
  let out = base;
  for (let n = 2; taken.has(out.toLowerCase()); n++) out = `${base} (${n})`;
  return out;
}
export const findByName = (store, name) => {
  const wanted = String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return store.list().find(f => f.name.toLowerCase() === wanted) || null;
};

// Which saved program the editor is working on, and the rules that stop work being lost.
// `doc` is kept with the autosaved draft: {id, stamp (version we have), clean (loaded text), suggest}.
export function createProgramSession({ store, getDoc, setDoc, capture, restore, blank, ask, changed = () => {} }) {
  const put = doc => { setDoc(doc); changed(); };
  const mark = file => put({ id: file.id, stamp: file.updated, clean: null, suggest: '' });
  const current = () => getDoc()?.id ? store.get(getDoc().id) : null;
  function isDirty() {
    const data = capture(), file = current();
    if (file) return fingerprint(data) !== fingerprint(file.data);
    return !isEmptyWork(data) && fingerprint(data) !== getDoc()?.clean;
  }
  const mayDiscard = () => !isDirty() || ask('Your unsaved changes will be lost. Continue?');
  return {
    current, isDirty, mayDiscard,
    // The editor now holds something that is not one of the saved files (import, demo, shared link).
    detach(suggest = '') { put({ id: null, stamp: 0, clean: fingerprint(capture()), suggest }); },
    save() {
      const file = current();
      if (!file) return { needName: true };
      if (file.updated !== getDoc().stamp && !ask('This file was changed in another tab. Replace it with what is on screen?')) return { cancelled: true };
      const saved = store.update(file.id, capture()); mark(saved);
      return { file: saved };
    },
    saveAs(name) {
      const other = findByName(store, name);
      if (other && other.id !== getDoc()?.id && !ask('A file with this name already exists. Replace it?')) return { cancelled: true };
      const saved = other ? store.update(other.id, capture()) : store.create(name, capture()); mark(saved);
      return { file: saved };
    },
    open(id) {
      const file = store.get(id);
      if (!file) throw new Error('This file no longer exists.');
      if (!mayDiscard()) return { cancelled: true };
      restore(file.data); mark(file);
      return { file };
    },
    newFile(name) {
      store.checkName(name);
      if (!mayDiscard()) return { cancelled: true };
      const before = capture();
      blank();
      let file;
      try { file = store.create(name, capture()); } catch (err) { restore(before); throw err; }
      mark(file);
      return { file };
    },
    // After deleting the open file, what is on screen is saved nowhere.
    removed(id) { if (getDoc()?.id === id) put({ id: null, stamp: 0, clean: null, suggest: '' }); }
  };
}
