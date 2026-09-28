<script setup>
// แถบโหลดสีเขียว + ต้นกล้าวิ่งตามปลายแถบ (ใช้ร่วมกันทั้งหน้าเปิดแอปและทุกหน้าที่ต้องรอโหลด)
defineProps({
  value: { type: Number, default: 0 },          // 0–100
  label: { type: String, default: 'กำลังโหลด' },
});
</script>

<template>
  <div class="loader" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(value)" :aria-label="label">
    <div class="labels">
      <span class="txt">{{ label }}<span class="dots"><i>.</i><i>.</i><i>.</i></span></span>
      <span class="pct">{{ Math.round(value) }}%</span>
    </div>
    <div class="track">
      <div class="fill" :style="{ width: value + '%' }">
        <span class="stripes" />
        <!-- ต้นกล้าวิ่งตามปลายแถบ -->
        <span class="sprout" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 21v-8M12 13c0-4 3-7 8-7 0 5-3 8-8 7ZM12 15c0-3-2-6-7-6 0 4 2 7 7 6Z" /></svg>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loader { width: 100%; display: flex; flex-direction: column; gap: 0.45rem; animation: fade 0.6s 0.2s both; }
.labels {
  display: flex; justify-content: space-between; align-items: baseline; padding: 0 0.4rem;
  font-family: var(--font-head); color: #ffffff;
  text-shadow: 0 2px 0 rgba(33, 79, 31, 0.55), 0 0 10px rgba(20, 50, 20, 0.45);
}
.txt { font-size: 1.15rem; font-weight: 600; }
.pct { font-size: 1.3rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.dots i { font-style: normal; animation: dot 1.2s infinite; }
.dots i:nth-child(2) { animation-delay: 0.2s; }
.dots i:nth-child(3) { animation-delay: 0.4s; }

/* รางกระจกฝ้า + ขอบขาว */
.track {
  position: relative; height: 2.3rem; padding: 3px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  border: 3px solid #ffffff;
  box-shadow: 0 0.35rem 0 rgba(33, 79, 31, 0.35), 0 0.6rem 1.4rem rgba(20, 50, 20, 0.3), inset 0 2px 6px rgba(20, 50, 20, 0.25);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
}
/* แถบเขียว + ลายทางวิ่ง + ไฮไลต์ด้านบน */
.fill {
  position: relative; height: 100%; min-width: 1.4rem; border-radius: 999px;
  background: linear-gradient(180deg, #9be46f 0%, #5cbf45 55%, #3f9a3a 100%);
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.12);
  transition: width 0.1s linear;
}
.fill::before {
  content: ''; position: absolute; left: 0.6rem; right: 0.6rem; top: 3px; height: 30%;
  border-radius: 999px; background: rgba(255, 255, 255, 0.45);
}
.stripes {
  position: absolute; inset: 0; border-radius: 999px; overflow: hidden;
  background: repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.18) 0 10px, transparent 10px 20px);
  background-size: 28px 28px;
  animation: stripes 0.8s linear infinite;
}
.sprout {
  position: absolute; right: -0.9rem; top: 50%;
  width: 2.2rem; height: 2.2rem; margin-top: -1.1rem;
  display: grid; place-items: center; border-radius: 50%;
  background: #ffffff; border: 3px solid #5cbf45;
  box-shadow: 0 0.2rem 0.5rem rgba(20, 50, 20, 0.35);
  animation: bob 1.1s ease-in-out infinite;
}
.sprout svg { width: 1.3rem; height: 1.3rem; fill: none; stroke: #3f9a3a; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }

@keyframes stripes { from { background-position: 0 0; } to { background-position: 28px 0; } }
@keyframes bob { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-3px) rotate(6deg); } }
@keyframes dot { 0%, 60%, 100% { opacity: 0.25; } 30% { opacity: 1; } }
@keyframes fade { from { opacity: 0; } }

/* มือถือแนวนอน */
@media (max-height: 440px) {
  .txt { font-size: 1rem; }
  .pct { font-size: 1.1rem; }
  .track { height: 1.9rem; }
  .sprout { width: 1.9rem; height: 1.9rem; margin-top: -0.95rem; }
  .sprout svg { width: 1.1rem; height: 1.1rem; }
}
</style>
