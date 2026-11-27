// The "My files" window (programs, robots, attachments) and the file bar above the block editor.
import { createFileStore, createStore, createProgramSession, freeName, findByName, downloadName } from './files.js';
import { ROBOTS_KEY, ATTACHMENTS_KEY, MAX_ITEM_FILE, cleanRobot, cleanAttachment, takeAttachment, portClashes, encodeItemFile, decodeItemFile, itemFileName } from './robot-files.js';
import { jsonToProgram } from './blocks-json.js';
import { prepareProgram } from './compatibility.js';
import { exportLlsp3 } from './spike-io.js';
import { tr } from './i18n.js';

// Translate a sentence, then put names in, so a file name is never translated.
const say = (text, values = {}) => tr(text).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
const when = ms => { const d = new Date(ms), two = n => String(n).padStart(2, '0'); return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`; };
const armText = a => `${a.port}: ${tr(a.motion === 'sweep' ? 'sweep arm' : a.tool === 'fork' ? 'fork' : 'lift arm')} ${Math.round(a.len)} ${tr('mm')}`;

function saveToComputer(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

export function setupFiles({ storage, getDoc, setDoc, capture, restore, blank, getRobot, applyRobot, applyAttachment, blocked, message, openSpikeFile, practising }) {
  const $ = id => document.getElementById(id);
  const dialog = $('files');
  const stores = {
    program: createFileStore(storage),
    robot: createStore(storage, ROBOTS_KEY, cleanRobot),
    attachment: createStore(storage, ATTACHMENTS_KEY, cleanAttachment)
  };
  const ask = (text, values) => confirm(say(text, values));
  const session = createProgramSession({ store: stores.program, getDoc, setDoc, capture, restore, blank, ask, changed: () => renderBar() });
  let kind = 'program';

  const KINDS = {
    program: {
      save: 'Save program', added: '', note: 'A program file keeps the blocks and the start position. The robot setup stays as it is.',
      empty: 'No saved programs yet. Type a name and press Save.', use: 'Open', describe: () => ''
    },
    robot: {
      save: 'Save this robot', note: 'A robot keeps its sizes, wheels, sensors, ports, weight and attachments.',
      empty: 'No saved robots yet. Set the robot up on the Robot tab, type a name and press Save.', use: 'Use',
      describe: c => [c.model === 'ev3' ? 'EV3' : 'SPIKE', `${tr('wheel')} ${c.wheel} ${tr('mm')}`, c.arms.map(armText).join(', ')].filter(Boolean).join(' · ')
    },
    attachment: {
      save: 'Save attachment', note: 'An attachment is every arm now on the robot, with its place, port, size and weight. Using one replaces the arms and keeps the rest of the robot.',
      empty: 'No saved attachments yet. Add an arm on the Robot tab, type a name and press Save.', use: 'Put on robot',
      describe: d => `${d.arms.map(armText).join(', ')} · ${d.armMassG} ${tr('g')}`
    }
  };

  const status = (text, bad = false) => { const s = $('files-status'); s.textContent = text; s.classList.toggle('bad', bad); };
  // Run one user action; anything that goes wrong is shown, never swallowed.
  function act(fn) {
    const why = blocked();
    if (why) { status(tr(why), true); message(tr(why)); return; }
    try { fn(); } catch (err) { status(tr(err.message), true); if (!dialog.open) message(tr(err.message)); }
  }

  function renderBar() {
    const label = $('fb-name'); if (!label || practising()) return; // the editor holds a practice draft
    let name = tr('Not saved yet'), dirty = false;
    try { const file = session.current(); if (file) name = file.name; dirty = session.isDirty(); }
    catch { /* unreadable storage or no editor: the Files window explains */ }
    $('fb-text').textContent = name;
    label.classList.toggle('dirty', dirty);
    label.title = dirty ? tr('Unsaved changes') : name;
    $('fb-mark').textContent = dirty ? '●' : '';
  }

  function row(item) {
    const meta = KINDS[kind];
    const li = document.createElement('li'); li.className = 'file-row'; li.dataset.id = item.id;
    const isCurrent = kind === 'program' && getDoc()?.id === item.id;
    if (isCurrent) li.classList.add('current');
    const info = document.createElement('div'); info.className = 'file-info';
    const name = document.createElement('b'); name.textContent = item.name;
    const sub = document.createElement('span'); sub.className = 'fine';
    let detail = '';
    try { detail = meta.describe(stores[kind].get(item.id).data); } catch { detail = tr('This file is damaged.'); }
    sub.textContent = [isCurrent ? tr('open now') : '', detail, when(item.updated)].filter(Boolean).join(' · ');
    info.append(name, sub);
    const buttons = document.createElement('div'); buttons.className = 'row file-actions';
    for (const [action, text, cls] of [['use', meta.use, ' primary'], ['download', 'Download', ''], ['rename', 'Rename', ''], ['delete', 'Delete', ' red']]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small' + cls; b.dataset.fileAction = action; b.textContent = tr(text);
      buttons.append(b);
    }
    li.append(info, buttons);
    return li;
  }

  function render() {
    for (const b of dialog.querySelectorAll('[data-kind]')) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
    $('files-save').textContent = tr(KINDS[kind].save);
    $('files-new').hidden = kind !== 'program';
    $('files-note').textContent = tr(KINDS[kind].note);
    const list = $('files-list'); list.replaceChildren();
    try {
      const items = stores[kind].list();
      if (!items.length) { const li = document.createElement('li'); li.className = 'fine'; li.textContent = tr(KINDS[kind].empty); list.append(li); }
      else list.append(...items.map(row));
    } catch (err) { status(tr(err.message), true); }
  }

  function open(which = 'program', hint = '') {
    kind = which; status(hint && tr(hint));
    $('files-name').value = kind === 'program' ? (session.current()?.name || getDoc()?.suggest || '') : '';
    render();
    if (!dialog.open) dialog.showModal();
    if (hint) $('files-name').focus();
  }

  function saveNamed(name) {
    if (kind === 'program') return session.saveAs(name);
    const data = kind === 'robot' ? cleanRobot(getRobot()) : takeAttachment(getRobot());
    const same = findByName(stores[kind], name);
    if (same && !ask('A file with this name already exists. Replace it?')) return { cancelled: true };
    return { file: same ? stores[kind].update(same.id, data) : stores[kind].create(name, data) };
  }

  $('files-form').onsubmit = e => {
    e.preventDefault();
    act(() => { const r = saveNamed($('files-name').value); if (r.file) { render(); status(say('Saved “{name}”.', r.file)); } });
  };
  $('files-new').onclick = () => act(() => {
    const r = session.newFile($('files-name').value);
    if (r.file) { dialog.close(); message(say('New file “{name}”. Add blocks under “when program starts”.', r.file)); }
  });

  $('files-list').addEventListener('click', e => {
    const button = e.target.closest('[data-file-action]'); if (!button) return;
    const id = button.closest('[data-id]').dataset.id, action = button.dataset.fileAction, store = stores[kind];
    act(() => {
      const item = store.get(id);
      if (!item) { render(); throw new Error('This file no longer exists.'); }
      if (action === 'use') {
        if (kind === 'program') { if (session.open(id).file) { dialog.close(); message(say('Opened “{name}”.', item)); } }
        else if (kind === 'robot') {
          if (!ask('Replace the robot on this screen with “{name}”? Save the current robot first if you need it.', item)) return;
          applyRobot(item.data); dialog.close(); message(say('Robot “{name}” is ready.', item));
        } else {
          if (!ask('Put “{name}” on the robot? It replaces the arms that are on it now.', item)) return;
          applyAttachment(item.data); dialog.close();
          const clash = portClashes(getRobot());
          message(say('Attachment “{name}” is on the robot.', item) + (clash.length ? ' ' + say('Check the ports: {ports} is also used by the wheels or a sensor.', { ports: clash.join(', ') }) : ''));
        }
      } else if (action === 'download') {
        if (kind === 'program') {
          const program = prepareProgram(jsonToProgram(item.data.workspace).program);
          saveToComputer(downloadName(item.name), exportLlsp3(program, item.name).zip, 'application/octet-stream');
        } else saveToComputer(itemFileName(item.name, kind), encodeItemFile(kind, item.name, item.data), 'application/json');
        status(say('“{name}” was sent to your Downloads folder.', item));
      } else if (action === 'rename') {
        const name = prompt(tr('New name'), item.name);
        if (name === null) return;
        store.rename(id, name); render(); renderBar();
      } else if (action === 'delete') {
        if (!ask('Delete “{name}”? This cannot be undone.', item)) return;
        store.remove(id);
        if (kind === 'program') session.removed(id);
        render(); status(say('Deleted “{name}”.', item));
      }
    });
  });

  $('files-from-computer').onclick = () => {
    if (kind === 'program') act(() => { dialog.close(); openSpikeFile(); });
    else $('files-import').click();
  };
  $('files-import').addEventListener('change', async e => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    let text = null;
    if (file.size <= MAX_ITEM_FILE) text = await file.text();
    act(() => {
      const item = decodeItemFile(text); // checks every value
      const store = stores[item.type], added = store.create(freeName(store, item.name), item.data);
      kind = item.type; render();
      status(say('Added “{name}”. Press the green button to use it.', added));
    });
  });

  for (const b of dialog.querySelectorAll('[data-kind]')) b.onclick = () => { kind = b.dataset.kind; $('files-name').value = ''; status(''); render(); };
  $('files-close').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-open-files]'); if (b) open(b.dataset.openFiles); });

  function quickSave() {
    act(() => {
      const r = session.save();
      if (r.needName) open('program', 'Type a name and press “Save program”.');
      else if (r.file) message(say('Saved “{name}”.', r.file));
    });
  }
  // The bar is rebuilt with the code tab, so listen on the document.
  document.addEventListener('click', e => {
    if (e.target.closest('#fb-save')) quickSave();
    else if (e.target.closest('#fb-new')) open('program', 'Type a name for the new file, then press “New file”.');
  });
  // Another tab saved or deleted something.
  window.addEventListener('storage', () => { renderBar(); if (dialog.open) render(); });

  renderBar();
  return {
    renderBar, quickSave, open,
    currentName() { try { return session.current()?.name || ''; } catch { return ''; } },
    mayDiscard() { try { return session.mayDiscard(); } catch { return ask('Your unsaved changes will be lost. Continue?'); } },
    detach(suggest) { session.detach(suggest); }
  };
}
