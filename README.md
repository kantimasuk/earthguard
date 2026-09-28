# It's All Rights: EarthGuard

เกมการ์ดออนไลน์เพื่อส่งเสริมการเรียนรู้ด้านสิทธิในสิ่งแวดล้อม — โปรเจกต์จบ ป.ตรี สาขา IT

> ออกแบบสำหรับ **โทรศัพท์แนวนอน** เป็นหลัก (บังคับแนวนอน ถ้าถือแนวตั้งจะขึ้นหน้าให้หมุนจอ) รองรับตั้งแต่ iPhone SE (568×320) ถึงแท็บเล็ต/คอมพิวเตอร์

## สถานะ (Demo)

| ส่วน | สถานะ |
|---|---|
| โครง Tech Stack (client / server / database / shared) | ✅ |
| หน้า Loading (โลโก้จางเข้า+ขยาย, แถบโหลด % จริง, "แตะเพื่อเริ่ม", เปลี่ยนหน้าแบบจาง) | ✅ |
| Login (อีเมล + Google), ข้อความ error รวม "อีเมลหรือรหัสผ่านไม่ถูกต้อง" | ✅ |
| Register (ชื่อ, อีเมล, รหัสผ่าน, ยืนยัน) + error ใต้ช่อง + เข้าสู่ระบบทันที | ✅ |
| ลืมรหัสผ่าน (Pop-up) + หน้าตั้งรหัสผ่านใหม่ (ลิงก์ 30 นาที ใช้ได้ครั้งเดียว) | ✅ |
| Navbar + หน้าหลัก (การ์ดเลือกโหมด 3 ใบ) + ออกจากระบบ | ✅ |
| หน้าตั้งค่าเกม (ง่าย/ปานกลาง/ยาก = AI 2/3/4 ตัว) + กติกาย่อ | ✅ |
| Pre-test / Post-test (5 ข้อ ถูก/ผิด 120 วินาที, Post เฉลยทันที) | ✅ |
| เกม Single Player (Phaser 3 + เซิร์ฟเวอร์ตรวจกติกาผ่าน Socket.IO + AI) | ✅ |
| หน้าสรุปผล (อันดับ, ตารางคะแนน, Pre vs Post, Game Log) + เล่นอีกครั้ง | ✅ |
| ปุ่มตั้งค่าระหว่างเล่น (เสียง, ออกจากเกม = ไม่บันทึกผล) | ✅ |

> คู่มืออธิบายระบบเกมแบบละเอียด (สถาปัตยกรรม, ไฟล์, AI, การทดสอบ): [`docs/GAME_GUIDE.md`](docs/GAME_GUIDE.md)

## โครงสร้างโฟลเดอร์

```
earthguard/
├─ client/                 Vue 3 + Vite (deploy บน Vercel)
│  ├─ public/              ไอคอน, รูปโปรไฟล์เริ่มต้น, เสียงเอฟเฟกต์ (.wav), manifest
│  └─ src/
│     ├─ components/       AppLogo, AppNavbar, BaseModal, FormField, ForgotPasswordModal, RotateOverlay ...
│     ├─ views/            LoadingView, LoginView, RegisterView, ResetPasswordView, MainMenuView, GameSetupView
│     ├─ stores/           Pinia: auth, app, toast
│     ├─ services/         firebase, api, sound (Howler), preload, device (เต็มจอ/ล็อกแนวนอน)
│     ├─ router/           route + guard (ยังไม่ login → กลับหน้า Login)
│     ├─ styles/           tokens.css (สี/ขนาด), base.css (ปุ่ม/พาเนล/transition)
│     ├─ utils/            validation, ข้อความ error ภาษาไทย
│     ├─ composables/      useLeaveGame (ออกจากเกม = ลบผลรอบนี้)
│     └─ game/             Phaser 3: GameScene (โต๊ะ+แอนิเมชัน), cardArt (วาดการ์ด), boot, reduce
├─ server/                 Node.js + Express 5 + Socket.IO (deploy บน Railway)
│  └─ src/
│     ├─ routes/auth.js    /api/auth/sync, /me, /forgot-password, /reset-password
│     ├─ services/         users (สร้าง/ผูกบัญชี), passwordReset, mailer, firebaseAdmin
│     ├─ middleware/       ตรวจ Firebase ID token
│     ├─ routes/sessions.js /api/sessions (รอบการเล่น, Pre/Post-test, สรุปผล, ออกจากเกม)
│     ├─ socket/           Socket.IO: singlePlayer.js (ห้องเกม)
│     ├─ game/engine/      ★ Game Engine: กติกา + AI (ไม่ผูกกับ UI/DB — ใช้กับ Multiplayer ได้)
│     ├─ game/room.js      ควบคุมจังหวะเกม: เวลา 20 วิ, ดีเลย์ AI, บันทึก log
│     └─ db/               pool (mysql2), init.js
├─ database/
│  ├─ schema.sql           ตารางทั้งหมดของ Demo
│  ├─ seed.sql             คลังข้อสอบ 50 ข้อ + การ์ด 81 ใบ (สร้างอัตโนมัติ)
│  ├─ source/*.xlsx        ไฟล์ต้นฉบับ
│  └─ tools/xlsx_to_seed.py
└─ shared/                 ใช้ร่วมกัน client/server
   ├─ data/cards.json
   └─ engine/constants.js  (เอนจินตัวจริงย้ายไปที่ server/src/game/engine เพราะ Railway deploy เฉพาะโฟลเดอร์ server)
```

## ติดตั้งครั้งแรก

ต้องมี **Node.js 20 ขึ้นไป**

### 1) Firebase

1. สร้างโปรเจกต์ที่ <https://console.firebase.google.com>
2. **Authentication → Sign-in method** เปิด **Email/Password** และ **Google**
3. **Authentication → Settings → Authorized domains** เพิ่มโดเมนของ Vercel (เช่น `earthguard.vercel.app`) — `localhost` มีให้อยู่แล้ว
4. **Project settings → General → Your apps** สร้าง Web app แล้วคัดลอกค่า config ไปใส่ `client/.env`
5. **Project settings → Service accounts → Generate new private key** เอาไฟล์ JSON ไปใส่ `server/.env` (ช่อง `FIREBASE_SERVICE_ACCOUNT`)

### 2) MySQL บน Railway

1. สร้าง Project บน Railway → **New → Database → MySQL**
2. แท็บ **Variables** ของ MySQL คัดลอก `MYSQL_PUBLIC_URL` ไปใส่ `DATABASE_URL` ใน `server/.env` (ทุกคนในทีมใช้ฐานข้อมูลเดียวกัน)

### 3) รันบนเครื่อง

```bash
# backend
cd server
cp .env.example .env        # แล้วกรอกค่า
npm install
npm run db:init             # สร้างตาราง + ใส่คลังข้อสอบ/การ์ด (รันซ้ำได้)
npm run dev                 # http://localhost:3000/api/health

# frontend (อีกหน้าต่าง)
cd client
cp .env.example .env        # แล้วกรอกค่า Firebase
npm install
npm run dev                 # http://localhost:5173
```

ทดสอบบนมือถือ: ใช้ Chrome DevTools → Device toolbar แล้วเลือกมือถือ + หมุนแนวนอน หรือเปิดจากมือถือที่อยู่ Wi-Fi เดียวกันผ่าน URL `Network:` ที่ `npm run dev` แสดง (ถ้า Google login ใช้ไม่ได้ผ่าน IP ให้ทดสอบผ่าน URL ของ Vercel แทน และอย่าลืมเพิ่ม URL นั้นใน `CLIENT_ORIGIN` ของ server)

## Deploy

**Frontend → Vercel**: Import repo, ตั้ง *Root Directory* = `client`, Framework = Vite, ใส่ Environment Variables ตาม `client/.env.example` (`VITE_API_URL` = URL ของ backend บน Railway) — ไฟล์ `vercel.json` จัดการให้รีเฟรชหน้าแล้วไม่ 404

**Backend → Railway**: New service จาก repo, ตั้ง *Root Directory* = `server`, Start command `npm start`, ใส่ Variables ตาม `server/.env.example` โดย `DATABASE_URL` ใช้ `${{MySQL.MYSQL_URL}}` (ต่อภายใน Railway) และ `CLIENT_ORIGIN` = URL ของ Vercel

## รายละเอียดการทำงานที่ควรรู้

**Loading** — โหลดฟอนต์ เสียง รูป และโค้ดของหน้าอื่นล่วงหน้า เปอร์เซ็นต์คำนวณจากงานที่เสร็จจริง (ไฟล์ที่ดาวน์โหลดนับตาม byte) การแตะ "แตะเพื่อเริ่ม" จะปลดล็อกเสียง และขอเต็มจอ + ล็อกแนวนอน (ได้บน Android Chrome; iPhone ไม่รองรับ จึงใช้หน้า "หมุนโทรศัพท์" แทน) ทุกหน้าต้องผ่าน Loading ก่อนเสมอ เปิดลิงก์ตรงก็จะผ่าน Loading แล้วค่อยไปหน้านั้น

**ลืมรหัสผ่าน** — ทำเองที่ backend (ไม่ใช้อีเมลรีเซ็ตของ Firebase เพราะกำหนดอายุ 30 นาทีไม่ได้) token สุ่ม 32 byte เก็บเฉพาะ hash ใน `password_reset_tokens`, หมดอายุ 30 นาที, ใช้ได้ครั้งเดียว, ขอลิงก์ใหม่แล้วลิงก์เก่าใช้ไม่ได้, ตอบข้อความเดียวกันเสมอ, จำกัด 5 ครั้ง/15 นาที/IP ถ้ายังไม่ตั้งค่า SMTP ลิงก์จะถูกพิมพ์ใน console ของ server (สะดวกตอน Demo)

**Google + บัญชีอีเมลเดิม** — Firebase ใช้ uid เดิมเมื่ออีเมลตรงกัน และ backend ผูกด้วยอีเมลใน MySQL อีกชั้น จึงไม่เกิดบัญชีซ้ำ ข้อควรรู้: ถ้าบัญชีที่สมัครด้วยอีเมล **ยังไม่ได้ยืนยันอีเมล** แล้วมาเข้าด้วย Google ครั้งแรก Firebase จะลบรหัสผ่านเดิมออกเพื่อความปลอดภัย (ข้อมูลในเกมไม่หาย ผู้ใช้ตั้งรหัสใหม่ได้ผ่าน "ลืมรหัสผ่าน") ระบบจึงส่งอีเมลยืนยันให้อัตโนมัติหลังสมัคร — ถ้ายืนยันแล้ว จะเข้าได้ทั้งสองแบบ

**Pop-up บนจอเล็ก** — ลืมรหัสผ่าน, เงื่อนไขรหัสผ่าน (ปุ่ม `?`), เมนูที่ยังไม่เปิดใช้ (ปุ่ม "เมนู" บนมือถือ), เมนูโปรไฟล์/ออกจากระบบ

**ชื่อที่แสดงในเกม** ยาว 2–20 ตัวอักษร (สเปกไม่ได้กำหนด ผมตั้งค่านี้ไว้ แก้ได้ที่ `client/src/utils/validation.js` และ `server/src/utils/validation.js`)

**เสียง** — ไฟล์ .wav ใน `client/public/audio/` เป็นเสียงสังเคราะห์ชั่วคราว เปลี่ยนเป็นเสียงจริงได้โดยใช้ชื่อไฟล์เดิม ค่าระดับเสียงเก็บในเครื่องผู้เล่น คงอยู่ข้ามหน้าและข้ามรอบการเล่น

## ใช้รูปพื้นหลัง / โลโก้ของทีม

วางไฟล์ใน `client/public/images/` ตามชื่อนี้ ระบบจะตรวจพบและใช้อัตโนมัติ (ไม่ต้องแก้โค้ด) ถ้าไม่มีไฟล์จะใช้แบบเริ่มต้น

| ไฟล์ | ชื่อที่ใช้ได้ (เลือกอย่างใดอย่างหนึ่ง) | คำแนะนำ |
|---|---|---|
| พื้นหลัง | `background.webp` / `background.jpg` / `background.png` | แนวนอน 1920×1080 ขึ้นไป, ไม่เกิน ~500 KB (.webp/.jpg เล็กกว่า), ของสำคัญวางไว้กลางภาพ เพราะมือถือจอยาวจะตัดขอบบน-ล่าง |
| โลโก้ | `logo.svg` / `logo.webp` / `logo.png` | พื้นหลังโปร่งใส, ตัดขอบว่างรอบรูปออก, กว้าง ~800px ขึ้นไป (ถ้าเป็น .svg จะคมทุกขนาด) — ควรใส่ชื่อเกมไว้ในรูปแล้ว เพราะระบบจะซ่อนตัวอักษร "EarthGuard" ที่วาดไว้ |

- ระบบวางสีเขียวเข้มโปร่งแสงทับพื้นหลังให้พาเนลและตัวหนังสืออ่านง่าย ปรับความเข้มได้ที่ `.shade` ใน `client/src/components/SceneBackground.vue`
- ไอคอนแท็บเบราว์เซอร์/หน้าจอหลัก: แทนที่ `client/public/favicon.svg` (ถ้าใช้ .png ให้แก้ชื่อไฟล์ใน `index.html` และ `manifest.webmanifest` ด้วย)

## API

| Method | Path | Auth | ใช้ทำอะไร |
|---|---|---|---|
| GET | `/api/health` | – | ตรวจ server + ฐานข้อมูล |
| POST | `/api/auth/sync` | Bearer | สร้าง/ผูก/อัปเดตผู้ใช้ใน MySQL หลัง login/register |
| GET | `/api/auth/me` | Bearer | ข้อมูลโปรไฟล์ |
| POST | `/api/auth/forgot-password` | – | `{ email }` ส่งลิงก์รีเซ็ต |
| GET | `/api/auth/reset-password/verify?token=` | – | ตรวจว่าลิงก์ยังใช้ได้ |
| POST | `/api/auth/reset-password` | – | `{ token, password }` ตั้งรหัสใหม่ |

## แก้ข้อมูลการ์ด/ข้อสอบ

แก้ไฟล์ใน `database/source/` แล้วรัน

```bash
pip install openpyxl
python database/tools/xlsx_to_seed.py   # สร้าง seed.sql + shared/data/cards.json ใหม่
cd server && npm run db:init
```
