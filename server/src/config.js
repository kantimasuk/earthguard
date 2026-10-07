import 'dotenv/config';

// CLIENT_ORIGIN: URL ของหน้าเว็บที่อนุญาตให้เรียก API (CORS) คั่นหลายค่าด้วย ,
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT) || 3000,
  clientOrigins: origins,
  databaseUrl: process.env.DATABASE_URL || process.env.MYSQL_URL || '',
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || '',
};
