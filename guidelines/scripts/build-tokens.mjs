#!/usr/bin/env node
// Erzeugt aus tokens.json die CSS-Dateien des Designguides und prüft die Kontraste.
//
//   node guidelines/scripts/build-tokens.mjs           CSS schreiben, Kontraste prüfen
//   node guidelines/scripts/build-tokens.mjs --check   nur prüfen, nichts schreiben
//
// Ausgabe:
//   css/tokens.css             Basis-Tokens (Neutralfarben, Status, Abstände, Radien, Grössen)
//   css/profiles/<name>.css    Markenfarben je Profil (primary, sidebar-bg, action …)
//
// Exit-Code 1, wenn ein Kontrastpaar in einem Profil oder Theme unter dem Minimum liegt.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');
const P = `--${tokens.meta.prefix}-`;
const THEMES = ['light', 'dark'];

// ---------- Farben rechnen ----------

/** "#rgb", "#rrggbb", "#rrggbbaa", "rgba(r,g,b,a)", "transparent" → [r, g, b, a] (0–1). */
function parse(value) {
  if (value === 'transparent') return [0, 0, 0, 0];
  let m = value.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) {
    const n = m[1];
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).concat(m[2] ? parseInt(m[2], 16) / 255 : 1);
  }
  m = value.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim());
    return [r / 255, g / 255, b / 255, Number(a)];
  }
  throw new Error(`Farbwert nicht lesbar: ${value}`);
}

/** Legt eine (teil-)transparente Farbe auf einen deckenden Grund. */
const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];

const lum = ([r, g, b]) => {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Löst einen Token-Namen für Profil und Theme zu einem Farbwert auf (inkl. abgeleiteter Tints). */
function resolve(name, profile, theme) {
  const base = tokens.color.base.find((t) => t.name === name);
  if (base) return parse(base[theme]);
  if (name in profile[theme]) return parse(profile[theme][name]);
  const tint = name.match(/^primary-tint-(\d+)$/);
  if (tint) {
    const [r, g, b] = resolve('primary', profile, theme);
    return [r, g, b, Number(tint[1]) / 100];
  }
  if (name === 'focus-ring') return resolve('primary', profile, theme);
  throw new Error(`Unbekanntes Token im Kontrastpaar: ${name}`);
}

// ---------- Kontraste prüfen ----------

let failures = 0;
for (const [id, profile] of Object.entries(tokens.profiles)) {
  for (const theme of THEMES) {
    const rows = [];
    for (const pair of tokens.contrast.pairs) {
      const on = pair.on ? resolve(pair.on, profile, theme) : null;
      let bg = resolve(pair.bg, profile, theme);
      if (bg[3] < 1) bg = over(bg, on ?? resolve('surface', profile, theme));
      const fg = over(resolve(pair.fg, profile, theme), bg);
      const r = ratio(fg, bg);
      const ok = r + 1e-9 >= pair.min;
      if (!ok) failures++;
      rows.push(`  ${ok ? 'ok  ' : 'FEHL'} ${pair.fg.padEnd(19)} auf ${pair.bg.padEnd(16)} ${r.toFixed(2).padStart(5)}:1 (min ${pair.min})`);
    }
    const bad = rows.filter((r) => r.includes('FEHL'));
    console.log(`${id} · ${theme}: ${rows.length - bad.length}/${rows.length} Paare bestanden`);
    bad.forEach((r) => console.log(r));
  }
}

// ---------- CSS schreiben ----------

const decl = (name, value) => `  ${P}${name}: ${value};`;
const block = (selector, lines) => `${selector} {\n${lines.join('\n')}\n}\n`;
const darkBlocks = (lines) =>
  [
    '/* Dunkel: explizit gewählt … */',
    block(`[data-theme='dark']`, ['  color-scheme: dark;', ...lines]),
    '/* … oder Systemeinstellung, solange kein Theme gewählt ist. */',
    `@media (prefers-color-scheme: dark) {\n${block(`  :root:not([data-theme='light'])`, ['  color-scheme: dark;', ...lines].map((l) => '  ' + l)).replace(/\n}\n$/, '\n  }\n')}}\n`,
  ].join('\n');

const header = (what) =>
  `/* ${what}\n   Generiert aus guidelines/tokens.json mit scripts/build-tokens.mjs – nicht von Hand ändern. */\n\n`;

const baseLight = [
  '  color-scheme: light;',
  decl('font-sans', tokens.type.family),
  decl('font-mono', tokens.type.mono),
  ...tokens.color.base.map((t) => decl(t.name, t.light)),
  ...tokens.color.derived.map((t) => decl(t.name, t.css)),
  ...tokens.spacing.map((t) => decl(t.name, t.value)),
  ...tokens.radius.map((t) => decl(t.name, t.value)),
  ...tokens.size.map((t) => decl(t.name, t.value)),
  ...tokens.shadow.map((t) => decl(t.name, t.light)),
];
const baseDark = [
  ...tokens.color.base.filter((t) => t.dark !== t.light).map((t) => decl(t.name, t.dark)),
  ...tokens.shadow.map((t) => decl(t.name, t.dark)),
];

const outputs = {
  'css/tokens.css': header('Designguide: Basis-Tokens') + block(':root', baseLight) + '\n' + darkBlocks(baseDark),
};
for (const [id, profile] of Object.entries(tokens.profiles)) {
  const lines = (theme) => tokens.color.brand.map((t) => decl(t.name, profile[theme][t.name]));
  outputs[`css/profiles/${id}.css`] =
    header(`Designguide: Profil «${profile.label}». ${profile.usage}`) +
    block(':root', lines('light')) + '\n' + darkBlocks(lines('dark'));
}

if (!checkOnly) {
  for (const [file, css] of Object.entries(outputs)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), css);
    console.log(`geschrieben: guidelines/${file}`);
  }
}

if (failures) {
  console.error(`\n${failures} Kontrastpaar(e) unter dem Minimum.`);
  process.exit(1);
}
