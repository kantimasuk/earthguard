import { defineStore } from 'pinia';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth, googleProvider, firebaseConfigured } from '@/services/firebase';
import { api } from '@/services/api';
import { PRIVACY_VERSION } from '@/data/privacy';

// ความยินยอมนโยบายความเป็นส่วนตัว: จำในเครื่องด้วย (กรณีส่งไปเซิร์ฟเวอร์ไม่สำเร็จ จะส่งซ้ำตอน sync ครั้งถัดไป)
const consentKey = (uid) => `eg.privacy.${uid}`;
const localConsent = (uid) => { try { return localStorage.getItem(consentKey(uid)); } catch { return null; } };

const DEFAULT_AVATAR = '/images/avatar-default.svg';
const notConfigured = () => Object.assign(new Error('Firebase not configured'), { code: 'app/not-configured' });

/** โปรไฟล์สำรองจาก Firebase (ใช้เมื่อ backend ยังไม่พร้อม) */
function profileFromFirebase(u) {
  const google = u.providerData.some((p) => p.providerId === 'google.com');
  return {
    id: null,
    email: u.email,
    displayName: u.displayName || u.email?.split('@')[0] || 'ผู้เล่น',
    photoUrl: google ? u.photoURL : null,
    providers: u.providerData.map((p) => p.providerId),
  };
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,        // Firebase user
    profile: null,     // ข้อมูลจาก MySQL (หรือสำรองจาก Firebase)
    ready: false,      // รู้สถานะ login ครั้งแรกแล้ว
    backendOnline: true,
  }),

  getters: {
    isLoggedIn: (s) => Boolean(s.user),
    displayName: (s) => s.profile?.displayName || s.user?.displayName || 'ผู้เล่น',
    avatar: (s) => s.profile?.photoUrl || DEFAULT_AVATAR,
    /** ต้องแสดงป๊อปอัปขอความยินยอมไหม (ครั้งเดียวต่อบัญชีต่อเวอร์ชันของนโยบาย) */
    needsPrivacy: (s) => Boolean(s.user && s.profile)
      && s.profile.privacyVersion !== PRIVACY_VERSION
      && localConsent(s.user.uid) !== PRIVACY_VERSION,
  },

  actions: {
    /** เรียกครั้งเดียวตอนแอปเริ่ม — resolve เมื่อรู้ว่ามีผู้ใช้ login อยู่หรือไม่ */
    init() {
      if (this._initPromise) return this._initPromise;
      this._initPromise = new Promise((resolve) => {
        if (!firebaseConfigured) {
          console.warn('[auth] ยังไม่ได้ตั้งค่า Firebase ใน client/.env');
          this.ready = true;
          resolve();
          return;
        }
        // รับผลจาก signInWithRedirect (กรณี popup ถูกบล็อก)
        getRedirectResult(auth).catch((e) => console.warn('[auth] redirect', e?.code));

        onAuthStateChanged(auth, async (u) => {
          this.user = u;
          if (!u) {
            this.profile = null;
          } else if (!this._suppressSync) {
            await this.syncProfile();
          }
          if (!this.ready) {
            this.ready = true;
            resolve();
          }
        });
      });
      return this._initPromise;
    },

    /** สร้าง/ผูกบัญชีใน MySQL — ถ้า backend ล่มยังเล่นต่อได้ด้วยข้อมูลจาก Firebase */
    async syncProfile(displayName) {
      if (!this.user) return;
      // กันเรียกซ้ำพร้อมกัน (listener + หลัง login)
      if (this._syncing && !displayName) return this._syncing;
      this._syncing = this._doSync(displayName).finally(() => { this._syncing = null; });
      return this._syncing;
    },

    async _doSync(displayName) {
      try {
        const { profile } = await api('/api/auth/sync', { method: 'POST', body: { displayName } });
        this.profile = profile;
        this.backendOnline = true;
        // เคยยอมรับในเครื่องนี้แล้ว แต่เซิร์ฟเวอร์ยังไม่ได้บันทึก → ส่งซ้ำแบบเงียบ ๆ
        if (profile.privacyVersion !== PRIVACY_VERSION && localConsent(this.user.uid) === PRIVACY_VERSION) {
          this.acceptPrivacy().catch(() => {});
        }
      } catch (e) {
        console.warn('[auth] sync failed', e);
        this.backendOnline = false;
        this.profile = { ...profileFromFirebase(this.user), ...(displayName ? { displayName } : {}) };
      }
    },

    /** จดจำฉัน: true = อยู่ในระบบต่อแม้ปิดเบราว์เซอร์ / false = ออกจากระบบเมื่อปิดแท็บ */
    async applyRemember(remember = true) {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    },

    async loginWithEmail(email, password, remember = true) {
      if (!auth) throw notConfigured();
      await this.applyRemember(remember);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await this.ensureProfile();
    },

    /** ให้แน่ใจว่ามี user + profile ก่อนเปลี่ยนหน้า */
    async ensureProfile() {
      this.user = auth.currentUser;
      if (this.user && this.profile?.email !== this.user.email) await this.syncProfile();
    },

    async loginWithGoogle(remember = true) {
      if (!auth) throw notConfigured();
      // ไม่ await: ต้องเปิด popup ทันทีในจังหวะที่ผู้ใช้แตะ ไม่งั้น Safari บล็อก popup (Firebase เรียงคิวคำสั่งให้เอง)
      this.applyRemember(remember).catch(() => {});
      try {
        await signInWithPopup(auth, googleProvider);
        await this.ensureProfile();
      } catch (e) {
        // บางเบราว์เซอร์มือถือบล็อก popup → เปลี่ยนเป็น redirect
        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw e;
      }
    },

    /** สมัครสมาชิก แล้วเข้าสู่ระบบให้ทันที */
    async register({ displayName, email, password }) {
      if (!auth) throw notConfigured();
      this._suppressSync = true; // รอใส่ชื่อก่อนค่อย sync
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        this.user = cred.user;
        await updateProfile(cred.user, { displayName: displayName.trim() });
        await this.syncProfile(displayName.trim());
        // ส่งอีเมลยืนยันแบบไม่บล็อก — ถ้ายืนยันแล้ว การเข้าด้วย Google ภายหลังจะเก็บรหัสผ่านเดิมไว้ด้วย
        sendEmailVerification(cred.user).catch(() => {});
      } finally {
        this._suppressSync = false;
      }
    },

    /**
     * ลืมรหัสผ่าน — ให้ Firebase ส่งอีเมลรีเซ็ตให้ (ส่งผ่านเซิร์ฟเวอร์ของ Google)
     * เดิมส่งจาก backend ด้วย SMTP แต่ Railway แพ็กเกจ Hobby ปิดพอร์ต SMTP ทั้งหมด อีเมลจึงไม่ถูกส่งออก
     * ไม่บอกว่ามีบัญชีนี้หรือไม่ (auth/user-not-found ถือว่าสำเร็จเหมือนกัน)
     */
    async requestPasswordReset(email) {
      if (!auth) throw notConfigured();
      const addr = email.trim();
      // ลิงก์ "ดำเนินการต่อ" หลังตั้งรหัสเสร็จ → กลับมาหน้าเข้าสู่ระบบของเรา
      const settings = { url: `${window.location.origin}/login` };
      try {
        await sendPasswordResetEmail(auth, addr, settings);
      } catch (e) {
        if (e.code === 'auth/user-not-found') return;
        if (e.code === 'auth/unauthorized-continue-uri' || e.code === 'auth/invalid-continue-uri') {
          // โดเมนยังไม่อยู่ใน Authorized domains → ส่งแบบไม่มีลิงก์กลับ (ยังรีเซ็ตได้ตามปกติ)
          try { await sendPasswordResetEmail(auth, addr); } catch (e2) { if (e2.code !== 'auth/user-not-found') throw e2; }
          return;
        }
        throw e;
      }
    },

    /** ตรวจรหัสในลิงก์จากอีเมล → คืนอีเมลของบัญชี */
    async checkResetCode(code) {
      if (!auth) throw notConfigured();
      return verifyPasswordResetCode(auth, code);
    },

    async confirmReset(code, password) {
      if (!auth) throw notConfigured();
      await confirmPasswordReset(auth, code, password);
    },

    /** ลิงก์ยืนยันอีเมล (ถ้าตั้ง Custom action URL ใน Firebase ไว้ ลิงก์ยืนยันอีเมลจะมาหน้าเดียวกัน) */
    async applyEmailAction(code) {
      if (!auth) throw notConfigured();
      await applyActionCode(auth, code);
      if (auth.currentUser) await auth.currentUser.reload().catch(() => {});
    },

    /** บันทึกการยอมรับนโยบายความเป็นส่วนตัว (เวอร์ชันปัจจุบัน) */
    async acceptPrivacy() {
      if (!this.user) return;
      try { localStorage.setItem(consentKey(this.user.uid), PRIVACY_VERSION); } catch { /* ignore */ }
      if (this.profile) this.profile = { ...this.profile, privacyVersion: PRIVACY_VERSION };
      try {
        const { profile } = await api('/api/auth/privacy-consent', { method: 'POST', body: { version: PRIVACY_VERSION } });
        this.profile = profile;
      } catch (e) {
        console.warn('[auth] privacy consent not saved on server (will retry on next sync)', e);
      }
    },

    async logout() {
      if (auth) await signOut(auth);
      this.user = null;
      this.profile = null;
    },
  },
});
