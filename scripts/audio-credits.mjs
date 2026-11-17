// Builds the music and sound credits from the audio table in docs/ASSETS.md (hand-off 002, game 0.6.60).
// One source, two places, so the two lists cannot differ:
//   www/audio/credits.json   read by the game (which files exist, and the credits list in Settings)
//   www/terms.html           the credits block between the audio-credits markers
// Run after any change to the audio table:   node scripts/audio-credits.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const COLUMNS = ['file', 'use', 'piece', 'composer', 'performer', 'source', 'licence', 'licenceLink', 'shortened', 'checked', 'licenceCopy'];
export const START = '<!-- audio-credits:start';
export const END = '<!-- audio-credits:end -->';

// The rows of the table under "## Audio files" in docs/ASSETS.md, one object per audio file
export function audioRows(md) {
  const lines = md.split('\n');
  const start = lines.findIndex(l => /^## Audio files/.test(l));
  if (start < 0) return [];
  const rows = [];
  let inTable = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^## /.test(l)) break;
    if (!l.startsWith('|')) { if (inTable) break; continue; }
    const cells = l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (!inTable) { inTable = true; continue; }             // the header row
    if (cells.every(c => /^:?-+:?$/.test(c))) continue;    // the line under the header
    rows.push(Object.fromEntries(COLUMNS.map((k, j) => [k, cells[j] || ''])));
  }
  return rows;
}

const has = v => !!v && v !== '-';
const shortened = r => /^yes/i.test(r.shortened);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const who = r => (r.use === 'music' ? 'Performed by ' : 'Made by ') + r.performer;

// One credit line as plain text (Settings shows addresses as text, so nothing leads a child outside the game)
export function creditText(r) {
  return `${r.piece}${has(r.composer) ? ', by ' + r.composer : ''}. ${who(r)}. Source: ${r.source}. Licence: ${r.licence}, ${r.licenceLink}.${shortened(r) ? ' Shortened for the Game.' : ''}`;
}
// The same line for the terms page, with links
export function creditHtml(r) {
  return `<li>${esc(r.piece)}${has(r.composer) ? ', by ' + esc(r.composer) : ''}. ${esc(who(r))}. Source: <a href="${esc(r.source)}">${esc(r.source)}</a>. ` +
    `Licence: <a href="${esc(r.licenceLink)}">${esc(r.licence)}</a>.${shortened(r) ? ' Shortened for the Game.' : ''}</li>`;
}
export function creditsJson(rows) {
  return JSON.stringify({ files: rows.map(r => ({ file: r.file, use: r.use, credit: creditText(r) })) }, null, 2) + '\n';
}
export function termsBlock(rows) {
  const body = rows.length
    ? '  <p>Credits:</p>\n  <ul>\n' + rows.map(r => '    ' + creditHtml(r)).join('\n') + '\n  </ul>'
    : '  <p>Credits: the list of music and sound files is added here when the first files are in the Game.</p>';
  return `  ${START} (written by scripts/audio-credits.mjs from docs/ASSETS.md; do not edit by hand) -->\n${body}\n  ${END}`;
}
// The terms page with its credits block replaced
export function withCredits(html, rows) {
  const lines = html.split('\n');
  const a = lines.findIndex(l => l.includes(START)), b = lines.findIndex(l => l.includes(END));
  if (a < 0 || b < a) throw new Error('www/terms.html has no audio-credits markers');
  lines.splice(a, b - a + 1, termsBlock(rows));
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = audioRows(fs.readFileSync(path.join(root, 'docs', 'ASSETS.md'), 'utf8'));
  fs.mkdirSync(path.join(root, 'www', 'audio'), { recursive: true });
  fs.writeFileSync(path.join(root, 'www', 'audio', 'credits.json'), creditsJson(rows));
  const terms = path.join(root, 'www', 'terms.html');
  fs.writeFileSync(terms, withCredits(fs.readFileSync(terms, 'utf8'), rows));
  console.log(`Credits written for ${rows.length} audio file(s): www/audio/credits.json and www/terms.html`);
}
