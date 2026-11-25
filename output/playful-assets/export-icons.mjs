import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const input = fs.readFileSync(new URL('../../src/components/Icons.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(input, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = new URL('./icons-module.mjs', import.meta.url);
fs.writeFileSync(moduleUrl, compiled);
const source = await import(moduleUrl.href);
const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const names = Object.keys(source).filter(n => /^Icon/.test(n)).sort();
const entries = [];
for (const name of names) {
  const file = name.replace(/^Icon/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '.svg';
  let svg = renderToStaticMarkup(React.createElement(source[name], { size: 24 }));
  svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" color="#34495F" ');
  fs.writeFileSync(path.join(out, 'icons', file), svg);
  entries.push({ name, file, origin: 'src/components/Icons.tsx', brandMark: /Mark$/.test(name) });
}
fs.writeFileSync(path.join(out, 'icons', 'manifest.json'), JSON.stringify(entries, null, 2));
const cards = entries.map(e => `<figure><img src="icons/${e.file}" width="40" height="40" alt=""><figcaption>${e.file}</figcaption></figure>`).join('');
fs.writeFileSync(path.join(out, 'icons-preview.html'), `<!doctype html><html lang="th"><meta charset="utf-8"><title>Kratai icons</title><style>body{font:16px system-ui;color:#34495f;background:#f4fbf8;margin:40px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:16px}figure{margin:0;padding:24px;background:white;border:1px solid #d5e5df;border-radius:16px}figcaption{margin-top:20px;font-size:12px}h1{font-size:28px}</style><h1>Kratai — SVG icons (${entries.length})</h1><p>ส่งออกจากไอคอนในโปรเจกต์ · เส้น 1.75 · viewBox 24 × 24 · สี slate · เครื่องหมายบริการภายนอกคงสีเดิม</p><main>${cards}</main></html>`);
console.log(`Exported ${entries.length} SVG icons.`);
