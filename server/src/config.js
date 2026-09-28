import 'dotenv/config';

const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT) || 3000,
  clientOrigins: origins,
  clientUrl: origins[0],
  databaseUrl: process.env.DATABASE_URL || process.env.MYSQL_URL || '',
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  resetTokenTtlMinutes: 30,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'EarthGuard <no-reply@earthguard.local>',
  },
};
