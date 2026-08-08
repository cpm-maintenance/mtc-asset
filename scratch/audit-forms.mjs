import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const roots = ['public', 'index.html', 'src'];
const files = [];
function walk(d, base) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html') || f === 'index.html') files.push(p);
  }
}
for (const r of roots) {
  if (r.endsWith('.html')) files.push(r);
  else walk(r);
}

const report = [];
for (const f of files) {
  let c;
  try { c = readFileSync(f, 'utf8'); } catch { continue; }
  const inputs = [...c.matchAll(/<(input|select|textarea|fieldset|datalist)[^>]*>/gi)].map(m => m[0]);
  if (!inputs.length) continue;
  report.push({ file: f, inputs });
}

let out = '# FORM AUDIT — MTC-ASSET\n\n';
for (const { file, inputs } of report) {
  out += `\n## ${file}\n`;
  inputs.forEach((el, i) => {
    const id = /id="([^"]*)"/.exec(el)?.[1] || '';
    const name = /name="([^"]*)"/.exec(el)?.[1] || '';
    const xm = /x-model="([^"]*)"/.exec(el)?.[1] || '';
    const type = /type="([^"]*)"/.exec(el)?.[1] || '';
    const ph = /placeholder="([^"]*)"/.exec(el)?.[1] || '';
    const t = /<select/.test(el) ? 'select' : `<input:${type}>`;
    out += `- [${i}] ${t} id=${id||'-'} name=${name||'-'} model=${xm||'-'} ph="${ph}"\n`;
  });
}
writeFileSync('scratch/form-audit-report.md', out);
console.log('files with inputs:', report.length);
console.log('total inputs:', report.reduce((a, r) => a + r.inputs.length, 0));
