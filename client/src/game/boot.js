// เริ่มต้น Phaser (โหลดแบบ dynamic import → หน้าอื่นไม่ต้องโหลด Phaser ที่มีขนาดใหญ่)
import { createCardArtist } from './cardArt';
import { loadCardImages } from './cardImages';
import { AI_LIST } from './avatars';
import { preloadUi } from '../services/uiArt';
import { maxDpr } from '../services/device';

/**
 * @param {HTMLElement} parent  กล่องที่จะใส่ canvas (เต็มจอ)
 * @param {object} bridge       { cards, me, on: {...}, sfx }
 * @returns {Promise<{ game: any, scene: any, destroy: () => void, resize: () => void }>}
 */
export async function bootGame(parent, bridge) {
  const Phaser = await import('phaser');
  const { defineGameScene } = await import('./GameScene');
  const Scene = defineGameScene(Phaser);

  // ต้องโหลดฟอนต์ก่อนวาดการ์ดลง canvas ไม่งั้นจะได้ฟอนต์สำรอง
  try {
    await Promise.all(['500 20px Kodchasan', '600 20px Kodchasan', '700 20px Kodchasan'].map((f) => document.fonts?.load(f, 'กขEarth')));
  } catch { /* ignore */ }

  // รูปการ์ดของทีม (ถ้ามีใน src/assets/cards/) — ไม่มีก็ใช้การ์ดที่วาดด้วยโค้ด
  const images = await loadCardImages();
  // รูปโปรไฟล์ AI ของทีม (assets/ui/ai-*.png) → วาดเป็นวงกลมบนกระดาน
  const aiPics = await preloadUi(AI_LIST.map((a) => `ai-${a.avatar}`));
  const aiImages = Object.fromEntries(AI_LIST.map((a, i) => [a.avatar, aiPics[i]]).filter(([, img]) => img));
  const art = createCardArtist(bridge.cards, images);
  // ความละเอียดการวาด: iPhone/คอม สูงสุด 3x (คม) · Android 2x · เครื่องสเปกต่ำ 1.75x
  // จอ 3x มีพิกเซลมากกว่า 2x ถึง 2.25 เท่า → บน Android ลดลงช่วยให้ลื่นขึ้นมาก โดยการ์ดยังคมพอ
  const dpr = () => Math.min(maxDpr(), window.devicePixelRatio || 1);
  const size = () => ({ w: Math.max(320, parent.clientWidth), h: Math.max(240, parent.clientHeight) });

  return new Promise((resolve) => {
    const { w, h } = size();
    const r = dpr();
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      transparent: true,
      width: Math.round(w * r),
      height: Math.round(h * r),
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / r },
      banner: false,
      audio: { noAudio: true }, // เสียงใช้ Howler แยกต่างหาก
      // windowEvents: false → คลิกบนป๊อปอัป (DOM) จะไม่ทะลุลงไปโดนการ์ดบนกระดาน
      input: { activePointers: 2, windowEvents: false },
      render: { antialias: true, roundPixels: false },
    });

    let scene = null;
    const resize = () => {
      if (!scene) return;
      const s = size();
      scene.resize(s.w, s.h, dpr());
    };
    const onResize = () => requestAnimationFrame(resize);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    game.scene.add('table', Scene, true, {
      bridge: {
        ...bridge,
        art,
        aiImages,
        onReady: (sc) => {
          scene = sc;
          resolve({
            game,
            scene,
            art,
            resize,
            destroy: () => {
              window.removeEventListener('resize', onResize);
              window.removeEventListener('orientationchange', onResize);
              game.destroy(true);
            },
          });
        },
      },
      dpr: r,
      width: w,
      height: h,
    });
  });
}
