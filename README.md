# Kratai

แพลตฟอร์มกลางสำหรับหลายผู้จัดงานวิ่ง (Multi-Tenant B2B2C) เชื่อมการสร้างงาน รับสมัคร ชำระเงิน จัดการนักวิ่ง และการรับอุปกรณ์ โดยนำแนวคิดการบริหารงานและค่าบริการตามการสมัครจาก **RunSignup** และประสบการณ์ค้นหางานวิ่ง/บริการอัลบั้มหลังงานจาก **ThaiRun** มาปรับใช้กับผลิตภัณฑ์ของเราโดยไม่คัดลอกแบรนด์หรือหน้าจอ

> ชื่อระบบเปลี่ยนจาก RunEvent เป็น **Kratai** เมื่อ 20 พฤศจิกายน 2026 (หน้าเว็บภาษาไทยแสดง "กระต่าย") ฐานข้อมูล Local ย้ายไปที่ `data/kratai.sqlite` และบัญชีทดสอบใช้โดเมน `@demo.kratai.local`

## สถานะโปรเจกต์

**ระบบทำงานจริงบนเครื่องผู้ใช้แล้ว (Local Full-Stack System v0.2 — อัปเดตเมื่อ 18 พฤศจิกายน 2026)**

- **สิ่งที่พัฒนาและทำงานจริงบน Local แล้ว:**
  - **Backend & Database จริงบนเครื่อง (`server/`):** `Node.js + Express + SQLite` (`node:sqlite` เก็บไฟล์ที่ `data/kratai.sqlite` สร้างและ Seed ข้อมูลผู้ใช้ทดสอบชุดเดิมอัตโนมัติเมื่อรันครั้งแรก) รองรับการแฮชรหัสผ่านด้วย `scrypt`, เซสชัน `HttpOnly` Cookie (`kratai_sid`), การตรวจสิทธิ์ RBAC ฝั่งเซิร์ฟเวอร์ (`401`/`403`), และ Atomic SQLite Transaction ป้องกันขายเกินโควตา ป้องกันเลข BIB ซ้ำในงานเดียวกัน และป้องกันรับอุปกรณ์ซ้ำ
  - **Frontend (`src/`):** `Vite + React + TypeScript` รองรับการสลับภาษา **TH / EN** ทั้งระบบ (`src/i18n/`), เมนูซ้ายแบบ **Sticky Sidebar** ทั้งฝั่งผู้จัดและ Platform Owner, หน้าสมัครงานวิ่ง 6 ขั้นตอนพร้อมภาพปก/ภาพประกอบของงาน (`EventMediaManager`) และครอบคลุมทุกบทบาท:
    1. **หน้าค้นหางานวิ่ง หน้ารายละเอียดงานแบบ 2 คอลัมน์ + กล่องสมัคร Sticky และร้านค้า (`CustomerPortalView` + `PublicEventView`):** ค้นหาและกรองงานวิ่ง, เปิดดูหน้ารายละเอียดงานวิ่งครบทุกหมวด (เกี่ยวกับงาน, ระยะและราคา, Race Pack & ตารางไซส์เสื้อ `XS`–`2XL`, กำหนดการ, สถานที่/กติกา/ผลแข่งขัน) คู่กับ **กล่องสรุปและปุ่มสมัครแบบ Sticky ด้านขวา**, สมัครวิ่งด้วย **Dynamic Runner Registration Wizard** ที่แสดงขั้นตอนและฟิลด์ตาม `Published Form Version` + `Conditional Logic`, ร้านค้าเฉพาะงานสำหรับลูกค้าทั่วไป และหน้าขอใบเสนอราคาสั่งผลิตเสื้อ/เหรียญสำหรับชมรมหรือบริษัท
    2. **ระบบเข้าสู่ระบบจำลอง Email / Google / Facebook / LINE, URL Routing รายหน้า และเมนูตามสิทธิ์จริง (`AuthViews` + `RunnerProfileView` + `App`):** เริ่มต้นแบบผู้เยี่ยมชมทั่วไป (`Guest`), ผูก URL จริง (`/`, `/events/:code`, `/events/:code/shop`, `/custom-production`, `/my-orders`, `/login`, `/profile`, `/account/security`, `/organizer`, `/platform-admin`), กั้นหน้า `/organizer` และ `/platform-admin` ด้วย Route Guard (`403` สำหรับบัญชีที่ไม่มีสิทธิ์) และมีแถบ `Dev / Demo` พับเก็บได้มุมขวาล่าง
    2.1 **Runner Profile Module ครบ 9 หมวด (`RunnerProfileView` + SQLite `/api/account/*` + `/api/admin/profile-config`):** ศูนย์กลางข้อมูลนักวิ่งประกอบด้วย ข้อมูลส่วนตัว/รูปโปรไฟล์ + ยืนยัน OTP อีเมลและเบอร์โทร (โหมด Sandbox รหัส `123456`), ค่าความชอบเสื้อวิ่ง (`XS`–`5XL`, `Unisex`/`Men`/`Women`, `Regular`/`Slim`/`Oversize`) และการวิ่ง, ผู้ติดต่อฉุกเฉินหลายรายพร้อมตั้งค่าหลัก, สมุดที่อยู่จัดส่งหลายรายการพร้อมที่อยู่เริ่มต้น, ประวัติการวิ่งแยก Upcoming / Past พร้อมดาวน์โหลด E-Certificate (`.svg`), รางวัลและสถิติแบบ Read-only ผูกกับผลแข่งขันที่ยืนยันแล้ว, ลิงก์โซเชียลมีเดีย, การแจ้งเตือนแยกแจ้งเตือนธุรกรรมออกจากการตลาด, ความปลอดภัย/ประวัติเข้าสู่ระบบ/ขอปิดพักหรือลบบัญชีตาม PDPA, แถบคำนวณ `Profile Completion %` และการดึงข้อมูลไปเติมหน้าสมัครงานวิ่งอัตโนมัติแบบ Immutable Snapshot (การแก้ไซส์เสื้อในโปรไฟล์ไม่กระทบงานที่ยืนยันไปแล้ว)
    3. **Organizer Dashboard แยก `Organization Overview` กับ `Event Dashboard` พร้อมชุดกราฟวิเคราะห์ P1–P3 ครบ 10 Components (`OrganizerDashboardView` + `OrganizerAnalyticsCharts` + `BibLedgerStrip`):**
       - **Organization Overview (`ดูภาพรวมทุกงานขององค์กร`)**: แสดงคิวงานด่วน, สมการโควตาและยอดโอนรวมทุกงาน, และกราฟ P1–P3 (`KPI Cards`, `Registration Trend`, `Registration Status`, `Revenue Trend`, `Upcoming Events`, `Distance Breakdown`, `Event Performance`, `Capacity`, `Demographics`, `Payment Method`)
       - **Event Dashboard (`เจาะลึกงานวิ่งแต่ละงาน`)**: เจาะลึกยอดสมัคร รายได้ โควตารายระยะ รายชื่อนักวิ่งพร้อมป้ายตรวจความครบถ้วนข้อมูล & BIB, การชำระเงิน/คืนเงิน, จุด Check-in สแกน QR หน้างาน และการตั้งค่าฟอร์มรับสมัครที่ให้ผู้จัดเลือก Template ปรับฟิลด์ตามสิทธิ์ (`LOCKED` / `CONFIGURABLE` / `CUSTOMIZABLE`) และ **ส่งคำขอ (Request) เพิ่มช่องกรอกข้อมูลไปยัง Platform Owner**
    4. **Platform Owner Console & Centralized Registration Form Builder (`PlatformAdminView` + `RegistrationFormBuilderAdmin`):** ศูนย์อนุมัติองค์กรผู้จัด (KYC/บัญชีรับเงิน), อนุมัติเผยแพร่/ระงับงานวิ่ง, ออกใบเสนอราคาผลิต, จัดการรอบโอนเงิน/คืนเงิน และ **Registration Form Builder 7 เมนูย่อย** (อนุมัติคำขอฟิลด์จากผู้จัด, จัดการ Step การสมัคร, Global Field Library 15 ชนิด Input, Field Configuration & Live Preview, Conditional Logic Builder, Form Templates 5 แม่แบบ และ Form Version Management)
  - **Workspace Skill สำหรับรันบน Local:** `.agents/skills/run-local/SKILL.md` พร้อมสคริปต์ช่วยรันและตรวจ build
- **ขอบเขตและความโปร่งใสของระบบปัจจุบัน (Persistence & Sandbox Boundaries):**
  - ข้อมูลธุรกรรม บัญชีผู้ใช้ งานวิ่ง ใบสมัคร คำสั่งซื้อ รอบโอน และ Audit Log ทั้งหมด **บันทึกลงฐานข้อมูล SQLite จริง (`data/kratai.sqlite`) ผ่าน REST API `/api/*`** (ไม่ได้เก็บใน `localStorage` แล้ว ยกเว้นค่าภาษา `TH/EN` และร่างฟอร์มผู้จัดชั่วคราวก่อนกดส่ง)
  - บัญชีผู้ใช้ทดสอบเริ่มต้นยังคงเป็นชุดข้อมูลสมมติชุดเดิม (`USR-001` รหัสผ่าน `platform2026`, และ `USR-901`, `USR-101`..`USR-104` รหัสผ่าน `demo1234`) สามารถกดปุ่มรีเซ็ตใน `Dev / Demo` เพื่อคืนค่าฐานข้อมูล SQLite กลับสู่จุดเริ่มต้นได้ตลอดเวลา
  - **สิ่งที่ยังเป็นโหมดจำลอง (Local Sandbox):** การเข้าสู่ระบบผ่าน Google / LINE OAuth, การส่งอีเมลออกภายนอก และการตัดบัตร/สแกน QR PromptPay จริงยังไม่ได้ต่อผู้ให้บริการภายนอก (ยังไม่มีการตัดเงินจริง และยังไม่ได้ Deploy ขึ้น Production)

## วิธีรันโปรเจกต์ต้นแบบบน Local

อัปเดตหน้าโปรไฟล์ 19 พฤศจิกายน 2026: แบบฟอร์มแก้ไขข้อมูลจัดไม่เกิน 2 คอลัมน์ (มือถือ 1 คอลัมน์), เพศเลือกด้วย radio ชาย/หญิง, เอกสารเริ่มต้นเป็นบัตรประชาชนเมื่อยังไม่มีประเภทที่บันทึกไว้ และเมนูหมวดไม่มีเลขลำดับพร้อมชื่อบรรทัดเดียว รองรับ TH/EN

ต้องมี **Node.js 22.13 ขึ้นไป** (ระบบหลังบ้านใช้ `node:sqlite` ที่มีในตัว Node รุ่นใหม่เท่านั้น) และ **npm** ติดตั้งในเครื่อง

> มือใหม่หรือรันครั้งแรก: ดูคู่มือทีละขั้นพร้อมวิธีแก้ปัญหาที่พบบ่อยใน [docs/run-local-guide.md](docs/run-local-guide.md)

### รันด้วยคำสั่ง npm มาตรฐาน

```bash
npm install
npm run dev
```

เปิดเบราว์เซอร์ไปที่ `http://localhost:5173/` (หรือพอร์ตที่ Vite แสดงในเทอร์มินัล)

### คำสั่งตรวจสอบความถูกต้อง (Typecheck & Build)

```bash
npm run typecheck
npm run build
```

### รันผ่านสคริปต์ของ Workspace Skill (`run-local`)

- **Windows PowerShell:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\.agents\skills\run-local\scripts\start-local.ps1
  ```
- **macOS / Linux / Git Bash:**
  ```bash
  sh ./.agents/skills/run-local/scripts/start-local.sh
  ```

## ฟีเจอร์บัญชีและการลงทะเบียนครบวงจร — อัปเดต 18 พฤศจิกายน 2026

พัฒนาลงในต้นแบบ Interactive Local Mockup (`src/components/AuthViews.tsx` และ `src/components/PlatformAdminView.tsx`) ครอบคลุม **อีเมล + รหัสผ่าน, Google และ LINE** ภายใต้บัญชี Kratai เดียวกัน พร้อม **Complete Registration System แยกประสบการณ์ Runner และ Organizer** (จำลองการทำงานฝั่งหน้าบ้านใน `localStorage` ยังไม่ได้เชื่อม OAuth หรือเซิร์ฟเวอร์จริง):

- **หน้าเลือกประเภทบัญชี (`Join the Running Community`):** แยกการ์ดเลือก `Register as Runner` และ `Register as Organizer` สลับหรือเพิ่มบทบาทได้โดยไม่เสียข้อมูลบัญชีเดิม
- **Runner Registration (Wizard 2 ขั้นตอน):** ขั้นที่ 1 ข้อมูลบัญชี + Social/Email (พร้อมตัววัดความแข็งแรงรหัสผ่าน) และขั้นที่ 2 โปรไฟล์นักวิ่ง ผู้ติดต่อฉุกเฉิน และความสนใจระยะวิ่งแบบข้ามฟิลด์ไม่บังคับได้ (**ไม่นำไซส์เสื้อหรือระยะแข่งเฉพาะงานมาปะปนกับการสมัครบัญชี**) จบด้วยหน้าต้อนรับและแถบความสมบูรณ์โปรไฟล์เข้าสู่ Runner Dashboard
- **Organizer Registration (Wizard 3 ขั้นตอน + Save Draft):** ขั้นที่ 1 บัญชีและตำแหน่งผู้ติดต่อ, ขั้นที่ 2 ข้อมูลองค์กร ประเภทองค์กร ที่อยู่สำนักงาน ประวัติจัดงาน และผู้ประสานงานหลัก, ขั้นที่ 3 ยืนยันตัวตนและอัปโหลดเอกสารองค์กร/หนังสือมอบอำนาจลง Private Storage พร้อมสถานะเริ่มต้น `SUBMITTED` / `PENDING_REVIEW` (ไม่อนุมัติอัตโนมัติ)
- **Workflow ตรวจสอบผู้จัด 7 สถานะ (`Platform Admin`):** `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `MORE_INFORMATION_REQUIRED`, `APPROVED`, `REJECTED`, `SUSPENDED` พร้อมประวัติผู้ตรวจและ Audit Log
- **การเชื่อมบัญชีและความปลอดภัย:** รองรับ LINE ที่ไม่มีอีเมล, ป้องกันบัญชีซ้ำเมื่ออีเมลชนกันโดยต้องพิสูจน์เจ้าของก่อนเชื่อม, ห้ามถอดวิธี Login สุดท้าย, จัดการอุปกรณ์ที่เข้าสู่ระบบ และแยกโมดูลสมัครบัญชีออกจากโมดูลสมัครงานวิ่งแต่ละงานอย่างเด็ดขาด

รายละเอียดครบทั้ง 17 Deliverables, ข้อเสนอโครงสร้างฐานข้อมูล และสัญญา API อยู่ใน [Product blueprint ข้อ 16](docs/product-blueprint.md) การบันทึกแผนนี้ไม่ใช่การอนุญาตให้เชื่อม backend จริงหรือลงโค้ดเพิ่มเติมจนกว่าผู้ใช้จะสั่งเริ่มพัฒนา

## เกณฑ์อายุและรุ่นอายุ — อัปเดต 20 พฤศจิกายน 2026

ผู้จัดตั้งวันที่นับอายุ (วันแข่ง หรือ 31 ธ.ค. ของปีที่แข่ง) อายุต่ำสุด/สูงสุด และรุ่นอายุต่อระยะได้ในเมนู "ระยะ โควตา & คำถามสมัคร" ระบบคำนวณอายุจากวันเกิดตอนสมัคร ตรวจเกณฑ์ซ้ำฝั่งเซิร์ฟเวอร์ และเก็บอายุ/รุ่นเป็น snapshot ในใบสมัคร ยังไม่มีการจัดอันดับผลการแข่งขันตามรุ่น รายละเอียดใน [Product blueprint ข้อ 19](docs/product-blueprint.md)

## ปฏิทินงานวิ่ง — อัปเดต 20 พฤศจิกายน 2026

เมนู "ปฏิทินงานวิ่ง" (`/calendar`) ดูงานตามเดือน จังหวัด หรือประเภทงาน ตัวกรองหน้าค้นหางานบอกจำนวนงาน และหน้างานแสดงตารางรุ่นอายุ รายละเอียดใน [Product blueprint ข้อ 20](docs/product-blueprint.md)

## Deploy ขึ้น VM สำหรับ demo ภายในทีม — อัปเดต 20 พฤศจิกายน 2026

> **สถานะ:** เป็นวิธีเปิดต้นแบบให้ทีมทดลองใช้ ไม่ใช่ production ยังห้ามเปิดให้คนทั่วไปเข้า และห้ามใส่ข้อมูลส่วนบุคคลจริง (เหตุผลอยู่ในหัวข้อ "ข้อจำกัดด้านความปลอดภัยที่ยังเหลือ")

### ตัวแปรสภาพแวดล้อม

| ตัวแปร | ค่าใน `docker-compose.yml` | ความหมาย |
|---|---|---|
| `NODE_ENV` | `production` | เปิดโหมด production: ปิดเครื่องมือ sandbox และตั้ง cookie แบบ `Secure` เป็นค่าเริ่มต้น |
| `ENABLE_SANDBOX_TOOLS` | ไม่ตั้ง (ปิด) | `1` = เปิดแถบ Dev / Demo, `/api/auth/dev-switch`, `/api/dev/reset` และปุ่ม Google / Facebook / LINE จำลอง ซึ่งทำให้ใครก็สวมเป็นบัญชีใดก็ได้ **ห้ามเปิดบนเครื่องที่เข้าถึงจากอินเทอร์เน็ต** |
| `COOKIE_SECURE` | `1` | cookie session ส่งผ่าน HTTPS เท่านั้น ใช้ `0` ได้เฉพาะเครื่องทดสอบที่ไม่มี HTTPS และไม่เปิดสู่ภายนอก |
| `TRUST_PROXY` | `1` | เชื่อ header จาก reverse proxy (IP และโปรโตคอลจริงของผู้ใช้) ตั้งเมื่อมี Caddy / nginx อยู่หน้าแอปเท่านั้น |
| `KRATAI_DB_FILENAME` | ไม่ตั้ง (`kratai.sqlite`) | ชื่อไฟล์ฐานข้อมูลในโฟลเดอร์ `data/` |
| `API_HOST` / `API_PORT` | `0.0.0.0` / `3001` | ที่อยู่ที่แอปฟังภายใน container |

พอร์ตใน compose ผูกไว้ที่ `127.0.0.1:3001` จึงเข้าได้เฉพาะ reverse proxy บนเครื่องเดียวกัน ไม่เปิดพอร์ต 3001 ออกอินเทอร์เน็ตตรง

### ขั้นตอน

1. ติดตั้ง Docker และ Docker Compose บน VM แล้ว clone repository
2. สร้างและรันแอป:

   ```bash
   docker compose up -d --build
   ```

3. ตั้ง reverse proxy ที่ออก HTTPS ให้อัตโนมัติ เช่น Caddy (ต้องมีโดเมนชี้มาที่ VM) และ**จำกัดคนเข้า** ด้วย basic auth, IP allowlist หรือ VPN ตัวอย่าง `Caddyfile`:

   ```caddyfile
   demo.example.com {
     basic_auth {
       # สร้าง hash ด้วยคำสั่ง: caddy hash-password
       team <HASH-จาก-caddy-hash-password>
     }
     reverse_proxy 127.0.0.1:3001
   }
   ```

4. ตรวจว่าเครื่องมือ sandbox ปิดอยู่: log ของ container ต้องมี `sandbox tools: OFF` และ `POST /api/auth/dev-switch` ต้องได้ 404

   ```bash
   docker compose logs kratai | grep "sandbox tools"
   ```

5. สำรองฐานข้อมูลเป็นระยะ (ข้อมูลทั้งหมดอยู่ในไฟล์ SQLite ไฟล์เดียวที่ `data/kratai.sqlite`):

   ```bash
   docker compose exec kratai node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/app/data/kratai.sqlite').exec(\"VACUUM INTO '/app/data/backup.sqlite'\")"
   ```

   แล้วย้าย `data/backup.sqlite` ออกไปเก็บนอก VM

### ข้อจำกัดด้านความปลอดภัยที่ยังเหลือ

- **`GET /api/bootstrap` ส่งข้อมูลทั้งระบบให้ทุกคน** รวมถึงผู้ที่ยังไม่ล็อกอิน: อีเมล เบอร์โทร เลขบัตรประชาชน ประวัติการเข้าสู่ระบบ และคำใบ้รหัสผ่านทดสอบของผู้ใช้ทุกคน รวมทั้งใบสมัคร รอบโอน และ Audit Log ทั้งหมด (endpoint อื่นที่คืน snapshot ก็เป็นแบบเดียวกัน) ต้องแก้เป็นการคัดข้อมูลตามสิทธิ์ผู้ดูฝั่งเซิร์ฟเวอร์ก่อนเปิดให้คนนอกเข้า — งานค้างใน TODO ข้อ 1.4
- บัญชีทดสอบใช้รหัสผ่าน `demo1234` ที่อยู่ใน repository ควรเปลี่ยนหรือลบบัญชีทดสอบก่อนให้คนอื่นเข้า
- รหัสยืนยันก่อนเปลี่ยนรหัสผ่านเป็นค่าคงที่ `123456` เพราะยังไม่มีระบบส่งอีเมลจริง
- ประกาศความเป็นส่วนตัวเป็นฉบับร่าง และชื่อผู้ควบคุมข้อมูลเป็นข้อมูลสมมติ

## ผู้ใช้งานที่จำลองในต้นแบบ (ปัจจุบัน)

| กลุ่ม | งานหลัก |
|---|---|
| นักวิ่ง | ค้นหางาน ดูราคาสุทธิ สมัครจำลอง ดูสิทธิ์/QR รับอุปกรณ์ แก้ไซส์เสื้อก่อนเส้นตาย และเปิดลิงก์อัลบั้มภาพหลังงาน |
| เจ้าขององค์กร | สลับหลายองค์กร บริหารงาน ทีม ตั้งค่าผู้รับภาระค่าบริการ และดูสมการยอดนำส่ง |
| ผู้จัดการงาน | ตั้งค่างานและจัดการผู้สมัครเฉพาะงานที่รับผิดชอบ (ไม่มีสิทธิ์ดูการเงินรวมหรือแก้บัญชีธนาคาร) |
| ฝ่ายการเงิน | ตรวจธุรกรรม อนุมัติ/ปฏิเสธคำขอคืนเงิน และตรวจรอบนำส่ง |
| เจ้าหน้าที่รับอุปกรณ์ | ค้นหาสิทธิ์/QR Token กำหนดเลข BIB ไม่ซ้ำ และบันทึกการส่งมอบเสื้อ+BIB บนมือถือ |

## โครงสร้าง Repository ปัจจุบัน

```text
Kratai/
├── .agents/
│   └── skills/
│       └── run-local/
│           ├── SKILL.md
│           └── scripts/
│               ├── start-local.ps1
│               └── start-local.sh
├── docs/
│   ├── product-blueprint.md
│   └── organizer-dashboard-plan.md
├── src/
│   ├── components/
│   │   ├── AuthViews.tsx
│   │   ├── BibLedgerStrip.tsx
│   │   ├── CustomerPortalView.tsx
│   │   ├── Icons.tsx
│   │   ├── OrganizerAnalyticsCharts.tsx
│   │   ├── OrganizerDashboardView.tsx
│   │   ├── PlatformAdminView.tsx
│   │   ├── PublicEventView.tsx
│   │   ├── RegistrationFormBuilderAdmin.tsx
│   │   └── StatusBadges.tsx
│   ├── data/
│   │   ├── formBuilderData.ts
│   │   └── mockData.ts
│   ├── utils/
│   │   ├── eventConfig.ts
│   │   └── pricing.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── types.ts
├── AGENTS.md
├── DESIGN.md
├── PRODUCT.md
├── README.md
├── TODO.md
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

- [AGENTS.md](AGENTS.md): กฎร่วมและขอบเขตระยะปัจจุบัน
- [PRODUCT.md](PRODUCT.md): บริบทผลิตภัณฑ์และหลักการหลักที่ยืนยันแล้ว
- [DESIGN.md](DESIGN.md): ระบบการออกแบบ (Design System & Tokens) ของต้นแบบ
- [TODO.md](TODO.md): ลำดับงานและสถานะความคืบหน้า
- [Product blueprint](docs/product-blueprint.md): ขอบเขต กฎธุรกิจ และข้อเสนอ architecture
- [Organizer dashboard plan](docs/organizer-dashboard-plan.md): โครงเมนู หน้าจอ ตัวเลข และ workflow
- [Run-local skill](.agents/skills/run-local/SKILL.md): คู่มือและสคริปต์สำหรับรันต้นแบบบน Local

## ขั้นตอนถัดไปก่อนพัฒนาระบบจริง

- ทบทวน Flow และโมเดลรายได้จากต้นแบบ Interactive Mockup นี้ เพื่อยืนยันนโยบายเงินจริง อัตราค่าบริการจริง เลือก Payment Provider / Backend Architecture และออกแบบ Schema + การตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ก่อนเริ่มพัฒนาระบบหลังบ้านสำหรับ Pilot
- พิจารณาข้อเสนอส่วนขยายด้าน **ร้านค้าเฉพาะงาน (ซื้อเพิ่ม/พรีออเดอร์/ซื้อโดยไม่สมัครวิ่ง) และบริการขอราคาสั่งผลิตเสื้อ/เหรียญกับ Kratai** ตามที่บันทึกไว้ใน [docs/product-blueprint.md](docs/product-blueprint.md) ข้อ 15 และ [docs/organizer-dashboard-plan.md](docs/organizer-dashboard-plan.md) (ยังเป็นข้อเสนอในแผนเอกสาร ยังไม่ได้ยืนยันเงื่อนไขการค้าหรือพัฒนา)

ปรับปรุงล่าสุด: 17 พฤศจิกายน 2026
