import { auth } from './firebase';

// ตอนพัฒนา (npm run dev) เรียกผ่าน proxy ของ Vite (ดู vite.config.js) → ใช้ path สั้น ๆ ได้ทั้งบนคอมและโทรศัพท์
// ตอน build ขึ้น Vercel ใช้ VITE_API_URL (URL ของ backend บน Railway)
export const API_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code) {
    super(code || `HTTP_${status}`);
    this.status = status;
    this.code = code;
  }
}

/** fetch ไปที่ backend พร้อมแนบ Firebase ID token (ถ้า login อยู่) */
export async function api(path, { method = 'GET', body, auth: withAuth = true, timeout = 12000 } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (withAuth && auth?.currentUser) {
    headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error);
  return data;
}
