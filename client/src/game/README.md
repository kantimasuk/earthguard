# client/src/game/

ส่วนแสดงผลกระดานเกมด้วย **Phaser 3** (รายละเอียด: `docs/GAME_GUIDE.md`)

| ไฟล์ | หน้าที่ |
|---|---|
| `boot.js` | สร้าง Phaser.Game (import แบบ dynamic → หน้าอื่นไม่ต้องโหลด Phaser), ความคมชัดตาม devicePixelRatio |
| `GameScene.js` | วาดโต๊ะทั้งหมด + แอนิเมชัน (บิน, พลิก, สับ, ภัยคุกคาม, +1) — **ไม่มีกติกาอยู่ในนี้** |
| `cardArt.js` | วาดหน้าการ์ด 81 ใบด้วย Canvas 2D จากข้อมูล Excel (ตัดคำไทยด้วย Intl.Segmenter) |
| `reduce.js` | อัปเดตภาพบนจอทีละ event ระหว่างเล่นแอนิเมชัน |
| `icons.js`, `avatars.js` | ไอคอนสัญลักษณ์/สิทธิ และรูปประจำตัว AI (path แบบ SVG ใช้ได้ทั้ง Vue และ Canvas) |

กติกาและสถานะเกมจริงอยู่ที่ `server/src/game/engine/` → Phaser รับ events + state จากเซิร์ฟเวอร์แล้ววาดตาม
