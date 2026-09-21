# MedTopix — condiciones permanentes para desarrollar con IA

Estas condiciones aplican a TODO pedido sobre este repositorio. Si un pedido las contradice, dilo antes de actuar.

## Contexto
- MedTopix es un **prototipo académico clínico** (Trabajo final de la Maestría en Salud Digital e IA, OBS Business School): seguimiento de adherencia a tratamientos farmacológicos y nutricionales con tres roles (profesional de la salud, paciente, farmaceuta) sobre un mismo caso.
- Existe y está en línea, pero **no está validado con usuarios ni con pacientes**. Nada en la app, el sitio o el video puede afirmar lo contrario.
- Usuarios en Colombia: español neutro, trato de «usted» en la app, hora local del paciente, datos de salud = datos sensibles (Ley 1581 de 2012).
- Arquitectura: sin framework ni build. `index.html` (venta), `proyecto.html`, `integracion.html`, `app.html` (PWA de un solo archivo) + `sw.js`; funciones Vercel en `api/`; Postgres en Neon (`db/schema.sql`, idempotente); pruebas en `tests/`.

## Definición de terminado
Un cambio está terminado solo si:
1. Funciona de punta a punta para el rol que lo usa (no basta con que «se vea»).
2. `npm test` pasa completo, y lo nuevo tiene su propia prueba.
3. Se verificó en el despliegue real (preview de Vercel y luego producción), no solo en local.
4. El informe final dice qué se verificó, cómo, y **qué no se pudo verificar**.

## Honestidad
- No inventar cifras, testimonios, clientes, precios ni resultados clínicos. La única cifra dura del proyecto es el ≈ 50 % de adherencia (OMS, 2004).
- Lo que sea hipótesis se rotula como hipótesis. Los datos de ejemplo se rotulan como ficticios.
- No afirmar cumplimiento normativo ni certificaciones (Ley 1581, Ley 2015 de 2020, Res. 866 de 2021, FHIR): se citan como marco, no como sello.

## Seguridad y datos
- Contraseñas solo con hash; sesión en cookie httpOnly firmada; secretos solo en variables de entorno, nunca en el código ni en el chat.
- Ingreso por correo, Google o Apple: las tres vías terminan en la misma creación de cuenta (`createAccount` en `api/auth.js`). Los tokens de proveedor se verifican en el servidor (firma, emisor, destinatario, vigencia, correo verificado); nunca confiar en datos de identidad que mande el navegador.
- Acceso siempre por rol **y** por caso: un usuario ve únicamente los pacientes que creó, su propia ficha o los casos donde está en el equipo tratante. Un recurso ajeno responde 404, no 403.
- Todo texto que entra al servidor pasa por `clean()` (`api/_lib/shape.js`): la app pinta con `innerHTML`.
- Datos de prueba solo con correos `…@test.medtopix.invalid`, y se borran al terminar. No correr `tests/alarmas.mjs` contra una base con pacientes reales.

## Criterio clínico
- MedTopix recuerda y registra. **No diagnostica, no recomienda dosis, no reemplaza al profesional.**
- Las alertas al equipo tratante siguen una regla por tratamiento (cada dosis · dos seguidas · nunca) para evitar fatiga de alertas. No agregar avisos que suenen por cada evento sin una regla así.
- «Sin respuesta» no es lo mismo que «no usó»: se registran y se muestran distinto, y ambos cuentan como no adherencia.

## Diseño
- Iconos SVG de línea del sprite `ic-*`; **nunca emojis** como iconos. Donde no cabe SVG (`<option>`, `confirm()`, notificaciones push, CSV) va texto limpio.
- Paleta de la marca (verdes `#0d2818`–`#2d8a4e`, dorado `#c97a20`/`#f0b862`); sin colores saturados sueltos. Tipografías Plus Jakarta Sans y Fraunces.
- Móvil primero, sin desborde horizontal, respeta `prefers-reduced-motion`. El efecto de entrada del sitio es `aladino` (el mismo de PREALTA IA).
- Las fotos son de licencia libre con créditos en `img/fotos/CREDITOS.txt`; las personas no se presentan como pacientes ni usuarios reales.

## Compatibilidad
- Debe funcionar en iPhone (Safari e instalada), Android y escritorio. En iPhone `Notification` no existe fuera de la app instalada: toda API del navegador se comprueba antes de usarla.
- El reloj (Apple Watch, Wear OS) solo replica la notificación del celular; no prometer una app de reloj.

## Proceso
- Rama → preview de Vercel → verificación → `main` (producción). Commits pequeños, en inglés, que expliquen el porqué.
- La regla de horarios de dosis vive duplicada en `api/_lib/doses.js` y en `doseTimes` de `app.html`: si cambia una, cambia la otra.
- Si un término del pedido no se reconoce, **buscarlo primero en el proyecto y en los proyectos hermanos** (p. ej. «aladino» era una animación de PREALTA IA). Preguntar solo cuando la respuesta cambia lo que se va a construir.

## Cómo pedir un cambio (plantilla)
```
Objetivo: qué debe poder hacer quién, y para qué.
Rol afectado: paciente / profesional / farmaceuta / institución.
Condiciones: lo que no se puede romper ni afirmar.
Criterios de aceptación: comprobaciones concretas, incluida la situación límite
  (app cerrada, sin conexión, iPhone sin instalar, caso ajeno, dato inválido).
Fuera de alcance: lo que NO se debe tocar.
Verificación: qué prueba automatizada y qué revisión en producción lo demuestran.
```
