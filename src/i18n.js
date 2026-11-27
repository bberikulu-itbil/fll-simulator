// Tiny translation layer. English is the source text, so the simulator logic stays untouched:
// text is translated where it is shown. In tests (no browser) everything stays English.
import blocks from './lang/blocks.js';
import ui from './lang/ui.js';
import patterns from './lang/patterns.js';

export const LANGS = { kk: 'Қазақша', ru: 'Русский', en: 'English' };
const KEY = 'bioglow-lang';
const stored = () => { try { return globalThis.document ? localStorage.getItem(KEY) || 'kk' : 'en'; } catch { return 'kk'; } };
let lang = stored();
if (!LANGS[lang]) lang = 'kk';

// The block table and page table share one lookup (same English text, same translation).
const table = new Map([...ui, ...blocks].map(row => [row[0], row]));
export const getLang = () => lang;
export function setLang(next) { if (LANGS[next]) lang = next; try { localStorage.setItem(KEY, lang); } catch { /* not remembered */ } }

export function tr(text, depth = 0) {
  if (lang === 'en' || typeof text !== 'string') return text;
  const key = text.trim().replace(/\s+/g, ' ');
  if (!key) return text;
  const i = lang === 'kk' ? 1 : 2;
  let out = table.get(key)?.[i];
  if (out === undefined && depth < 4) {
    for (const [re, kk, ru] of patterns) {
      const m = key.match(re);
      if (m) { out = (i === 1 ? kk : ru).replace(/\$(\d)/g, (_, n) => tr(m[n] ?? '', depth + 1)); break; }
    }
  }
  return out === undefined ? text : text.match(/^\s*/)[0] + out + text.match(/\s*$/)[0];
}

// Translate what is on the page now and whatever gets rendered later. Editor contents
// and anything the user typed (variables, file names) are left alone.
const SKIP = '#blockly, .blocklyWidgetDiv, .blocklyDropDownDiv, .blocklyTooltipDiv, script, style, textarea, [data-no-i18n]';
const ATTRS = ['title', 'aria-label', 'placeholder'];
function translateNode(node) {
  if (node.nodeType === 3) {
    if (node.parentElement?.closest(SKIP)) return;
    const next = tr(node.nodeValue); if (next !== node.nodeValue) node.nodeValue = next;
  } else if (node.nodeType === 1) {
    if (node.matches(SKIP)) return;
    for (const a of ATTRS) { const v = node.getAttribute(a); if (v) { const next = tr(v); if (next !== v) node.setAttribute(a, next); } }
    for (const child of node.childNodes) translateNode(child);
  }
}
export function translatePage() {
  document.documentElement.lang = lang;
  if (lang === 'en') return;
  document.title = tr(document.title);
  translateNode(document.body);
  new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'childList') r.addedNodes.forEach(translateNode);
      else if (r.type === 'characterData') translateNode(r.target);
      else if (!r.target.closest(SKIP)) { const v = r.target.getAttribute(r.attributeName); if (v) { const next = tr(v); if (next !== v) r.target.setAttribute(r.attributeName, next); } }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributeFilter: ATTRS });
}
