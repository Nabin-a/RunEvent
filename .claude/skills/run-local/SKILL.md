---
name: run-local
description: >-
  Start, preview, check or troubleshoot the Kratai project on this computer (API + public
  web + admin console). Use when asked to run the project locally, start the dev server,
  open the site, test a change in the browser, check the build, or fix a local run problem
  ("run project", "รันโปรเจกต์", "เปิดเว็บบน local", "/run-local").
---

# Kratai — รันบนเครื่อง (Local)

คู่มือสำหรับ Claude Code ใน repository นี้ (Codex มีอีกชุดที่ `.agents/skills/run-local`)
ใช้คำสั่งที่มีจริงใน `package.json` และ `.claude/launch.json` เท่านั้น อย่าแต่งคำสั่งหรือรายงานผลที่ไม่ได้รัน

## สิ่งที่รัน

`npm run dev` เปิด 3 ส่วนพร้อมกัน (`concurrently`):

| ส่วน | คำสั่งย่อย | พอร์ต | หมายเหตุ |
|---|---|---|---|
| API (Express + `node:sqlite`) | `npm run dev:api` (`tsx watch server/index.ts`) | `3001` (`API_PORT`) | รีสตาร์ตเองเมื่อแก้ `server/`; สร้าง/seed `data/kratai.sqlite` และ migration ใน `seedDatabase()` ตอนเริ่ม |
| เว็บสาธารณะ + ระบบผู้จัด | `npm run dev:web` (Vite) | `5173` | proxy `/api` ไป API; พอร์ตไม่ว่าง Vite จะขยับไปพอร์ตถัดไป — อ่าน URL จริงจาก log |
| คอนโซลแพลตฟอร์ม | `npm run dev:admin` (`vite.admin.config.ts`) | `5174` | |

ไม่ต้องมี `.env` หรือ key ภายนอก ข้อมูลทั้งหมดเป็นข้อมูลสมมติ

## ขั้นตอน

1. **ตรวจเครื่อง:** `node -v` ต้องเป็น Node ที่มี `node:sqlite` (22.5 ขึ้นไป; เครื่องนี้ใช้ 24) ถ้ายังไม่มี `node_modules` ให้รัน `npm install`
2. **สตาร์ต:**
   - **ในแอป Claude desktop:** ใช้ `preview_start` ชื่อ `kratai-dev` (จาก `.claude/launch.json`; รัน `npm run dev` ทั้ง 3 ส่วน และเปิดแท็บที่ `:5173`) — อย่ารันเซิร์ฟเวอร์ผ่าน Bash ถ้าเซิร์ฟเวอร์รันอยู่แล้ว (`preview_list`) ให้ใช้ตัวเดิม ดู log ด้วย `preview_logs`
   - **ใน CLI:** `npm run dev` แบบ `run_in_background` แล้วรอ log `SQLite server listening` และ `Local: http://localhost:<port>/`
3. **ยืนยันว่าขึ้นจริง:**
   - API: `curl -s http://127.0.0.1:3001/api/bootstrap` ต้องขึ้นต้นด้วย `{"ok":true` (API ฟังที่ `127.0.0.1`)
   - เว็บและคอนโซล: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` และ `:5174/` ต้องได้ `200` — ใช้ `localhost` ไม่ใช่ `127.0.0.1` เพราะ Vite บนเครื่องนี้ฟังที่ localhost (IPv6) เรียก `127.0.0.1:5173` จะดูเหมือนเซิร์ฟเวอร์ไม่ขึ้น
   - เปิดหน้าเว็บแล้วไม่มี error ใน console
4. **ตรวจโค้ด/บิลด์** (ไม่ต้องเปิดเซิร์ฟเวอร์): `npm run typecheck` → exit 0, `npm run build` และ `npm run build:admin` → ไม่มี error (คำเตือนขนาด chunk ใหญ่เป็นเรื่องปกติ)

## ทดสอบในเบราว์เซอร์

- เปลี่ยนบทบาทผ่านปุ่มลอย **"Dev / Demo"** มุมขวาล่าง (ไม่ต้องกรอกรหัสผ่าน) เช่น ทานตะวัน (USR-101, owner), กานต์พิชชา (USR-901, runner), ณัฐพล (USR-104, staff)
- ตัวแก้ไขหน้ารายละเอียดงานใช้จอกว้าง ≥ 1280px — ตั้ง viewport 1440×900 ก่อนทดสอบ
- ทดสอบเสร็จ: สลับกลับเป็น **"ผู้เยี่ยมชมทั่วไป (Guest · ยังไม่ Login)"** และรีเซ็ต viewport เป็น desktop

## ข้อมูลทดสอบ

- ฐานข้อมูลอยู่ที่ `data/kratai.sqlite` (อย่า commit) — ล้างเฉพาะข้อมูลที่ตัวเองสร้าง ตรวจ `updatedBy`/ผู้สร้างก่อนลบ อาจมีผู้ใช้คนอื่นใช้เครื่อง/ฐานข้อมูลเดียวกันอยู่
- สคริปต์ node ที่แก้ DB ระหว่างเซิร์ฟเวอร์รัน ให้เปิดด้วย timeout กัน `database is locked`:
  `new DatabaseSync('data/kratai.sqlite', { timeout: 10000 })`
- รีเซ็ตทั้งหมดกลับข้อมูลเริ่มต้น: Dev / Demo → ส่วน "ล้างข้อมูล" → **"รีเซ็ตข้อมูลทั้งหมด…"** แล้วกดยืนยัน (ถามผู้ใช้ก่อน เพราะลบข้อมูลทดสอบของทุกคน)

## แก้ปัญหา

- **พอร์ต 5173/5174 ไม่ว่าง:** Vite ขยับพอร์ตเอง — ใช้ URL จาก log; ถ้า API `3001` ไม่ว่าง หาโปรเซสเดิมก่อน (`netstat -ano | findstr :3001`) อย่าปิดโปรเซสที่ไม่ได้เริ่มเองโดยไม่ถามผู้ใช้
- **แก้ `server/` แล้ว API ไม่เปลี่ยน:** ดู log ของ `tsx watch` ว่ารีสตาร์ตและไม่มี error
- **หน้าเว็บขึ้นแต่ข้อมูลว่าง/`/api` 502:** API ยังไม่ขึ้นหรือพัง — ดู log ส่วน `api`
- **`node:sqlite` ไม่มี:** อัปเดต Node

ห้าม commit, push หรือ deploy จาก skill นี้ ทำเมื่อผู้ใช้สั่งเท่านั้น
