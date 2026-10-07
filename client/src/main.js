import { createApp } from 'vue';
import { createPinia } from 'pinia';

// ฟอนต์ Kodchasan โหลดจาก Google Fonts (ดู <link> ใน index.html)

import './styles/tokens.css';
import './styles/base.css';

import App from './App.vue';
import router from './router';
import { detectBranding } from './services/branding';
import { vFit } from './utils/fit';
import { perf } from './services/device';

// เครื่องสเปกต่ำ / Android: ปิดเอฟเฟกต์เบลอกระจกและแอนิเมชันตกแต่งบางส่วน (ดู html.lite ใน base.css)
if (perf.lite) document.documentElement.classList.add('lite');

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.directive('fit', vFit);
// ตรวจหารูปพื้นหลัง/โลโก้ของทีมก่อน เพื่อให้หน้า Loading แสดงรูปที่ถูกต้องตั้งแต่เฟรมแรก
detectBranding().finally(() => app.mount('#app'));
