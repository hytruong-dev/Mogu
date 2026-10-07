const fs = require('fs');
const path = require('path');
const root = 'mobile/src/screens';
const srcPath = path.join(root, 'ProfileScreen.tsx');
fs.copyFileSync(srcPath, 'tmp_ProfileScreen.orig.tsx');
const lines = fs.readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
const sl = (a, b) => lines.slice(a - 1, b).join('\n') + '\n';

// Full import block of the original file (lines 1-86 + 100-150) used as the pool.
const importPool = sl(1, 86) + sl(100, 151);

function fixPaths(s, depth) {
  // original lives in src/screens ; new files live in src/screens/profile[/pages]
  const up = depth === 1 ? '../' : '../../';
  return s
    .replace(/from '\.\.\/(?!\.)/g, `from '${up}../`)
    .replace(/from '\.\/profile\/ProfileUI'/g, depth === 1 ? "from './ProfileUI'" : "from '../ProfileUI'")
    .replace(/from '\.\/meal-journal\//g, `from '${up}meal-journal/`)
    .replace(/require\('\.\.\/assets/g, `require('${up}../assets`);
}

function pruneImports(poolSrc, body, extraImports = '') {
  const importRe = /import\s+(type\s+)?(?:([\w$]+)\s*,?\s*)?(?:\{([\s\S]*?)\})?\s*(?:from\s*)?'([^']+)';/g;
  const out = [];
  const seen = new Set();
  const all = poolSrc + '\n' + extraImports;
  let m;
  while ((m = importRe.exec(all))) {
    const [, typeOnly, def, named, from] = m;
    const names = named
      ? named.split(',').map((x) => x.trim()).filter(Boolean)
      : [];
    const used = (n) => {
      const local = n.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      return new RegExp(`(^|[^\\w$.])${local.replace('$', '\\$')}([^\\w$]|$)`).test(body);
    };
    const keep = names.filter(used);
    const keepDef = def && used(def) ? def : null;
    if (!keep.length && !keepDef) continue;
    const key = from + '|' + keepDef + '|' + keep.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    let stmt = 'import ' + (typeOnly ? 'type ' : '');
    const parts = [];
    if (keepDef) parts.push(keepDef);
    if (keep.length) parts.push('{ ' + keep.join(', ') + ' }');
    stmt += parts.join(', ') + ` from '${from}';`;
    out.push(stmt);
  }
  return out.join('\n') + '\n\n';
}

function write(file, body, depth, extraImports = '') {
  const fixedPool = fixPaths(importPool, depth);
  const fixedExtra = extraImports;
  const fixedBody = fixPaths(body, depth);
  const imports = pruneImports(fixedPool, fixedBody, fixedExtra);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, imports + fixedBody);
}

// ── shared.tsx ───────────────────────────────────────────────────────────────
let shared = sl(153, 278) + '\n' + sl(280, 301) + '\n' + sl(967, 1014) + '\n' + sl(2943, 3027) + '\n' + sl(3029, 3099);
shared = shared
  .replace(/^function /gm, 'export function ')
  .replace(/^const (GENDER_OPTIONS|dishPlaceholder)/gm, 'export const $1')
  .replace(/^type (ConfirmState|Page|Props)/gm, 'export type $1')
  .replace('let setGlobalConfirmState: ((s: ConfirmState) => void) | null = null;',
    'let setGlobalConfirmState: ((s: ConfirmState) => void) | null = null;\nexport function registerConfirmSetter(fn: ((s: ConfirmState) => void) | null) {\n  setGlobalConfirmState = fn;\n}')
  .replace(/^export function isDoneStatus/m, 'function isDoneStatus')
  .replace('export const fr =', 'const fr =');
shared += '\nexport { isDoneStatus };\n';
write(path.join(root, 'profile', 'shared.tsx'), shared, 1);

// ── pages ────────────────────────────────────────────────────────────────────
const sharedImport = (names) => `import { ${names} } from '../shared';\n`;

let main = sl(370, 904).replace(/^function ProfileMain/m, 'export function ProfileMain');
write(path.join(root, 'profile', 'pages', 'ProfileMain.tsx'), main, 2,
  sharedImport('confirmAction, type Page, type Props'));

let edit = sl(1189, 1404).replace(/^function EditPage/m, 'export function EditPage');
write(path.join(root, 'profile', 'pages', 'EditPage.tsx'), edit, 2,
  sharedImport('LoadBlock, errMsg, formatGender, parseGenderLabel, formatDob, parseDobInput, GENDER_OPTIONS'));

let journey = sl(1406, 1592).replace(/^function JourneyPage/m, 'export function JourneyPage');
write(path.join(root, 'profile', 'pages', 'JourneyPage.tsx'), journey, 2,
  sharedImport('LoadBlock, errMsg, MonthCalendar'));

let avoid = sl(2027, 2313).replace(/^function AvoidPage/m, 'export function AvoidPage');
write(path.join(root, 'profile', 'pages', 'AvoidPage.tsx'), avoid, 2,
  sharedImport('LoadBlock, errMsg'));

// ── pieces reused by rewritten pages (kept as text for manual composition) ───
fs.writeFileSync('tmp_health_bits.txt', sl(1754, 1813));      // bmiCategory, BmiScale, hs
fs.writeFileSync('tmp_choice_bits.txt', sl(1919, 2025));      // ChoiceGrid, ChoiceChips, ps
fs.writeFileSync('tmp_history_bits.txt', sl(2765, 2820));     // groupByDay, formatClock, rs
fs.writeFileSync('tmp_privacy_bits.txt', sl(2625, 2647));     // passwordStrength, pv
fs.writeFileSync('tmp_history_body.txt', sl(2651, 2763));     // HistoryPage
console.log('done');
