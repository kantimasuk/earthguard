<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AppLogo from './AppLogo.vue';
import { useToastStore } from '@/stores/toast';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { play } from '@/services/sound';

// แถบเมนูด้านบน (หน้าที่ login แล้ว) — ดีไซน์แบบเกม: แผงลอยขอบขาวหนา · ปุ่มเมนูทรงเม็ดยา + ไอคอนสีพาสเทล · กดแล้วยุบ
// (แบบเดิมเก็บไว้ที่ AppNavbar.classic.vue — อยากกลับไปใช้แบบเดิม: คัดลอกไฟล์นั้นมาทับไฟล์นี้)
// - จอกว้าง: โลโก้ | เมนูเรียงกลาง | กรอบโปรไฟล์ (กดแล้วมีเมนูย่อย "ออกจากระบบ")
// - โทรศัพท์/จอแคบ: โลโก้ | รูปโปรไฟล์ + ปุ่มแฮมเบอร์เกอร์ → แผงเมนูเลื่อนออกจากขวา
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const toast = useToastStore();
const app = useAppStore();
const SHIELD_ICON = 'M12 3 4 7v5c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V7Z M10 11.5V10a2 2 0 0 1 4 0v1.5 M9 11.5h6v4H9z';
function openPolicy() { play('click'); closeDropdown(); closeDrawer(); app.openPrivacy(); }

// รูปแบบแถบบนจอคอม: false = ชิดขอบจอ (เต็มความกว้าง มุมโค้งเฉพาะด้านล่าง) · true = แผงลอย (มีระยะห่างรอบ มุมโค้งทุกมุม)
const FLOATING = false;
const HOME_ICON = 'M3 11.5 12 4l9 7.5 M5.5 10v10h13V10 M10 20v-5h4v5';
const soonItems = [
  { label: 'วิธีเล่น', c: '#7fb5e3', icon: 'M12 17v.01M12 13.5c0-2 2.5-2 2.5-4a2.5 2.5 0 0 0-5 0 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z' },
  { label: 'คลังความรู้', c: '#f0c35a', icon: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z M4 20.5A2.5 2.5 0 0 0 6.5 23H20' },
  { label: 'สถิติและอันดับ', c: '#f09bb5', icon: 'M5 21V11 M12 21V4 M19 21v-7' },
  { label: 'การตั้งค่า', c: '#b59ae6', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z' },
];

const dropdown = ref(false);   // เมนูย่อยโปรไฟล์ (จอกว้าง)
const drawer = ref(false);     // แผงเมนูด้านขวา (โทรศัพท์)
const profileBtn = ref(null);
const menuEl = ref(null);
const anchor = ref({ top: 0, right: 0 });

function outside(e) {
  if (menuEl.value?.contains(e.target) || profileBtn.value?.contains(e.target)) return;
  closeDropdown();
}
function toggleDropdown() {
  play('click');
  if (dropdown.value) return closeDropdown();
  const r = profileBtn.value.getBoundingClientRect();
  anchor.value = { top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) };
  dropdown.value = true;
  setTimeout(() => document.addEventListener('pointerdown', outside), 0);
}
function closeDropdown() {
  dropdown.value = false;
  document.removeEventListener('pointerdown', outside);
}
// เมนูที่ยังไม่เปิดใช้: กดไม่ได้ แค่แจ้งเตือน
function notReady(item) {
  play('click');
  toast.show(`เมนู "${item.label}" ยังไม่เปิดให้ใช้งาน`);
}
function openDrawer() { play('click'); drawer.value = true; }
function closeDrawer() { drawer.value = false; }
function onKey(e) { if (e.key === 'Escape') { closeDrawer(); closeDropdown(); } }
watch(drawer, (v) => (v ? window.addEventListener('keydown', onKey) : window.removeEventListener('keydown', onKey)));
onBeforeUnmount(() => { closeDropdown(); window.removeEventListener('keydown', onKey); });

async function logout() {
  closeDropdown();
  closeDrawer();
  play('click');
  await auth.logout();
  router.replace('/login');
}
function goHome() {
  play('click');
  closeDropdown();
  closeDrawer();
  if (route.name !== 'menu') router.push('/menu');
}
</script>

<template>
  <header class="nav" :class="{ floating: FLOATING }">
    <div class="bar">
    <button type="button" class="brand" aria-label="หน้าหลัก" @click="goHome">
      <AppLogo size="sm" :stacked="false" />
    </button>

    <!-- จอกว้าง: ปุ่มเมนูแบบเกม (ไอคอนวงกลมสี + ชื่อ) -->
    <nav class="links wide-only" aria-label="เมนูหลัก">
      <button type="button" class="link" :class="{ active: route.name === 'menu' }" style="--c: #6cc788" @click="goHome">
        <span class="ic"><svg viewBox="0 0 24 24"><path :d="HOME_ICON" /></svg></span>
        <span class="lbl">หน้าหลัก</span>
      </button>
      <button v-for="item in soonItems" :key="item.label" type="button" class="link soon" :style="{ '--c': item.c }" aria-disabled="true" @click="notReady(item)">
        <span class="ic"><svg viewBox="0 0 24 24"><path :d="item.icon" /></svg></span>
        <span class="lbl">{{ item.label }}</span>
      </button>
    </nav>
    <button ref="profileBtn" type="button" class="profile wide-only" :class="{ active: dropdown }" :aria-expanded="dropdown" aria-haspopup="menu" @click="toggleDropdown">
      <img :src="auth.avatar" alt="" referrerpolicy="no-referrer" @error="(e) => (e.target.src = '/images/avatar-default.svg')" />
      <span class="name">{{ auth.displayName }}</span>
      <svg class="chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
    </button>

    <!-- โทรศัพท์ -->
    <div class="mobile-actions narrow-only">
      <button type="button" class="burger" :class="{ open: drawer }" aria-label="เปิดเมนู" :aria-expanded="drawer" @click="openDrawer">
        <span /><span /><span />
      </button>
    </div>
    </div>

    <Teleport to="body">
      <!-- เมนูย่อยโปรไฟล์ (จอกว้าง) -->
      <Transition name="drop">
        <div v-if="dropdown" ref="menuEl" class="dropdown" :style="{ top: anchor.top + 'px', right: anchor.right + 'px' }" role="menu">
          <div class="who">
            <img :src="auth.avatar" alt="" referrerpolicy="no-referrer" />
            <div>
              <strong>{{ auth.displayName }}</strong>
              <small>{{ auth.profile?.email || auth.user?.email }}</small>
            </div>
          </div>
          <button type="button" class="item" role="menuitem" @click="openPolicy">
            <svg viewBox="0 0 24 24"><path :d="SHIELD_ICON" /></svg>
            นโยบายความเป็นส่วนตัว
          </button>
          <button type="button" class="item danger" role="menuitem" @click="logout">
            <svg viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l5-5-5-5 M15 12H3" /></svg>
            ออกจากระบบ
          </button>
        </div>
      </Transition>

      <!-- แผงเมนูด้านขวา (โทรศัพท์) -->
      <Transition name="fade">
        <div v-if="drawer" class="scrim" @click="closeDrawer"></div>
      </Transition>
      <Transition name="slide">
        <aside v-if="drawer" class="drawer" role="dialog" aria-modal="true" aria-label="เมนู">
          <div class="drawer-head">
            <img :src="auth.avatar" alt="" referrerpolicy="no-referrer" />
            <div class="who-text">
              <strong>{{ auth.displayName }}</strong>
              <small>{{ auth.profile?.email || auth.user?.email }}</small>
            </div>
            <button type="button" class="x" aria-label="ปิดเมนู" @click="closeDrawer">
              <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <nav class="drawer-list" aria-label="เมนูหลัก">
            <button type="button" class="d-item" :class="{ active: route.name === 'menu' }" style="--c: #6cc788" @click="goHome">
              <span class="ic"><svg viewBox="0 0 24 24"><path :d="HOME_ICON" /></svg></span>
              หน้าหลัก
            </button>
            <button v-for="item in soonItems" :key="item.label" type="button" class="d-item" :style="{ '--c': item.c }" aria-disabled="true" @click="notReady(item)">
              <span class="ic"><svg viewBox="0 0 24 24"><path :d="item.icon" /></svg></span>
              {{ item.label }}
            </button>
            <button type="button" class="d-item" style="--c: #8fb6d9" @click="openPolicy">
              <span class="ic"><svg viewBox="0 0 24 24"><path :d="SHIELD_ICON" /></svg></span>
              นโยบายความเป็นส่วนตัว
            </button>
          </nav>

          <button type="button" class="d-logout" @click="logout">
            <svg viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l5-5-5-5 M15 12H3" /></svg>
            ออกจากระบบ
          </button>
        </aside>
      </Transition>
    </Teleport>
  </header>
</template>

<style scoped>
/* ชั้นนอก: เต็มความกว้าง (ชดเชยระยะขอบของ .page) · ข้างในเป็น "แผงลอย" แบบเกม */
.nav {
  position: relative; z-index: 20; flex: none;
  margin: calc(-1 * var(--safe-t)) calc(-1 * var(--safe-r)) 0 calc(-1 * var(--safe-l));
}
/* แบบชิดขอบ (ค่าเริ่มต้น): เต็มความกว้างจอ ติดขอบบน มุมโค้งเฉพาะด้านล่าง */
.bar {
  display: flex; align-items: center; gap: 1rem;
  height: calc(var(--nav-h) + var(--safe-t) - 4px);
  padding: max(0px, calc(var(--safe-t) - 4px)) calc(var(--safe-r) + 0.3rem) 0 calc(var(--safe-l) + 0.6rem);
  border-radius: 0 0 24px 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(238, 248, 234, 0.94) 100%);
  border-bottom: 3px solid #ffffff;
  box-shadow: 0 4px 0 #bfdcb3, 0 12px 26px rgba(30, 70, 40, 0.18);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
/* แบบแผงลอย (FLOATING = true) */
.nav.floating { padding: max(8px, calc(var(--safe-t) - 4px)) var(--safe-r) 0 var(--safe-l); }
.nav.floating .bar {
  height: var(--nav-h); padding: 0 0.5rem 0 0.9rem;
  border-radius: 22px; border: 3px solid #ffffff;
}
.brand { background: none; border: 0; padding: 0; cursor: pointer; flex: none; display: flex; transition: transform 0.2s var(--ease-back); }
.brand:hover { transform: rotate(-3deg) scale(1.04); }
.nav .brand :deep(.custom) { height: calc(var(--nav-h) - 8px); }

svg { width: 1.15rem; height: 1.15rem; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* ---------- จอกว้าง: ปุ่มเมนูแบบเกม ---------- */
.links { display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex: 1; min-width: 0; }
.link {
  --c: #6cc788;
  position: relative; display: inline-flex; align-items: center; gap: 0.45rem;
  height: 2.6rem; padding: 0 1rem 0 0.3rem; border-radius: 999px;
  background: #ffffff; border: 2px solid #e2eedc; cursor: pointer; white-space: nowrap;
  box-shadow: 0 3px 0 #d3e5ca;
  font-family: var(--font-head); font-size: 1rem; font-weight: 600; color: #3d5a45;
  transition: transform 0.18s var(--ease-back), box-shadow 0.18s, background 0.2s;
}
.link .ic {
  width: 1.95rem; height: 1.95rem; flex: none; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--c); color: #ffffff; box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.12);
}
.link .ic svg { width: 1.05rem; height: 1.05rem; stroke-width: 2.4; }
.link:hover { transform: translateY(-2px); box-shadow: 0 5px 0 #d3e5ca; }
.link:hover .ic { animation: ic-wiggle 0.5s ease-in-out; }
.link:active { transform: translateY(2px); box-shadow: 0 1px 0 #d3e5ca; }
/* เมนูที่อยู่ตอนนี้: ปุ่มเขียวนูนแบบปุ่มเกม */
.link.active {
  background: linear-gradient(180deg, #7fd49a 0%, #45a064 100%); color: #ffffff; border-color: #ffffff;
  box-shadow: 0 3px 0 #2f7446, 0 0 0 3px rgba(108, 199, 136, 0.3);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
}
.link.active .ic { background: rgba(255, 255, 255, 0.28); box-shadow: none; }
.link.active:hover { box-shadow: 0 5px 0 #2f7446, 0 0 0 3px rgba(108, 199, 136, 0.3); }
/* เมนูที่ยังไม่เปิด: หน้าตาปกติ กดแล้วขึ้นแจ้งเตือน (ไม่มีกุญแจ) */
@keyframes ic-wiggle { 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }

.profile {
  display: inline-flex; align-items: center; gap: 0.5rem; flex: none;
  height: 2.7rem; min-height: 38px; padding: 0 0.7rem 0 0.25rem; border-radius: 999px;
  background: #ffffff; border: 2px solid #e2eedc; color: var(--text); box-shadow: 0 3px 0 #d3e5ca;
  cursor: pointer; max-width: 15rem;
  transition: transform 0.18s var(--ease-back), box-shadow 0.18s, background 0.2s;
}
.profile:hover { transform: translateY(-2px); box-shadow: 0 5px 0 #d3e5ca; }
.profile.active { background: #f3faef; transform: translateY(1px); box-shadow: 0 2px 0 #d3e5ca; }
.profile img {
  width: 2.15rem; height: 2.15rem; min-width: 30px; min-height: 30px; border-radius: 50%; object-fit: cover;
  border: 2.5px solid #ffffff; background: var(--leaf-light);
  box-shadow: 0 0 0 2.5px #f6cf6a;
}
.profile .name { font-family: var(--font-head); font-size: 0.98rem; font-weight: 600; color: #2f5a3a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; padding-left: 0.1rem; }
.chev { width: 1rem; height: 1rem; color: var(--text-muted); transition: transform 0.2s; }
.profile.active .chev { transform: rotate(180deg); }

/* จอกว้างแต่ไม่มาก: ซ่อนไอคอนในปุ่มเมนู กันล้น */
@media (max-width: 1280px) {
  .links { gap: 0.35rem; }
  .link { padding: 0 0.85rem; }
  .link .ic { display: none; }
  .profile { max-width: 12rem; }
}

.dropdown {
  position: fixed; z-index: 600; min-width: 13rem;
  padding: 0.45rem; background: #ffffff; border-radius: 1.1rem; border: 3px solid #ffffff;
  box-shadow: 0 4px 0 #bfdcb3, 0 0.8rem 2rem rgba(20, 50, 20, 0.22);
  display: flex; flex-direction: column; gap: 0.15rem;
}
.who { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.5rem 0.6rem; border-bottom: 1px solid var(--input-border); margin-bottom: 0.2rem; }
.who img { width: 2.4rem; height: 2.4rem; border-radius: 50%; border: 2px solid var(--leaf); background: var(--leaf-light); }
.who div { display: flex; flex-direction: column; min-width: 0; }
.who strong { font-family: var(--font-head); font-weight: 600; }
.who small { color: var(--text-muted); font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 12rem; }
.item {
  display: flex; align-items: center; gap: 0.55rem;
  min-height: 40px; padding: 0 0.7rem; border-radius: 0.6rem;
  background: none; border: 0; color: var(--text); text-align: left; cursor: pointer;
  font-family: var(--font-head); font-size: 0.98rem;
}
.item:hover { background: #f3faef; }
.item.danger { color: var(--danger); }
.item.danger:hover { background: var(--danger-bg); }

/* ---------- โทรศัพท์ ---------- */
.narrow-only { display: none; }
.mobile-actions { margin-left: auto; align-items: center; gap: 0.5rem; }
.burger {
  width: 50px; height: 50px; border-radius: 50%; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
  background: var(--leaf); border: 3px solid #ffffff;
  box-shadow: 0 0.25rem 0 var(--leaf-dark), 0 0.5rem 1.1rem rgba(20, 50, 20, 0.35);
}
.burger span { width: 22px; height: 3.5px; border-radius: 3px; background: #ffffff; }
.burger:active { transform: translateY(2px); box-shadow: 0 0.1rem 0 var(--leaf-dark), 0 0.3rem 0.7rem rgba(20, 50, 20, 0.3); }

.scrim { position: fixed; inset: 0; z-index: 650; background: rgba(20, 45, 25, 0.35); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); }
.drawer {
  position: fixed; z-index: 660; top: 0; right: 0; bottom: 0;
  width: min(300px, 82vw);
  display: flex; flex-direction: column; gap: 0.4rem;
  padding: max(12px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(238, 248, 234, 0.97) 100%);
  border-left: 3px solid #ffffff;
  border-radius: 1.4rem 0 0 1.4rem;
  box-shadow: -4px 0 0 #bfdcb3, -0.8rem 0 2rem rgba(20, 50, 20, 0.25);
}
/* หัวลิ้นชัก: การ์ดโปรไฟล์ขอบขาวหนา */
.drawer-head {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.45rem 0.5rem 0.45rem 0.45rem; border-radius: 1rem;
  background: #ffffff; border: 2px solid #e2eedc; box-shadow: 0 3px 0 #d3e5ca;
}
.drawer-head img { width: 40px; height: 40px; border-radius: 50%; border: 2.5px solid #fff; box-shadow: 0 0 0 2.5px #f6cf6a; background: var(--leaf-light); object-fit: cover; flex: none; }
.who-text { display: flex; flex-direction: column; min-width: 0; flex: 1; padding-left: 0.1rem; }
.who-text strong { font-family: var(--font-head); font-size: 0.95rem; font-weight: 700; color: #2f5a3a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.who-text small { font-size: 0.72rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.x { width: 34px; height: 34px; flex: none; display: flex; align-items: center; justify-content: center; padding: 0; border: 2px solid #e2eedc; border-radius: 50%; background: #f4f8f1; color: var(--text); cursor: pointer; }
.x svg { width: 1rem; height: 1rem; }

/* รายการเมนู: ปุ่มเม็ดยาแบบเดียวกับจอคอม */
.drawer-list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 0.45rem; padding: 0.5rem 0.1rem; }
.d-item {
  --c: #6cc788;
  display: flex; align-items: center; gap: 0.6rem; flex: none;
  min-height: 44px; padding: 0 0.7rem 0 0.3rem; border-radius: 999px;
  background: #ffffff; border: 2px solid #e2eedc; box-shadow: 0 3px 0 #d3e5ca;
  text-align: left; cursor: pointer;
  font-family: var(--font-head); font-size: 0.94rem; font-weight: 600; color: #3d5a45;
  transition: transform 0.12s var(--ease-out), box-shadow 0.12s;
}
.d-item:active { transform: translateY(2px); box-shadow: 0 1px 0 #d3e5ca; }
.d-item .ic {
  width: 32px; height: 32px; flex: none; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--c); color: #ffffff; box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.12);
}
.d-item .ic svg { width: 1rem; height: 1rem; stroke-width: 2.4; }
.d-item.active {
  background: linear-gradient(180deg, #7fd49a 0%, #45a064 100%); color: #ffffff; border-color: #ffffff;
  box-shadow: 0 3px 0 #2f7446; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
}
.d-item.active .ic { background: rgba(255, 255, 255, 0.28); box-shadow: none; }
.d-logout {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex: none;
  min-height: 44px; border-radius: 999px; cursor: pointer;
  border: 2px solid #ffffff; background: linear-gradient(180deg, #ff9f92 0%, #e0574b 100%); color: #ffffff;
  box-shadow: 0 3px 0 #a93a31; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
  font-family: var(--font-head); font-size: 0.94rem; font-weight: 700;
}
.d-logout:active { transform: translateY(2px); box-shadow: 0 1px 0 #a93a31; }
.d-logout svg { width: 1rem; height: 1rem; }

@media (max-width: 1000px) {
  .wide-only { display: none !important; }
  .narrow-only { display: flex; }
  /* โทรศัพท์: ไม่มีแถบขาว — โลโก้และปุ่มเมนูลอยอยู่บนพื้นหลัง (มุมซ้าย/ขวาบน) */
  .nav {
    position: absolute; z-index: 30; left: 0; right: 0; top: 0;
    margin: 0; padding: calc(var(--safe-t) - 2px) var(--safe-r) 0 var(--safe-l);
    pointer-events: none;
  }
  .bar {
    height: auto; padding: 0; align-items: flex-start; border: 0; border-radius: 0;
    background: none; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none;
  }
  .bar > * { pointer-events: auto; }
  .nav .brand :deep(.custom) {
    height: 62px; max-width: 130px;
    filter: drop-shadow(0 0 1.5px #ffffff) drop-shadow(0 0 1.5px #ffffff) drop-shadow(0 0.3rem 0.5rem rgba(20, 50, 20, 0.35));
  }
}
@media (max-height: 380px) {
  .d-item, .d-logout { min-height: 36px; }
  .d-item .ic { width: 26px; height: 26px; }
  .drawer-list { padding: 0.35rem 0.1rem; gap: 0.35rem; }
}

.drop-enter-active, .drop-leave-active { transition: opacity 0.18s, transform 0.18s var(--ease-out); }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-6px) scale(0.98); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform 0.3s var(--ease-out); }
.slide-enter-from, .slide-leave-to { transform: translateX(105%); }
</style>
