# shared/

โค้ดและข้อมูลที่ใช้ร่วมกันทั้ง client และ server

- `data/cards.json` — การ์ดทั้ง 81 ใบ (สร้างจาก `database/source/its_all_rights_cards.xlsx` ด้วย `python database/tools/xlsx_to_seed.py`)
- `engine/` — game engine (กติกา สถานะเกม การตรวจความถูกต้อง) **ไม่ผูกกับ UI** เพื่อย้ายไปรันบน server ตอนทำ Multiplayer ได้ทันที
  - ตอนนี้มีแค่ `constants.js` — ตัว engine จะเริ่มทำในขั้น Single Player

ฝั่ง client import ได้ด้วย `import cards from '@shared/data/cards.json'`
