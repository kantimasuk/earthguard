// แปลง error code ของ Firebase Auth เป็นข้อความภาษาไทย
const GENERIC_LOGIN = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';

const COMMON = {
  'auth/network-request-failed': 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาลองใหม่',
  'auth/too-many-requests': 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
  'auth/user-disabled': 'บัญชีนี้ถูกระงับการใช้งาน',
  'auth/operation-not-allowed': 'ยังไม่ได้เปิดใช้วิธีเข้าสู่ระบบนี้ใน Firebase',
  'app/not-configured': 'ยังไม่ได้ตั้งค่า Firebase (ดู client/.env.example)',
};

/** Login ด้วยอีเมล: ไม่บอกว่าช่องไหนผิด */
export function loginErrorMessage(err) {
  return COMMON[err?.code] || GENERIC_LOGIN;
}

/** Google: คืนค่า null ถ้าผู้ใช้ปิดหน้าต่างเอง (ไม่ต้องแสดงอะไร) */
export function googleErrorMessage(err) {
  switch (err?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/account-exists-with-different-credential':
      return 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน';
    case 'auth/unauthorized-domain':
      return 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase (Authentication → Settings → Authorized domains)';
    default:
      return COMMON[err?.code] || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่';
  }
}

/** Register: คืน { field, message } เพื่อแสดงใต้ช่องที่ผิด */
export function registerError(err) {
  switch (err?.code) {
    case 'auth/email-already-in-use':
      return { field: 'email', message: 'อีเมลนี้ถูกใช้สมัครแล้ว' };
    case 'auth/invalid-email':
      return { field: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง' };
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return { field: 'password', message: 'รหัสผ่านไม่ตรงตามเงื่อนไข' };
    default:
      return { field: null, message: COMMON[err?.code] || 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่' };
  }
}
