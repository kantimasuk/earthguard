// ============================================================
// Painter — วาดรูปทรงนิ่ง ๆ (พื้นโต๊ะ กรอบแผง ป้าย) ด้วย Canvas 2D ครั้งเดียว แล้วแสดงเป็นรูปใน Phaser
// ============================================================
// ทำไมไม่ใช้ this.add.graphics() ของ Phaser ตรง ๆ?
//   Graphics ของ Phaser (WebGL) ถูก "คำนวณรูปทรงใหม่ทุกเฟรม" (60 ครั้ง/วินาที)
//   ถ้ามีสี่เหลี่ยมมุมโค้ง/วงกลมหลายสิบชิ้น มือถือสเปกต่ำจะกระตุก (วัดได้ 3 → 59 fps)
//   Painter วาดลง canvas แค่ตอนที่ข้อมูลเปลี่ยน แล้ว Phaser แสดงเป็นรูปภาพธรรมดา (เร็วมาก)
//   และวาดที่ความละเอียดจริงของจอ (× dpr) → ขอบคมกว่า Graphics ด้วย
//
// API เลียนแบบ Phaser.Graphics (fillStyle, fillRoundedRect, lineStyle, strokeRoundedRect, fillCircle, ...)
// ใช้แบบนี้:
//   const p = new Painter(scene, container);   // container = ที่จะใส่รูป (เช่น box.c)
//   p.begin(x, y, w, h)                         // พื้นที่ที่จะวาด (พิกัดเดียวกับที่ใช้ใน container)
//    .fillStyle(0xffffff, 1).fillRoundedRect(...)
//    .end();                                    // ส่งขึ้นจอ

let uid = 0;
const css = (color, alpha = 1) => {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

function roundRectPath(ctx, x, y, w, h, r) {
  const R = typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : { tl: r.tl || 0, tr: r.tr || 0, br: r.br || 0, bl: r.bl || 0 };
  const m = Math.min(w, h) / 2;
  for (const k of Object.keys(R)) R[k] = Math.max(0, Math.min(R[k], m));
  ctx.beginPath();
  ctx.moveTo(x + R.tl, y);
  ctx.lineTo(x + w - R.tr, y);
  ctx.arcTo(x + w, y, x + w, y + R.tr, R.tr);
  ctx.lineTo(x + w, y + h - R.br);
  ctx.arcTo(x + w, y + h, x + w - R.br, y + h, R.br);
  ctx.lineTo(x + R.bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - R.bl, R.bl);
  ctx.lineTo(x, y + R.tl);
  ctx.arcTo(x, y, x + R.tl, y, R.tl);
  ctx.closePath();
}

export class Painter {
  /**
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.Container} [parent] container ที่จะใส่รูป (ไม่ใส่ = ต้อง add เอง)
   */
  constructor(scene, parent) {
    this.scene = scene;
    this.key = `paint:${++uid}`;
    this.cv = document.createElement('canvas');
    this.ctx = this.cv.getContext('2d');
    this.img = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false);
    if (parent) parent.add(this.img);
    this._fill = 'rgba(0,0,0,1)';
    this._stroke = 'rgba(0,0,0,1)';
    this._lw = 1;
  }

  /** เริ่มวาดใหม่ในกรอบ x, y, w, h (หน่วย CSS px) */
  begin(x, y, w, h) {
    const s = this.scene.dpr || 1;
    this.box = { x, y, w: Math.max(1, w), h: Math.max(1, h) };
    const W = Math.max(1, Math.ceil(this.box.w * s));
    const H = Math.max(1, Math.ceil(this.box.h * s));
    if (this.cv.width !== W || this.cv.height !== H) {
      this.cv.width = W;
      this.cv.height = H;
    }
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    c.setTransform(s, 0, 0, s, -x * s, -y * s);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    return this;
  }

  fillStyle(color, alpha = 1) { this._fill = css(color, alpha); return this; }
  lineStyle(width, color, alpha = 1) { this._lw = width; this._stroke = css(color, alpha); return this; }

  fillRoundedRect(x, y, w, h, r = 8) {
    roundRectPath(this.ctx, x, y, w, h, r);
    this.ctx.fillStyle = this._fill;
    this.ctx.fill();
    return this;
  }
  strokeRoundedRect(x, y, w, h, r = 8) {
    roundRectPath(this.ctx, x, y, w, h, r);
    this.ctx.strokeStyle = this._stroke;
    this.ctx.lineWidth = this._lw;
    this.ctx.stroke();
    return this;
  }
  fillRect(x, y, w, h) { this.ctx.fillStyle = this._fill; this.ctx.fillRect(x, y, w, h); return this; }
  fillCircle(x, y, r) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    this.ctx.fillStyle = this._fill;
    this.ctx.fill();
    return this;
  }
  strokeCircle(x, y, r) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    this.ctx.strokeStyle = this._stroke;
    this.ctx.lineWidth = this._lw;
    this.ctx.stroke();
    return this;
  }
  lineBetween(x1, y1, x2, y2) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = this._stroke;
    this.ctx.lineWidth = this._lw;
    this.ctx.stroke();
    return this;
  }
  /** ไล่สีแนวตั้งในสี่เหลี่ยมมุมโค้ง */
  gradientRoundedRect(x, y, w, h, r, stops) {
    const g = this.ctx.createLinearGradient(0, y, 0, y + h);
    for (const [at, color, alpha = 1] of stops) g.addColorStop(at, css(color, alpha));
    roundRectPath(this.ctx, x, y, w, h, r);
    this.ctx.fillStyle = g;
    this.ctx.fill();
    return this;
  }

  /** ส่งภาพที่วาดขึ้นจอ (สร้าง/อัปเดต texture) */
  end() {
    const { textures } = this.scene;
    if (textures.exists(this.key)) {
      const t = textures.get(this.key);
      // ขนาดเปลี่ยน → ต้องสร้าง texture ใหม่ · ขนาดเดิม → แค่ refresh (เร็ว)
      if (t.source[0].width !== this.cv.width || t.source[0].height !== this.cv.height) {
        this.img.setTexture('__DEFAULT');
        textures.remove(this.key);
        textures.addCanvas(this.key, this.cv);
      } else {
        t.refresh();
      }
    } else {
      textures.addCanvas(this.key, this.cv);
    }
    this.img.setTexture(this.key).setPosition(this.box.x, this.box.y).setDisplaySize(this.box.w, this.box.h).setVisible(true);
    return this;
  }

  /** ล้างภาพ (ซ่อน) */
  clear() {
    this.img.setVisible(false);
    return this;
  }

  setVisible(v) { this.img.setVisible(v); return this; }
  destroy() {
    this.img.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}
