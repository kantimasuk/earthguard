"""
สร้างเพลงประกอบเกม EarthGuard (แต่งและสังเคราะห์เสียงเองทั้งหมดด้วยโค้ด → ไม่มีลิขสิทธิ์ของใคร ใช้ได้ฟรี)

    python tools/music/make_music.py          → client/public/audio/music/*.mp3

เพลง 4 เพลง (วนลูปได้ไม่มีรอยต่อ):
    menu   สดใส อบอุ่น          (หน้าเมนู / ห้องรอ / แบบทดสอบ)   C major · 104 BPM
    p1     สดใส มีพลัง          (ช่วงที่ 1)                     G major · 118 BPM
    p2     กดดันพอประมาณ ชวนลุ้น  (ช่วงที่ 2)                     A minor · 108 BPM
    p3     ตึงเครียด กดดัน        (ช่วงที่ 3)                     D minor · 96 BPM
    end    ยิ่งใหญ่ เศร้า ดราม่า    (ฉากจบเกม / ผลการแข่งขัน)        D minor · 68 BPM

    สร้างบางเพลง: python tools/music/make_music.py p2 end   · เสียงประกอบ: deal / env / endfx

เทคนิคลูปไม่มีรอยต่อ: เรนเดอร์ 1 รอบ + หางเสียงก้อง แล้วพับหางกลับไปทับช่วงต้น (เพลงเป็นคาบสมบูรณ์)
ไฟล์จริง = [ท้ายลูป 1 วินาที] + [ลูป] + [ต้นลูป 1 วินาที] → ฝั่งเว็บวนช่วง loopStart = 1s ถึง 1s + ความยาวลูป
(ต่อให้ตัวถอดรหัส MP3 ของแต่ละเบราว์เซอร์เลื่อนเวลาไปไม่กี่มิลลิวินาที ก็ยังวนได้เนียน เพราะเนื้อเพลงเป็นคาบ)

และสร้างเสียงแจกการ์ดใหม่ (deal.wav) เป็นเสียงการ์ดกระดาษไถลเบา ๆ
"""
import json
import os
import subprocess
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'client', 'public', 'audio', 'music')
RNG = np.random.default_rng(7)

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(n):
    """'A4' → 440 · รับตัวเลข MIDI ได้ด้วย"""
    if isinstance(n, (int, float)):
        return 440.0 * 2 ** ((n - 69) / 12)
    name, octv = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octv + 1) - 69) / 12)


def midi(n):
    name, octv = n[:-1], int(n[-1])
    return NOTE[name] + 12 * (octv + 1)


def t_arr(dur):
    return np.arange(int(dur * SR)) / SR


def adsr(n, a, d, s, r, sus_len=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    env = np.ones(n) * s
    a = min(a, n)
    env[:a] = np.linspace(0, 1, a, endpoint=False) if a else env[:a]
    d2 = min(d, max(0, n - a))
    env[a:a + d2] = np.linspace(1, s, d2, endpoint=False)
    if r and n > r:
        env[-r:] *= np.linspace(1, 0, r) ** 1.5
    return env


def lowpass(x, fc, order=2):
    sos = butter(order, min(fc, SR * 0.45) / (SR / 2), 'low', output='sos')
    return sosfilt(sos, x)


def highpass(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), 'high', output='sos')
    return sosfilt(sos, x)


def bandpass(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], 'band', output='sos')
    return sosfilt(sos, x)


# ------------------------------------------------------------------ เครื่องดนตรี
def pad(freq, dur, bright=8, detune=0.25, a=0.6, r=1.2):
    """แพดอุ่น ๆ: ซอว์บวกฮาร์มอนิกลดหลั่น 3 ตัวเพี้ยนกันนิด ๆ"""
    t = t_arr(dur + r)
    out = np.zeros_like(t)
    for cents in (-detune * 10, 0, detune * 10):
        f = freq * 2 ** (cents / 1200)
        ph = RNG.random() * 6.28
        for k in range(1, bright + 1):
            if f * k > 9000:
                break
            out += np.sin(2 * np.pi * f * k * t + ph * k) / (k ** 1.35)
    env = adsr(len(t), a, 0.4, 0.85, r)
    vib = 1 + 0.08 * np.sin(2 * np.pi * 0.23 * t)
    return out * env * vib / 3


def pluck(freq, dur, bright=0.5, decay=0.996):
    """กีตาร์/ฮาร์ปดีด (Karplus–Strong)"""
    n = int(dur * SR)
    p = max(2, int(SR / freq))
    buf = (RNG.random(p) * 2 - 1)
    buf = lowpass(buf, 2000 + 6000 * bright)
    out = np.zeros(n)
    for i in range(n):
        v = buf[i % p]
        out[i] = v
        buf[i % p] = decay * 0.5 * (v + buf[(i + 1) % p])
    out *= adsr(n, 0.002, 0.05, 1, 0.05)
    return out


def bell(freq, dur, index=2.2, ratio=3.5, tau=0.9):
    """กระดิ่ง/กล่องดนตรี (FM)"""
    t = t_arr(dur)
    mod = index * np.exp(-t / (tau * 0.5)) * np.sin(2 * np.pi * freq * ratio * t)
    out = np.sin(2 * np.pi * freq * t + mod) * np.exp(-t / tau)
    return out * adsr(len(t), 0.003, 0.0, 1, 0.03)


def marimba(freq, dur):
    t = t_arr(dur)
    out = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.45) + 0.35 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t / 0.08)
    return out * adsr(len(t), 0.002, 0, 1, 0.02)


def bass(freq, dur, grit=0.25, a=0.008, r=0.08):
    t = t_arr(dur)
    out = np.sin(2 * np.pi * freq * t) + grit * np.sin(2 * np.pi * freq * 2 * t) + grit * 0.4 * np.sin(2 * np.pi * freq * 3 * t)
    return out * adsr(len(t), a, 0.15, 0.75, r)


def strings(freq, dur, a=0.01, r=0.08, bright=10, trem=0.0):
    """เครื่องสาย (สั้น = สแตคคาโต · ยาว = ลากเสียง)"""
    t = t_arr(dur)
    out = np.zeros_like(t)
    for cents in (-6, 0, 7):
        f = freq * 2 ** (cents / 1200) * (1 + 0.003 * np.sin(2 * np.pi * 5.2 * t))
        ph = 2 * np.pi * np.cumsum(f) / SR
        for k in range(1, bright + 1):
            if freq * k > 10000:
                break
            out += np.sin(ph * k) / (k ** 1.15)
    out = lowpass(out, 3800)
    env = adsr(len(t), a, 0.08, 0.8, r)
    if trem:
        env *= 0.75 + 0.25 * np.sin(2 * np.pi * trem * t)
    return out * env / 3


def brass(freq, dur):
    t = t_arr(dur)
    bright = 3 + 9 * np.exp(-t / 0.25)
    out = np.zeros_like(t)
    for k in range(1, 14):
        if freq * k > 9000:
            break
        w = np.clip(bright - k + 1, 0, 1) / k ** 0.9
        out += w * np.sin(2 * np.pi * freq * k * t)
    return out * adsr(len(t), 0.03, 0.2, 0.6, 0.15) / 3


def choir(freq, dur):
    """คอรัส "อา" (ฟอร์แมนต์โดยประมาณ)"""
    t = t_arr(dur)
    f = freq * (1 + 0.006 * np.sin(2 * np.pi * 5 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros_like(t)
    for k in range(1, 16):
        fk = freq * k
        w = np.exp(-((fk - 750) / 280) ** 2) + 0.7 * np.exp(-((fk - 1200) / 350) ** 2) + 0.4 * np.exp(-((fk - 2600) / 500) ** 2) + 0.15 / k
        out += w * np.sin(ph * k)
    return out * adsr(len(t), 0.5, 0.3, 0.9, 0.8) / 2


def kick(gain=1.0, dur=0.45):
    t = t_arr(dur)
    f = 45 + 95 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.sin(ph) * np.exp(-t / 0.18) + 0.25 * (RNG.random(len(t)) * 2 - 1) * np.exp(-t / 0.004)
    return out * gain


def snare(gain=1.0, dur=0.3, clap=False):
    t = t_arr(dur)
    noise = bandpass(RNG.random(len(t)) * 2 - 1, 900, 7500)
    if clap:
        env = np.exp(-t / 0.09)
        for off in (0.0, 0.011, 0.022):
            i = int(off * SR)
            env[i:i + int(0.006 * SR)] += 0.8
        return noise * env * 0.7 * gain
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05)
    return (noise * np.exp(-t / 0.11) * 0.8 + tone * 0.5) * gain


def hat(gain=1.0, dur=0.08, open_=False):
    t = t_arr(dur if not open_ else 0.3)
    n = highpass(RNG.random(len(t)) * 2 - 1, 7000, 3)
    return n * np.exp(-t / (0.02 if not open_ else 0.12)) * gain


def shaker(gain=1.0):
    t = t_arr(0.09)
    n = bandpass(RNG.random(len(t)) * 2 - 1, 4000, 11000)
    return n * np.sin(np.pi * t / 0.09) ** 2 * gain


def tom(freq=110, gain=1.0, dur=0.6):
    t = t_arr(dur)
    f = freq * (1 + 0.6 * np.exp(-t / 0.05))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t / 0.28) + 0.2 * (RNG.random(len(t)) * 2 - 1) * np.exp(-t / 0.01)) * gain


def timpani(freq, gain=1.0, dur=2.0):
    t = t_arr(dur)
    out = sum(np.sin(2 * np.pi * freq * r * t) * w for r, w in ((1, 1), (1.5, 0.5), (1.98, 0.35), (2.44, 0.2)))
    return out * np.exp(-t / 0.7) * adsr(len(t), 0.004, 0, 1, 0.2) * gain


def swell(dur, lo=200, hi=3000):
    """เสียงลมไหลขึ้น (ไรเซอร์) ก่อนขึ้นท่อนใหม่"""
    t = t_arr(dur)
    n = RNG.random(len(t)) * 2 - 1
    out = np.zeros_like(t)
    seg = 2048
    for i in range(0, len(t), seg):
        f = lo + (hi - lo) * (i / len(t)) ** 2
        out[i:i + seg] = bandpass(n[i:i + seg], f * 0.7, f * 1.4, 1)
    return out * (t / dur) ** 2


# ------------------------------------------------------------------ ตัวช่วยเรียบเรียง
class Track:
    def __init__(self, bpm, bars, beats=4, tail=4.0):
        self.bpm, self.beat = bpm, 60 / bpm
        self.length = bars * beats * self.beat
        self.n = int(round(self.length * SR))
        self.tail = int(tail * SR)
        self.bus = {}

    def add(self, bus, sig, at_beat, gain=1.0, pan=0.0):
        L = self.bus.setdefault(bus, np.zeros((2, self.n + self.tail + SR * 4)))
        i = int(round(at_beat * self.beat * SR))
        sig = sig[: L.shape[1] - i]
        g = gain
        L[0, i:i + len(sig)] += sig * g * np.sqrt(0.5 * (1 - pan))
        L[1, i:i + len(sig)] += sig * g * np.sqrt(0.5 * (1 + pan))

    def mix(self, levels, reverb=0.25, rev_len=2.2, rev_sends=None):
        dry = np.zeros((2, self.n + self.tail + SR * 4))
        send = np.zeros_like(dry)
        for name, buf in self.bus.items():
            lv = levels.get(name, 1.0)
            dry += buf * lv
            send += buf * lv * (rev_sends or {}).get(name, 1.0)
        # ห้องก้อง: IR เป็นสัญญาณรบกวนสเตอริโอที่จางลง
        tl = t_arr(rev_len)
        ir = np.stack([RNG.random(len(tl)) * 2 - 1 for _ in range(2)]) * np.exp(-tl / (rev_len / 5))
        ir = np.stack([lowpass(ir[0], 6000), lowpass(ir[1], 5000)])
        ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
        wet = np.stack([fftconvolve(send[c], ir[c])[: dry.shape[1]] for c in range(2)])
        out = dry + reverb * wet
        # พับหางเสียงกลับมาทับต้นเพลง → ลูปเป็นคาบสมบูรณ์
        loop = out[:, : self.n].copy()
        rest = out[:, self.n:]
        k = 0
        while k < rest.shape[1]:
            seg = rest[:, k:k + self.n]
            loop[:, : seg.shape[1]] += seg
            k += self.n
        loop = highpass(loop, 28)
        peak = np.max(np.abs(loop))
        loop = np.tanh(loop / peak * 1.25) / np.tanh(1.25) * 0.86
        return loop


def chord_notes(root, kind, octv=3):
    base = midi(f'{root}{octv}')
    iv = {'maj': (0, 4, 7), 'min': (0, 3, 7), 'maj7': (0, 4, 7, 11), 'min7': (0, 3, 7, 10), 'dom7': (0, 4, 7, 10),
          'sus4': (0, 5, 7), 'sus2': (0, 2, 7), 'add9': (0, 4, 7, 14), 'madd9': (0, 3, 7, 14)}[kind]
    return [base + i for i in iv]


# ================================================================== เพลง 1: เมนู (ผ่อนคลาย)
def song_menu():
    """เพลงเมนู: สดใส อบอุ่น ฟังสบาย (อูคูเลเล่ดีด + กล็อคเคนชปีล + ปรบมือ/เขย่าเบา ๆ) · C major 104 BPM"""
    T = Track(bpm=104, bars=16)
    prog = [('C', 'add9'), ('A', 'min7'), ('F', 'maj7'), ('G', 'sus4'),
            ('C', 'add9'), ('E', 'min7'), ('F', 'maj7'), ('G', 'dom7')] * 2
    strum = [(0, 1.0), (1, 0.55), (1.5, 0.75), (2.5, 0.6), (3, 0.85), (3.5, 0.5)]  # จังหวะดีดอูคูเลเล่ (ลง-ขึ้น)
    for bar, (r, k) in enumerate(prog):
        b0 = bar * 4
        notes = chord_notes(r, k, 4)
        # อูคูเลเล่: ดีดคอร์ดเป็นจังหวะ (แต่ละสายห่างกันนิด ๆ เหมือนดีดจริง)
        for b, v in strum:
            order = notes[:4] if int(b * 2) % 2 == 0 else notes[:4][::-1]
            for si, m in enumerate(order):
                T.add('uke', pluck(hz(m), 0.9, bright=0.55, decay=0.993), b0 + b + si * 0.012, 0.13 * v, pan=-0.25 + si * 0.15)
        # เบสเด้งดึ๋ง
        for b, iv in ((0, 0), (1.5, 7), (2, 12), (3, 7)):
            T.add('bass', bass(hz(notes[0] - 24 + iv), 0.45 * T.beat, grit=0.2), b0 + b, 0.36)
        # เครื่องเคาะเบา ๆ: ปรบมือจังหวะ 2/4 · เขย่า 8 ส่วน · กลองเตะนุ่ม ๆ
        T.add('perc', kick(0.7), b0, 0.5)
        T.add('perc', kick(0.6), b0 + 2.5, 0.4)
        for b in (1, 3):
            T.add('perc', snare(clap=True), b0 + b, 0.3)
        for i in range(8):
            T.add('perc', shaker(), b0 + i * 0.5, 0.1 if i % 2 else 0.06, pan=0.3)
        # แพดบาง ๆ รองพื้น
        for m in notes[:3]:
            T.add('pad', pad(hz(m), 4 * T.beat, bright=5, a=0.4, r=0.8), b0, 0.05)
    # ทำนองกล็อคเคนชปีล (กระดิ่งสดใส) — เมโลดี้ร่าเริง วนสองรอบ (รอบสองเพิ่มมาริมบาเสียงคู่)
    mel = [(0, 'E5', 1), (1, 'G5', 1), (2, 'C6', 1.5), (3.5, 'B5', 0.5), (4, 'A5', 1), (5, 'C6', 1), (6, 'E6', 2),
           (8, 'D6', 1), (9, 'C6', 0.5), (9.5, 'A5', 0.5), (10, 'F5', 1), (11, 'A5', 1), (12, 'G5', 1.5), (13.5, 'A5', 0.5), (14, 'B5', 2),
           (16, 'E5', 1), (17, 'G5', 1), (18, 'C6', 1), (19, 'D6', 1), (20, 'E6', 1.5), (21.5, 'D6', 0.5), (22, 'C6', 2),
           (24, 'A5', 1), (25, 'C6', 1), (26, 'F6', 1), (27, 'E6', 1), (28, 'D6', 1.5), (29.5, 'B5', 0.5), (30, 'C6', 2)]
    for rep in range(2):
        for b, n, d in mel:
            T.add('glock', bell(hz(n), 1.4, index=1.4, ratio=3.0, tau=0.55), rep * 32 + b, 0.17, pan=0.1)
            if rep:
                T.add('glock', marimba(hz(midi(n) - 12), 1.0), rep * 32 + b, 0.12, pan=-0.15)
    return T.mix({'uke': 1, 'bass': 1, 'perc': 1, 'pad': 1, 'glock': 1}, reverb=0.3, rev_len=2.2,
                 rev_sends={'perc': 0.25, 'bass': 0.1})


# ================================================================== เพลง 2: ช่วงที่ 1 (สดใส มีพลัง)
def song_p1():
    T = Track(bpm=118, bars=16)
    prog = [('G', 'add9'), ('D', 'maj'), ('E', 'min7'), ('C', 'add9')] * 4
    for bar, (r, k) in enumerate(prog):
        b0 = bar * 4
        notes = chord_notes(r, k, 3)
        for m in notes[:3]:
            T.add('pad', pad(hz(m + 12), 4 * T.beat, bright=7, a=0.15, r=0.5), b0, 0.07)
        # เบสเด้ง: โน้ต 8 ส่วน สลับคู่แปด
        for i in range(8):
            m = notes[0] - 12 + (12 if i % 2 else 0)
            T.add('bass', bass(hz(m), 0.42 * T.beat, grit=0.35), b0 + i * 0.5, 0.32 if i % 2 else 0.42)
        # กีตาร์ดีด 16 ส่วน
        pat = [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 3, 2, 1, 2]
        tones = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[0] + 24]
        for i, p in enumerate(pat):
            T.add('pluck', pluck(hz(tones[p]), 0.6, bright=0.7), b0 + i * 0.25, 0.16 if i % 4 else 0.22, pan=-0.4 if i % 2 else 0.4)
        # กลอง
        for b in (0, 2, 2.5):
            T.add('drum', kick(), b0 + b, 0.85)
        for b in (1, 3):
            T.add('drum', snare(clap=True), b0 + b, 0.5)
        for i in range(8):
            T.add('hat', hat(), b0 + i * 0.5 + 0.5 * (i % 1), 0.22 if i % 2 else 0.12, pan=0.25)
        for i in range(16):
            T.add('hat', shaker(), b0 + i * 0.25, 0.08 if i % 2 else 0.04, pan=-0.3)
    # ทำนองกระดิ่ง (สเกลเพนทาโทนิก G) 8 บาร์ × 2 (รอบสองขึ้นคู่แปด)
    mel = [(0, 'D5', 1), (1, 'G5', 1), (2, 'A5', 0.5), (2.5, 'B5', 1.5), (4, 'A5', 1), (5, 'F#5', 1), (6, 'D5', 2),
           (8, 'E5', 1), (9, 'G5', 1), (10, 'B5', 0.5), (10.5, 'A5', 1.5), (12, 'G5', 1), (13, 'E5', 1), (14, 'G5', 2),
           (16, 'D5', 0.5), (16.5, 'G5', 0.5), (17, 'A5', 1), (18, 'B5', 1), (19, 'D6', 1), (20, 'B5', 1), (21, 'A5', 1), (22, 'F#5', 2),
           (24, 'E5', 1), (25, 'G5', 1), (26, 'A5', 1), (27, 'B5', 1), (28, 'A5', 1.5), (29.5, 'G5', 0.5), (30, 'G5', 2)]
    for rep in range(2):
        for b, n, d in mel:
            f = hz(n) * (2 if rep else 1) * (0.5 if rep else 1)
            T.add('lead', bell(f, d * T.beat + 0.6, index=1.6, ratio=2.0, tau=0.5), rep * 32 + b, 0.24, pan=0.05)
            if rep:
                T.add('lead', marimba(hz(n), 1.0), rep * 32 + b, 0.12, pan=-0.1)
    T.add('fx', swell(4 * T.beat, 300, 5000), 60, 0.1)
    return T.mix({'pad': 1, 'bass': 1, 'pluck': 1, 'drum': 1, 'hat': 1, 'lead': 1, 'fx': 1}, reverb=0.28,
                 rev_sends={'drum': 0.3, 'bass': 0.1, 'hat': 0.4})


# ================================================================== เพลง: ช่วงที่ 3 (ตึงเครียด กดดัน — ไมเนอร์ เครื่องสายเป็นจังหวะชีพจร)
def song_p3():  # (เดิมเป็นเพลงช่วงที่ 2 — ย้ายมาเป็นช่วงที่ 3 ตามที่ทีมเลือก)
    T = Track(bpm=96, bars=16)
    prog = [('D', 'min'), ('D', 'min'), ('Bb', 'maj'), ('Bb', 'maj'), ('G', 'min'), ('G', 'min'), ('A', 'maj'), ('A', 'dom7')] * 2
    for bar, (r, k) in enumerate(prog):
        b0 = bar * 4
        notes = chord_notes(r, k, 3)
        # พื้นเสียงทุ้มมืด
        for m in notes[:3]:
            T.add('pad', pad(hz(m), 4 * T.beat, bright=5, a=0.8, r=1.0), b0, 0.09)
        T.add('bass', bass(hz(notes[0] - 12), 4 * T.beat, grit=0.3, a=0.02, r=0.3), b0, 0.38)
        # เครื่องสายสแตคคาโต 8 ส่วน (ชีพจร) — รอบสองเล่นเป็น 16 ส่วน (เร่งขึ้น)
        step = 0.5 if bar < 8 else 0.25
        for i in range(int(4 / step)):
            m = notes[0] + (12 if i % 4 == 2 else 0)
            T.add('stacc', strings(hz(m), step * T.beat * 0.6, a=0.004, r=0.05), b0 + i * step, 0.22 if i % 2 == 0 else 0.15, pan=-0.3)
            T.add('stacc', strings(hz(notes[2]), step * T.beat * 0.6, a=0.004, r=0.05), b0 + i * step, 0.1, pan=0.3)
        # นาฬิกาเดิน (ไฮแฮต 16 ส่วนเบา ๆ) + กลองทุ้ม
        for i in range(16):
            T.add('hat', hat(dur=0.05), b0 + i * 0.25, 0.1 if i % 4 == 0 else 0.05, pan=0.4)
        T.add('drum', kick(0.8), b0, 0.6)
        T.add('drum', kick(0.6), b0 + 2.5, 0.5)
        if bar % 2 == 1:
            T.add('drum', tom(90, 0.7), b0 + 3.5, 0.35)
    # ลวดลายเปียโนไมเนอร์ซ้ำ ๆ ชวนลุ้น
    motif = [('D5', 0), ('F5', 0.5), ('E5', 1), ('D5', 1.5), ('A4', 2), ('C#5', 3)]
    for bar in range(0, 16, 2):
        shift = {0: 0, 2: 0, 4: -2, 6: 1}[bar % 8]
        for n, b in motif:
            T.add('keys', marimba(hz(midi(n) + shift), 1.2), bar * 4 + b, 0.18, pan=0.15)
            T.add('keys', bell(hz(midi(n) + shift + 12), 0.8, index=0.8, tau=0.4), bar * 4 + b, 0.05)
    # เครื่องสายเสียงสูงลากยาวครึ่งหลัง (ตึงขึ้น)
    for bar in range(8, 16, 2):
        n = ['A5', 'Bb5', 'G5', 'A5'][(bar - 8) // 2]
        T.add('hi', strings(hz(n), 8 * T.beat, a=1.2, r=0.8, trem=7), bar * 4, 0.12)
    T.add('fx', swell(4 * T.beat, 150, 2500), 60, 0.12)
    return T.mix({'pad': 1, 'bass': 1, 'stacc': 1, 'hat': 1, 'drum': 1, 'keys': 1, 'hi': 1, 'fx': 1}, reverb=0.35, rev_len=2.6,
                 rev_sends={'drum': 0.4, 'bass': 0.1})


# ================================================================== เพลง: ช่วงที่ 2 (กดดันพอประมาณ — ลึกลับ ชวนลุ้น แต่ยังไม่หนัก)
def song_p2():
    T = Track(bpm=108, bars=16)
    prog = [('A', 'min'), ('F', 'maj'), ('C', 'maj'), ('G', 'maj'),
            ('A', 'min'), ('F', 'maj'), ('D', 'min'), ('E', 'maj')] * 2
    for bar, (r, k) in enumerate(prog):
        b0 = bar * 4
        notes = chord_notes(r, k, 3)
        # แพดบาง ๆ ค่อย ๆ พอง
        for m in notes:
            T.add('pad', pad(hz(m + 12), 4 * T.beat, bright=5, a=1.2, r=1.0), b0, 0.06)
        # เบสชีพจร 8 ส่วน (นุ่ม ไม่หนัก)
        for i in range(8):
            T.add('bass', bass(hz(notes[0] - 12), 0.4 * T.beat, grit=0.3), b0 + i * 0.5, 0.19 if i % 2 == 0 else 0.13)
        # พิซซิคาโต (ดีดสายเบา ๆ) อาร์เปจโจ 8 ส่วน
        arp = [notes[0] + 12, notes[2] + 12, notes[1] + 24, notes[2] + 12, notes[0] + 24, notes[2] + 12, notes[1] + 24, notes[2] + 12]
        for i, m in enumerate(arp):
            T.add('pizz', pluck(hz(m), 0.35, bright=0.25, decay=0.985), b0 + i * 0.5, 0.18, pan=-0.35 if i % 2 else 0.35)
        # เสียงนาฬิกา (ไม้เคาะเสียงสูง) จังหวะยก + กลองนุ่ม ๆ
        for i in range(4):
            T.add('perc', marimba(hz('E6'), 0.15), b0 + i + 0.5, 0.06, pan=0.4)
        T.add('perc', kick(0.7), b0, 0.42)
        T.add('perc', kick(0.6), b0 + 2, 0.36)
        for i in range(8):
            T.add('perc', hat(dur=0.05), b0 + i * 0.5 + 0.25, 0.05, pan=-0.3)
        if bar % 4 == 3:
            T.add('perc', snare(0.6), b0 + 3, 0.18)
    # ทำนองกระดิ่งไมเนอร์ (ถาม-ตอบ) ครึ่งแรกเบา ครึ่งหลังเพิ่มเครื่องสายเสียงสูง
    mel = [(0, 'E5', 1.5), (1.5, 'D5', 0.5), (2, 'C5', 1), (3, 'B4', 1), (4, 'A4', 2), (6, 'C5', 2),
           (8, 'E5', 1.5), (9.5, 'F5', 0.5), (10, 'E5', 1), (11, 'D5', 1), (12, 'B4', 3), (15, 'G#4', 1)]
    for rep in range(2):
        for half in range(2):
            for b, n, d in mel:
                at = rep * 32 + half * 16 + b
                T.add('lead', bell(hz(n), d * T.beat + 0.5, index=1.2, ratio=3.0, tau=0.6), at, 0.16)
                if rep:
                    T.add('lead', strings(hz(n), d * T.beat, a=0.15, r=0.3), at, 0.08, pan=0.15)
    T.add('fx', swell(4 * T.beat, 200, 3000), 60, 0.08)
    return T.mix({'pad': 1, 'bass': 1, 'pizz': 1, 'perc': 1, 'lead': 1, 'fx': 1}, reverb=0.32, rev_len=2.4,
                 rev_sends={'perc': 0.3, 'bass': 0.1})


# ================================================================== เพลง: จบเกม (ยิ่งใหญ่ เศร้า ดราม่า)
def song_end():
    T = Track(bpm=68, bars=12)
    prog = [('D', 'min'), ('Bb', 'maj'), ('F', 'maj'), ('C', 'maj'),
            ('G', 'min'), ('Bb', 'maj'), ('A', 'sus4'), ('A', 'maj')] + [('D', 'min'), ('Bb', 'maj'), ('G', 'min'), ('A', 'maj')]
    for bar, (r, k) in enumerate(prog):
        b0 = bar * 4
        notes = chord_notes(r, k, 3)
        # เครื่องสายต่ำลากยาว + คอรัส
        for m in notes:
            T.add('str', strings(hz(m), 4 * T.beat + 0.4, a=0.9, r=0.8, bright=9), b0, 0.13, pan=RNG.uniform(-0.3, 0.3))
            T.add('choir', choir(hz(m + 12), 4 * T.beat + 0.5), b0, 0.07, pan=RNG.uniform(-0.4, 0.4))
        T.add('bass', strings(hz(notes[0] - 12), 4 * T.beat + 0.3, a=0.4, r=0.6, bright=6), b0, 0.3)
        # กลองใหญ่ / ทิมปานี ต้นบาร์
        T.add('drum', timpani(hz(notes[0] - 12), 1.0, dur=3.0), b0, 0.55)
        if bar % 2 == 1:
            T.add('drum', tom(70, 1.0, dur=1.2), b0 + 2, 0.5)
            T.add('drum', tom(60, 0.8, dur=1.2), b0 + 3.5, 0.35)
        # เปียโน (กระดิ่ง + มาริมบา) อาร์เปจโจช้า ๆ
        for i, m in enumerate([notes[0] + 24, notes[1] + 24, notes[2] + 24, notes[1] + 24]):
            T.add('keys', bell(hz(m), 2.2, index=0.9, ratio=4.0, tau=1.0), b0 + i, 0.09, pan=0.25)
    # ทำนองเครื่องสายเสียงสูง (เศร้า กว้าง)
    mel = [(0, 'A5', 3), (3, 'G5', 1), (4, 'F5', 2), (6, 'D5', 2), (8, 'C5', 3), (11, 'D5', 1), (12, 'E5', 4),
           (16, 'D5', 2), (18, 'F5', 2), (20, 'G5', 2), (22, 'F5', 1), (23, 'E5', 1), (24, 'E5', 3), (27, 'C#5', 1), (28, 'E5', 4),
           (32, 'A5', 2), (34, 'Bb5', 2), (36, 'D6', 3), (39, 'C6', 1), (40, 'Bb5', 2), (42, 'A5', 2), (44, 'A5', 4)]
    for b, n, d in mel:
        T.add('lead', strings(hz(n), d * T.beat + 0.2, a=0.25, r=0.5, trem=0), b, 0.2, pan=0.1)
    return T.mix({'str': 1, 'choir': 1, 'bass': 1, 'drum': 1, 'keys': 1, 'lead': 1}, reverb=0.5, rev_len=3.6,
                 rev_sends={'drum': 0.5})


def make_end_sfx():
    """เสียงประกอบฉากจบเกม (~11.5 วิ): 3 ฉาก × เสียงกระแทกตอนเปลี่ยนฉาก (0 / 3.7 / 7.4 วิ)
    ฉาก 1 ฝนกระหน่ำ · ฉาก 2 หินถล่มครืน · ฉาก 3 ไฟลุกโหม · ทุ้มคำรามตลอด · ไรเซอร์ไต่ก่อนภาพประกาศจบเกม"""
    rng = np.random.default_rng(99)
    dur = 11.6
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    def seg(a, b):
        return slice(int(a * SR), min(n, int(b * SR)))
    # ทุ้มคำราม
    rumble = sum(np.sin(2 * np.pi * 38.9 * k * t * (1 + 0.005 * np.sin(2 * np.pi * 0.5 * t))) / k for k in (1, 2, 3, 4, 6))
    out += rumble * 0.06 * np.clip(t / 1.5, 0, 1)
    # ฝน (ฉาก 1)
    sl = seg(0, 4.2)
    m = sl.stop - sl.start
    for c in range(2):
        r = bandpass(rng.random(m) * 2 - 1, 1500, 9000)
        env = np.minimum(1, np.arange(m) / (0.3 * SR)) * np.minimum(1, (m - np.arange(m)) / (0.6 * SR))
        out[c, sl] += r * env * 0.55
    # หินถล่ม (ฉาก 2): เม็ดเสียงกระทบสุ่ม
    sl = seg(3.7, 7.9)
    m = sl.stop - sl.start
    crumble = np.zeros(m)
    for _ in range(260):
        p = int(rng.uniform(0, m - 4000))
        g = rng.random(3000) * 2 - 1
        crumble[p:p + 3000] += lowpass(g, rng.uniform(500, 3000)) * np.exp(-np.arange(3000) / rng.uniform(150, 900)) * rng.uniform(0.2, 1)
    crumble *= np.minimum(1, (m - np.arange(m)) / (0.8 * SR))
    out[:, sl] += crumble * 0.35
    # ไฟลุก (ฉาก 3): เสียงฟู่ + ประทุ
    sl = seg(7.4, dur)
    m = sl.stop - sl.start
    for c in range(2):
        roar = lowpass(rng.random(m) * 2 - 1, 900) * (0.7 + 0.3 * np.sin(2 * np.pi * 3.1 * np.arange(m) / SR + c))
        out[c, sl] += roar * 0.8 * np.minimum(1, np.arange(m) / (0.4 * SR))
        for _ in range(40):
            p = int(rng.uniform(0, m - 800))
            out[c, sl.start + p:sl.start + p + 800] += highpass(rng.random(800) * 2 - 1, 2000) * np.exp(-np.arange(800) / 80) * 0.4
    # เสียงกระแทกเปลี่ยนฉาก
    for at, big in ((0.0, 1.0), (3.7, 1.15), (7.4, 1.35)):
        i0 = int(at * SR)
        m = min(int(3.0 * SR), n - i0)
        tt = np.arange(m) / SR
        f = 32 + 90 * np.exp(-tt / 0.1)
        boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 1.1)
        crack = lowpass(rng.random(m) * 2 - 1, 2200) * np.exp(-tt / 0.22)
        out[:, i0:i0 + m] += (boom * 0.4 + crack * 1.2) * big
    # ไรเซอร์ก่อนภาพประกาศ (ช่วง 9.1–11.6)
    rs = int(2.5 * SR)
    r = swell(2.5, 300, 7000)
    tone = np.sin(2 * np.pi * np.cumsum(98 * 2 ** (np.arange(rs) / rs * 2)) / SR) * (np.arange(rs) / rs) ** 2
    out[:, n - rs:] += r * 0.6 + tone * 0.3
    out *= np.minimum(1, (n - np.arange(n)) / (0.3 * SR))
    out = highpass(out, 25)
    out = np.tanh(out / np.max(np.abs(out)) * 1.6) / np.tanh(1.6) * 0.8
    pcm = (out.T * 32767).astype(np.int16)
    import wave
    wav = os.path.join(OUT, 'endfx.tmp.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '96k',
                    os.path.join(ROOT, 'client', 'public', 'audio', 'endfx.mp3')], check=True)
    os.remove(wav)


# ------------------------------------------------------------------ บันทึกไฟล์
def save_loop(name, loop):
    pre = SR  # 1 วินาที
    full = np.concatenate([loop[:, -pre:], loop, loop[:, :pre]], axis=1)
    pcm = (np.clip(full, -1, 1) * 32767).astype(np.int16).T.copy()
    os.makedirs(OUT, exist_ok=True)
    wav = os.path.join(OUT, f'{name}.tmp.wav')
    import wave
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    mp3 = os.path.join(OUT, f'{name}.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '112k', mp3], check=True)
    os.remove(wav)
    return {'file': f'/audio/music/{name}.mp3', 'loopStart': 1.0, 'loopLength': round(loop.shape[1] / SR, 6)}


def make_deal():
    """เสียงแจกการ์ดจริง ๆ: "ฟึ่บ" — ดีดการ์ด (snap) → กระดาษเสียดสีไถลไป (เม็ดเสียงถี่ ๆ) → การ์ดตบลงบนโต๊ะเบา ๆ"""
    rng = np.random.default_rng(3)
    dur = 0.14
    n = int(dur * SR)
    out = np.zeros(n)
    # 1) ดีดการ์ดออกจากมือ: คลิกสั้นมาก ย่านแหลม
    k = int(0.004 * SR)
    snap = bandpass(rng.random(k) * 2 - 1, 2500, 9000) * np.exp(-np.arange(k) / (0.0008 * SR))
    out[:k] += snap * 0.9
    # 2) กระดาษไถล: เม็ดเสียงเล็ก ๆ จำนวนมาก (ความถี่ของเม็ดลดลงเมื่อการ์ดช้าลง) — ให้ผิวเสียงหยาบแบบกระดาษจริง
    slide_len = int(0.075 * SR)
    grains = np.zeros(slide_len)
    t = 0.0
    while t < slide_len:
        pos = int(t)
        g = int(0.00025 * SR) + 1
        amp = (1 - pos / slide_len) ** 1.3 * rng.uniform(0.3, 1.0)
        grains[pos:pos + g] += (rng.random(min(g, slide_len - pos)) * 2 - 1) * amp
        t += SR * (0.00018 + 0.0012 * (pos / slide_len) ** 2) * rng.uniform(0.5, 1.5)
    grains = bandpass(grains, 1400, 7500, 2)
    env = np.minimum(1, np.arange(slide_len) / (0.004 * SR))
    out[int(0.002 * SR):int(0.002 * SR) + slide_len] += grains * env * 1.1
    # 3) การ์ดตบลงโต๊ะ: เสียงตบสั้น ๆ + ทุ้มเบา ๆ
    at = int(0.078 * SR)
    m = n - at
    tt = np.arange(m) / SR
    slap = lowpass(rng.random(m) * 2 - 1, 2600, 2) * np.exp(-tt / 0.009)
    thump = np.sin(2 * np.pi * 150 * tt) * np.exp(-tt / 0.014)
    out[at:] += slap * 0.7 + thump * 0.35
    out = highpass(out, 90)
    out *= np.minimum(1, (n - np.arange(n)) / (0.01 * SR))  # หางจบนุ่ม ๆ
    out = out / np.max(np.abs(out)) * 0.6
    pcm = (out * 32767).astype(np.int16)
    import wave
    path = os.path.join(ROOT, 'client', 'public', 'audio', 'deal.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def make_env_sfx(phase):
    """เสียงประกอบฉากเปลี่ยนช่วง (ยาวประมาณ 9 วินาที):
    เสียงลมกระโชก + เสียงทุ้มต่ำคำราม ค่อย ๆ ดังขึ้น → เสียงกระแทก "ตูม" ตอนฉากเปลี่ยน (2.8 วิ) →
    เสียงโดรนอึมครึม + ควันฟู่ → ไรเซอร์ไต่ระดับก่อนภาพประกาศช่วงขึ้น · ช่วง 3 หนักและดุกว่า"""
    rng = np.random.default_rng(10 + phase)
    dur = 9.4
    n = int(dur * SR)
    t = np.arange(n) / SR
    hard = phase >= 3
    out = np.zeros((2, n))
    # ลมกระโชก (สเตอริโอ) — ความเข้มลอยขึ้นลงช้า ๆ
    for c in range(2):
        noise = rng.random(n) * 2 - 1
        wind = np.zeros(n)
        seg = 4096
        for k in range(0, n, seg):
            f = 380 + 260 * np.sin(2 * np.pi * 0.13 * (k / SR) + c) + (180 if hard else 0)
            wind[k:k + seg] = bandpass(noise[k:k + seg], f * 0.6, f * 1.8, 1)
        gust = 0.55 + 0.45 * np.sin(2 * np.pi * (0.21 + 0.05 * c) * t + c * 2) ** 2
        out[c] += wind * gust * np.clip(t / 2.5, 0, 1) * (1.0 if not hard else 1.2) * 2.4
    # เสียงทุ้มต่ำคำราม (ซับเบส + ฮาร์มอนิกบีบ) ค่อย ๆ ดังขึ้นจนถึงจุดเปลี่ยนฉาก
    base = 41.2 if not hard else 36.7
    rumble = sum(np.sin(2 * np.pi * base * k * t * (1 + 0.004 * np.sin(2 * np.pi * 0.7 * t))) / k for k in (1, 2, 3, 5))
    rumble *= (0.4 + 0.6 * np.clip(t / 2.8, 0, 1)) * np.where(t < 2.8, 1, np.exp(-(t - 2.8) / 2.5) * 0.6 + 0.4)
    out += rumble * (0.14 if not hard else 0.18)
    # เสียงกระแทก "ตูม" ตอนฉากเปลี่ยน
    at = int(2.8 * SR)
    m = n - at
    tt = np.arange(m) / SR
    f = 30 + 80 * np.exp(-tt / 0.12)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / (0.9 if not hard else 1.3))
    crack = lowpass(rng.random(m) * 2 - 1, 1800) * np.exp(-tt / 0.18)
    for c in range(2):
        out[c, at:] += boom * (0.6 if not hard else 0.75) + crack * (1.3 if not hard else 1.8)
    # โดรนอึมครึมหลังฉากเปลี่ยน (คอร์ดไมเนอร์ต่ำ ๆ ลอยอยู่)
    drone_notes = ['D2', 'A2', 'F3'] if not hard else ['E2', 'B2', 'G3', 'A#3']
    for nn in drone_notes:
        d = pad(hz(nn), dur - 2.8, bright=6, a=1.5, r=1.0)[: n - at]
        for c in range(2):
            out[c, at:at + len(d)] += d * 0.3
    # ไรเซอร์ไต่ระดับ ก่อนภาพประกาศช่วง (ช่วงท้าย 3 วินาที)
    rs = int(3.0 * SR)
    r = swell(3.0, 300, 7000 if hard else 5000)
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (np.arange(rs) / rs * 2)) / SR) * (np.arange(rs) / rs) ** 2
    for c in range(2):
        out[c, n - rs:] += r * 0.7 + tone * 0.3
    # ช่วง 3: ระฆังเตือนภัยตีเป็นจังหวะ
    if hard:
        for b in np.arange(3.6, 8.6, 1.25):
            i0 = int(b * SR)
            bl = bell(hz('E5'), 1.2, index=3.0, ratio=2.76, tau=0.6)[: n - i0]
            out[:, i0:i0 + len(bl)] += bl * 0.22
    out *= np.minimum(1, (n - np.arange(n)) / (0.4 * SR))   # จบนุ่ม ๆ
    out = highpass(out, 25)
    out = np.tanh(out / np.max(np.abs(out)) * 1.6) / np.tanh(1.6) * 0.8
    pcm = (out.T * 32767).astype(np.int16)
    wav = os.path.join(OUT, f'env{phase}.tmp.wav')
    import wave
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    mp3 = os.path.join(ROOT, 'client', 'public', 'audio', f'env{phase}.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '96k', mp3], check=True)
    os.remove(wav)


SONGS = {'menu': song_menu, 'p1': song_p1, 'p2': song_p2, 'p3': song_p3, 'end': song_end}

if __name__ == '__main__':
    import sys
    args = sys.argv[1:]
    meta_path = os.path.join(ROOT, 'client', 'src', 'data', 'music.json')
    if 'deal' in args:
        make_deal()
    if 'env' in args:
        make_env_sfx(2)
        make_env_sfx(3)
    if 'endfx' in args:
        make_end_sfx()
    keys = [a for a in args if a in SONGS] or ([] if args else list(SONGS))
    if keys:
        meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
        for k in keys:
            print('rendering', k, flush=True)
            meta[k] = save_loop(k, SONGS[k]())
        json.dump(meta, open(meta_path, 'w'), indent=2)
    if not args:
        make_deal()
        make_env_sfx(2)
        make_env_sfx(3)
        make_end_sfx()
    print('done')
