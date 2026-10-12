#!/usr/bin/env node
// แปลง JSON ของ Google Docs (ผลจาก connector `read_doc` / documents.get) เป็น Markdown ทุกแท็บ
// ใช้: node scripts/gdoc-to-md.mjs <doc.json> <out.md>  → พิมพ์ title + revisionId
// ใช้โดย skill `.claude/skills/sync-requirements` — ไฟล์ที่ได้ห้ามแก้มือ
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node scripts/gdoc-to-md.mjs <doc.json> <out.md>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(input, 'utf8'));
const doc = raw.content ?? raw;

const textOf = (paragraph) =>
  (paragraph.elements ?? []).map((el) => el.textRun?.content ?? '').join('');

function blocks(content, out) {
  for (const el of content ?? []) {
    if (el.paragraph) {
      const p = el.paragraph;
      let text = textOf(p);
      const style = p.paragraphStyle?.namedStyleType ?? '';
      if (style.startsWith('HEADING_')) text = `${'#'.repeat(Number(style.slice(-1)) + 1)} ${text}`;
      else if (style === 'TITLE') text = `## ${text}`;
      if (p.bullet) text = `- ${text}`;
      out.push(text);
    } else if (el.table) {
      const rows = el.table.tableRows.map((row) =>
        row.tableCells.map((cell) => {
          const inner = [];
          blocks(cell.content, inner);
          return inner
            .map((s) => s.trim())
            .filter(Boolean)
            .join(' ')
            .replaceAll('|', '\\|');
        }),
      );
      const width = Math.max(...rows.map((r) => r.length));
      out.push('\n');
      rows.forEach((r, i) => {
        out.push(`| ${r.join(' | ')} |\n`);
        if (i === 0) out.push(`|${' --- |'.repeat(width)}\n`);
      });
      out.push('\n');
    }
  }
}

function tabs(list, out) {
  for (const tab of list ?? []) {
    out.push(`\n# แท็บ: ${tab.tabProperties?.title ?? '(ไม่มีชื่อ)'}\n\n`);
    blocks(tab.documentTab?.body?.content, out);
    tabs(tab.childTabs, out);
  }
}

const body = [];
tabs(doc.tabs, body);

const header = [
  `<!-- สร้างจาก /sync-requirements (scripts/gdoc-to-md.mjs) — ห้ามแก้มือ -->`,
  `<!-- source: https://docs.google.com/document/d/${doc.documentId}/edit -->`,
  `<!-- revisionId: ${doc.revisionId} -->`,
  `<!-- synced: ${new Date().toISOString().slice(0, 10)} -->`,
  '',
  `# ${doc.title}`,
  '',
].join('\n');

writeFileSync(output, `${header}${body.join('').replace(/\n{3,}/g, '\n\n')}`.trimEnd() + '\n');
console.log(`title: ${doc.title}`);
console.log(`revisionId: ${doc.revisionId}`);
