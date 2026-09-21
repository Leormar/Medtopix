#!/usr/bin/env python3
"""Video «MedTopix dentro de la historia clínica». Mismo pipeline que build_video.py, con las escenas de
scenes_integracion.py. Los temporales (html, png, audio, seg) van a WORK, fuera del repositorio.
Uso: <venv>/bin/python build_integracion.py   (env: VOZ, RATE, OUT, POSTER, POSTER_SHOT, WORK, VENV, STAGE=png|all)"""
import os, subprocess, sys, json, wave
import numpy as np
from scenes_integracion import SCENES, SPLIT, page

SCRATCH = '/private/tmp/claude-501/-Users-leo/8fc48d75-f468-412b-b688-7b2370a09d37/scratchpad'
HERE = os.environ.get('WORK', os.path.join(SCRATCH, 'medtopix-video-int'))   # carpeta de trabajo
VENV = os.environ.get('VENV', os.path.join(SCRATCH, 'medtopix-video', 'venv'))  # venv con edge-tts y numpy
VOZ = os.environ.get('VOZ', 'es-CO-SalomeNeural')
RATE = os.environ.get('RATE', '+7%')
OUT = os.environ.get('OUT', '/Users/leo/Medtopix/video/integracion.mp4')
POSTER = os.environ.get('POSTER', '/Users/leo/Medtopix/img/integracion-poster.jpg')
STAGE = os.environ.get('STAGE', 'all')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
FPS, LEAD, TAIL, FADE = 30, 0.5, 0.6, 0.4
for d in ('html', 'png', 'audio', 'seg'):
    os.makedirs(os.path.join(HERE, d), exist_ok=True)

def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.exit('FALLO: ' + ' '.join(cmd[:4]) + '\n' + r.stderr[-1500:])
    return r.stdout

def dur(path):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).strip())

# 1. Tomas -> PNG 3840x2160 (escala 2x para que el zoompan no tiemble)
for sid, _, shots in SCENES:
    for k, body in enumerate(shots):
        name = f'{sid}_{k}'
        h = os.path.join(HERE, 'html', name + '.html')
        open(h, 'w', encoding='utf-8').write(page(body))
        png = os.path.join(HERE, 'png', name + '.png')
        run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
             '--allow-file-access-from-files', '--window-size=1920,1080', '--virtual-time-budget=8000', '--screenshot=' + png, 'file://' + h])
        print('png', name)
if STAGE == 'png':
    sys.exit(0)

# 2. Narración
durs = []
for sid, text, _ in SCENES:
    mp3 = os.path.join(HERE, 'audio', sid + '.mp3')
    if not os.path.exists(mp3):
        run([os.path.join(VENV, 'bin/edge-tts'), '--voice', VOZ, '--rate=' + RATE, '--text', text, '--write-media', mp3])
    durs.append(dur(mp3))
seg_d = [round(LEAD + d + TAIL, 3) for d in durs]
total = sum(seg_d)
print('duraciones', seg_d, 'total', round(total, 1))

# 3. Pista de voz completa (cada voz con su retraso dentro del segmento)
voice = os.path.join(HERE, 'audio', 'voice.wav')
inputs, filt, t = [], [], 0.0
for i, (sid, _, _) in enumerate(SCENES):
    inputs += ['-i', os.path.join(HERE, 'audio', sid + '.mp3')]
    ms = int((t + LEAD) * 1000)
    filt.append(f'[{i}:a]aresample=48000,adelay={ms}|{ms}[v{i}]')
    t += seg_d[i]
filt.append(''.join(f'[v{i}]' for i in range(len(SCENES))) + f'amix=inputs={len(SCENES)}:normalize=0,apad,atrim=0:{total},volume=1.6[out]')
run(['ffmpeg', '-y', *inputs, '-filter_complex', ';'.join(filt), '-map', '[out]', '-ac', '2', '-ar', '48000', voice])

# 4. Música: pad + arpegio suave, Am7 · Fmaj7 · Cmaj7 · G a 84 BPM
SR = 48000
bpm = 84; beat = 60 / bpm; bar = 4 * beat
CH = [[220.00, 261.63, 329.63, 392.00], [174.61, 220.00, 261.63, 329.63],
      [130.81, 164.81, 196.00, 246.94], [196.00, 246.94, 293.66, 392.00]]
n = int((total + 1) * SR)
tt = np.arange(n) / SR
mus = np.zeros(n)
nbars = int(np.ceil((total + 1) / bar))
for b in range(nbars):
    ch = CH[b % 4]
    s, e = int(b * bar * SR), min(int((b + 1) * bar * SR), n)
    if s >= n: break
    lt = tt[s:e] - b * bar
    env = np.minimum(1, lt / 0.9) * np.minimum(1, (bar - lt) / 0.9)
    pad = sum(np.sin(2 * np.pi * f * lt) + 0.35 * np.sin(2 * np.pi * 2 * f * lt + .3) + 0.5 * np.sin(2 * np.pi * f * 1.004 * lt) for f in ch)
    mus[s:e] += 0.05 * pad * env
    mus[s:e] += 0.10 * np.sin(2 * np.pi * (ch[0] / 2) * lt) * env          # bajo
    order = [0, 2, 1, 3, 2, 3, 1, 2]
    for k in range(8):                                                     # arpegio en corcheas
        a = s + int(k * beat / 2 * SR); z = min(a + int(0.9 * SR), n)
        if a >= n: break
        at = np.arange(z - a) / SR
        f = ch[order[k]] * 2
        mus[a:z] += 0.06 * np.sin(2 * np.pi * f * at) * np.exp(-at * 4.2) * np.minimum(1, at / 0.01)
# eco sencillo + fades
dly = int(0.357 * SR); echo = np.zeros(n); echo[dly:] = mus[:-dly] * 0.3; mus += echo
fi, fo = int(2 * SR), int(3 * SR)
mus[:fi] *= np.linspace(0, 1, fi); mus[-fo:] *= np.linspace(1, 0, fo)
mus = mus / np.max(np.abs(mus)) * 0.55
st = np.stack([mus, np.roll(mus, int(0.011 * SR))], axis=1)
music = os.path.join(HERE, 'audio', 'music.wav')
with wave.open(music, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())

# 5. Mezcla con ducking
mix = os.path.join(HERE, 'audio', 'mix.m4a')
run(['ffmpeg', '-y', '-i', music, '-i', voice, '-filter_complex',
     '[1:a]asplit=2[vk][vm];[0:a][vk]sidechaincompress=threshold=0.02:ratio=9:attack=25:release=450[duck];'
     f'[duck]volume=0.85[m];[m][vm]amix=inputs=2:normalize=0,alimiter=limit=0.95,atrim=0:{total}[out]',
     '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', mix])

# 6. Segmentos de video: cada toma con zoompan; las tomas de una misma escena se funden entre sí (xfade)
XF = 0.7
def shot_clip(png, d, idx, out, fin, fout):
    fr = int(round(d * FPS))
    z = "min(1+0.06*on/%d,1.06)" % fr if idx % 2 == 0 else "max(1.06-0.06*on/%d,1)" % fr
    vf = f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={fr}:s=1920x1080:fps={FPS}"
    if fin: vf += f",fade=t=in:st=0:d={FADE}"
    if fout: vf += f",fade=t=out:st={d - FADE:.3f}:d={FADE}"
    run(['ffmpeg', '-y', '-loop', '1', '-i', png, '-vf', vf + ',format=yuv420p', '-frames:v', str(fr),
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', str(FPS), out])

lst = os.path.join(HERE, 'seg', 'list.txt'); n_shot = 0; marks = []; t0 = 0.0
with open(lst, 'w') as f:
    for i, (sid, _, shots) in enumerate(SCENES):
        d = seg_d[i]; seg = os.path.join(HERE, 'seg', sid + '.mp4')
        if len(shots) == 1:
            shot_clip(os.path.join(HERE, 'png', sid + '_0.png'), d, n_shot, seg, True, True); n_shot += 1
            marks.append((sid + '_0', t0 + d / 2))
        else:
            d1 = round(d * SPLIT[sid] + XF / 2, 3); d2 = round(d - d1 + XF, 3)
            a, b2 = os.path.join(HERE, 'seg', sid + '_0.mp4'), os.path.join(HERE, 'seg', sid + '_1.mp4')
            shot_clip(os.path.join(HERE, 'png', sid + '_0.png'), d1, n_shot, a, True, False); n_shot += 1
            shot_clip(os.path.join(HERE, 'png', sid + '_1.png'), d2, n_shot, b2, False, True); n_shot += 1
            run(['ffmpeg', '-y', '-i', a, '-i', b2, '-filter_complex',
                 f'[0:v][1:v]xfade=transition=fade:duration={XF}:offset={d1 - XF:.3f},format=yuv420p[v]', '-map', '[v]',
                 '-frames:v', str(int(round(d * FPS))), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', str(FPS), seg])
            marks.append((sid + '_0', t0 + (d1 - XF) / 2)); marks.append((sid + '_1', t0 + d1 + (d2 - XF) / 2))
        t0 += d
        f.write(f"file '{seg}'\n"); print('seg', sid, d)
json.dump(marks, open(os.path.join(HERE, 'marks.json'), 'w'))

# 7. Concat + mux
os.makedirs(os.path.dirname(OUT), exist_ok=True); os.makedirs(os.path.dirname(POSTER), exist_ok=True)
run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-i', mix, '-map', '0:v', '-map', '1:a',
     '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-shortest',
     '-movflags', '+faststart', OUT])
run(['ffmpeg', '-y', '-i', os.path.join(HERE, 'png', os.environ.get('POSTER_SHOT', 'i3_0') + '.png'), '-vf', 'scale=1920:1080', '-q:v', '3', POSTER])
print(json.dumps({'out': OUT, 'dur': dur(OUT), 'mb': round(os.path.getsize(OUT) / 1e6, 2), 'voz': VOZ}))
