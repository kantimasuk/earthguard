<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AppLogo from './AppLogo.vue';
import { useToastStore } from '@/stores/toast';
import { useAuthStore } from '@/stores/auth';
import { play } from '@/services/sound';

// แถบเมนูด้านบน (หน้าที่ login แล้ว)
// - จอกว้าง: โลโก้ | เมนูเรียงกลาง | กรอบโปรไฟล์ (กดแล้วมีเมนูย่อย "ออกจากระบบ")
// - โทรศัพท์/จอแคบ: โลโก้ | รูปโปรไฟล์ + ปุ่มแฮมเบอร์เกอร์ → แผงเมนูเลื่อนออกจากขวา
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const toast = useToastStore();

const soonItems = [
  { label: 'วิธีเล่น', icon: 'M12 17v.01M12 13.5c0-2 2.5-2 2.5-4a2.5 2.5 0 0 0-5 0 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z' },
  { label: 'คลังความรู้', icon: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z M4 20.5A2.5 2.5 0 0 0 6.5 23H20' },
  { label: 'สถิติและอันดับ', icon: 'M5 21V11 M12 21V4 M19 21v-7' },
  { label: 'การตั้งค่า', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z' },
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
  <header class="nav">
    <button type="button" class="brand" aria-label="หน้าหลัก" @click="goHome">
      <AppLogo size="sm" :stacked="false" />
    </button>

    <!-- จอกว้าง -->
    <nav class="links wide-only" aria-label="เมนูหลัก">
      <button type="button" class="link" :class="{ active: route.name === 'menu' }" @click="goHome">หน้าหลัก</button>
      <button v-for="item in soonItems" :key="item.label" type="button" class="link disabled" aria-disabled="true" @click="notReady(item)">{{ item.label }}</button>
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
            <button type="button" class="d-item" :class="{ active: route.name === 'menu' }" @click="goHome">
              <span class="ic"><svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5 M5.5 10v10h13V10 M10 20v-5h4v5" /></svg></span>
              หน้าหลัก
            </button>
            <button v-for="item in soonItems" :key="item.label" type="button" class="d-item disabled" aria-disabled="true" @click="notReady(item)">
              <span class="ic"><svg viewBox="0 0 24 24"><path :d="item.icon" /></svg></span>
              {{ item.label }}
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
/* แถบขาวเต็มความกว้าง (ชดเชยระยะขอบของ .page) */
.nav {
  position: relative; z-index: 20; flex: none;
  display: flex; align-items: center; gap: 1rem;
  height: var(--nav-h);
  margin: calc(-1 * var(--safe-t)) calc(-1 * var(--safe-r)) 0 calc(-1 * var(--safe-l));
  padding: 0 var(--safe-r) 0 var(--safe-l);
  background: #ffffff;
  box-shadow: 0 2px 12px rgba(33, 79, 31, 0.12);
}
.brand { background: none; border: 0; padding: 0; cursor: pointer; flex: none; display: flex; }
.nav .brand :deep(.custom) { height: calc(var(--nav-h) - 10px); }

svg { width: 1.15rem; height: 1.15rem; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* ---------- จอกว้าง ---------- */
.links { display: flex; align-items: center; justify-content: center; gap: 0.4rem; flex: 1; min-width: 0; }
.link {
  position: relative; display: inline-flex; align-items: center;
  height: 2.5rem; padding: 0 1rem; border-radius: 999px;
  background: none; border: 0; cursor: pointer; white-space: nowrap;
  font-family: var(--font-head); font-size: 1.05rem; font-weight: 500; color: var(--text);
}
.link { transition: background 0.15s, color 0.15s; }
.link:hover:not(.disabled):not(.active) { background: #f2f5ee; }
/* เมนูที่อยู่ตอนนี้: พื้นหลังเขียวอ่อน + ตัวอักษรเขียว */
.link.active { background: var(--leaf-light); color: var(--leaf); font-weight: 600; }
.link.disabled { cursor: not-allowed; }

.profile {
  display: inline-flex; align-items: center; gap: 0.5rem; flex: none;
  height: 2.6rem; min-height: 38px; padding: 0 0.6rem 0 0.25rem; border-radius: 999px;
  background: #ffffff; border: 1.5px solid var(--input-border); color: var(--text);
  cursor: pointer; max-width: 15rem;
}
.profile:hover, .profile.active { background: var(--leaf-light); }
.profile img { width: 2.1rem; height: 2.1rem; min-width: 30px; min-height: 30px; border-radius: 50%; object-fit: cover; border: 2px solid var(--leaf); background: var(--leaf-light); }
.profile .name { font-family: var(--font-head); font-size: 0.98rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.chev { width: 1rem; height: 1rem; color: var(--text-muted); transition: transform 0.2s; }
.profile.active .chev { transform: rotate(180deg); }

.dropdown {
  position: fixed; z-index: 600; min-width: 13rem;
  padding: 0.4rem; background: #ffffff; border-radius: 1rem;
  box-shadow: 0 0.8rem 2rem rgba(20, 50, 20, 0.22);
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
  display: flex; flex-direction: column;
  padding: max(12px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) 14px;
  background: #ffffff;
  border-radius: 1.2rem 0 0 1.2rem;
  box-shadow: -0.8rem 0 2rem rgba(20, 50, 20, 0.25);
}
.drawer-head {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.5rem 0.6rem; border-radius: 0.9rem;
  background: var(--leaf-light);
}
.drawer-head img { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--leaf); background: #fff; object-fit: cover; flex: none; }
.who-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.who-text strong { font-family: var(--font-head); font-size: 0.95rem; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.who-text small { font-size: 0.72rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.x { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border: 0; border-radius: 50%; background: #ffffff; color: var(--text); cursor: pointer; }
.x svg { width: 1rem; height: 1rem; }

.drawer-list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding: 0.5rem 0; }
.d-item {
  display: flex; align-items: center; gap: 0.65rem;
  min-height: 42px; padding: 0 0.6rem; border-radius: 0.8rem;
  background: none; border: 0; text-align: left; cursor: pointer;
  font-family: var(--font-head); font-size: 0.92rem; font-weight: 500; color: var(--text);
}
.d-item .ic { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border-radius: 0.6rem; background: #f3f5ef; color: var(--text-muted); }
.d-item .ic svg { width: 1rem; height: 1rem; }
.d-item.active { background: var(--leaf); color: #ffffff; }
.d-item.active .ic { background: rgba(255, 255, 255, 0.2); color: #ffffff; }
.d-item.disabled { cursor: not-allowed; }
.d-logout {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  min-height: 42px; border-radius: 0.8rem; cursor: pointer;
  border: 1.5px solid #f3c9c7; background: #fff7f6; color: var(--danger);
  font-family: var(--font-head); font-size: 0.92rem; font-weight: 600;
}
.d-logout svg { width: 1rem; height: 1rem; }

@media (max-width: 1000px) {
  .wide-only { display: none !important; }
  .narrow-only { display: flex; }
  /* โทรศัพท์: ไม่มีแถบขาว — โลโก้และปุ่มเมนูลอยอยู่บนพื้นหลัง (มุมซ้าย/ขวาบน) */
  .nav {
    position: absolute; z-index: 30; left: 0; right: 0; top: 0;
    height: auto; margin: 0; align-items: flex-start;
    padding: calc(var(--safe-t) - 2px) var(--safe-r) 0 var(--safe-l);
    background: none; box-shadow: none; pointer-events: none;
  }
  .nav > * { pointer-events: auto; }
  .nav .brand :deep(.custom) {
    height: 62px; max-width: 130px;
    filter: drop-shadow(0 0 1.5px #ffffff) drop-shadow(0 0 1.5px #ffffff) drop-shadow(0 0.3rem 0.5rem rgba(20, 50, 20, 0.35));
  }
}
@media (max-height: 380px) {
  .d-item, .d-logout { min-height: 36px; }
  .d-item .ic { width: 26px; height: 26px; }
  .drawer-list { padding: 0.35rem 0; }
}

.drop-enter-active, .drop-leave-active { transition: opacity 0.18s, transform 0.18s var(--ease-out); }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-6px) scale(0.98); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform 0.3s var(--ease-out); }
.slide-enter-from, .slide-leave-to { transform: translateX(105%); }
</style>
