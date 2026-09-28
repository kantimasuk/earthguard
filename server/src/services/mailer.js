import nodemailer from 'nodemailer';
import { config } from '../config.js';

const enabled = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

const transporter = enabled
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

export async function sendResetEmail(to, link) {
  if (!transporter) {
    console.log(`[mail:dev] ลิงก์รีเซ็ตรหัสผ่านสำหรับ ${to}\n  ${link}`);
    return;
  }
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: 'ตั้งรหัสผ่านใหม่ — EarthGuard',
    text: `มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี EarthGuard ของคุณ\n\nกดลิงก์นี้ภายใน ${config.resetTokenTtlMinutes} นาที (ใช้ได้ครั้งเดียว):\n${link}\n\nถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border-radius:16px;background:#0f2a22;color:#eafff4">
      <h2 style="margin:0 0 12px;color:#9be77a">EarthGuard</h2>
      <p>มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#5bd07f;color:#06301c;font-weight:bold;text-decoration:none">ตั้งรหัสผ่านใหม่</a></p>
      <p style="font-size:13px;opacity:.8">ลิงก์มีอายุ ${config.resetTokenTtlMinutes} นาที และใช้ได้ครั้งเดียว<br>ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>
    </div>`,
  });
}
