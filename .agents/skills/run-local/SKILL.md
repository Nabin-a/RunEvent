---
name: run-local
description: >-
  Use this skill when the user asks to start, run, preview, verify, or troubleshoot
  the RunEvent interactive mockup project on their local machine (e.g., "run project locally",
  "start dev server", "เปิดเว็บต้นแบบบน local", or "/run-local").
---

# RunEvent Local Runner Skill

Runbook สำหรับตรวจสอบสภาพแวดล้อม ติดตั้งแพ็กเกจที่จำเป็น และรันเว็บต้นแบบ **RunEvent** (`Vite + React + TypeScript`) บนเครื่อง Local โดยไม่อาศัยการระบุพาธตายตัวของเครื่องใดเครื่องหนึ่ง

## ขอบเขตของโปรเจกต์ที่รัน

- โปรเจกต์ปัจจุบันเป็น **ต้นแบบจำลองฝั่งหน้าบ้าน (Interactive Client-Side Mockup)** เก็บสถานะการทดสอบไว้ในหน่วยความจำและ `localStorage` ของเบราว์เซอร์ (`runevent_v2_mock_system`)
- ไม่ต้องตั้งค่าฐานข้อมูล ไม่ต้องใส่ `.env` หรือ API key ของระบบชำระเงินจริง

## ขั้นตอนการรันบน Local

### 1. ตรวจสอบความพร้อมและติดตั้ง Dependencies (ทำอัตโนมัติผ่านสคริปต์)

- **Windows (PowerShell):**
  รันสคริปต์ [start-local.ps1](./scripts/start-local.ps1) จากรากของโปรเจกต์:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\.agents\skills\run-local\scripts\start-local.ps1
  ```
- **macOS / Linux / Git Bash:**
  รันสคริปต์ [start-local.sh](./scripts/start-local.sh) จากรากของโปรเจกต์:
  ```bash
  sh ./.agents/skills/run-local/scripts/start-local.sh
  ```

> หากต้องการรันคำสั่งมาตรฐานโดยตรงจากรากโปรเจกต์:
> 1. ตรวจว่ามีโฟลเดอร์ `node_modules` หรือยัง หากยังไม่มีให้รัน `npm install`
> 2. รันเซิร์ฟเวอร์พัฒนา: `npm run dev` (ค่าเริ่มต้นคือพอร์ต `5173` และหากพอร์ตไม่ว่าง Vite จะขยับไปพอร์ตถัดไปให้อัตโนมัติ)

### 2. การรันผ่าน Agent เครื่องมือ `run_command`

- เมื่อ Agent สตาร์ทเซิร์ฟเวอร์เพื่อให้ผู้ใช้เปิดดูต่อเนื่อง ให้ตั้งค่า `IsDaemon: true` และ `WaitMsBeforeAsync: 5000` เพื่อไม่ให้โปรเซสถูกปิดเมื่อจบรอบสนทนา
- อ่าน URL จริงจากบรรทัด `Local: http://localhost:<port>/` ใน output ของคำสั่งเสมอ ก่อนแจ้ง URL แก่ผู้ใช้หรือส่งต่อให้ `browser` subagent

### 3. ขั้นตอนตรวจสอบความถูกต้อง (Validation)

หากต้องการตรวจความถูกต้องของโค้ดและไฟล์ประกอบการบิลด์โดยไม่ค้างโปรเซสเซิร์ฟเวอร์ ให้รันโหมด `-CheckOnly`:

```powershell
powershell -ExecutionPolicy Bypass -File .\.agents\skills\run-local\scripts\start-local.ps1 -CheckOnly
```

หรือรันคำสั่งตรวจสอบของโปรเจกต์โดยตรง:
1. `npm run typecheck` — ต้องจบด้วย exit code `0` ไม่มีข้อผิดพลาดของชนิดข้อมูล TypeScript
2. `npm run build` — ต้องสร้างชุดไฟล์ใน `dist/` สำเร็จโดยไม่มี error

## การแก้ไขปัญหาเบื้องต้น

- **พอร์ต 5173 ถูกใช้งานอยู่:** สคริปต์รองรับการกำหนดพอร์ตเอง เช่น `-Port 5180` (PowerShell) หรือ `PORT=5180 sh ./.agents/skills/run-local/scripts/start-local.sh`
- **ข้อมูลจำลองค้างจากการทดสอบก่อนหน้า:** กดปุ่มลอย **"Dev / Demo"** มุมขวาล่างของหน้าเว็บ แล้วเลือก **"รีเซ็ตข้อมูลจำลองเริ่มต้นทั้งหมด"** เพื่อล้าง `localStorage` กลับสู่ชุดข้อมูลเริ่มต้น (สถานะเริ่มต้นเข้าเว็บครั้งแรกเป็นผู้เยี่ยมชมทั่วไป `Guest`)
