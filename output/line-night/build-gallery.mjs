import fs from 'node:fs';
import path from 'node:path';
const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const groups=[['profile-mascots','มาสคอตโปรไฟล์'],['illustrations','ภาพประกอบ'],['motion','ต่าย Move · ฉากกลางคืน']];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const assets=[];
const sections=groups.map(([dir,title])=>{
const files=fs.readdirSync(path.join(root,dir)).filter(f=>/\.(png|mp4)$/.test(f));
return `<section><h2>${title} <small>${files.length} ไฟล์</small></h2><div class="grid">${files.map(f=>{
const relative=`${dir}/${f}`; assets.push({file:relative,kind:f.endsWith('.mp4')?'video':'image'});
const src=relative.split('/').map(encodeURIComponent).join('/');
return `<article>${f.endsWith('.mp4')?`<video controls playsinline preload="metadata" src="${src}"></video>`:`<img loading="lazy" src="${src}" alt="${esc(f)}">`}<a download href="${src}">${esc(f)}</a></article>`;
}).join('')}</div></section>`;
}).join('');
fs.writeFileSync(path.join(root,'index.html'),`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kratai — LINE Night assets</title><style>*{box-sizing:border-box}body{margin:0;background:#111513;color:#f0f7f3;font-family:Tahoma,system-ui,sans-serif;line-height:1.65}main{max-width:1440px;margin:auto;padding:32px 24px}h1{font-size:32px;margin:0}p{color:#bdcec4}h2{margin-top:44px}small{font-size:14px;font-weight:400;color:#9fb9aa}a{color:#63e6a2;overflow-wrap:anywhere}a:focus-visible,video:focus-visible{outline:3px solid #06c755;outline-offset:4px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}article{background:#19231d;border:1px solid #314039;border-radius:16px;overflow:hidden}img,video{display:block;width:100%;height:300px;object-fit:contain;background:#09110d}article a{display:block;padding:12px 16px}.swatch{display:inline-block;width:16px;height:16px;border-radius:50%;vertical-align:middle;border:1px solid #718178}nav{display:flex;gap:16px;flex-wrap:wrap;margin-top:16px}@media(max-width:500px){main{padding:24px 16px}.grid{grid-template-columns:1fr}}</style><main><h1>กระต่าย · LINE Night</h1><p>ธีมดำ <span class="swatch" style="background:#111513"></span> #111513 / เขียว <span class="swatch" style="background:#06C755"></span> #06C755 · ฉากกลางคืน<br>มาสคอตแยกชิ้นใช้พื้นหลังโปร่งใส ภาพและคลิปชุดนี้เป็นสำเนาที่ปรับใหม่ ต้นฉบับยังคงเดิม</p><nav><a href="manifest.json">รายการไฟล์</a><a href="video-validation.json">ผลตรวจวิดีโอ</a></nav>${sections}</main></html>`);
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({project:'Kratai',date:'2026-11-25',palette:{black:'#111513',green:'#06C755'},notes:['สำเนาชุดปรับสี ไม่ทับต้นฉบับ','ภาพ PNG ปรับด้วย imagegen รูปทรงหรือรายละเอียดอาจต่างจากต้นฉบับเล็กน้อย','ภาพตัวละครคงพื้นหลังโปร่งใส ฉากประกอบและวิดีโอใช้บรรยากาศกลางคืน','วิดีโอคงจำนวนเฟรม ความละเอียด และอัตราเฟรมตามต้นฉบับ'],sources:['output/profile-mascots','output/playful-assets/illustrations','กระต่าย_KraTai/ต่าย Move'],assets},null,2));
console.log(JSON.stringify({assets:assets.length}));
