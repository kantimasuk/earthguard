<script setup>
// ปุ่มฟันเฟือง + ป๊อปอัปตั้งค่าระหว่างเล่น (ใช้ในหน้า Pre-test, เล่นเกม, Post-test)
// - เพิ่ม/ลดเสียง, เปิด/ปิดเสียง (ค่าคงอยู่ข้ามหน้าและข้ามรอบ — เก็บใน localStorage ผ่าน sound.js)
// - ออกจากเกม (ถามยืนยันก่อน) → ไม่บันทึกผลของรอบนี้
// ระหว่างเปิดป๊อปอัป เกมไม่หยุด ตัวจับเวลายังเดินต่อ
import { ref } from 'vue';
import BaseModal from './BaseModal.vue';
import { openModals } from './modalState';
import { audioSettings, play } from '@/services/sound';
import { musicSettings } from '@/services/music';
import { useAppStore } from '@/stores/app';

const props = defineProps({
  showSpeed: { type: Boolean, default: false }, // แสดงสวิตช์ "AI เล่นเร็ว" (เฉพาะหน้าเล่นเกม)
  fast: { type: Boolean, default: false },
  exiting: { type: Boolean, default: false },
});
const emit = defineEmits(['exit', 'speed']);

const app = useAppStore();
const open = ref(false);
const confirm = ref(false);
const volume = ref(audioSettings.volume);
const muted = ref(audioSettings.muted);
const musicOn = ref(musicSettings.on);
function toggleMusic() {
  musicSettings.setOn(!musicOn.value);
  musicOn.value = musicSettings.on;
  play('tap');
}

function toggle() { play('click'); open.value = !open.value; }
function step(d) {
  audioSettings.setVolume(volume.value + d);
  volume.value = audioSettings.volume;
  if (muted.value && d > 0) { audioSettings.setMuted(false); muted.value = false; }
  play('tap');
}
function toggleMute() {
  audioSettings.setMuted(!muted.value);
  muted.value = audioSettings.muted;
  play('tap');
}
function askExit() { play('click'); confirm.value = true; }
function doExit() { emit('exit'); }
</script>

<template>
  <button type="button" class="gear" :class="{ on: open, away: openModals > 0 }" :tabindex="openModals > 0 ? -1 : 0" aria-label="ตั้งค่า" @click="toggle">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  </button>

  <BaseModal :open="open" title="ตั้งค่า" width="21rem" @close="open = false">
    <div class="rows">
      <div class="row">
        <span class="label">ระดับเสียง</span>
        <div class="vol">
          <button type="button" class="step" aria-label="ลดเสียง" :disabled="volume <= 0" @click="step(-0.1)">
            <svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg>
          </button>
          <div class="bars" :class="{ muted }" role="meter" :aria-valuenow="Math.round(volume * 100)" aria-valuemin="0" aria-valuemax="100">
            <i v-for="i in 10" :key="i" :class="{ lit: i <= Math.round(volume * 10) }" />
          </div>
          <button type="button" class="step" aria-label="เพิ่มเสียง" :disabled="volume >= 1" @click="step(0.1)">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>

      <div class="row">
        <span class="label">เสียง</span>
        <button type="button" class="switch" :class="{ off: muted }" role="switch" :aria-checked="!muted" @click="toggleMute">
          <svg v-if="!muted" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Z M16.5 8.5a5 5 0 0 1 0 7 M19 6a8.5 8.5 0 0 1 0 12" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Z M17 9l5 6 M22 9l-5 6" /></svg>
          {{ muted ? 'ปิดเสียงอยู่' : 'เปิดเสียงอยู่' }}
        </button>
      </div>

      <div class="row">
        <span class="label">เพลงประกอบ</span>
        <button type="button" class="switch" :class="{ off: !musicOn }" role="switch" :aria-checked="musicOn" @click="toggleMusic">
          <svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
          {{ musicOn ? 'เปิด' : 'ปิด' }}
        </button>
      </div>

      <div v-if="props.showSpeed" class="row">
        <span class="label">AI เล่นเร็ว</span>
        <button type="button" class="switch" :class="{ off: !fast }" role="switch" :aria-checked="fast" @click="play('tap'); emit('speed', !fast)">
          <svg viewBox="0 0 24 24"><path d="M4 18V6l7 6-7 6Z M12 18V6l7 6-7 6Z" /></svg>
          {{ fast ? 'เปิด' : 'ปิด' }}
        </button>
      </div>

      <button type="button" class="policy" @click="play('click'); app.openPrivacy()">
        <svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V7Z M10 11.5V10a2 2 0 0 1 4 0v1.5 M9 11.5h6v4H9z" /></svg>
        นโยบายความเป็นส่วนตัว
      </button>
      <button type="button" class="btn btn--block exit" @click="askExit">
        <svg viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l5-5-5-5 M15 12H3" /></svg>
        ออกจากเกม
      </button>
    </div>
  </BaseModal>

  <BaseModal :open="confirm" title="ออกจากเกม?" width="22rem" :closable="!exiting" @close="confirm = false">
    <p class="warn">หากออกตอนนี้ ผลเกมและผลแบบทดสอบของรอบนี้จะไม่ถูกบันทึก</p>
    <div class="actions">
      <button type="button" class="btn btn--light" :disabled="exiting" @click="play('click'); confirm = false">ยกเลิก</button>
      <button type="button" class="btn danger" :disabled="exiting" @click="doExit">
        <span v-if="exiting" class="spinner" />ออกจากเกม
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
.gear {
  /* ตำแหน่ง/ขนาดกำหนดจากหน้าที่ใช้ผ่านตัวแปร CSS (--gear-top / --gear-right / --gear-size)
     → หน้าแบบทดสอบ: แถวเดียวกับวงเวลา ขนาดเท่ากัน · หน้าเกม: แถวเดียวกับปุ่มเครื่องมือ ขนาดเท่ากัน */
  --s: var(--gear-size, 42px);
  position: fixed; z-index: 60;
  top: var(--gear-top, max(8px, env(safe-area-inset-top)));
  right: var(--gear-right, max(10px, env(safe-area-inset-right)));
  width: var(--s); height: var(--s); border-radius: 50%; padding: 0; margin: 0; line-height: 0;
  /* flex (ไม่ใช้ grid บนปุ่ม) + padding 0 → ไอคอนอยู่กลางวงพอดีบน iOS Safari */
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  background: #ffffff; border: 2px solid rgba(47, 107, 44, 0.25);
  box-shadow: 0 3px 10px rgba(20, 50, 20, 0.22);
  transition: transform 0.3s var(--ease-back), opacity 0.2s;
}
.gear svg { display: block; flex: none; width: calc(var(--s) * 0.56); height: calc(var(--s) * 0.56); fill: none; stroke: var(--leaf); stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.gear.on, .gear:active { transform: rotate(60deg); }
/* มีป๊อปอัปเปิดอยู่ → ซ่อนฟันเฟือง (ไม่ให้ไปอยู่ชิด/ทับปุ่ม X ของป๊อปอัป) */
.gear.away { opacity: 0; pointer-events: none; }

.rows { display: flex; flex-direction: column; gap: 0.8rem; padding-top: 0.2rem; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; }
.label { font-weight: 600; color: var(--text); }
.vol { display: flex; align-items: center; gap: 0.45rem; }
.step {
  width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--input-border);
  background: #ffffff; display: grid; place-items: center; cursor: pointer;
}
.step:disabled { opacity: 0.4; cursor: not-allowed; }
.step svg { width: 18px; height: 18px; fill: none; stroke: var(--leaf); stroke-width: 2.6; stroke-linecap: round; }
.bars { display: flex; align-items: flex-end; gap: 3px; height: 22px; }
.bars i { width: 5px; border-radius: 2px; background: #e2e6de; }
.bars i:nth-child(1) { height: 6px; } .bars i:nth-child(2) { height: 8px; } .bars i:nth-child(3) { height: 10px; }
.bars i:nth-child(4) { height: 12px; } .bars i:nth-child(5) { height: 14px; } .bars i:nth-child(6) { height: 16px; }
.bars i:nth-child(7) { height: 17px; } .bars i:nth-child(8) { height: 19px; } .bars i:nth-child(9) { height: 20px; }
.bars i:nth-child(10) { height: 22px; }
.bars i.lit { background: var(--leaf); }
.bars.muted i.lit { background: #b9c2b5; }

.switch {
  display: inline-flex; align-items: center; gap: 0.4rem; min-height: 36px; padding: 0 0.85rem;
  border-radius: 999px; border: 0; cursor: pointer; font-family: var(--font-head); font-weight: 600; font-size: 0.9rem;
  background: var(--leaf); color: #ffffff;
}
.switch.off { background: #e8ebe5; color: var(--text-muted); }
.switch svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.policy {
  display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.3rem; margin-top: 0.1rem;
  background: none; border: 0; cursor: pointer; font-family: var(--font-head); font-size: 0.88rem; color: var(--text-muted);
  text-decoration: underline; text-underline-offset: 3px;
}
.policy svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.exit { --btn-bg: #fff1ef; --btn-edge: #f2cfc9; --btn-ink: #b8433a; border: 1.5px solid #f2cfc9; margin-top: 0.2rem; }
.exit svg, .danger svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.warn { color: var(--text); line-height: 1.5; padding: 0.1rem 0 0.9rem; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.danger { --btn-bg: #d9534f; --btn-edge: #a63c39; }

</style>
