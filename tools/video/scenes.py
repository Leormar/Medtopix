# Escenas 1920x1080 del video MedTopix. Cada escena: (id, narración, html del cuerpo)
LOGO = '''<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<circle cx="50" cy="58" r="36" fill="#1a4a2e"/><circle cx="50" cy="58" r="30" fill="#f0f7f2" stroke="#2d8a4e" stroke-width="2"/>
<line x1="50" y1="30" x2="50" y2="36" stroke="#1e6b3a" stroke-width="2.5" stroke-linecap="round"/><line x1="50" y1="80" x2="50" y2="86" stroke="#1e6b3a" stroke-width="2.5" stroke-linecap="round"/>
<line x1="22" y1="58" x2="28" y2="58" stroke="#1e6b3a" stroke-width="2.5" stroke-linecap="round"/><line x1="72" y1="58" x2="78" y2="58" stroke="#1e6b3a" stroke-width="2.5" stroke-linecap="round"/>
<line x1="50" y1="58" x2="50" y2="38" stroke="#1a4a2e" stroke-width="3" stroke-linecap="round"/><line x1="50" y1="58" x2="64" y2="65" stroke="#c97a20" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="50" cy="58" r="3.5" fill="#1a4a2e"/><ellipse cx="36" cy="26" rx="8" ry="5" fill="#f0b862"/><ellipse cx="64" cy="26" rx="8" ry="5" fill="#f0b862"/>
<line x1="36" y1="30" x2="36" y2="36" stroke="#c97a20" stroke-width="2" stroke-linecap="round"/><line x1="64" y1="30" x2="64" y2="36" stroke="#c97a20" stroke-width="2" stroke-linecap="round"/></svg>'''

CSS = '''
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:wght@700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden}
body{font-family:'Plus Jakarta Sans',sans-serif;color:#0d2818;background:#f0f7f2;position:relative}
body.dark{background:radial-gradient(1200px 800px at 78% 20%,#1e6b3a 0%,#1a4a2e 38%,#0d2818 100%);color:#fff}
.pad{position:absolute;inset:0;padding:96px 120px;display:flex;flex-direction:column;justify-content:center}
.tag{display:flex;align-items:center;gap:18px;font-size:26px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#c97a20;margin-bottom:28px}
.tag::before{content:'';width:60px;height:3px;background:#f0b862}
.dark .tag{color:#f0b862}
h1{font-family:'Fraunces',serif;font-weight:900;font-size:92px;line-height:1.05;letter-spacing:-.01em}
h1 em{font-style:normal;color:#c97a20}.dark h1 em{color:#f0b862}
p.sub{font-size:38px;line-height:1.45;color:#3d6350;margin-top:30px;max-width:1300px}
.dark p.sub{color:#c2f0d1}
.foot{position:absolute;left:120px;right:120px;bottom:54px;display:flex;justify-content:space-between;align-items:center;font-size:22px;color:#6b9278;font-weight:600}
.dark .foot{color:#8fdeaa}
.foot .mk{display:flex;align-items:center;gap:12px}.foot .mk svg{width:40px;height:40px}
.foot b{color:#1a4a2e}.dark .foot b{color:#fff}
.cols{display:grid;grid-template-columns:1.05fr .95fr;gap:80px;align-items:center}
.card{background:#fff;border:2px solid #c8e6d0;border-radius:28px;box-shadow:0 30px 70px -30px rgba(13,40,24,.35);padding:36px 40px}
.btn{border-radius:18px;padding:22px 26px;font-size:30px;font-weight:700;display:flex;align-items:center;gap:16px}
.b-yes{background:#e8f8ee;color:#1e6b3a;border:2px solid #8fdeaa}
.b-late{background:#fdf1dd;color:#9a5a12;border:2px solid #f0b862}
.b-no{background:#fdeaea;color:#b91c1c;border:2px solid #f5b5b5}
.dot{width:22px;height:22px;border-radius:50%;flex-shrink:0}
ul.k{list-style:none;margin-top:34px}
ul.k li{font-size:34px;line-height:1.4;padding:12px 0 12px 52px;position:relative;color:#1a4a2e}
.dark ul.k li{color:#e8f8ee}
ul.k li::before{content:'';position:absolute;left:4px;top:28px;width:22px;height:22px;border-radius:50%;background:#c97a20}
.dark ul.k li::before{background:#f0b862}
'''

def foot(n, dark=False):
    return f'<div class="foot"><div class="mk">{LOGO}<b>MedTopix</b></div><span>Trabajo final de la Maestría en Salud Digital e IA · OBS Business School</span></div>'

def people_row():
    out = ''
    for i in range(10):
        fill = '#f0b862' if i < 5 else 'rgba(255,255,255,.18)'
        out += f'<svg width="92" height="150" viewBox="0 0 46 75"><circle cx="23" cy="13" r="11" fill="{fill}"/><path d="M5 72V42c0-10 8-16 18-16s18 6 18 16v30z" fill="{fill}"/></svg>'
    return out

def curve():
    # datos ilustrativos: 12 semanas
    vals = [92, 90, 88, 91, 84, 76, 68, 61, 58, 72, 83, 89]
    W, H, x0, y0 = 1000, 420, 80, 30
    pts = []
    for i, v in enumerate(vals):
        x = x0 + i * (W - x0 - 30) / (len(vals) - 1)
        y = y0 + (100 - v) / 60 * (H - y0 - 60)
        pts.append((x, y))
    line = ' '.join(f'{x:.0f},{y:.0f}' for x, y in pts)
    area = f'{pts[0][0]:.0f},{H-60} ' + line + f' {pts[-1][0]:.0f},{H-60}'
    grid = ''
    for v in (100, 80, 60, 40):
        y = y0 + (100 - v) / 60 * (H - y0 - 60)
        grid += f'<line x1="{x0}" y1="{y:.0f}" x2="{W-30}" y2="{y:.0f}" stroke="#e1efe5" stroke-width="2"/><text x="{x0-16}" y="{y+8:.0f}" text-anchor="end" font-size="22" fill="#6b9278">{v}%</text>'
    dots = ''
    for i, (x, y) in enumerate(pts):
        c = '#dc2626' if vals[i] < 65 else ('#c97a20' if vals[i] < 80 else '#2d8a4e')
        dots += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="9" fill="#fff" stroke="{c}" stroke-width="5"/>'
    labels = ''.join(f'<text x="{pts[i][0]:.0f}" y="{H-22}" text-anchor="middle" font-size="20" fill="#6b9278">S{i+1}</text>' for i in range(0, 12))
    yb = y0 + (100 - 80) / 60 * (H - y0 - 60)
    return f'''<svg viewBox="0 0 {W} {H}" width="100%" style="font-family:'Plus Jakarta Sans',sans-serif;display:block">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3aaa63" stop-opacity=".35"/><stop offset="1" stop-color="#3aaa63" stop-opacity="0"/></linearGradient></defs>
    {grid}<line x1="{x0}" y1="{yb:.0f}" x2="{W-30}" y2="{yb:.0f}" stroke="#c97a20" stroke-width="3" stroke-dasharray="10 8"/>
    <text x="{x0+300}" y="{yb+28:.0f}" text-anchor="middle" font-size="20" font-weight="700" fill="#c97a20">meta 80 %</text>
    <polygon points="{area}" fill="url(#g)"/><polyline points="{line}" fill="none" stroke="#1e6b3a" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>{dots}{labels}</svg>'''

def node(x, y, title, sub, color):
    return f'''<div style="position:absolute;left:{x}px;top:{y}px;width:400px;background:#fff;border:2px solid #c8e6d0;border-top:8px solid {color};border-radius:24px;padding:26px 30px;box-shadow:0 24px 50px -24px rgba(13,40,24,.4)">
    <div style="font-size:32px;font-weight:800;color:#0d2818">{title}</div><div style="font-size:24px;color:#3d6350;margin-top:6px;line-height:1.35">{sub}</div></div>'''

SCENES = []

SCENES.append(('s1',
 "MedTopix. Seguimiento de la adherencia al tratamiento, a largo plazo, con el paciente y todo su equipo de salud sobre el mismo caso.",
 f'''<body class="dark"><div class="pad" style="align-items:center;text-align:center">
 <div style="width:230px;height:230px;border-radius:56px;background:#f0f7f2;display:flex;align-items:center;justify-content:center;box-shadow:0 40px 90px -30px rgba(0,0,0,.6);margin-bottom:44px"><div style="width:190px;height:190px">{LOGO}</div></div>
 <h1 style="font-size:150px">Med<em>Topix</em></h1>
 <p class="sub" style="font-size:46px;max-width:1400px">Seguimiento de la adherencia al tratamiento,<br>a largo plazo y en equipo.</p>
 </div>{foot(1)}</body>'''))

SCENES.append(('s2',
 "La Organización Mundial de la Salud estima que, en los países desarrollados, solo cerca de la mitad de los pacientes con enfermedades crónicas sigue su tratamiento como fue indicado. Y entre una consulta y la siguiente, nadie ve lo que pasa en casa.",
 f'''<body class="dark"><div class="pad">
 <div class="tag">El problema</div>
 <div style="display:flex;align-items:flex-end;gap:50px"><div style="font-family:'Fraunces',serif;font-weight:900;font-size:260px;line-height:.9;color:#f0b862;white-space:nowrap;flex-shrink:0">≈ 50 %</div>
 <p class="sub" style="margin:0 0 22px;font-size:40px;max-width:820px">de adherencia a los tratamientos de largo plazo en enfermedades crónicas, en países desarrollados.</p></div>
 <div style="display:flex;gap:26px;margin-top:56px">{people_row()}</div>
 <p style="font-size:24px;color:#8fdeaa;margin-top:36px">Fuente: OMS. Adherencia a los tratamientos a largo plazo: pruebas para la acción. Ginebra, 2004.</p>
 </div>{foot(2)}</body>'''))

SCENES.append(('s3',
 "MedTopix convierte cada dosis en un dato. Es una aplicación web, instalable en el celular, donde el tratamiento se programa una sola vez y el seguimiento se construye día a día.",
 f'''<body><div class="pad"><div class="cols">
 <div><div class="tag">Qué es MedTopix</div><h1>Cada dosis se convierte en <em>un dato</em></h1>
 <ul class="k"><li>Aplicación web instalable en el celular</li><li>El tratamiento se programa una sola vez</li><li>El seguimiento se construye día a día</li></ul></div>
 <div style="display:flex;justify-content:center"><div style="width:470px;height:860px;border-radius:64px;background:#0d2818;padding:22px;box-shadow:0 50px 100px -40px rgba(13,40,24,.6)">
 <div style="width:100%;height:100%;border-radius:46px;background:#f0f7f2;overflow:hidden">
 <div style="background:#1a4a2e;color:#fff;padding:34px 28px 26px;display:flex;align-items:center;gap:14px"><div style="width:54px;height:54px;background:#f0f7f2;border-radius:14px;padding:4px">{LOGO}</div><div><div style="font-family:'Fraunces',serif;font-size:30px;font-weight:900">MedTopix</div><div style="font-size:16px;color:#8fdeaa">Hoy · 3 recordatorios</div></div></div>
 <div style="padding:22px">
 <div style="background:#fff;border:2px solid #c8e6d0;border-left:8px solid #2d8a4e;border-radius:18px;padding:18px 20px;margin-bottom:14px"><div style="font-size:16px;color:#6b9278;font-weight:700">08:00 · OFTALMOLOGÍA</div><div style="font-size:24px;font-weight:800">Timolol 0,5 % gotas</div><div style="font-size:17px;color:#2d8a4e;font-weight:700;margin-top:4px">✓ Usó la medicación</div></div>
 <div style="background:#fff;border:2px solid #f0b862;border-left:8px solid #c97a20;border-radius:18px;padding:18px 20px;margin-bottom:14px"><div style="font-size:16px;color:#9a5a12;font-weight:700">14:00 · DERMATOLOGÍA</div><div style="font-size:24px;font-weight:800">Hidrocortisona 1 % crema</div><div style="font-size:17px;color:#9a5a12;font-weight:700;margin-top:4px">Pendiente · suena en 12 min</div></div>
 <div style="background:#fff;border:2px solid #c8e6d0;border-left:8px solid #2d8a4e;border-radius:18px;padding:18px 20px;margin-bottom:14px"><div style="font-size:16px;color:#6b9278;font-weight:700">20:00 · OFTALMOLOGÍA</div><div style="font-size:24px;font-weight:800">Timolol 0,5 % gotas</div><div style="font-size:17px;color:#6b9278;font-weight:700;margin-top:4px">Programado</div></div>
 <div style="background:#1a4a2e;border-radius:18px;padding:20px;color:#fff;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:16px;color:#8fdeaa">Adherencia 14 días</div><div style="font-size:40px;font-weight:800">87 %</div></div><svg width="150" height="60" viewBox="0 0 150 60"><polyline points="0,40 25,30 50,34 75,18 100,24 125,12 150,16" fill="none" stroke="#f0b862" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
 <div style="font-size:14px;color:#6b9278;text-align:center;margin-top:14px">Pantalla ilustrativa · datos ficticios</div>
 </div></div></div></div>
 </div></div>{foot(3)}</body>'''))

SCENES.append(('s4',
 "El paciente recibe una alarma a la hora indicada y responde con un toque: usó la medicación, la aplicó en otro horario, o no la usó. Además ve su propia adherencia y sabe cómo va.",
 f'''<body><div class="pad"><div class="cols">
 <div><div class="tag">El paciente</div><h1>Una alarma,<br><em>un toque</em></h1>
 <ul class="k"><li>Recordatorio a la hora indicada</li><li>Tres respuestas posibles, sin formularios</li><li>Ve su propia adherencia y sabe cómo va</li></ul></div>
 <div class="card" style="padding:44px">
 <div style="display:flex;align-items:center;gap:22px;margin-bottom:30px"><div style="width:96px;height:96px;border-radius:50%;background:#fdf1dd;display:flex;align-items:center;justify-content:center"><div style="width:74px;height:74px">{LOGO}</div></div>
 <div><div style="font-size:22px;color:#c97a20;font-weight:800;letter-spacing:.12em">ES HORA · 08:00</div><div style="font-size:40px;font-weight:800">Timolol 0,5 % gotas</div><div style="font-size:24px;color:#6b9278">1 gota en cada ojo · vía oftálmica</div></div></div>
 <div style="display:grid;gap:16px">
 <div class="btn b-yes"><span class="dot" style="background:#2d8a4e"></span>Usó la medicación</div>
 <div class="btn b-late"><span class="dot" style="background:#c97a20"></span>La aplicó en otro horario</div>
 <div class="btn b-no"><span class="dot" style="background:#dc2626"></span>No usó</div></div>
 <div style="font-size:18px;color:#6b9278;margin-top:22px;text-align:center">Pantalla ilustrativa · datos ficticios</div></div>
 </div></div>{foot(4)}</body>'''))

SCENES.append(('s5',
 "El médico, o el profesional tratante, deja de depender de la memoria del paciente. Ve la curva de adherencia a lo largo de semanas y meses, detecta cuándo empezó a fallar, y ajusta el tratamiento a tiempo.",
 f'''<body><div class="pad">
 <div class="tag">El médico tratante</div><h1 style="font-size:80px">La adherencia <em>en el tiempo</em>, no de memoria</h1>
 <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:50px;margin-top:40px;align-items:center">
 <div class="card" style="padding:30px 34px 16px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><div style="font-size:28px;font-weight:800">Curva de adherencia · 12 semanas</div><div style="font-size:20px;color:#6b9278">Paciente ficticio</div></div>{curve()}</div>
 <ul class="k" style="margin:0"><li>Semanas y meses, no solo el día de la consulta</li><li>Detecta cuándo empezó a fallar</li><li>Ajusta el tratamiento a tiempo</li></ul></div>
 </div>{foot(5)}</body>'''))

SCENES.append(('s6',
 "El farmaceuta verifica si el tratamiento farmacológico se está cumpliendo, y el nutricionista hace lo mismo con el plan nutricional. Cada uno deja sus notas de seguimiento dentro del caso.",
 f'''<body><div class="pad">
 <div class="tag">Farmaceuta y nutricionista</div><h1 style="font-size:80px">¿Se está <em>adhiriendo</em> al tratamiento?</h1>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:44px;margin-top:46px">
 <div class="card" style="border-top:10px solid #2d8a4e"><div style="font-size:22px;font-weight:800;letter-spacing:.14em;color:#2d8a4e">FARMACEUTA</div><div style="font-size:38px;font-weight:800;margin:8px 0 18px">Tratamiento farmacológico</div>
 <div style="font-size:27px;color:#3d6350;line-height:1.5">Dosis registradas frente a dosis indicadas, omisiones y cambios de horario.</div>
 <div style="background:#e8f8ee;border-radius:16px;padding:18px 22px;margin-top:22px;font-size:24px;color:#1a4a2e"><b>Nota de seguimiento:</b> omisiones repetidas en la dosis de la noche; se refuerza la técnica de aplicación.</div></div>
 <div class="card" style="border-top:10px solid #c97a20"><div style="font-size:22px;font-weight:800;letter-spacing:.14em;color:#c97a20">NUTRICIONISTA</div><div style="font-size:38px;font-weight:800;margin:8px 0 18px">Tratamiento nutricional</div>
 <div style="font-size:27px;color:#3d6350;line-height:1.5">Cumplimiento del plan y de los suplementos indicados, con la misma lógica de registro.</div>
 <div style="background:#fdf1dd;border-radius:16px;padding:18px 22px;margin-top:22px;font-size:24px;color:#6b3f0c"><b>Nota de seguimiento:</b> buen cumplimiento entre semana; se ajusta el plan del fin de semana.</div></div>
 </div><p style="font-size:20px;color:#6b9278;margin-top:22px">Notas ilustrativas · casos ficticios</p>
 </div>{foot(6)}</body>'''))

SCENES.append(('s7',
 "Todos trabajan sobre el mismo caso: paciente, médico, farmaceuta y nutricionista. Cada uno con su cuenta y su rol, viendo la misma información para decidir mejor.",
 f'''<body><div class="pad" style="justify-content:flex-start;padding-top:80px">
 <div class="tag">Un solo caso</div><h1 style="font-size:76px">Todos sobre <em>el mismo caso</em></h1></div>
 <svg style="position:absolute;inset:0" width="1920" height="1080"><g stroke="#8fdeaa" stroke-width="5" stroke-dasharray="4 14" stroke-linecap="round">
 <line x1="960" y1="640" x2="420" y2="440"/><line x1="960" y1="640" x2="1500" y2="440"/><line x1="960" y1="640" x2="420" y2="850"/><line x1="960" y1="640" x2="1500" y2="850"/></g></svg>
 <div style="position:absolute;left:730px;top:500px;width:460px;height:280px;border-radius:36px;background:#1a4a2e;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 40px 80px -30px rgba(13,40,24,.6)">
 <div style="width:86px;height:86px;background:#f0f7f2;border-radius:22px;padding:6px;margin-bottom:12px">{LOGO}</div><div style="font-family:'Fraunces',serif;font-size:42px;font-weight:900">Caso del paciente</div><div style="font-size:22px;color:#8fdeaa;margin-top:4px">tratamientos · adherencia · notas</div></div>
 {node(200,350,'Paciente','Recibe recordatorios y registra cada dosis','#3aaa63')}
 {node(1320,350,'Médico tratante','Ve la adherencia a largo plazo y ajusta','#1a4a2e')}
 {node(200,770,'Farmaceuta','Verifica el tratamiento farmacológico','#2d8a4e')}
 {node(1320,770,'Nutricionista','Verifica el tratamiento nutricional','#c97a20')}
 </body>'''))

SCENES.append(('s8',
 "Los datos de salud son sensibles. MedTopix pide autorización informada conforme a la Ley mil quinientos ochenta y uno de habeas data. Y no reemplaza el criterio clínico: lo informa.",
 f'''<body class="dark"><div class="pad"><div class="cols" style="grid-template-columns:.7fr 1.3fr">
 <div style="display:flex;justify-content:center"><svg width="420" height="480" viewBox="0 0 100 114"><path d="M50 4l42 14v34c0 28-18 48-42 58C26 100 8 80 8 52V18z" fill="rgba(240,184,98,.12)" stroke="#f0b862" stroke-width="4" stroke-linejoin="round"/><path d="M32 56l13 13 25-27" fill="none" stroke="#f0b862" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
 <div><div class="tag">Ética y datos</div><h1 style="font-size:84px">Informa al clínico,<br><em>no lo reemplaza</em></h1>
 <ul class="k"><li>Autorización informada · Ley 1581 de 2012, habeas data</li><li>Datos de salud tratados como datos sensibles</li><li>La decisión clínica es siempre del profesional</li></ul></div>
 </div></div>{foot(8)}</body>'''))

SCENES.append(('s9',
 "MedTopix. Que el tratamiento se cumpla, y que todo el equipo lo pueda ver. Pruébelo en medtopix punto vercel punto app.",
 f'''<body class="dark"><div class="pad" style="align-items:center;text-align:center">
 <div style="width:170px;height:170px;border-radius:42px;background:#f0f7f2;display:flex;align-items:center;justify-content:center;margin-bottom:36px"><div style="width:140px;height:140px">{LOGO}</div></div>
 <h1 style="font-size:96px;max-width:1500px">Que el tratamiento se cumpla,<br>y que <em>todo el equipo</em> lo pueda ver.</h1>
 <div style="margin-top:54px;background:#f0b862;color:#0d2818;border-radius:22px;padding:22px 54px;font-size:52px;font-weight:800">medtopix.vercel.app</div>
 </div>{foot(9)}</body>'''))


# ── v2: fotos de entorno real. Cada escena pasa a ser una lista de tomas (shots). ──
F = 'file:///Users/leo/Medtopix/img/fotos/'
CSS += """
.bgph{position:absolute;inset:-60px;width:calc(100% + 120px);height:calc(100% + 120px);object-fit:cover;filter:blur(8px) brightness(.55) saturate(.9)}
.bgov{position:absolute;inset:0;background:radial-gradient(1300px 900px at 78% 20%,rgba(30,107,58,.62) 0%,rgba(26,74,46,.78) 40%,rgba(13,40,24,.93) 100%)}
.ph{position:relative;border-radius:34px;overflow:hidden;border:4px solid #f0b862;box-shadow:0 50px 110px -40px rgba(13,40,24,.6);background:#0d2818}
.ph img{width:100%;height:100%;object-fit:cover;display:block}
.ph .cap{position:absolute;left:26px;bottom:26px;background:rgba(13,40,24,.84);color:#fff;font-size:24px;font-weight:700;padding:11px 22px;border-radius:999px;letter-spacing:.02em}
.ph .cap b{color:#f0b862}
.cred{position:absolute;left:0;right:0;bottom:112px;text-align:center;font-size:22px;color:#8fdeaa;font-weight:500}
"""

def bg(name):
    return f'<img class="bgph" src="{F}{name}.jpg"><div class="bgov"></div>'

def ph(name, w, h, cap='', pos='center'):
    c = f'<div class="cap">{cap}</div>' if cap else ''
    return f'<div class="ph" style="width:{w}px;height:{h}px;flex-shrink:0"><img src="{F}{name}.jpg" style="object-position:{pos}">{c}</div>'

OLD = {sid: (text, body) for sid, text, body in SCENES}
def old(sid): return OLD[sid][1]

s1 = old('s1').replace('<body class="dark">', '<body class="dark">' + bg('consulta-equipo'), 1)

s2a = f"""<body class="dark"><div class="pad"><div class="cols" style="grid-template-columns:1fr 860px;gap:70px">
 <div style="min-width:0"><div class="tag">El problema</div>
 <div style="font-family:'Fraunces',serif;font-weight:900;font-size:215px;line-height:.9;color:#f0b862;white-space:nowrap">≈ 50 %</div>
 <p class="sub" style="margin-top:26px;font-size:38px;max-width:800px">de adherencia a los tratamientos de largo plazo en enfermedades crónicas, en países desarrollados.</p>
 <div style="margin-top:40px;height:96px;width:740px;overflow:visible"><div style="display:flex;gap:14px;zoom:.62;width:1190px">{people_row()}</div></div>
 <p style="font-size:22px;color:#8fdeaa;margin-top:4px;max-width:800px">Fuente: OMS. Adherencia a los tratamientos a largo plazo: pruebas para la acción. Ginebra, 2004.</p></div>
 {ph('medicamentos', 860, 600)}
 </div></div>{foot(2)}</body>"""

s2b = f"""<body class="dark"><div class="pad"><div class="cols" style="grid-template-columns:1080px 1fr;gap:70px">
 {ph('gotas', 1080, 716, pos='60% center')}
 <div><div class="tag">Entre consultas</div><h1 style="font-size:78px">Nadie ve lo que pasa <em>en casa</em></h1>
 <p class="sub" style="font-size:34px">El tratamiento se indica en la consulta, pero se cumple —o no— lejos de ella.</p></div>
 </div></div>{foot(2)}</body>"""

s3b = f"""<body><div class="pad"><div class="cols" style="grid-template-columns:1fr 860px;gap:70px">
 <div><div class="tag">Qué es MedTopix</div><h1 style="font-size:84px">En el celular que el paciente <em>ya tiene</em></h1>
 <ul class="k"><li>Se abre desde el navegador</li><li>Se puede instalar como aplicación</li><li>La misma cuenta en cualquier dispositivo</li></ul></div>
 {ph('registro-celular', 860, 600, pos='center 40%')}
 </div></div>{foot(3)}</body>"""

s4a = f"""<body><div class="pad"><div class="cols" style="grid-template-columns:860px 1fr;gap:70px">
 {ph('paciente-celular', 860, 600, pos='center 30%')}
 <div><div class="tag">El paciente</div><h1>Una alarma,<br><em>un toque</em></h1>
 <ul class="k"><li>Recordatorio a la hora indicada</li><li>Responde desde su celular</li></ul></div>
 </div></div>{foot(4)}</body>"""

s5a = f"""<body><div class="pad"><div class="cols" style="grid-template-columns:1fr 860px;gap:70px">
 <div><div class="tag">El médico tratante</div><h1 style="font-size:84px">Deja de depender de <em>la memoria</em> del paciente</h1>
 <p class="sub" style="font-size:34px">La adherencia llega hecha a la consulta.</p></div>
 {ph('medico-tableta', 860, 600, pos='center 25%')}
 </div></div>{foot(5)}</body>"""

s6a = f"""<body><div class="pad">
 <div class="tag">Farmaceuta y nutricionista</div><h1 style="font-size:80px">¿Se está <em>adhiriendo</em> al tratamiento?</h1>
 <div style="display:flex;gap:44px;margin-top:46px;justify-content:space-between">
 {ph('farmacia', 818, 560, '<b>Farmaceuta</b> · tratamiento farmacológico', 'center 35%')}
 {ph('nutricion', 818, 560, '<b>Nutricionista</b> · tratamiento nutricional')}
 </div></div>{foot(6)}</body>"""

s7a = f"""<body><div class="pad"><div class="cols" style="grid-template-columns:900px 1fr;gap:70px">
 {ph('consulta-equipo', 900, 620)}
 <div><div class="tag">Un solo caso</div><h1 style="font-size:84px">Todos sobre <em>el mismo caso</em></h1>
 <p class="sub" style="font-size:34px">Paciente, médico, farmaceuta y nutricionista: cada uno con su cuenta y su rol.</p></div>
 </div></div>{foot(7)}</body>"""

s8 = old('s8').replace('<body class="dark">', '<body class="dark">' + bg('consulta-doctora'), 1)
s9 = old('s9').replace('</div>' + foot(9), '</div><div class="cred">Fotografías ilustrativas de licencia libre · créditos en medtopix.vercel.app</div>' + foot(9), 1)
assert 'class="cred"' in s9 and 'bgph' in s1 and 'bgph' in s8

SHOTS = {'s1': [s1], 's2': [s2a, s2b], 's3': [old('s3'), s3b], 's4': [s4a, old('s4')], 's5': [s5a, old('s5')],
         's6': [s6a, old('s6')], 's7': [s7a, old('s7')], 's8': [s8], 's9': [s9]}
# fracción del tiempo de la escena que ocupa la primera toma
SPLIT = {'s2': 0.62, 's3': 0.55, 's4': 0.42, 's5': 0.40, 's6': 0.45, 's7': 0.45}
SCENES = [(sid, OLD[sid][0], SHOTS[sid]) for sid, _, _ in SCENES]

def page(body):
    return f'<!doctype html><html lang="es"><head><meta charset="utf-8"><style>{CSS}</style></head>{body}</html>'
