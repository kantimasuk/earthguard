import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import { attachSocket } from './socket/index.js';
import { pool } from './db/pool.js';
import { migrate } from './db/migrate.js';

const app = express();
app.set('trust proxy', 1); // อยู่หลัง proxy ของ Railway → rate limit ใช้ IP จริง
app.use(helmet());
app.use(cors({ origin: config.clientOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  let db = 'down';
  try { await pool.query('SELECT 1'); db = 'up'; } catch { /* ignore */ }
  res.json({ ok: true, db, time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
// Express 5 ส่ง error จาก async handler มาที่นี่อัตโนมัติ
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'SERVER_ERROR' });
});

const server = http.createServer(app);
attachSocket(server, config.clientOrigins);
server.listen(config.port, () => console.log(`EarthGuard API → http://localhost:${config.port}`));
if (config.databaseUrl) migrate().catch((e) => console.error('[migrate]', e.message));
