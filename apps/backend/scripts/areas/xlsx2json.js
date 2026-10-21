// อ่าน sheet ของ xlsx (แตกไฟล์แล้ว) → JSON rows · ใช้ shared strings
const fs = require('fs');
const dir = process.argv[2];
const sheet = process.argv[3];
const xmlUnesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const ss = [];
const ssx = fs.existsSync(`${dir}/xl/sharedStrings.xml`) ? fs.readFileSync(`${dir}/xl/sharedStrings.xml`, 'utf8') : '';
for (const m of ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(xmlUnesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
const x = fs.readFileSync(`${dir}/xl/worksheets/${sheet}.xml`, 'utf8');
const rows = [];
for (const r of x.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
  const row = {};
  for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const col = c[1];
    const attrs = c[2];
    const inner = c[3] || '';
    let v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    if (v === undefined) v = (inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
    if (v === undefined) continue;
    if (/t="s"/.test(attrs)) v = ss[+v];
    else v = xmlUnesc(v);
    row[col] = v;
  }
  rows.push(row);
}
const head = rows.shift();
const out = rows.map((r) => Object.fromEntries(Object.entries(head).map(([k, name]) => [name, r[k] ?? null])));
fs.writeFileSync(process.argv[4], JSON.stringify(out));
console.log(sheet, out.length, Object.values(head).join(','));
console.log(JSON.stringify(out[0]));
