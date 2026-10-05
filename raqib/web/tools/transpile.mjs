// Transpile the Claude Design (.dc.html) template into React TSX components.
import { parseDocument } from 'htmlparser2';
import fs from 'fs';
import path from 'path';

const OUT = process.argv[2];
let src = fs.readFileSync(process.argv[3] ?? 'Raqib.dc.html', 'utf8').split('\n');
src.pop(); // last line is cut mid-tag by the 256KiB get_file cap; modal tail is hand-written
src = src.join('\n');
const doc = parseDocument(src, { lowerCaseAttributeNames: false, lowerCaseTags: false });
const find = (n, fn) => { if (fn(n)) return n; for (const c of n.children || []) { const r = find(c, fn); if (r) return r; } };
const ready = find(doc, n => n.name === 'sc-if' && n.attribs.value === '{{ready}}');

const VOID = new Set(['input', 'br', 'img', 'hr', 'meta', 'link']);
const BLOCK = new Set(['div', 'section', 'p', 'h1', 'h2', 'h3', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'header', 'aside', 'nav', 'article', 'footer', 'sc-if', 'sc-for', 'select', 'textarea', 'button', 'label']);
const ATTR = { class: 'className', for: 'htmlFor', colspan: 'colSpan', autocomplete: 'autoComplete', inputmode: 'inputMode', readonly: 'readOnly' };
const DROP = new Set(['hint-placeholder-count', 'hint-placeholder-val']);

const camel = p => p.startsWith('--') ? p : p.replace(/^-(webkit|moz|ms)-/, (_, v) => v[0].toUpperCase() + v.slice(1) + '-').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const PATH = /^\{\{\s*([A-Za-z_][\w.]*)\s*\}\}$/;
const jsStr = s => JSON.stringify(s);
function tpl(v) {
  if (!v.includes('{{')) return jsStr(v);
  const m = v.match(PATH); if (m) return m[1];
  return '`' + v.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g, (_, p) => '${' + p + '}') + '`';
}
function splitDecls(s) {
  const out = []; let cur = '', depth = 0, br = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (s.startsWith('{{', i)) { br++; cur += '{{'; i++; continue; }
    if (s.startsWith('}}', i)) { br--; cur += '}}'; i++; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0 && br === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
function styleObj(s) {
  const parts = [];
  for (const d of splitDecls(s)) {
    const i = d.indexOf(':'); if (i < 0) continue;
    const prop = d.slice(0, i).trim(), val = d.slice(i + 1).trim(); if (!prop) continue;
    const k = camel(prop);
    parts.push((/^[A-Za-z_$][\w$]*$/.test(k) ? k : jsStr(k)) + ': ' + tpl(val));
  }
  return '{ ' + parts.join(', ') + ' }';
}
const bindings = [];
function collectBindings(str, scope) {
  for (const m of str.matchAll(/\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g)) { const root = m[1].split('.')[0]; if (!scope.has(root)) bindings.push(root); }
}
function jsxText(s) { return /[{}<>]/.test(s) ? '{' + jsStr(s) + '}' : s; }

function emitChildren(node, scope, parentStyle) {
  const kids = node.children || [];
  const outs = [];
  kids.forEach((c, i) => {
    if (c.type === 'text') {
      const raw = c.data;
      if (!raw.trim()) {
        if (!raw.includes('\n')) {
          const prev = kids[i - 1], next = kids[i + 1];
          if (prev && next && !BLOCK.has(prev.name) && !BLOCK.has(next.name) && !/display:\s*(flex|grid)/.test(parentStyle || '')) outs.push("{' '}");
        }
        return;
      }
      const text = raw.replace(/\s+/g, ' ');
      collectBindings(text, scope);
      let res = '', last = 0;
      for (const m of text.matchAll(/\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g)) {
        const lit = text.slice(last, m.index); if (lit) res += jsxText(lit);
        res += '{' + m[1] + '}'; last = m.index + m[0].length;
      }
      const rest = text.slice(last); if (rest) res += jsxText(rest);
      outs.push(res);
    } else if (c.type === 'tag') {
      outs.push(emitNode(c, scope));
    }
  });
  return outs.join('\n');
}

function emitNode(n, scope) {
  const name = n.name;
  if (name === 'sc-if') {
    const v = n.attribs.value; const m = v.match(PATH); collectBindings(v, scope);
    if (!m) throw new Error('complex sc-if ' + v);
    return `{${m[1]} ? (<>\n${emitChildren(n, scope)}\n</>) : null}`;
  }
  if (name === 'sc-for') {
    const lst = n.attribs.list.match(PATH)[1]; const as = n.attribs.as; collectBindings(n.attribs.list, scope);
    const inner = new Set(scope); inner.add(as);
    const kidsOut = emitChildren(n, inner); const used = new RegExp("\\b" + as + "\\b").test(kidsOut);
    return `{(${lst} || []).map((${used ? as : "_" + as}: any, __i: number) => (<Fragment key={__i}>
${kidsOut}
</Fragment>))}`;
  }
  let tag = name; const attrs = []; let hover = null; let styleStr = '';
  const handlerExprs = {};
  for (const [k0, v] of Object.entries(n.attribs)) {
    if (DROP.has(k0)) continue;
    if (k0 === 'style-hover') { hover = v; continue; }
    if (k0 === 'style') { styleStr = v; collectBindings(v, scope); continue; }
    const k = ATTR[k0] || k0;
    collectBindings(v, scope);
    if (/^on[A-Z]/.test(k)) { const e = tpl(v); handlerExprs[k] = e; attrs.push(`${k}={${e}}`); continue; }
    if (k === 'ref') { attrs.push(`ref={${tpl(v)}}`); continue; }
    if (k === 'multiple') { attrs.push('multiple'); continue; }
    if (v.includes('{{')) { attrs.push(`${k}={${tpl(v)}}`); continue; }
    if (v === '' && ['checked', 'disabled', 'readOnly'].includes(k)) { attrs.push(k); continue; }
    if (['rows', 'colSpan', 'tabIndex'].includes(k) && /^\d+$/.test(v)) { attrs.push(`${k}={${v}}`); continue; }
    attrs.push(`${k}=${jsStr(v)}`);
  }
  if (styleStr) attrs.push(`style={${styleObj(styleStr)}}`);
  if (hover) { collectBindings(hover, scope); attrs.push(`hover={${styleObj(hover)}}`); attrs.unshift(`as=${jsStr(tag)}`); tag = 'Hover'; }
  if (handlerExprs.onClick && !['button', 'a', 'input', 'select', 'textarea', 'Hover'].includes(tag) && !hover) {
    if (/inset:\s*0/.test(styleStr)) attrs.push('aria-hidden="true"');
    else attrs.push(`role="button" tabIndex={0} onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (${handlerExprs.onClick})(e); } }}`);
  }
  if (VOID.has(name)) return `<${tag} ${attrs.join(' ')} />`;
  const inner = emitChildren(n, scope, styleStr);
  return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${inner ? '\n' + inner + '\n' : ''}</${tag}>`;
}

function component(file, fname, nodes, scopeInit = new Set()) {
  bindings.length = 0;
  const body = nodes.map(n => emitNode(n, scopeInit)).join('\n');
  const roots = [...new Set(bindings)].sort();
  const imports = [];
  if (/<Fragment/.test(body)) imports.push('import { Fragment } from "react";');
  if (/<Hover/.test(body)) imports.push('import { Hover } from "@/ui/Hover";');
  imports.push('import type { VM } from "@/ui/vm";');
  const destructure = roots.length ? `  const { ${roots.join(', ')} } = vm;\n` : '';
  const FIXES = [['{ov.overall}%', '{ov.overallTxt}']]; // presenter owns units, so an empty state can show a dash
  let patched = body; for (const [a, b] of FIXES) patched = patched.split(a).join(b);
  const code = `/* eslint-disable */\n// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.\n${imports.join('\n')}\n\nexport function ${fname}({ vm }: { vm: VM }) {\n${destructure}  return (<>\n${patched}\n</>);\n}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, code);
}

const tags = n => n.children.filter(c => c.type === 'tag');
const kids = tags(ready);
const [side, mainCol, more, notif, search, modal] = kids;
const NAMES = { ovMgmt: 'OverviewQuality', ovIns: 'OverviewInspector', ovPm: 'OverviewProjectManager', ovGuard: 'OverviewGuard', ovGs: 'OverviewGuardsSupervisor', guards: 'GuardsHeader', showGuardTable: 'GuardsTable', projects: 'ProjectsList', project: 'ProjectDetail', visits: 'VisitsList', visit: 'VisitDetail', inspect: 'InspectionWorkspace', reviews: 'ReviewQueue', review: 'ReviewDetail', report: 'InspectionReport', reports: 'ReportsIssued', actions: 'ActionsList', action: 'ActionDetail', observations: 'ObservationsList', conf: 'ConfidentialArea', denied: 'AccessDenied', stub: 'ModuleStub', forms: 'FormsList', form: 'FormBuilder', guard: 'GuardProfile', training: 'TrainingList', trainingD: 'TrainingDetail', users: 'UsersList', user: 'UserDetail', request: 'AccountRequestReview', publicReq: 'AccountRequestPublic', setup: 'PasswordSetup', perms: 'PermissionTemplates', audit: 'AuditLog', analytics: 'Analytics', reportsC: 'ReportsCenter', rpt: 'GeneratedReport', settings: 'SettingsScreen' };
const gen = path.join(OUT, 'generated');
component(path.join(gen, 'Sidebar.tsx'), 'Sidebar', tags(side));
const [top, offline, scroll, bottom] = tags(tags(mainCol)[0] ? mainCol : mainCol);
component(path.join(gen, 'TopBar.tsx'), 'TopBar', tags(top));
component(path.join(gen, 'OfflineBanner.tsx'), 'OfflineBanner', tags(offline));
component(path.join(gen, 'BottomNav.tsx'), 'BottomNav', tags(bottom));
component(path.join(gen, 'MoreSheet.tsx'), 'MoreSheet', tags(more));
component(path.join(gen, 'NotificationPanel.tsx'), 'NotificationPanel', tags(notif));
component(path.join(gen, 'SearchPalette.tsx'), 'SearchPalette', tags(search));
component(path.join(gen, 'ModalFields.tsx'), 'ModalFields', tags(tags(tags(modal)[1])[1]));
const index = [];
for (const k of tags(scroll)) {
  const v = k.attribs.value.match(PATH)[1];
  if (v === 'loading') { component(path.join(gen, 'LoadingSkeleton.tsx'), 'LoadingSkeleton', tags(k)); continue; }
  if (v === 'notLoading') {
    for (const s of tags(k)) {
      const key = s.attribs.value.match(PATH)[1].replace(/^is\./, '');
      const nm = NAMES[key]; if (!nm) throw new Error('no name for ' + key);
      component(path.join(gen, 'screens', nm + '.tsx'), nm, tags(s));
      index.push([key, nm]);
    }
  }
}
fs.writeFileSync(path.join(gen, 'screens', 'index.ts'), '/* eslint-disable */\n// GENERATED — maps view-model flags (vm.is.*) to screen components.\n' + index.map(([, n]) => `import { ${n} } from "./${n}";`).join('\n') + '\n\nexport const SCREENS: [string, (props: { vm: any }) => React.JSX.Element][] = [\n' + index.map(([k, n]) => `  [${jsStr(k)}, ${n}],`).join('\n') + '\n];\n');
console.log('generated', index.length, 'screens');
