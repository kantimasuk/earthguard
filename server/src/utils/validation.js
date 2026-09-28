// กติกาเดียวกับฝั่ง client (client/src/utils/validation.js)
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

/** รหัสผ่าน ≥ 8 ตัว มีตัวอักษรและตัวเลขอย่างน้อยอย่างละ 1 ตัว (ไม่บังคับอักขระพิเศษ) */
export function isValidPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

export function cleanDisplayName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/\s+/g, ' ').trim().slice(0, 20);
}
