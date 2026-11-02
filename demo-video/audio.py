"""Audio for the demo videos: narration with Kokoro (an open text-to-speech model, Apache 2.0), a music
bed synthesised here from scratch, and the final mix with the music ducked under the voice.

  python3 audio.py tts  <in.json> <out.json>     # in: {"voice","speed","texts":[...]}; out: [{"wav","seconds"}]
  python3 audio.py mix  <in.json> <out.wav>      # in: {"segments":[{"wav","start"}], "total", "music":{...}}

Kokoro's model files (kokoro-v1.0.onnx, voices-v1.0.bin) are read from $KOKORO_DIR.
"""
import hashlib, json, os, sys
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
CACHE = os.environ.get('TTS_CACHE', '/tmp/demo-tts-cache')


# ---------------------------------------------------------------- narration
def tts(cfg_path, out_path):
    cfg = json.load(open(cfg_path))
    voice, speed = cfg.get('voice', 'af_heart'), float(cfg.get('speed', 1.05))
    os.makedirs(CACHE, exist_ok=True)
    kokoro = None
    out = []
    for text in cfg['texts']:
        key = hashlib.sha1(f'{voice}|{speed}|{text}'.encode()).hexdigest()[:16]
        path = os.path.join(CACHE, key + '.wav')
        if not os.path.exists(path):
            if kokoro is None:
                from kokoro_onnx import Kokoro
                d = os.environ['KOKORO_DIR']
                kokoro = Kokoro(os.path.join(d, 'kokoro-v1.0.onnx'), os.path.join(d, 'voices-v1.0.bin'))
            samples, sr = kokoro.create(text, voice=voice, speed=speed, lang='en-us')
            x = signal.resample_poly(samples.astype(np.float64), SR, sr)
            x = trim(x)
            # Even out the level from line to line: RMS to about -19 dBFS, peaks under -2 dBFS.
            rms = np.sqrt(np.mean(x ** 2)) + 1e-9
            x *= 10 ** (-19 / 20) / rms
            peak = np.max(np.abs(x))
            if peak > 0.79:
                x *= 0.79 / peak
            sf.write(path, x.astype(np.float32), SR, subtype='PCM_16')
        info = sf.info(path)
        out.append({'wav': path, 'seconds': round(info.frames / info.samplerate, 3)})
    json.dump(out, open(out_path, 'w'), indent=1)


def trim(x, thresh=0.004):
    idx = np.where(np.abs(x) > thresh)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(0.03 * SR)), min(len(x), idx[-1] + int(0.12 * SR))
    return x[a:b]


# ---------------------------------------------------------------- music
NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def chord_notes(name, octave=4):
    """'Am' -> midi notes of a minor triad plus the seventh, voiced around middle C."""
    minor = name.endswith('m')
    root = NOTE[name[:-1] if minor else name] + 12 * (octave + 1)
    return [root, root + (3 if minor else 4), root + 7, root + (10 if minor else 11)]


def saw(f, t, harmonics=16):
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        if f * k > 9000:
            break
        out += np.sin(2 * np.pi * f * k * t) / k
    return out


def lowpass(x, cutoff, order=2):
    b, a = signal.butter(order, cutoff / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def highpass(x, cutoff, order=2):
    b, a = signal.butter(order, cutoff / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)


def music(seconds, bpm=112, chords=('Am', 'F', 'C', 'G'), seed=1):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    L = np.zeros(n); R = np.zeros(n)
    beat = 60.0 / bpm
    bar = beat * 4

    def place(buf, start, x, gain=1.0):
        i = int(start * SR)
        if i >= n:
            return
        j = min(n, i + len(x))
        buf[i:j] += x[: j - i] * gain

    # one-shot drums
    tk = np.arange(int(0.42 * SR)) / SR
    pitch = 46 + 110 * np.exp(-tk * 38)
    kick = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-tk * 9.5)
    kick += 0.35 * np.exp(-tk * 400) * rng.uniform(-1, 1, len(tk))
    kick = np.tanh(kick * 1.6) * 0.9
    tc = np.arange(int(0.25 * SR)) / SR
    clap = np.zeros(len(tc))
    for off in (0, 0.011, 0.022):
        noise = rng.uniform(-1, 1, len(tc))
        env = np.where(tc >= off, np.exp(-(tc - off) * (55 if off < 0.02 else 22)), 0)
        clap += noise * env
    clap = bandpass(clap, 900, 3500) * 0.8
    th = np.arange(int(0.08 * SR)) / SR
    hat = highpass(rng.uniform(-1, 1, len(th)), 7000, 4) * np.exp(-th * 60)
    hat_open = highpass(rng.uniform(-1, 1, int(0.2 * SR)), 6500, 4) * np.exp(-np.arange(int(0.2 * SR)) / SR * 18)

    # sidechain: the pad and bass dip on every kick ("pumping")
    t_all = np.arange(n) / SR
    phase = (t_all % beat) / beat
    pump = 0.35 + 0.65 * np.clip(phase / 0.45, 0, 1) ** 0.8

    bars = int(np.ceil(seconds / bar))
    pad = np.zeros(n); pad_r = np.zeros(n); bass = np.zeros(n)
    for b in range(bars):
        name = chords[b % len(chords)]
        t0 = b * bar
        seg_n = int(bar * SR)
        t = np.arange(seg_n) / SR
        env = np.minimum(1, t / 0.04) * np.minimum(1, (bar - t) / 0.08)
        notes = chord_notes(name, 4)
        left = sum(saw(hz(m) * 1.003, t, 12) for m in notes) * env
        right = sum(saw(hz(m) * 0.997, t, 12) for m in notes) * env
        place(pad, t0, left); place(pad_r, t0, right)
        # bass: off-beat eighth notes on the root
        root = hz(chord_notes(name, 2)[0])
        tb = np.arange(int(beat * 0.5 * SR)) / SR
        note = (np.sin(2 * np.pi * root * tb) + 0.25 * np.sin(4 * np.pi * root * tb)) * np.exp(-tb * 5) * np.minimum(1, tb / 0.005)
        for q in range(4):
            place(bass, t0 + q * beat + beat * 0.5, note)
        for q in range(4):
            place(L, t0 + q * beat, kick, 0.9); place(R, t0 + q * beat, kick, 0.9)
            if q in (1, 3):
                place(L, t0 + q * beat, clap, 0.5); place(R, t0 + q * beat, clap, 0.42)
            place(L, t0 + q * beat + beat * 0.5, hat_open, 0.11); place(R, t0 + q * beat + beat * 0.5, hat_open, 0.15)
            for s16 in (0.25, 0.75):
                place(L, t0 + q * beat + beat * s16, hat, 0.06); place(R, t0 + q * beat + beat * s16, hat, 0.08)
    pad = lowpass(pad, 1600) * pump * 0.06
    pad_r = lowpass(pad_r, 1600) * pump * 0.06
    bass = np.tanh(bass * 1.4) * pump * 0.32
    L += pad + bass
    R += pad_r + bass
    # first bar filtered, then the drop
    sweep = np.clip(t_all / bar, 0, 1)
    if seconds > bar:
        Lf, Rf = lowpass(L, 500), lowpass(R, 500)
        L = Lf * (1 - sweep) + L * sweep
        R = Rf * (1 - sweep) + R * sweep
    return np.stack([L, R], axis=1)


# ---------------------------------------------------------------- mix
def mix(cfg_path, out_path):
    cfg = json.load(open(cfg_path))
    total = float(cfg['total'])
    n = int(total * SR) + SR
    voice = np.zeros(n)
    for s in cfg['segments']:
        x, sr = sf.read(s['wav'])
        if x.ndim > 1:
            x = x.mean(axis=1)
        i = int(float(s['start']) * SR)
        j = min(n, i + len(x))
        voice[i:j] += x[: j - i]
    m = cfg.get('music', {})
    bed = music(n / SR, bpm=m.get('bpm', 112), chords=tuple(m.get('chords', ['Am', 'F', 'C', 'G'])), seed=m.get('seed', 1))
    bed = np.pad(bed[:n], ((0, max(0, n - len(bed))), (0, 0)))  # rounding can leave it a sample short
    # The bed sits well under the voice: about -25 dBFS RMS before ducking (the voice is about -19).
    bed *= 10 ** (float(m.get('level_db', -25)) / 20) / (np.sqrt(np.mean(bed ** 2)) + 1e-9)
    # duck the music under the voice with a smooth envelope
    env = np.abs(voice)
    win = int(0.25 * SR)
    env = np.convolve(env, np.ones(win) / win, mode='same')
    duck = 1 - 0.55 * np.clip(env / 0.03, 0, 1)
    duck = np.convolve(duck, np.ones(int(0.12 * SR)) / int(0.12 * SR), mode='same')
    bed *= duck[:, None] * float(m.get('gain', 1.0))
    # fades
    fin, fout = int(0.6 * SR), int(1.4 * SR)
    bed[:fin] *= np.linspace(0, 1, fin)[:, None]
    bed[-fout:] *= np.linspace(1, 0, fout)[:, None]
    out = bed + voice[:, None]
    # gentle master: level, then a soft limiter
    peak = np.max(np.abs(out)) + 1e-9
    out *= min(1.0, 0.97 / peak) * 1.15
    out = np.tanh(out * 1.05) * 0.93
    sf.write(out_path, out.astype(np.float32), SR, subtype='PCM_16')
    rms_voice = 20 * np.log10(np.sqrt(np.mean(voice[voice != 0] ** 2)) + 1e-9) if np.any(voice) else -99
    rms_bed = 20 * np.log10(np.sqrt(np.mean(bed ** 2)) + 1e-9)
    print(json.dumps({'seconds': round(n / SR, 2), 'peak': round(float(np.max(np.abs(out))), 3), 'voice_rms_db': round(float(rms_voice), 1), 'music_rms_db': round(float(rms_bed), 1)}))


if __name__ == '__main__':
    {'tts': tts, 'mix': mix}[sys.argv[1]](sys.argv[2], sys.argv[3])
