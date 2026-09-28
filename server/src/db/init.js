// สร้างตารางและใส่ข้อมูลตั้งต้น:  npm run db:init
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../config.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../database');

const conn = await mysql.createConnection({ uri: config.databaseUrl, multipleStatements: true, charset: 'utf8mb4' });
for (const file of ['schema.sql', 'seed.sql']) {
  const sql = await fs.readFile(path.join(dir, file), 'utf8');
  await conn.query(sql);
  console.log(`✔ ${file}`);
}
const [[q]] = await conn.query('SELECT COUNT(*) AS n FROM questions');
const [[c]] = await conn.query('SELECT COUNT(*) AS n FROM cards');
console.log(`questions=${q.n} cards=${c.n}`);
await conn.end();
