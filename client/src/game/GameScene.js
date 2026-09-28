// ============================================================
// GameScene (Phaser 3) — วาดโต๊ะเกมทั้งหมด + แอนิเมชันการ์ด
// ============================================================
// หน้าที่: "วาดตาม state" และ "เล่นแอนิเมชันตามที่ถูกสั่ง" เท่านั้น (ไม่มีกติกาเกมอยู่ในนี้)
// - พิกัดทั้งหมดคิดเป็นหน่วย CSS px แล้วย่อ/ขยายทั้งกลุ่มด้วย root.setScale(dpr) → คมชัดบนจอความละเอียดสูง
// - ปุ่ม/ป๊อปอัป/ข้อความยาวอยู่ใน Vue (GameView.vue) ส่วนนี้ส่งเหตุการณ์กลับผ่าน this.bridge
//
// โครงหน้าจอ: Vue (GameView.vue) จัดเลย์เอาต์ทั้งหมดด้วย CSS
//   ┌ช่วง/ตาของ/เวลา/แจ้งเตือน/ผู้เล่น ┬──── โต๊ะกลาง (Phaser) ────┬ เครื่องมือ/การ์ดของเรา ┐
//   │ (Vue)                        │กองจั่ว │ กองกลาง 3×3        │ (Vue)                │
//   │                              │สาธารณะ│ + ปุ่มหยิบแถว        │                      │
//   │                              │กองทิ้ง │                    │                      │
//   └──────────────────────────────┴────────────────────────────┴──────────────────────┘
// Phaser วาดเฉพาะโต๊ะกลาง ในกรอบที่ Vue บอก (bridge.boardRect) + แอนิเมชันการ์ดที่บินไปมา
// จุดหมายของการ์ดที่บินเข้าหาผู้เล่น (แถบผู้เล่น/การ์ดของเรา) ถามตำแหน่งจาก Vue ผ่าน bridge.anchor
//
// ความคมชัด: การ์ดแต่ละใบถูกย่อ "ล่วงหน้า" ด้วย Canvas 2D ให้พอดีขนาดที่แสดงจริง × dpr
//           (tex(id, width)) แทนการให้ WebGL ย่อรูปใหญ่ทีเดียว ซึ่งทำให้ขอบแตก

import { Painter } from './painter';


const FONT = 'Kodchasan, system-ui, sans-serif';
const THAI_TEST = '|MÉqgyก่ปั้ญฐุ';
const LINES = {
  r0: [0, 1, 2], r1: [3, 4, 5], r2: [6, 7, 8],
  c0: [0, 3, 6], c1: [1, 4, 7], c2: [2, 5, 8],
};
const hex = (s) => parseInt(String(s).replace('#', ''), 16);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function defineGameScene(Phaser) {
  return class GameScene extends Phaser.Scene {
    constructor() {
      super('table');
    }

    init(data) {
      this.bridge = data.bridge;   // { cards, art, me, on: {...} }
      this.cards = data.bridge.cards;
      this.art = data.bridge.art;
      this.dpr = data.dpr || 1;
      this.W = data.width;
      this.H = data.height;
      this.view = null;
      this.takeState = { enabled: false, mode: 'line', lines: [], selected: [] };
      this.speed = 1;
    }

    // ------------------------------------------------------------------
    create() {
      this.root = this.add.container(0, 0).setScale(this.dpr);
      this.bgG = new Painter(this); // พื้นโต๊ะ + กรอบแผง (วาดครั้งเดียวตอนจัดหน้า)
      this.boardL = this.add.container(0, 0);
      this.sideL = this.add.container(0, 0);
      this.fxL = this.add.container(0, 0);
      this.root.add([this.bgG.img, this.boardL, this.sideL, this.fxL]);

      this.#buildBoard();
      this.#layout();
      this.bridge.onReady?.(this);
    }

    // ------------------------------------------------------------------
    // เครื่องมือ
    // ------------------------------------------------------------------
    /**
     * texture ของการ์ด: ส่งความกว้างที่จะแสดง (px) มาด้วย → ได้รูปที่ย่อพอดีจอ (คม ไม่แตก)
     * ไม่ส่ง → ใช้รูปเต็มขนาด (สำหรับการ์ดใบใหญ่กลางจอ)
     */
    tex(id, w) {
      const src = id ? this.art.face(id) : this.art.back();
      let tw = src.width;
      if (w) tw = Math.min(src.width, Math.ceil((w * this.dpr) / 24) * 24); // ปัดเป็นช่วง ๆ → ไม่สร้าง texture ใหม่ทุกพิกเซล
      const key = `card:${id || 'back'}:${tw}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, tw === src.width ? src : this.art.resample(src, tw));
      return key;
    }

    /** รูปโปรไฟล์ AI ของทีม → ตัดเป็นวงกลม (ไม่มีรูป → null ใช้ไอคอนแทน) */
    aiTex(avatar) {
      const img = this.bridge.aiImages?.[avatar];
      if (!img) return null;
      const key = `ai:${avatar}`;
      if (!this.textures.exists(key)) {
        const S = 160;
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const g = cv.getContext('2d');
        g.beginPath();
        g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
        g.clip();
        const sc = Math.max(S / img.naturalWidth, S / img.naturalHeight); // cover-crop กึ่งกลาง
        const w = img.naturalWidth * sc;
        const h = img.naturalHeight * sc;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
        this.textures.addCanvas(key, cv);
      }
      return key;
    }

    iconTex(path, size = 128) {
      const key = `icon:${path.length}:${path.slice(0, 24)}:${size}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, this.art.iconCanvas(path, size));
      return key;
    }

    text(x, y, str, { size = 12, color = '#1f2a22', weight = '500', align = 'left', ox = 0, oy = 0, width = 0 } = {}) {
      const t = this.add.text(x, y, str, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: weight,
        color,
        align,
        testString: THAI_TEST,
        padding: { top: 2, bottom: 2 },
        ...(width ? { wordWrap: { width, useAdvancedWrap: true } } : {}),
      });
      t.setResolution(Math.min(3, this.dpr * 1.25));
      t.setOrigin(ox, oy);
      return t;
    }

    /** ป้ายข้อความพื้นเขียวเข้ม (อ่านง่ายบนพื้นหลังทุกแบบ) */
    /** เปิด/ปิดไฮไลต์กองจั่ว (ความสามารถ "ดูการ์ดบนสุด" ใช้ได้ในตานี้) */
    setPeekable(on) {
      on = Boolean(on);
      if (on === this.peekable) return;
      this.peekable = on;
      this.deckGlow.setVisible(on);
      this.peekBadge.setVisible(on);
      this.peekTweens?.forEach((t) => t.remove());
      this.peekTweens = null;
      if (on) {
        this.#drawDeckGlow();
        this.deckGlow.setAlpha(1);
        this.peekTweens = [
          this.tweens.add({ targets: this.deckGlow, alpha: 0.35, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
          this.tweens.add({ targets: this.peekBadge, scale: 1.12, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
        ];
      } else {
        this.peekBadge.setScale(1);
      }
    }

    #drawDeckGlow() {
      const r = this.deckRect;
      if (!r || !this.deckGlow) return;
      const g = this.deckGlow;
      g.clear();
      g.fillStyle(0xffd24d, 0.35);
      g.fillRoundedRect(r.x - r.w / 2 - 7, r.y - r.h / 2 - 7, r.w + 14, r.h + 14, 12);
      g.lineStyle(3, 0xf5a623, 1);
      g.strokeRoundedRect(r.x - r.w / 2 - 5, r.y - r.h / 2 - 5, r.w + 10, r.h + 10, 10);
    }

    /** ป้ายข้อความของกอง — ตอนนี้แสดงเป็น HTML ใน Vue แทน (คมทุกจอ มุมโค้ง) · อันนี้ซ่อนไว้ (alpha 0) */
    pill(str) {
      const t = this.text(0, 0, str, { size: 10, weight: '700', color: '#ffffff', ox: 0.5, oy: 0.5 }).setAlpha(0);
      t.setBackgroundColor('rgba(47, 90, 58, 0.88)');
      t.setPadding(this.H <= 500 ? 5 : 8, 2, this.H <= 500 ? 5 : 8, 2);
      return t;
    }

    tween(targets, props) {
      return new Promise((resolve) => {
        this.tweens.add({ targets, ...props, duration: (props.duration || 300) * this.speed, onComplete: resolve });
      });
    }

    // ------------------------------------------------------------------
    // Layout
    // ------------------------------------------------------------------
    resize(W, H, dpr) {
      this.W = W;
      this.H = H;
      this.dpr = dpr;
      this.scale.resize(Math.round(W * dpr), Math.round(H * dpr));
      this.scale.setZoom(1 / dpr);
      this.root.setScale(dpr);
      this.#layout();
      if (this.view) this.render(this.view);
    }

    /** จัดโต๊ะใหม่ (Vue เรียกเมื่อขนาดช่องโต๊ะเปลี่ยน) */
    relayout() {
      this.#layout();
      if (this.view) this.render(this.view);
    }

    /** ค่าคงที่ของโต๊ะ (ใช้ทั้งตอนจัดโต๊ะ และตอนบอก Vue ว่าโต๊ะควรกว้างเท่าไร) */
    #metrics(h) {
      const phone = this.H <= 500;
      const pad = phone ? 6 : 10;
      const handle = phone ? 24 : 32;           // ปุ่มหยิบแถว (ซ้ายของกองกลาง)
      const hTop = Math.round(handle * 0.6);    // ปุ่มหยิบคอลัมน์ (บน) ซ้อนขอบบนการ์ดเล็กน้อย → การ์ดสูงขึ้น
      const g = phone ? 5 : 7;
      const sideGap = phone ? 8 : 14;
      const sideRatio = 0.86;
      const innerH = h - 2 * pad - hTop;
      const ch = (innerH - 2 * g) / 3;
      const cw = ch * 0.714;
      const width = 2 * pad + cw * sideRatio + sideGap + handle + 3 * cw + 2 * g;
      return { phone, pad, handle, hTop, g, sideGap, sideRatio, innerH, ch, cw, width };
    }

    /** ความกว้างโต๊ะที่พอดีกับความสูง h (Vue ใช้กำหนดความกว้างช่องโต๊ะ → ไม่มีที่ว่างเหลือในกรอบ) */
    idealWidth(h) { return Math.ceil(this.#metrics(h).width); }

    #layout() {
      const { W, H } = this;
      const K = Math.max(1, Math.min(1.8, H / 420));
      // กรอบโต๊ะจาก Vue (ถ้ายังไม่มี ใช้กลางจอไปก่อน)
      const R = this.bridge.boardRect?.() || { x: W * 0.22, y: 8, w: W * 0.5, h: H - 16 };
      const M = this.#metrics(R.h);
      const { phone, pad, handle, hTop, g, sideGap, sideRatio, innerH } = M;
      let { ch, cw } = M;
      const fixedW = 2 * pad + sideGap + handle + 2 * g;
      if (fixedW + cw * (3 + sideRatio) > R.w) {  // ช่องแคบกว่าที่ต้องการ → ย่อตามความกว้าง
        cw = (R.w - fixedW) / (3 + sideRatio);
        ch = cw / 0.714;
      }
      const sw = cw * sideRatio;
      const gridW = 3 * cw + 2 * g;
      const gridH = 3 * ch + 2 * g;
      const boardW = sw + sideGap + handle + gridW;
      const boardX = R.x + (R.w - boardW) / 2;
      const gx = boardX + sw + sideGap + handle;
      const gy = R.y + pad + hTop + (innerH - gridH) / 2;
      this.L = {
        phone, k: K, R,
        // กรอบโต๊ะที่วาดจริง: ห่อพอดีการ์ด (ไม่มีที่ว่างซ้ายขวา)
        box: { x: boardX - pad, y: gy - hTop - pad, w: boardW + 2 * pad, h: gridH + hTop + 2 * pad },
        grid: { x: gx, y: gy, cw, ch, g, handle, hTop, w: gridW, h: gridH },
        side: { x: boardX, w: sw, h: ch * sideRatio },
      };
      this.#placeBoard();
      this.#drawBackdrop();
    }

    /** ตำแหน่งกลางของช่องกองกลาง i */
    slotXY(i) {
      const { x, y, cw, ch, g } = this.L.grid;
      const c = i % 3;
      const r = Math.floor(i / 3);
      return { x: x + c * (cw + g) + cw / 2, y: y + r * (ch + g) + ch / 2 };
    }

    deckXY() {
      const { side, grid } = this.L;
      return { x: side.x + side.w / 2, y: grid.y + grid.ch / 2 };
    }
    publicXY() {
      const { side, grid } = this.L;
      return { x: side.x + side.w / 2, y: grid.y + grid.ch + grid.g + grid.ch / 2 };
    }
    discardXY() {
      const { side, grid } = this.L;
      return { x: side.x + side.w / 2, y: grid.y + 2 * (grid.ch + grid.g) + grid.ch / 2 };
    }

    /** จุดที่การ์ดบินเข้าหาผู้เล่น (ถามตำแหน่งจากแถบผู้เล่น/การ์ดของเราใน Vue) */
    anchorOf(pid) {
      return this.bridge.anchor?.(pid, 'hand') || { x: this.W - 80, y: this.H / 2 };
    }
    builtAnchor(pid) {
      return this.bridge.anchor?.(pid, 'built') || this.anchorOf(pid);
    }

    #drawBackdrop() {
      const { box: R, grid, side, phone } = this.L;
      const g = this.bgG.begin(R.x - 4, R.y - 4, R.w + 8, R.h + 12);
      const r = phone ? 18 : 24;
      // พื้นโต๊ะโปร่งแสง (เห็นพื้นหลังทะลุ) + ขอบขาวนุ่ม ๆ
      g.fillStyle(0x2c5a3a, 0.06).fillRoundedRect(R.x, R.y + 4, R.w, R.h, r);
      g.fillStyle(0xffffff, 0.34).fillRoundedRect(R.x, R.y, R.w, R.h, r);
      g.lineStyle(1.5, 0xffffff, 0.85).strokeRoundedRect(R.x + 0.75, R.y + 0.75, R.w - 1.5, R.h - 1.5, r);
      // คอลัมน์กองจั่ว/สาธารณะ/กองทิ้ง (กรอบบาง ๆ แบบในไวร์เฟรม)
      const m = phone ? 4 : 6;
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(side.x - m, grid.y - m, side.w + 2 * m, grid.h + 2 * m, 14);
      g.lineStyle(1.2, 0xffffff, 0.75).strokeRoundedRect(side.x - m, grid.y - m, side.w + 2 * m, grid.h + 2 * m, 14);
      // ช่องวางการ์ด
      for (let i = 0; i < 9; i++) {
        const p = this.slotXY(i);
        g.fillStyle(0xffffff, 0.28).fillRoundedRect(p.x - grid.cw / 2, p.y - grid.ch / 2, grid.cw, grid.ch, 10);
        g.lineStyle(1.2, 0xffffff, 0.7).strokeRoundedRect(p.x - grid.cw / 2, p.y - grid.ch / 2, grid.cw, grid.ch, 10);
      }
      for (const p of [this.deckXY(), this.publicXY(), this.discardXY()]) {
        g.fillStyle(0xffffff, 0.3).fillRoundedRect(p.x - side.w / 2, p.y - side.h / 2, side.w, side.h, 10);
      }
      g.end();
    }

    // texture เล็ก ๆ ที่ใช้ซ้ำ (วาดด้วย Canvas 2D ที่ความละเอียดจอ แล้วแคชไว้)
    #shapeTex(key, w, h, draw) {
      const s = this.dpr;
      const k = `shape:${key}:${Math.round(w * 10)}:${Math.round(h * 10)}:${s}`;
      if (!this.textures.exists(k)) {
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.ceil(w * s));
        cv.height = Math.max(1, Math.ceil(h * s));
        const ctx = cv.getContext('2d');
        ctx.scale(s, s);
        draw(ctx);
        this.textures.addCanvas(k, cv);
      }
      return k;
    }

    // ------------------------------------------------------------------
    // สร้างวัตถุบนกระดาน (ครั้งเดียว) แล้วจัดตำแหน่งใหม่ทุกครั้งที่ขนาดจอเปลี่ยน
    // ------------------------------------------------------------------
    #buildBoard() {
      // การ์ดกองกลาง 9 ใบ
      this.slots = [];
      for (let i = 0; i < 9; i++) {
        const img = this.add.image(0, 0, this.tex(null)).setVisible(false);
        img.setInteractive({ useHandCursor: true });
        let pressT = 0;
        let longTimer = null;
        img.on('pointerdown', () => {
          pressT = performance.now();
          clearTimeout(longTimer);
          longTimer = setTimeout(() => { pressT = -1; this.bridge.on.cardInfo?.(this.displayMarket?.[i]); }, 450);
        });
        img.on('pointerup', () => {
          clearTimeout(longTimer);
          const pressed = pressT;
          pressT = 0;
          if (pressed <= 0) return; // ไม่ได้กดที่การ์ดใบนี้ หรือกดค้างดูรายละเอียดไปแล้ว
          const id = this.displayMarket?.[i];
          if (!id) return;
          if (this.takeState.enabled && this.takeState.mode === 'free') this.bridge.on.slotTap?.(i);
          else this.bridge.on.cardInfo?.(id);
        });
        img.on('pointerout', () => { clearTimeout(longTimer); pressT = 0; });
        img.on('pointerover', () => {
          if (this.takeState.enabled && this.takeState.mode === 'free') img.setTint(0xfff6d0);
        });
        img.on('pointerout', () => img.clearTint());
        this.boardL.add(img);
        this.slots.push(img);
      }

      // เส้นเรืองแสงไฮไลต์แถว + กรอบเลือกการ์ด
      this.glow = this.add.graphics();
      this.selG = this.add.graphics();
      this.intentG = this.add.graphics();
      this.boardL.add([this.glow, this.selG, this.intentG]);

      // ปุ่มหยิบแถว/คอลัมน์ 6 ปุ่ม
      this.handles = {};
      for (const line of Object.keys(LINES)) {
        const c = this.add.container(0, 0);
        const g = this.add.graphics();
        const hit = this.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true });
        c.add([g, hit]);
        c.g = g;
        c.hit = hit;
        c.line = line;
        c.setVisible(false);
        hit.on('pointerover', () => { if (this.takeState.enabled) { this.#glowLine(line, 0xffd24d); this.#drawHandle(c, true); } });
        hit.on('pointerout', () => { this.#glowLine(null); this.#drawHandle(c, false); });
        hit.on('pointerdown', () => { if (this.takeState.enabled) { this.#glowLine(line, 0xffd24d); this.#drawHandle(c, true); } });
        hit.on('pointerup', () => {
          if (!this.takeState.enabled) return;
          this.#glowLine(null);
          this.bridge.on.lineTap?.(line);
        });
        this.boardL.add(c);
        this.handles[line] = c;
      }

      // กองจั่ว (ซ้อน 3 ใบ) + ตัวเลข
      this.deckGlow = this.add.graphics().setVisible(false); // กรอบเรืองแสงตอน "ดูการ์ดบนสุด" ได้
      this.deckImgs = [0, 1, 2].map(() => this.add.image(0, 0, this.tex(null)));
      this.deckCount = this.pill('');
      this.deckLabel = this.pill('กองจั่ว');
      this.peekBadge = this.pill('แตะเพื่อดู').setBackgroundColor('#f39c12').setVisible(false);
      this.deckHit = this.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true });
      this.deckHit.on('pointerup', () => this.bridge.on.deck?.());
      this.sideL.add([this.deckGlow, ...this.deckImgs, this.deckCount, this.deckLabel, this.peekBadge, this.deckHit]);
      this.peekable = false;

      // โซนสิทธิสาธารณะ
      this.pubTitle = this.pill('สิทธิสาธารณะ');
      this.pubCards = this.add.container(0, 0);
      this.pubCount = this.pill('');
      this.pubHit = this.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true });
      this.pubHit.on('pointerup', () => this.bridge.on.publicZone?.());
      this.sideL.add([this.pubCards, this.pubTitle, this.pubCount, this.pubHit]);

      // กองทิ้ง
      this.discImg = this.add.image(0, 0, this.tex(null)).setVisible(false);
      this.discTitle = this.pill('กองทิ้ง');
      this.discCount = this.pill('');
      this.sideL.add([this.discImg, this.discTitle, this.discCount]);

      this.displayMarket = Array(9).fill(null);
    }

    #placeBoard() {
      const { grid, side, phone } = this.L;
      for (let i = 0; i < 9; i++) {
        const p = this.slotXY(i);
        const img = this.slots[i];
        img.setPosition(p.x, p.y).setDisplaySize(grid.cw, grid.ch);
        img.baseScaleX = img.scaleX;
        img.baseScaleY = img.scaleY;
      }
      const hs = grid.handle;
      for (const [line, c] of Object.entries(this.handles)) {
        const idx = LINES[line];
        let x;
        let y;
        if (line[0] === 'r') {
          const p = this.slotXY(idx[0]);
          x = grid.x - hs / 2 - 2;
          y = p.y;
        } else {
          const p = this.slotXY(idx[0]);
          x = p.x;
          y = grid.y - grid.hTop / 2 - 1; // ครึ่งล่างของปุ่มซ้อนขอบบนการ์ด
        }
        c.setPosition(x, y);
        const hsz = hs + 10; // พื้นที่แตะใหญ่กว่าปุ่มเล็กน้อย (นิ้วแตะง่าย)
        c.hit.setSize(hsz, hsz);
        if (c.hit.input) c.hit.input.hitArea.setTo(0, 0, hsz, hsz);
        this.#drawHandle(c, false);
      }
      // กองจั่ว
      const d = this.deckXY();
      this.deckImgs.forEach((im, k) => im.setTexture(this.tex(null, side.w)).setPosition(d.x - k * 1.5, d.y - k * 1.5).setDisplaySize(side.w, side.h));
      // ขนาดตัวอักษรป้ายตามความกว้างกอง (จอเล็กกองแคบ → ตัวเล็กลง ไม่ล้นกอง)
      const fsL = phone ? Math.max(7, Math.min(9, side.w * 0.12)) : Math.min(14, Math.max(9, side.w * 0.085));
      const fsN = phone ? Math.max(8, Math.min(10, side.w * 0.14)) : Math.min(16, Math.max(10, side.w * 0.1));
      const lblY = (cy) => cy - side.h / 2 + fsL * 0.9 + 3;
      const cntY = (cy) => cy + side.h / 2 - fsN * 0.9 - 3;
      const narrow = side.w < 70;
      this.pubTitle.setText(narrow ? 'สาธารณะ' : 'สิทธิสาธารณะ');
      this.discTitle.setText(narrow ? 'ทิ้ง' : 'กองทิ้ง');
      this.deckLabel.setPosition(d.x, lblY(d.y)).setFontSize(fsL);
      this.deckCount.setPosition(d.x, cntY(d.y)).setFontSize(fsN);
      this.deckHit.setPosition(d.x, d.y).setSize(side.w, side.h);
      if (this.deckHit.input) this.deckHit.input.hitArea.setTo(0, 0, side.w, side.h);
      this.deckRect = { x: d.x, y: d.y, w: side.w, h: side.h };
      // บอก Vue ว่ากองแต่ละกองอยู่ตรงไหน → วาดป้ายชื่อ/จำนวนเป็น HTML
      const box = (c) => ({ x: c.x - side.w / 2, y: c.y - side.h / 2, w: side.w, h: side.h });
      this.bridge.onLayout?.({ deck: box(d), pub: box(this.publicXY()), disc: box(this.discardXY()) });
      this.peekBadge.setPosition(d.x, d.y + side.h * 0.12).setFontSize(fsN);
      this.#drawDeckGlow();
      // สาธารณะ
      const pp = this.publicXY();
      this.pubTitle.setPosition(pp.x, lblY(pp.y)).setFontSize(fsL);
      this.pubCount.setPosition(pp.x, cntY(pp.y)).setFontSize(fsN);
      this.pubHit.setPosition(pp.x, pp.y).setSize(side.w, side.h);
      if (this.pubHit.input) this.pubHit.input.hitArea.setTo(0, 0, side.w, side.h);
      // กองทิ้ง
      const dd = this.discardXY();
      this.discImg.setPosition(dd.x, dd.y).setDisplaySize(side.w * 0.9, side.h * 0.9);
      this.discTitle.setPosition(dd.x, lblY(dd.y)).setFontSize(fsL);
      this.discCount.setPosition(dd.x, cntY(dd.y)).setFontSize(fsN);
    }

    #drawHandle(c, hot) {
      const g = c.g;
      const hs = this.L.grid.handle;
      const on = this.takeState.enabled && this.takeState.lines.includes(c.line);
      g.clear();
      g.fillStyle(hot ? 0xffd24d : on ? 0xffffff : 0xffffff, on ? 1 : 0.35);
      g.fillCircle(0, 0, hs / 2);
      g.lineStyle(2, hot ? 0xb37d0c : 0x3a7d2c, on ? 1 : 0.4);
      g.strokeCircle(0, 0, hs / 2);
      // ลูกศรชี้เข้าหาแถว
      const a = hs * 0.22;
      g.lineStyle(2.4, hot ? 0x6b4500 : 0x2f6b2c, on ? 1 : 0.5);
      g.beginPath();
      if (c.line[0] === 'r') {
        g.moveTo(-a * 0.6, -a); g.lineTo(a * 0.7, 0); g.lineTo(-a * 0.6, a);
      } else {
        g.moveTo(-a, -a * 0.6); g.lineTo(0, a * 0.7); g.lineTo(a, -a * 0.6);
      }
      g.strokePath();
    }

    #glowLine(line, color = 0xffd24d, g = this.glow) {
      g.clear();
      if (!line) return;
      const { cw, ch } = this.L.grid;
      const idx = LINES[line];
      const a = this.slotXY(idx[0]);
      const b = this.slotXY(idx[2]);
      const x = Math.min(a.x, b.x) - cw / 2 - 4;
      const y = Math.min(a.y, b.y) - ch / 2 - 4;
      const w = Math.abs(b.x - a.x) + cw + 8;
      const h = Math.abs(b.y - a.y) + ch + 8;
      g.fillStyle(color, 0.18);
      g.fillRoundedRect(x, y, w, h, 12);
      g.lineStyle(6, color, 0.35);
      g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 14);
      g.lineStyle(3, color, 1);
      g.strokeRoundedRect(x, y, w, h, 12);
    }

    // ------------------------------------------------------------------
    // วาดตาม state (ไม่มีแอนิเมชัน)
    // ------------------------------------------------------------------
    render(view) {
      this.view = view;
      if (!this.L) return;
      this.displayMarket = view.market.slice();
      for (let i = 0; i < 9; i++) this.#setSlot(i, view.market[i]);
      this.#renderSide(view);
      this.#refreshTake();
    }

    #setSlot(i, id) {
      const img = this.slots[i];
      this.tweens.killTweensOf(img);
      if (!id) { img.setVisible(false); return; }
      img.setTexture(this.tex(id, this.L.grid.cw)).setVisible(true).setAlpha(1).setAngle(0);
      const p = this.slotXY(i);
      img.setPosition(p.x, p.y).setDisplaySize(this.L.grid.cw, this.L.grid.ch);
    }

    #renderSide(v) {
      const n = v.deckLeft;
      this.deckImgs.forEach((im, k) => im.setVisible(n > k));
      this.deckCount.setText(`${n} ใบ`);
      this.deckLabel.setText(this.L.side.w < 70 ? 'กองจั่ว' : this.L.phone ? `กองจั่ว ช่วง ${v.phase}` : `กองจั่วช่วงที่ ${v.phase}`);
      // สาธารณะ: แสดงการ์ดซ้อนกันสูงสุด 3 ใบ
      const sig = v.publicRights.join(',') + `|${this.L.side.w}`;
      if (sig !== this._pubSig) {
        this._pubSig = sig;
        this.pubCards.removeAll(true);
        const { side } = this.L;
        const p = this.publicXY();
        const show = v.publicRights.slice(-3);
        show.forEach((id, k) => {
          const im = this.add.image(p.x + (k - (show.length - 1) / 2) * 5, p.y + (k - (show.length - 1) / 2) * 4, this.tex(id, side.w));
          im.setDisplaySize(side.w * 0.86, side.h * 0.86);
          this.pubCards.add(im);
        });
      }
      this.pubCount.setText(`${v.publicRights.length} ใบ`).setVisible(v.publicRights.length > 0);
      // กองทิ้ง
      this.discImg.setVisible(Boolean(v.discardTop));
      const { side } = this.L;
      if (v.discardTop) this.discImg.setTexture(this.tex(v.discardTop, side.w)).setAlpha(0.85);
      this.discImg.setDisplaySize(side.w * 0.9, side.h * 0.9);
      this.discCount.setText(`${v.discardCount} ใบ`).setVisible(v.discardCount > 0);
    }

    // ------------------------------------------------------------------
    // โหมดหยิบการ์ด (ตาของเรา)
    // ------------------------------------------------------------------
    setTake({ enabled, mode, lines, selected }) {
      this.takeState = { enabled: Boolean(enabled), mode: mode || 'line', lines: lines || [], selected: selected || [] };
      this.#refreshTake();
    }

    #refreshTake() {
      const t = this.takeState;
      for (const c of Object.values(this.handles)) {
        c.setVisible(t.enabled && t.lines.includes(c.line));
        this.#drawHandle(c, false);
      }
      if (t.enabled && !this._pulse) {
        this._pulse = this.tweens.add({
          targets: Object.values(this.handles), scale: 1.15, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.easeInOut',
        });
      } else if (!t.enabled && this._pulse) {
        this._pulse.stop();
        this._pulse = null;
        Object.values(this.handles).forEach((h) => h.setScale(1));
      }
      if (!t.enabled) this.glow.clear();
      // การ์ดที่เลือก (โหมดหยิบตำแหน่งใดก็ได้)
      this.selG.clear();
      const { cw, ch } = this.L.grid;
      for (const i of t.enabled ? t.selected : []) {
        const p = this.slotXY(i);
        this.selG.lineStyle(4, 0xffd24d, 1);
        this.selG.strokeRoundedRect(p.x - cw / 2 - 3, p.y - ch / 2 - 3, cw + 6, ch + 6, 10);
        this.selG.fillStyle(0xffd24d, 1).fillCircle(p.x + cw / 2 - 4, p.y - ch / 2 + 4, 8);
      }
    }

    // ------------------------------------------------------------------
    // สิ่งที่ AI กำลังจะทำ (ไฮไลต์ค้างไว้ระหว่างดีเลย์)
    // ------------------------------------------------------------------
    showIntent(intent) {
      this.clearIntent();
      if (!intent) return;
      const a = intent.action || {};
      const say = () => {}; // ข้อความ "กำลังทำอะไร" ของ AI แสดงในแถบผู้เล่น (Vue)
      if (a.type === 'take' && a.line) {
        this.#glowLine(a.line, 0x7fc8ff, this.intentG);
        this._intentPulse = this.tweens.add({ targets: this.intentG, alpha: 0.45, yoyo: true, repeat: -1, duration: 420 });
        say('กำลังเลือกแถวนี้...');
      } else if (a.type === 'take' && a.slots) {
        const { cw, ch } = this.L.grid;
        for (const i of a.slots) {
          const p = this.slotXY(i);
          this.intentG.lineStyle(4, 0x7fc8ff, 1).strokeRoundedRect(p.x - cw / 2 - 3, p.y - ch / 2 - 3, cw + 6, ch + 6, 10);
        }
        this._intentPulse = this.tweens.add({ targets: this.intentG, alpha: 0.45, yoyo: true, repeat: -1, duration: 420 });
        say('กำลังเลือกการ์ด...');
      } else if (a.type === 'build') {
        say(`กำลังสร้าง: ${this.cards[a.right]?.shortName || 'สิทธิ'}`);
      } else if (a.type === 'peek' || a.type === 'peekDecide') {
        say('ดูการ์ดบนสุด...');
      }
    }

    clearIntent() {
      this._intentPulse?.stop();
      this._intentPulse = null;
      this.intentG.clear().setAlpha(1);
    }

    // ------------------------------------------------------------------
    // แอนิเมชัน
    // ------------------------------------------------------------------
    /** การ์ดชั่วคราวสำหรับแอนิเมชัน (texW = ความกว้างใหญ่สุดที่จะขยายไปถึง → เลือก texture ให้คม) */
    #flyer(id, x, y, w, h, faceUp = true, texW = Math.max(w, this.L.grid.cw)) {
      const im = this.add.image(x, y, this.tex(faceUp ? id : null, texW)).setDisplaySize(w, h);
      this.fxL.add(im);
      return im;
    }

    async #flip(im, id, w, texW = w) {
      const h = im.displayHeight; // จำขนาดไว้ก่อน (รูปหน้า/หลังการ์ดอาจมีความละเอียดต่างกัน)
      await this.tween(im, { scaleX: 0, duration: 90, ease: 'Quad.easeIn' });
      im.setTexture(texW ? this.tex(id, texW) : this.tex(id));
      im.setDisplaySize(w, h);
      const tx = im.scaleX;
      im.scaleX = 0;
      await this.tween(im, { scaleX: tx, duration: 110, ease: 'Quad.easeOut' });
    }

    /** สับการ์ด 3 กองตอนเริ่มเกม */
    async shuffleIntro() {
      const d = this.deckXY();
      const { side } = this.L;
      const piles = [-1, 0, 1].map((k) => {
        const im = this.#flyer(null, d.x, d.y, side.w, side.h, false);
        return { im, k };
      });
      this.deckImgs.forEach((im) => im.setVisible(false));
      const cx = (this.L.grid.x + this.L.grid.w / 2);
      const cy = this.L.grid.y + this.L.grid.h / 2;
      await Promise.all(piles.map(({ im, k }) => this.tween(im, { x: cx + k * (side.w + 14), y: cy, duration: 350, ease: 'Back.easeOut' })));
      for (let round = 0; round < 2; round++) {
        await Promise.all(piles.map(({ im, k }) => this.tween(im, { angle: k * 10 + (round % 2 ? -6 : 6), y: cy - 10, yoyo: true, duration: 140 })));
        this.bridge.sfx?.('deal');
      }
      await Promise.all(piles.map(({ im }) => this.tween(im, { x: d.x, y: d.y, angle: 0, duration: 380, ease: 'Cubic.easeInOut' })));
      piles.forEach(({ im }) => im.destroy());
      this.deckImgs.forEach((im) => im.setVisible(true));
    }

    /** เปิดการ์ดจากกองจั่วลงช่อง (บิน + พลิกหงาย) */
    async dealToSlot(slot, id, delay = 0) {
      if (delay) await wait(delay * this.speed);
      const d = this.deckXY();
      const p = this.slotXY(slot);
      const { cw, ch } = this.L.grid;
      const im = this.#flyer(null, d.x, d.y, this.L.side.w, this.L.side.h, false);
      this.bridge.sfx?.('deal');
      await this.tween(im, { x: p.x, y: p.y, displayWidth: cw, displayHeight: ch, duration: 300, ease: 'Cubic.easeOut' });
      this.bridge.sfx?.('flip');
      await this.#flip(im, id, cw);
      this.displayMarket[slot] = id;
      this.#setSlot(slot, id);
      im.destroy();
    }

    /** ผู้เล่นหยิบการ์ดจากกองกลาง → บินเข้าหาผู้เล่น */
    async takeCards(pid, slots) {
      const to = this.anchorOf(pid);
      const { cw, ch } = this.L.grid;
      const flyers = slots.map((i) => {
        const p = this.slotXY(i);
        const im = this.#flyer(this.displayMarket[i], p.x, p.y, cw, ch, true);
        this.slots[i].setVisible(false);
        this.displayMarket[i] = null;
        return im;
      });
      this.bridge.sfx?.('whoosh');
      await Promise.all(flyers.map((im, k) => this.tween(im, {
        x: to.x + (k - 1) * 8, y: to.y, displayWidth: cw * 0.45, displayHeight: ch * 0.45, alpha: 0.2,
        delay: k * 70, duration: 420, ease: 'Cubic.easeIn',
      })));
      flyers.forEach((im) => im.destroy());
      this.#pulseTarget(pid);
    }

    #pulseTarget(pid) {
      const m = this.anchorOf(pid);
      const ring = this.add.graphics();
      ring.lineStyle(3, 0xffd24d, 1).strokeCircle(0, 0, 24);
      ring.setPosition(m.x, m.y);
      this.fxL.add(ring);
      this.tween(ring, { scale: 2, alpha: 0, duration: 450 }).then(() => ring.destroy());
    }

    /** การ์ดบินจากผู้เล่นไปกองทิ้ง/โซนสาธารณะ (ทิ้งเพื่อสร้างสิทธิ หรือเสียการ์ดจากภัยคุกคาม) */
    async cardsLeavePlayer(pid, ids, toPublic = []) {
      const from = this.anchorOf(pid);
      const { cw, ch } = this.L.grid;
      const disc = this.discardXY();
      const pub = this.publicXY();
      const flyers = ids.map((id) => this.#flyer(id, from.x, from.y, cw * 0.5, ch * 0.5, true).setAlpha(0));
      await Promise.all(flyers.map((im, k) => {
        const target = toPublic.includes(ids[k]) ? pub : disc;
        return this.tween(im, {
          x: target.x, y: target.y, alpha: { from: 0, to: 1 }, displayWidth: this.L.side.w * 0.9, displayHeight: this.L.side.h * 0.9,
          angle: (k - 1) * 8, delay: k * 110, duration: 480, ease: 'Cubic.easeInOut',
        });
      }));
      flyers.forEach((im) => im.destroy());
    }

    /** การ์ดสิทธิบินจากมือ/โซนสาธารณะไปวางหน้าผู้เล่น */
    async rightToBuilt(pid, id, from) {
      const start = from === 'public' ? this.publicXY() : this.anchorOf(pid);
      const to = this.builtAnchor(pid);
      const { cw, ch } = this.L.grid;
      const im = this.#flyer(id, start.x, start.y, cw * 0.6, ch * 0.6, true, cw * 1.05);
      await this.tween(im, { y: start.y - 24, displayWidth: cw * 1.05, displayHeight: ch * 1.05, duration: 260, ease: 'Back.easeOut' });
      await this.tween(im, { x: to.x, y: to.y, displayWidth: cw * 0.3, displayHeight: ch * 0.3, duration: 420, ease: 'Cubic.easeIn' });
      im.destroy();
      this.#sparkle(to.x, to.y);
    }

    #sparkle(x, y, color = 0xffd24d) {
      for (let k = 0; k < 8; k++) {
        const s = this.add.graphics();
        s.fillStyle(color, 1).fillCircle(0, 0, 3);
        s.setPosition(x, y);
        this.fxL.add(s);
        const a = (Math.PI * 2 * k) / 8;
        this.tween(s, { x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 30, alpha: 0, duration: 520, ease: 'Cubic.easeOut' }).then(() => s.destroy());
      }
    }

    /** +1 เด้งขึ้นบนการ์ดสิทธิที่ป้องกันได้ */
    async protectPop(pid, text = '+1') {
      const at = this.builtAnchor(pid);
      const t = this.text(at.x, at.y - 6, text, { size: this.L.phone ? 16 : 20, weight: '700', color: '#2f7a2e', ox: 0.5, oy: 0.5 });
      t.setStroke('#ffffff', 5);
      this.fxL.add(t);
      this.#sparkle(at.x, at.y, 0x7cc47a);
      await this.tween(t, { y: at.y - 40, scale: 1.3, duration: 700, ease: 'Back.easeOut' });
      await this.tween(t, { alpha: 0, duration: 250 });
      t.destroy();
    }

    /** ภัยคุกคาม/การ์ดจบเกม: บินจากกองจั่วมากลางจอ ขยายใหญ่ + จอสั่น */
    async bigCard(id, { shake = true } = {}) {
      const d = this.deckXY();
      const { W, H } = this;
      const h = Math.min(H * 0.62, 340);
      const w = h * 0.714;
      const im = this.#flyer(null, d.x, d.y, this.L.side.w, this.L.side.h, false);
      this._big = im;
      await this.tween(im, { x: W / 2, y: H / 2, displayWidth: w * 0.5, displayHeight: h * 0.5, duration: 380, ease: 'Cubic.easeOut' });
      await this.#flip(im, id, w * 0.5, w);
      await this.tween(im, { displayWidth: w, displayHeight: h, duration: 320, ease: 'Back.easeOut' });
      if (shake) this.cameras.main.shake(380, 0.012);
      return im;
    }

    async bigCardAway() {
      const im = this._big;
      this._big = null;
      if (!im) return;
      await this.tween(im, { alpha: 0, displayWidth: im.displayWidth * 0.6, displayHeight: im.displayHeight * 0.6, duration: 300 });
      im.destroy();
    }

    /** ย่อการ์ดใหญ่ไปมุมจอ (ให้เห็นกระดานระหว่างตัดสินใจ) */
    async bigCardDock() {
      const im = this._big;
      if (!im) return;
      const { R } = this.L;
      const h = this.L.phone ? 96 : 130;
      await this.tween(im, { x: R.x + R.w / 2, y: R.y + h / 2 + 4, displayWidth: h * 0.714, displayHeight: h, duration: 350, ease: 'Cubic.easeInOut' });
    }

    /** ความสามารถดูการ์ดบนสุด: ยกการ์ดขึ้น */
    async peekLift() {
      const im = this.deckImgs[this.deckImgs.length - 1];
      await this.tween(im, { y: im.y - 16, angle: -6, duration: 250, ease: 'Back.easeOut' });
    }

    async peekDone(bottom) {
      const d = this.deckXY();
      const im = this.deckImgs[this.deckImgs.length - 1];
      if (bottom) {
        await this.tween(im, { x: d.x + 20, alpha: 0.2, duration: 220 });
        im.setPosition(d.x - 3, d.y - 3).setAlpha(1).setAngle(0);
        this.deckImgs.forEach((x) => this.tween(x, { x: x.x - 1, yoyo: true, duration: 80 }));
      } else {
        await this.tween(im, { y: d.y - 3, angle: 0, duration: 220 });
      }
      this.#placeBoard();
    }

    setSpeed(fast) { this.speed = fast ? 0.6 : 1; }
  };
}
