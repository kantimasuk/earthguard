// วาดหน้าการ์ดด้วย Canvas 2D (ไม่ต้องมีไฟล์รูป) แล้วส่งให้ Phaser ใช้เป็น texture
// - ข้อความไทยตัดคำด้วย Intl.Segmenter (ถ้ามี) ไม่ตัดกลางคำ
// - วาดครั้งแรกที่ใช้แล้วเก็บไว้ (lazy + cache)
import {
  SYMBOL_ICON, SYMBOL_COLOR, SYMBOL_SHORT, RIGHT_ICON, THREAT_ICON, END_ICON, STAR_PATH,
} from './icons';

export const CW = 200;  // ขนาดต้นฉบับของการ์ด (px) — แสดงผลจริงจะย่อลง
export const CH = 280;
const FONT = 'Kodchasan, system-ui, sans-serif';

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;

function words(text) {
  if (!text) return [];
  if (segmenter) return [...segmenter.segment(text)].map((s) => s.segment);
  return [...text]; // สำรอง: ตัดทีละตัวอักษร
}

/** ตัดบรรทัดตามความกว้าง (คืน array ของบรรทัด) */
export function wrap(ctx, text, maxWidth, maxLines = 4) {
  const lines = [];
  let line = '';
  for (const w of words(text)) {
    const test = line + w;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line.trim());
      line = w.trimStart();
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  if (lines.length === maxLines && words(text).join('').length > lines.join('').length + 2) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…');
  }
  return lines;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** วาดไอคอน path (viewBox 24) ที่ตำแหน่งกลาง (cx, cy) ขนาด size */
export function icon(ctx, d, cx, cy, size, color, width = 2, fill = null) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  const p = new Path2D(d);
  if (fill) { ctx.fillStyle = fill; ctx.fill(p); }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(p);
  ctx.restore();
}

function textLines(ctx, lines, cx, y, lh) {
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
}

function mix(hex, amt) {
  // ทำสีให้อ่อนลง (amt 0–1 ผสมกับขาว)
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c) => Math.round(c + (255 - c) * amt);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function dark(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c) => Math.round(c * (1 - amt));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

function newCanvas(w = CW, h = CH) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// การ์ดที่วาดด้วยโค้ดออกแบบไว้ที่ 200×280 แต่วาดจริงใหญ่ขึ้น 2.5 เท่า (500×700)
// → จอใหญ่/จอความละเอียดสูงไม่ต้องขยายภาพเล็กขึ้น (ขยาย = เบลอ)
const ART_SCALE = 2.5;
function newArtCanvas() {
  const c = newCanvas(Math.round(CW * ART_SCALE), Math.round(CH * ART_SCALE));
  c.getContext('2d').scale(ART_SCALE, ART_SCALE);
  return c;
}

/**
 * ย่อรูปให้เหลือกว้าง tw px แบบคุณภาพสูง (ย่อทีละครึ่งจนใกล้ขนาดจริง)
 * ทำไม: WebGL ย่อรูปใหญ่มาก ๆ ทีเดียว (เช่น 500px → 90px) จะได้ขอบแตก/ตัวหนังสือขาด ๆ
 * การย่อทีละครึ่งด้วย Canvas 2D ให้ภาพเนียนกว่ามาก แล้วค่อยส่งขนาดที่พอดีจอให้ Phaser
 */
export function resample(src, tw) {
  tw = Math.max(8, Math.round(tw));
  if (tw >= src.width) return src;
  const th = Math.round((src.height * tw) / src.width);
  let cur = src;
  while (cur.width / 2 >= tw * 1.05) {
    const half = newCanvas(Math.round(cur.width / 2), Math.round(cur.height / 2));
    const g = half.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  const out = newCanvas(tw, th);
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, 0, 0, tw, th);
  return out;
}

// ---------------------------------------------------------------------------
function drawActivity(ctx, c) {
  const col = SYMBOL_COLOR[c.symbol];
  rr(ctx, 3, 3, CW - 6, CH - 6, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = col.band;
  ctx.stroke();
  // แถบหัว
  ctx.save();
  rr(ctx, 3, 3, CW - 6, CH - 6, 18);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, 78);
  g.addColorStop(0, col.band);
  g.addColorStop(1, mix(col.band, 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, 78);
  ctx.restore();
  // หมายเลข
  ctx.beginPath();
  ctx.arc(44, 42, 29, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = col.ink;
  ctx.stroke();
  ctx.fillStyle = col.ink;
  ctx.font = `700 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(c.number), 44, 45);
  // สัญลักษณ์
  ctx.beginPath();
  ctx.arc(CW - 44, 42, 29, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  icon(ctx, SYMBOL_ICON[c.symbol], CW - 44, 42, 36, col.ink, 2.2);
  // ชื่อกิจกรรม
  ctx.fillStyle = '#1f2a22';
  ctx.font = `600 23px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  const lines = wrap(ctx, c.name, CW - 30, 4);
  const top = 150 - ((lines.length - 1) * 29) / 2;
  textLines(ctx, lines, CW / 2, top, 29);
  // ความหมายของหมายเลข
  ctx.font = `600 19px ${FONT}`;
  const label = c.numberMeaning || '';
  const w = Math.min(CW - 30, ctx.measureText(label).width + 26);
  rr(ctx, (CW - w) / 2, 214, w, 32, 16);
  ctx.fillStyle = col.soft;
  ctx.fill();
  ctx.fillStyle = col.ink;
  ctx.fillText(label, CW / 2, 237);
  ctx.font = `500 15px ${FONT}`;
  ctx.fillStyle = '#7a857b';
  ctx.fillText(SYMBOL_SHORT[c.symbol], CW / 2, 266);
}

function drawRight(ctx, c) {
  const base = c.color || '#dddddd';
  rr(ctx, 3, 3, CW - 6, CH - 6, 18);
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, mix(base, 0.1));
  g.addColorStop(0.55, mix(base, 0.55));
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = dark(base, 0.25);
  ctx.stroke();
  const ink = dark(base, 0.6);
  // ประเภทสิทธิ
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = ink;
  ctx.fillText(c.kind === 'procedural' ? 'สิทธิเชิงกระบวนการ' : 'สิทธิเชิงเนื้อหา', 16, 32);
  // ดาวคะแนน
  icon(ctx, STAR_PATH, CW - 32, 30, 44, '#b37d0c', 1.6, '#ffd24d');
  ctx.textAlign = 'center';
  ctx.font = `700 19px ${FONT}`;
  ctx.fillStyle = '#6b4500';
  ctx.fillText(String(c.points), CW - 32, 38);
  // ไอคอนใหญ่
  ctx.beginPath();
  ctx.arc(CW / 2, 96, 40, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = dark(base, 0.2);
  ctx.stroke();
  icon(ctx, RIGHT_ICON[c.key], CW / 2, 96, 50, ink, 2.1);
  // ชื่อสิทธิ
  ctx.fillStyle = '#1f2a22';
  ctx.font = `700 24px ${FONT}`;
  const lines = wrap(ctx, c.shortName || c.name, CW - 28, 2);
  textLines(ctx, lines, CW / 2, 172 - (lines.length - 1) * 14, 29);
  // เงื่อนไข
  ctx.font = `500 14px ${FONT}`;
  ctx.fillStyle = '#56655a';
  ctx.fillText('ทิ้งการ์ดกิจกรรม', CW / 2, 222);
  if (c.kind === 'substantive') {
    [1, 2, 3].forEach((n, i) => {
      const x = CW / 2 + (i - 1) * 42;
      ctx.beginPath();
      ctx.arc(x, 248, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#56655a';
      ctx.stroke();
      ctx.fillStyle = '#2d3a30';
      ctx.font = `700 19px ${FONT}`;
      ctx.fillText(String(n), x, 255);
    });
  } else {
    const col = SYMBOL_COLOR[c.symbol];
    [0, 1, 2].forEach((i) => {
      const x = CW / 2 + (i - 1) * 42;
      ctx.beginPath();
      ctx.arc(x, 248, 16, 0, Math.PI * 2);
      ctx.fillStyle = col.band;
      ctx.fill();
      icon(ctx, SYMBOL_ICON[c.symbol], x, 248, 22, col.ink, 2.2);
    });
  }
}

function drawThreat(ctx, c, catalogByKey) {
  rr(ctx, 3, 3, CW - 6, CH - 6, 18);
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#3a1f1f');
  g.addColorStop(1, '#141515');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#e0533f';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = `700 16px ${FONT}`;
  ctx.fillStyle = '#ffb09f';
  ctx.fillText('ภัยคุกคาม', CW / 2, 30);
  icon(ctx, THREAT_ICON, CW / 2, 74, 60, '#ffcf4a', 2.2, 'rgba(224,83,63,0.35)');
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 21px ${FONT}`;
  const lines = wrap(ctx, c.name, CW - 26, 3);
  textLines(ctx, lines, CW / 2, 138, 26);
  // จำนวนการ์ดที่ต้องทิ้ง
  ctx.beginPath();
  ctx.arc(CW / 2, 208, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#e0533f';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(`−${c.discardCount}`, CW / 2, 216);
  // สิทธิที่ป้องกันได้
  const keys = c.protectedBy || [];
  const step = Math.min(34, (CW - 30) / Math.max(1, keys.length));
  keys.forEach((k, i) => {
    const x = CW / 2 + (i - (keys.length - 1) / 2) * step;
    const r = catalogByKey[k];
    ctx.beginPath();
    ctx.arc(x, 253, 14, 0, Math.PI * 2);
    ctx.fillStyle = r?.color || '#ffffff';
    ctx.fill();
    icon(ctx, RIGHT_ICON[k], x, 253, 18, '#1f2a22', 2.4);
  });
}

function drawEnd(ctx, c) {
  rr(ctx, 3, 3, CW - 6, CH - 6, 18);
  const g = ctx.createRadialGradient(CW / 2, 100, 10, CW / 2, 120, 200);
  g.addColorStop(0, '#ff7a4d');
  g.addColorStop(0.6, '#c23b2f');
  g.addColorStop(1, '#5e1712');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffd24d';
  ctx.stroke();
  icon(ctx, END_ICON, CW / 2, 95, 74, '#fff3d6', 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 23px ${FONT}`;
  textLines(ctx, ['โลกเข้าสู่', 'จุดพลิกผัน'], CW / 2, 175, 30);
  ctx.font = `500 15px ${FONT}`;
  ctx.fillStyle = '#ffe2c7';
  ctx.fillText('Climate Tipping Points', CW / 2, 236);
  ctx.font = `700 17px ${FONT}`;
  ctx.fillStyle = '#ffd24d';
  ctx.fillText('เกมจบทันที', CW / 2, 262);
}

function drawBack(ctx) {
  rr(ctx, 3, 3, CW - 6, CH - 6, 18);
  const g = ctx.createLinearGradient(0, 0, CW, CH);
  g.addColorStop(0, '#4f9a3f');
  g.addColorStop(1, '#23551f');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#f4efd9';
  ctx.stroke();
  // ลายเส้นทแยง
  ctx.save();
  rr(ctx, 12, 12, CW - 24, CH - 24, 12);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 8;
  for (let x = -CH; x < CW + CH; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + CH, CH);
    ctx.stroke();
  }
  ctx.restore();
  rr(ctx, 12, 12, CW - 24, CH - 24, 12);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(244,239,217,0.6)';
  ctx.stroke();
  // ตราโลก + ใบไม้
  ctx.beginPath();
  ctx.arc(CW / 2, CH / 2 - 14, 46, 0, Math.PI * 2);
  ctx.fillStyle = '#f4efd9';
  ctx.fill();
  icon(ctx, END_ICON, CW / 2, CH / 2 - 14, 60, '#3a7d2c', 2.2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4efd9';
  ctx.font = `700 21px ${FONT}`;
  ctx.fillText('EarthGuard', CW / 2, CH / 2 + 62);
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText("It's All Rights", CW / 2, CH / 2 + 82);
}

/** วาดรูปการ์ดของทีมลง canvas: ตัดให้ได้สัดส่วนการ์ด (5:7) + มุมโค้ง */
function drawImageCard(img) {
  const w = Math.min(500, img.naturalWidth || 500);
  const h = Math.round(w * (CH / CW));
  const cv = newCanvas(w, h);
  const ctx = cv.getContext('2d');
  rr(ctx, 0, 0, w, h, w * 0.07);
  ctx.clip();
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return cv;
}

/**
 * @param {Record<string, object>} cards แค็ตตาล็อก (id → card)
 * @param {Map<string, HTMLImageElement>} [images] รูปการ์ดของทีม (ชื่อไฟล์ = รหัสการ์ด/รหัสแบบ/back)
 */
export function createCardArtist(cards, images = new Map()) {
  const cache = new Map();
  const byKey = {};
  for (const c of Object.values(cards)) if (c.type === 'right' && !byKey[c.key]) byKey[c.key] = c;

  function face(id) {
    if (cache.has(id)) return cache.get(id);
    const c = cards[id];
    // มีรูปของทีม → ใช้รูป (รหัสรายใบก่อน แล้วค่อยรหัสแบบ)
    const img = images.get(id) || (c && images.get(c.design));
    if (img) {
      const cvImg = drawImageCard(img);
      cache.set(id, cvImg);
      return cvImg;
    }
    const cv = newArtCanvas();
    const ctx = cv.getContext('2d');
    if (!c) drawBack(ctx);
    else if (c.type === 'activity') drawActivity(ctx, c);
    else if (c.type === 'right') drawRight(ctx, c);
    else if (c.type === 'threat') drawThreat(ctx, c, byKey);
    else drawEnd(ctx, c);
    cache.set(id, cv);
    return cv;
  }

  function back() {
    if (cache.has('__back')) return cache.get('__back');
    const img = images.get('back');
    const cv = img ? drawImageCard(img) : newArtCanvas();
    if (!img) drawBack(cv.getContext('2d'));
    cache.set('__back', cv);
    return cv;
  }

  /** ไอคอนสีขาว (ใช้ tint ใน Phaser) — 128px ให้คมบนจอ 3x */
  function iconCanvas(d, size = 128, width = 2.2) {
    const key = `__icon:${d}:${size}`;
    if (cache.has(key)) return cache.get(key);
    const cv = newCanvas(size, size);
    icon(cv.getContext('2d'), d, size / 2, size / 2, size * 0.8, '#ffffff', width);
    cache.set(key, cv);
    return cv;
  }

  /** รูปการ์ดเป็น data URL (ใช้ใน Vue เช่น ป๊อปอัปรายละเอียดการ์ด) */
  const urls = new Map();
  function url(id) {
    const k = id || '__back';
    if (!urls.has(k)) urls.set(k, (id ? face(id) : back()).toDataURL('image/png'));
    return urls.get(k);
  }

  return { face, back, iconCanvas, url, byKey, resample };
}
