// โหลดข้อมูลการ์ดครั้งเดียวตอนเริ่มเซิร์ฟเวอร์ แล้วสร้างเอนจินไว้ใช้ร่วมกันทุกห้อง
import { readFileSync } from 'node:fs';
import { Engine, buildCatalog, catalogForClient } from './engine/index.js';

const raw = JSON.parse(readFileSync(new URL('./data/cards.json', import.meta.url), 'utf8'));

export const catalog = buildCatalog(raw);
export const engine = new Engine(catalog);
export const clientCatalog = catalogForClient(catalog); // ส่งให้ client ใช้วาดการ์ด
