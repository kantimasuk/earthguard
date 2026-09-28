"""สร้างเสียงเอฟเฟกต์ของหน้าเล่นเกม (สังเคราะห์ด้วยโค้ด ไม่ติดลิขสิทธิ์)
รัน: python tools/sfx/make_sfx.py  → client/public/audio/*.wav"""
import wave, pathlib
import numpy as np

SR = 22050
OUT = pathlib.Path(__file__).resolve().parents[2] / "client" / "public" / "audio"
rng = np.random.default_rng(7)

def t(sec): return np.arange(int(SR * sec)) / SR
def env(n, a=0.005, d=None, curve=4.0):
    x = np.linspace(0, 1, n)
    e = np.exp(-curve * x)
    na = max(1, int(SR * a))
    e[:na] *= np.linspace(0, 1, na)
    return e
def tone(f, sec, curve=5, a=0.005, harm=((1, 1.0),)):
    tt = t(sec)
    s = sum(g * np.sin(2 * np.pi * f * h * tt) for h, g in harm)
    return s * env(len(tt), a, curve=curve)
def noise(sec, curve=8):
    n = rng.standard_normal(int(SR * sec))
    return n * env(len(n), 0.002, curve=curve)
def lowpass(x, k=8):
    return np.convolve(x, np.ones(k) / k, mode="same")
def mix(*xs):
    n = max(len(x) for x in xs)
    return sum(np.pad(x, (0, n - len(x))) for x in xs)
def seq(parts, gap):
    total = int(SR * (gap * (len(parts) - 1))) + max(len(p) for p in parts) + 10
    out = np.zeros(total)
    for i, p in enumerate(parts):
        s = int(SR * gap * i)
        out[s:s + len(p)] += p
    return out
def save(name, x, vol=0.8):
    x = x / (np.max(np.abs(x)) + 1e-9) * vol
    data = (x * 32767).astype(np.int16)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())
    print("✔", name, f"{len(x)/SR:.2f}s")

BELL = ((1, 1.0), (2, 0.35), (3, 0.12))
# พลิกการ์ด: เสียงกระดาษ "ฟึ่บ" สั้น ๆ
save("flip", mix(lowpass(noise(0.07, 14), 3), 0.25 * tone(1800, 0.03, 30)), 0.55)
# แจก/บินการ์ด: สวืบ
sw = noise(0.16, 5)
sw = lowpass(sw * np.sin(np.linspace(0, np.pi, len(sw))), 6)
save("deal", sw, 0.5)
# เหรียญ
save("coin", mix(tone(1320, 0.35, 7, harm=((1, 1), (1.5, 0.5), (2.76, 0.2))), 0.6 * np.pad(tone(1760, 0.3, 8), (int(SR*0.06), 0))), 0.7)
# สร้างสิทธิสำเร็จ: อาร์เปจจิโอขึ้น
save("build", seq([tone(f, 0.45, 5, harm=BELL) for f in (523, 659, 784, 1047)], 0.08), 0.75)
# ปลดล็อกความสามารถ: ประกายเสียงสูง
save("unlock", seq([tone(f, 0.35, 6, harm=BELL) for f in (1047, 1319, 1568, 2093, 2637)], 0.06), 0.6)
# ภัยคุกคาม: เสียงทุ้มสั่น + เตือนสองโทน
rumble = mix(lowpass(noise(1.0, 2.5), 40) * 3, tone(55, 1.0, 2.5))
alarm = seq([tone(f, 0.28, 4, harm=((1, 1), (2, 0.4))) for f in (622, 440, 622, 440)], 0.18)
alarm = np.pad(alarm, (0, max(0, len(rumble) - len(alarm))))[:len(rumble)]
save("threat", rumble * 0.8 + alarm * 0.5, 0.8)
# เปลี่ยนช่วงเกม: ระฆังนุ่ม
save("phase", mix(tone(392, 1.2, 3, harm=BELL), 0.6 * tone(587, 1.2, 3.5, harm=BELL)), 0.7)
# ชนะ: แฟนแฟร์สั้น
save("win", seq([tone(f, 0.5, 4, harm=BELL) for f in (523, 659, 784)] + [tone(1047, 1.0, 2.5, harm=BELL)], 0.13), 0.8)
# เสียการ์ด: โน้ตลง
save("lose", seq([tone(f, 0.3, 6, harm=((1, 1), (2, 0.3))) for f in (440, 370, 294)], 0.1), 0.6)
# นาฬิกาใกล้หมดเวลา
save("tick", tone(1200, 0.05, 25), 0.5)
# ตาของเรา
save("turn", seq([tone(f, 0.25, 7, harm=BELL) for f in (784, 1047)], 0.09), 0.6)
