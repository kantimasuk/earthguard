import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:3000';

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      fs: { allow: ['..'] }, // ให้ import ไฟล์จากโฟลเดอร์ shared/ ได้
      // ตอนพัฒนา: ส่งต่อ /api และ /socket.io ไปที่ backend
      // → เปิดเว็บจากโทรศัพท์ผ่าน IP ของคอมพิวเตอร์ได้ ไม่ติด localhost / CORS
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
    build: {
      chunkSizeWarningLimit: 1600, // Phaser มีขนาดใหญ่ และถูกแยก chunk ไว้แล้ว
    },
  };
});
