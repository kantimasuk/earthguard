<script setup>
import AppLogo from './AppLogo.vue';
// wideForm: ฟอร์มหลายคอลัมน์ → ให้พาเนลกว้างขึ้น
defineProps({ wideForm: { type: Boolean, default: false } });
</script>

<template>
  <main class="page auth-page">
    <div class="auth" :class="{ 'wide-form': wideForm }">
      <section class="brand">
        <AppLogo size="lg" animated />
      </section>
      <section class="panel form-panel">
        <slot />
      </section>
    </div>
  </main>
</template>

<style scoped>
.auth {
  --panel-w: 29rem;
  flex: 1; min-height: 0; width: 100%; max-width: 1180px; margin: 0 auto;
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, var(--panel-w));
  align-items: center; justify-content: center;
  gap: clamp(16px, 5vw, 72px);
}
.auth.wide-form { --panel-w: 33rem; }
.brand {
  display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 0;
  animation: rise 0.7s var(--ease-out) both;
}
.form-panel {
  width: 100%; max-height: 100%;
  overflow-y: auto; overscroll-behavior: contain;
  padding: clamp(1.5rem, 5vh, 2.7rem) clamp(1.3rem, 3vw, 2.4rem);
  border: 0; border-radius: var(--radius-l);
  background: var(--panel);
  box-shadow: 0 1rem 2.5rem rgba(20, 50, 20, 0.25);
  animation: rise 0.7s 0.08s var(--ease-out) both;
  scrollbar-width: thin;
}

/* ---------- โทรศัพท์แนวนอน: ไม่มีโลโก้ใหญ่ พาเนลเดียวอยู่กลางจอ ---------- */
@media (max-height: 500px) {
  .auth, .auth.wide-form {
    --panel-w: 32rem;
    grid-template-columns: minmax(0, var(--panel-w));
    padding: 4px 0;
  }
  .auth.wide-form { --panel-w: 36rem; }
  .brand { display: none; }
  .form-panel {
    padding: 1.65rem 2.6rem 1.5rem;   /* เว้นขอบบน-ล่างในการ์ดให้โปร่ง */
    border-radius: 1.4rem;
    box-shadow: 0 0.6rem 1.6rem rgba(20, 50, 20, 0.25);
  }
}
@media (max-height: 440px) {
  .form-panel { padding: 1.4rem 2.5rem 1.25rem; }
}
/* จอเตี้ย: ลดความสูงช่องกรอก/ปุ่มในการ์ดลงเล็กน้อย เพื่อเก็บระยะห่างไว้ */
@media (max-height: 380px) {
  .form-panel { --control-h: 32px; padding: 1.15rem 2.3rem 1.05rem; }
}
@media (max-height: 340px) {
  .form-panel { --control-h: 30px; padding: 0.8rem 2.1rem 0.75rem; }
}
/* จอแคบบนคอมพิวเตอร์ */
@media (max-width: 620px) {
  .auth { grid-template-columns: minmax(0, var(--panel-w)); }
  .brand { display: none; }
}

@keyframes rise { from { opacity: 0; transform: translateY(14px); } }
</style>
