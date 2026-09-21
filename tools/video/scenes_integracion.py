# Escenas 1920x1080 del video «MedTopix dentro de la historia clínica».
# Cada escena: (id, narración, [tomas html]). Reutiliza la identidad de scenes.py sin modificarlo.
import random
from scenes import LOGO, CSS as BASE_CSS, foot, ph, bg

CSS = BASE_CSS + """
.ic{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none;vertical-align:-.14em}
.step{display:inline-flex;align-items:center;gap:16px;font-size:26px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c97a20;margin-bottom:22px}
.step i{font-style:normal;width:58px;height:58px;border-radius:50%;background:#0d2818;color:#f0b862;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:32px;letter-spacing:0}
.dark .step{color:#f0b862}.dark .step i{background:#f0b862;color:#0d2818}
/* maqueta genérica de historia clínica: gris azulado, sin marca */
.hce{background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 40px 90px -40px rgba(20,35,50,.55);border:2px solid #cfd8e0;font-size:24px;color:#22303c}
.hce-top{background:#3b4f63;color:#fff;display:flex;align-items:center;gap:18px;padding:18px 28px;font-weight:700;font-size:24px}
.hce-top span{margin-left:auto;font-weight:500;font-size:20px;color:#c5d2de}
.hce-dots{display:flex;gap:8px}.hce-dots b{width:14px;height:14px;border-radius:50%;background:#7e92a5;display:block}
.hce-body{display:grid;grid-template-columns:230px 1fr}
.hce-side{background:#eef2f6;padding:24px 0;border-right:2px solid #dbe3ea}
.hce-side div{padding:13px 26px;font-size:21px;color:#5a6b7b;font-weight:600}
.hce-side div.on{background:#dbe6f0;color:#22303c;border-left:6px solid #3b4f63;padding-left:20px}
.hce-main{padding:26px 32px 30px}
.hce-pt{display:flex;align-items:center;gap:18px;padding-bottom:18px;border-bottom:2px solid #e3e9ee;margin-bottom:20px}
.hce-av{width:64px;height:64px;border-radius:50%;background:#dbe6f0;color:#3b4f63;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px}
.hce-pt b{display:block;font-size:28px}.hce-pt small{font-size:20px;color:#6b7c8c}
.hce-fict{margin-left:auto;font-size:18px;font-weight:700;color:#8a5a12;background:#fdf1dd;border:1.5px solid #f0b862;border-radius:999px;padding:6px 16px;letter-spacing:.04em}
.hce h4{font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:#6b7c8c;margin-bottom:12px}
.hce-rx{display:grid;grid-template-columns:1.5fr 1.3fr .9fr;gap:0;border:2px solid #dbe3ea;border-radius:14px;overflow:hidden}
.hce-rx div{padding:15px 20px;border-bottom:2px solid #e9eef2;font-size:22px}
.hce-rx .h{background:#f3f6f9;font-size:17px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7c8c}
.hce-rx div:nth-last-child(-n+3){border-bottom:0}
.hce-btns{display:flex;gap:14px;margin-top:22px;align-items:center}
.hce-btn{padding:15px 30px;border-radius:12px;font-weight:700;font-size:23px;background:#eef2f6;color:#4a5b6b;border:2px solid #d3dce4}
.hce-btn.go{background:#3b4f63;color:#fff;border-color:#3b4f63;box-shadow:0 0 0 8px rgba(240,184,98,.55)}
.mtx{margin-top:20px;border:3px solid #2d8a4e;border-radius:18px;background:#f0f7f2;padding:18px 24px;display:grid;grid-template-columns:auto 1fr auto;gap:22px;align-items:center}
.mtx-l{display:flex;align-items:center;gap:12px;font-weight:800;color:#1a4a2e;font-size:21px}.mtx-l svg{width:44px;height:44px}
.mtx-n{font-family:'Fraunces',serif;font-weight:900;font-size:66px;line-height:1;color:#c97a20;white-space:nowrap}
.mtx small{display:block;font-size:18px;color:#3d6350;font-weight:600;white-space:nowrap}
/* fórmula impresa */
.paper{background:#fff;border-radius:10px;box-shadow:0 50px 100px -40px rgba(13,40,24,.6);padding:44px 50px;width:760px;color:#22303c;transform:rotate(-1.6deg)}
.paper h5{font-size:21px;letter-spacing:.16em;text-transform:uppercase;color:#6b7c8c;border-bottom:2px solid #dbe3ea;padding-bottom:14px;margin-bottom:20px}
.paper p{font-size:25px;line-height:1.5}
.paper .rx{font-size:30px;font-weight:700;margin:16px 0 4px}
.codebox{margin-top:28px;border:3px dashed #2d8a4e;border-radius:18px;padding:22px 24px;display:flex;gap:26px;align-items:center;background:#f0f7f2}
.codebox small{display:block;font-size:19px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#1e6b3a}
.codebox b{display:block;font-family:ui-monospace,Menlo,monospace;font-size:50px;letter-spacing:.08em;color:#0d2818;margin:4px 0}
.codebox span{font-size:20px;color:#3d6350}
/* diagrama */
.sys{width:520px;border-radius:30px;padding:40px 36px;text-align:center}
.sys svg.big{width:110px;height:110px;margin-bottom:14px}
.sys b{display:block;font-family:'Fraunces',serif;font-size:46px;line-height:1.1}
.sys span{display:block;font-size:26px;margin-top:10px;line-height:1.35}
.pipe{flex:1;display:flex;flex-direction:column;align-items:center;gap:16px}
.pill{background:#fff;color:#0d2818;border-radius:999px;padding:13px 26px;font-size:25px;font-weight:700;display:flex;align-items:center;gap:12px;box-shadow:0 14px 30px -14px rgba(0,0,0,.5)}
.pill .ic{color:#2d8a4e;font-size:28px}
.alertc{background:#fff7ed;border:3px solid #fdba74;border-radius:26px;padding:34px 38px;box-shadow:0 40px 80px -40px rgba(13,40,24,.45)}
.alertc h6{font-size:30px;color:#9a3412;display:flex;align-items:center;gap:14px;margin-bottom:16px;font-weight:800}
.alertc p{font-size:30px;line-height:1.45;color:#22303c}
.alertc small{display:block;margin-top:14px;font-size:22px;color:#6b7c8c}
.need{background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.22);border-radius:28px;padding:34px 36px;flex:1}
.need .ic{font-size:64px;color:#f0b862;margin-bottom:14px}
.need b{display:block;font-family:'Fraunces',serif;font-size:42px;line-height:1.12}
.need span{display:block;font-size:27px;color:#c2f0d1;margin-top:10px;line-height:1.4}
.honest{margin-top:34px;background:#fdf1dd;color:#5b3a0a;border-radius:20px;padding:22px 30px;font-size:29px;font-weight:600;display:flex;gap:16px;align-items:center}
.honest .ic{font-size:40px;color:#c97a20}
"""

def ic(path):
    return f'<svg class="ic" viewBox="0 0 24 24">{path}</svg>'

I_LOCK = ic('<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')
I_KEY = ic('<circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8 20 3M16 7l3 3M13.5 9.5l2 2"/>')
I_CODE = ic('<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/>')
I_BELL = ic('<path d="M6 9.5a6 6 0 0 1 12 0c0 5.5 2.3 7 2.3 7H3.700s2.300-1.500 2.300-7z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>')
I_ALERT = ic('<path d="M12 3.6 2.7 19.6h18.6z"/><path d="M12 10v4.4M12 17.200v.2"/>')
I_CHECK = ic('<circle cx="12" cy="12" r="9"/><path d="m8.3 12.3 2.5 2.5 4.9-5.2"/>')
I_USER = ic('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>')
I_PILL = ic('<rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="m9.2 9.2 5.6 5.6"/>')
I_FILE = '<svg class="big" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 22h8M12 18v4M7 13h6M7 15.500h4"/></svg>'


def qr():
    """QR ilustrativo (no codifica nada): patrón fijo para que el video sea reproducible."""
    rnd = random.Random(7)
    n, c = 25, 8
    cells = ''
    def finder(x, y):
        return (f'<rect x="{x*c}" y="{y*c}" width="{7*c}" height="{7*c}" fill="#0d2818"/>'
                f'<rect x="{(x+1)*c}" y="{(y+1)*c}" width="{5*c}" height="{5*c}" fill="#fff"/>'
                f'<rect x="{(x+2)*c}" y="{(y+2)*c}" width="{3*c}" height="{3*c}" fill="#0d2818"/>')
    for y in range(n):
        for x in range(n):
            if (x < 8 and y < 8) or (x > n - 9 and y < 8) or (x < 8 and y > n - 9):
                continue
            if rnd.random() < 0.47:
                cells += f'<rect x="{x*c}" y="{y*c}" width="{c}" height="{c}" fill="#0d2818"/>'
    return (f'<svg width="200" height="200" viewBox="0 0 {n*c} {n*c}" style="flex:none;background:#fff;border-radius:8px">'
            f'{cells}{finder(0,0)}{finder(n-7,0)}{finder(0,n-7)}</svg>')


def mini_curve(w=360, h=110):
    vals = [88, 84, 80, 71, 62, 55, 52, 58, 61, 60, 64, 62]
    pts = [(10 + i * (w - 20) / (len(vals) - 1), 8 + (100 - v) / 55 * (h - 20)) for i, v in enumerate(vals)]
    line = ' '.join(f'{x:.0f},{y:.0f}' for x, y in pts)
    y80 = 8 + (100 - 80) / 55 * (h - 20)
    return (f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}"><line x1="6" y1="{y80:.0f}" x2="{w-6}" y2="{y80:.0f}" stroke="#c97a20" stroke-width="2.5" stroke-dasharray="8 7"/>'
            f'<polyline points="{line}" fill="none" stroke="#1e6b3a" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="{pts[-1][0]:.0f}" cy="{pts[-1][1]:.0f}" r="8" fill="#fff" stroke="#c97a20" stroke-width="5"/></svg>')


def hce(with_mtx=False, highlight_sign=True):
    extra = ''
    if with_mtx:
        extra = f'''<div class="mtx"><div class="mtx-l">{LOGO}<div>MedTopix<small>caso vinculado</small></div></div>
        <div><small>Adherencia · últimos 30 días</small>{mini_curve(300, 96)}</div>
        <div style="text-align:right"><div class="mtx-n">62 %</div><small>ejemplo de pantalla</small></div></div>'''
    btns = (f'<div class="hce-btns"><div class="hce-btn">Guardar borrador</div><div class="hce-btn{" go" if highlight_sign else ""}">Firmar orden</div></div>'
            if not with_mtx else '')
    return f'''<div class="hce">
 <div class="hce-top"><div class="hce-dots"><b></b><b></b><b></b></div>Historia clínica electrónica<span>maqueta genérica · no representa ningún software real</span></div>
 <div class="hce-body"><div class="hce-side"><div>Resumen</div><div>Consulta</div><div class="on">Ordenamiento</div><div>Laboratorios</div><div>Imágenes</div><div>Evolución</div></div>
 <div class="hce-main">
  <div class="hce-pt"><div class="hce-av">MG</div><div><b>María González</b><small>68 años · Glaucoma primario de ángulo abierto</small></div><div class="hce-fict">Datos ficticios</div></div>
  <h4>Orden de medicamentos</h4>
  <div class="hce-rx"><div class="h">Medicamento</div><div class="h">Posología</div><div class="h">Duración</div>
   <div><b>Timolol 0,5 %</b> · colirio</div><div>1 gota cada 12 horas · vía oftálmica</div><div>30 días</div></div>
  {btns}{extra}
 </div></div></div>'''


S = []

# 1 · apertura
S.append(('i1', "¿Y si MedTopix apareciera justo en el momento en que el médico formula? Así se conecta con la historia clínica.", [
 f'''<body class="dark">{bg('medico-tableta')}<div class="pad" style="align-items:center;text-align:center">
 <div style="width:150px;height:150px;border-radius:38px;background:#f0f7f2;padding:12px;margin-bottom:34px">{LOGO}</div>
 <div class="tag" style="justify-content:center">Integración</div>
 <h1 style="font-size:100px;max-width:1500px">MedTopix <em>dentro</em> de la historia clínica</h1>
 <p class="sub" style="max-width:1200px;font-size:40px">Que aparezca justo cuando el médico formula.</p></div>{foot(1)}</body>''']))

# 2 · hoy
S.append(('i2', "Hoy el médico formula, el paciente se va para su casa, y nadie sabe si cumplió hasta el próximo control.", [
 f'''<body><div class="pad"><div class="cols" style="grid-template-columns:900px 1fr;gap:70px">
 {ph('consulta-doctora', 900, 620, pos='center 35%')}
 <div><div class="tag">Hoy</div><h1 style="font-size:80px">Se formula, el paciente se va… y <em>nadie sabe</em> si cumplió</h1>
 <p class="sub" style="font-size:34px">Hasta el próximo control, semanas o meses después.</p></div>
 </div></div>{foot(2)}</body>''']))

# 3 · paso 1
S.append(('i3', "Paso uno. El médico no cambia nada: formula y firma la orden en su historia clínica de siempre.", [
 f'''<body><div class="pad" style="padding-top:70px"><div class="cols" style="grid-template-columns:500px 1fr;gap:54px">
 <div><div class="step"><i>1</i>Paso uno</div><h1 style="font-size:70px">El médico <em>no cambia nada</em></h1>
 <p class="sub" style="font-size:33px">Formula y firma en su historia clínica de siempre.</p></div>
 {hce()}
 </div></div>{foot(3)}</body>''']))

# 4 · paso 2
S.append(('i4', "Paso dos. Al firmar, la historia clínica le avisa a MedTopix, sola: le envía el paciente y el tratamiento por una conexión segura, con una llave que el médico puede revocar. Nadie digita dos veces.", [
 f'''<body class="dark"><div class="pad"><div class="step"><i>2</i>Paso dos</div>
 <h1 style="font-size:78px">La historia clínica le avisa a MedTopix, <em>sola</em></h1>
 <div style="display:flex;align-items:center;gap:30px;margin-top:54px">
  <div class="sys" style="background:#eef2f6;color:#22303c">{I_FILE}<b>Historia clínica</b><span style="color:#5a6b7b">el médico firma la orden</span></div>
  <div class="pipe"><div class="pill">{I_USER} el paciente</div><div class="pill">{I_PILL} el tratamiento</div>
   <svg width="100%" height="46" viewBox="0 0 600 46" preserveAspectRatio="none"><path d="M0 23h570" stroke="#f0b862" stroke-width="6" stroke-dasharray="18 12"/><path d="m560 6 30 17-30 17" fill="none" stroke="#f0b862" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>
   <div class="pill" style="background:#f0b862">{I_LOCK.replace('class="ic"','class="ic" style="color:#0d2818"')} conexión segura con llave</div></div>
  <div class="sys" style="background:#f0f7f2;color:#0d2818"><div style="width:110px;height:110px;margin:0 auto 14px">{LOGO}</div><b>MedTopix</b><span style="color:#3d6350">crea el caso, sin digitar dos veces</span></div>
 </div></div>{foot(4)}</body>''',
 f'''<body class="dark"><div class="pad"><div class="cols" style="grid-template-columns:1fr 1fr;gap:70px">
 <div><div class="step"><i>2</i>Paso dos</div><h1 style="font-size:84px">Nadie digita <em>dos veces</em></h1>
 <ul class="k"><li>El paciente y el tratamiento viajan solos</li><li>La llave la crea el médico en MedTopix</li><li>Puede revocarla cuando quiera</li></ul></div>
 <div style="background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.22);border-radius:30px;padding:46px 44px">
  <div style="font-size:24px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f0b862">Llave de integración</div>
  <div style="display:flex;align-items:center;gap:22px;margin-top:22px"><span style="font-size:74px;color:#f0b862">{I_KEY}</span>
  <div style="font-family:ui-monospace,Menlo,monospace;font-size:44px;letter-spacing:.06em">mtx_7f3a••••••••</div></div>
  <div style="display:flex;gap:16px;margin-top:30px"><div class="pill">{I_CHECK} Activa</div><div class="pill" style="background:transparent;color:#fff;border:2px solid rgba(255,255,255,.4);box-shadow:none">Revocar</div></div>
  <p style="font-size:23px;color:#8fdeaa;margin-top:24px">Ejemplo ilustrativo · la llave real solo se muestra una vez</p></div>
 </div></div>{foot(4)}</body>''']))

# 5 · paso 3
S.append(('i5', "Paso tres. La fórmula sale impresa con el código del caso y un código QR. El paciente lo escanea, activa MedTopix en su celular y empieza a recibir sus recordatorios.", [
 f'''<body><div class="pad"><div class="cols" style="grid-template-columns:1fr 800px;gap:60px">
 <div><div class="step"><i>3</i>Paso tres</div><h1 style="font-size:80px">La fórmula sale con <em>un código</em></h1>
 <p class="sub" style="font-size:33px">MedTopix le devuelve a la historia clínica el código del caso, y ella lo imprime.</p></div>
 <div class="paper"><h5>Fórmula médica · datos ficticios</h5><p>Paciente: <b>María González</b></p>
  <p class="rx">Timolol 0,5 % colirio</p><p>1 gota cada 12 horas · vía oftálmica · 30 días</p>
  <div class="codebox">{qr()}<div><small>Active sus recordatorios</small><b>VH4L-P3PY</b><span>Escanee el código o entre a medtopix.vercel.app/app</span></div></div></div>
 </div></div>{foot(5)}</body>''',
 f'''<body><div class="pad"><div class="cols" style="grid-template-columns:860px 1fr;gap:70px">
 {ph('paciente-celular', 860, 600, pos='center 30%')}
 <div><div class="step"><i>3</i>Paso tres</div><h1 style="font-size:80px">El paciente lo escanea y <em>empieza</em></h1>
 <ul class="k"><li>Activa MedTopix en su celular</li><li>Recibe el aviso de cada dosis</li><li>Registra con un toque</li></ul></div>
 </div></div>{foot(5)}</body>''']))

# 6 · paso 4
S.append(('i6', "Paso cuatro. En el próximo control, la adherencia ya está ahí, en la misma pantalla donde se formula. Así el médico distingue un tratamiento que no funciona de uno que no se está cumpliendo.", [
 f'''<body><div class="pad" style="padding-top:64px"><div class="cols" style="grid-template-columns:480px 1fr;gap:50px">
 <div><div class="step"><i>4</i>Paso cuatro</div><h1 style="font-size:64px">En el próximo control, la adherencia <em>está ahí</em></h1>
 <p class="sub" style="font-size:31px">En la misma pantalla donde se formula.</p></div>
 {hce(with_mtx=True)}
 </div></div>{foot(6)}</body>''',
 f'''<body class="dark"><div class="pad"><div class="cols" style="grid-template-columns:1fr 760px;gap:70px">
 <div><div class="step"><i>4</i>Paso cuatro</div><h1 style="font-size:82px">¿El tratamiento <em>no funciona</em>… o no se está <em>cumpliendo</em>?</h1>
 <p class="sub" style="font-size:34px">Con el dato a la vista, la decisión sigue siendo del médico.</p></div>
 <div class="card" style="color:#0d2818"><div style="font-size:23px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6b9278">Adherencia últimos 30 días</div>
  <div style="display:flex;align-items:flex-end;gap:24px;margin:10px 0 8px"><div style="font-family:'Fraunces',serif;font-weight:900;font-size:170px;line-height:.95;color:#c97a20">62 %</div></div>
  {mini_curve(660, 170)}<p style="font-size:22px;color:#6b9278;margin-top:10px">Ejemplo de pantalla · datos ficticios, no es un resultado</p></div>
 </div></div>{foot(6)}</body>''']))

# 7 · aviso
S.append(('i7', "Y si el paciente deja de cumplir, por ejemplo dos dosis seguidas, el equipo tratante recibe un aviso.", [
 f'''<body><div class="pad"><div class="cols" style="grid-template-columns:1fr 820px;gap:70px">
 <div><div class="tag">Y si deja de cumplir</div><h1 style="font-size:84px">El equipo tratante <em>recibe un aviso</em></h1>
 <p class="sub" style="font-size:33px">Con una regla por tratamiento, para no saturar al médico.</p></div>
 <div class="alertc"><h6>{I_BELL} MedTopix · dosis sin cumplir</h6>
  <p><b>María González:</b> dos dosis seguidas sin cumplir de Timolol 0,5 % (última: 20:00).</p>
  <small>Ejemplo de aviso · datos ficticios</small></div>
 </div></div>{foot(7)}</body>''']))

# 8 · cierre
S.append(('i8', "¿Qué se necesita? Una llave creada en MedTopix y unas horas de un desarrollador de la historia clínica. Es un prototipo: todavía no se ha probado con una historia clínica real. Más en medtopix punto vercel punto app, barra integración.", [
 f'''<body class="dark"><div class="pad"><div class="tag">Qué se necesita</div><h1 style="font-size:84px">Dos cosas, <em>nada más</em></h1>
 <div style="display:flex;gap:36px;margin-top:44px">
  <div class="need">{I_KEY}<b>Una llave</b><span>La crea el médico en MedTopix, en Mi cuenta.</span></div>
  <div class="need">{I_CODE}<b>Unas horas de desarrollo</b><span>De quien mantiene el sistema de historia clínica.</span></div></div>
 <div class="honest">{I_ALERT}<span>MedTopix es un prototipo: todavía no se ha probado con una historia clínica real.</span></div>
 </div>{foot(8)}</body>''',
 f'''<body class="dark">{bg('consulta-equipo')}<div class="pad" style="align-items:center;text-align:center">
 <div style="width:130px;height:130px;border-radius:34px;background:#f0f7f2;padding:10px;margin-bottom:30px">{LOGO}</div>
 <h1 style="font-size:88px;max-width:1500px">Que aparezca justo cuando <em>el médico formula</em></h1>
 <div style="margin-top:50px;background:#f0b862;color:#0d2818;border-radius:22px;padding:22px 50px;font-size:50px;font-weight:800">medtopix.vercel.app/integracion</div>
 </div><div class="cred">Fotografías ilustrativas de licencia libre · pantallas de ejemplo con datos ficticios</div>{foot(8)}</body>''']))

SCENES = S
# fracción del tiempo de la escena que ocupa la primera toma
SPLIT = {'i4': 0.58, 'i5': 0.52, 'i6': 0.50, 'i8': 0.72}


def page(body):
    return f'<!doctype html><html lang="es"><head><meta charset="utf-8"><style>{CSS}</style></head>{body}</html>'
