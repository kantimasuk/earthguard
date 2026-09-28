// กติกาเดียวกับฝั่ง server (server/src/utils/validation.js)
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email) {
  if (!email?.trim()) return 'กรุณากรอกอีเมล';
  if (!EMAIL_RE.test(email.trim())) return 'รูปแบบอีเมลไม่ถูกต้อง';
  return '';
}

export function passwordChecks(pw = '') {
  return {
    length: pw.length >= 8,
    letter: /[A-Za-z]/.test(pw),
    digit: /\d/.test(pw),
  };
}

export function validatePassword(pw) {
  if (!pw) return 'กรุณากรอกรหัสผ่าน';
  const c = passwordChecks(pw);
  if (!c.length) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว';
  if (!c.letter || !c.digit) return 'ต้องมีทั้งตัวอักษรภาษาอังกฤษและตัวเลข';
  return '';
}

export function validateConfirm(pw, confirm) {
  if (!confirm) return 'กรุณายืนยันรหัสผ่าน';
  if (pw !== confirm) return 'รหัสผ่านไม่ตรงกัน';
  return '';
}

export function validateDisplayName(name) {
  const n = name?.trim() ?? '';
  if (!n) return 'กรุณากรอกชื่อที่แสดงในเกม';
  if (n.length < 2) return 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร';
  if (n.length > 20) return 'ชื่อยาวได้ไม่เกิน 20 ตัวอักษร';
  return '';
}
