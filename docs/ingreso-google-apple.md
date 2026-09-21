# Activar el ingreso con Google y con Apple

El código ya está desplegado. Los botones aparecen **solos** en `/app` cuando existen estas variables de entorno en Vercel
(proyecto `medtopix`, los tres entornos). Mientras no existan, el ingreso es solo por correo y nada se rompe.

| Variable | Qué es |
|---|---|
| `GOOGLE_CLIENT_ID` | ID de cliente OAuth 2.0 tipo «Aplicación web» de Google Cloud |
| `APPLE_CLIENT_ID` | Identificador del *Services ID* de Sign in with Apple |

No hace falta ningún secreto: el servidor solo verifica la firma del token de identidad contra las llaves públicas del proveedor
(`api/_lib/social.js`), que el token venga emitido para ese cliente, que esté vigente y que el correo esté verificado.

## Google (gratis, ~10 minutos)
1. https://console.cloud.google.com → crear o elegir un proyecto.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo *Externo*; nombre «MedTopix»; correo de asistencia; dominio autorizado `vercel.app`
   (o el dominio propio); alcances por defecto (`email`, `profile`, `openid`). Publicar la app (con esos alcances no requiere verificación de Google).
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   Orígenes autorizados de JavaScript: `https://medtopix.vercel.app` (y `http://localhost:3210` para pruebas locales). No se necesitan URI de redirección.
4. Copiar el ID (termina en `.apps.googleusercontent.com`) y guardarlo:
   `vercel env add GOOGLE_CLIENT_ID production` (repetir para `preview` y `development`), luego volver a desplegar.

## Apple (requiere Apple Developer Program, 99 USD al año)
1. https://developer.apple.com/account → **Identifiers**: crear un *App ID* con «Sign in with Apple» activado.
2. Crear un **Services ID** (p. ej. `app.medtopix.web`), activar «Sign in with Apple» y configurarlo con:
   dominio `medtopix.vercel.app` y Return URL `https://medtopix.vercel.app/app`.
3. Guardar ese identificador: `vercel env add APPLE_CLIENT_ID production` (y en los otros entornos), y volver a desplegar.
4. Apple exige que el dominio sea propio y verificable para producción seria; con un subdominio de `vercel.app` puede rechazar la verificación.
   Si ocurre, hace falta un dominio propio (p. ej. `medtopix.co`) apuntado a Vercel.

## Cómo se comporta
- Persona nueva: tras Google/Apple elige tipo de cuenta (paciente, profesional, farmaceuta), escribe su documento, puede poner el código del caso y acepta los términos. Solo entonces se crea la cuenta.
- Persona que ya tenía cuenta con ese mismo correo: entra a esa misma cuenta; conserva su contraseña y suma la nueva forma de ingreso.
- Apple puede entregar un correo de retransmisión privada (`…@privaterelay.appleid.com`); en ese caso la cuenta queda con ese correo.
- En iPhone con la app instalada en la pantalla de inicio, las ventanas emergentes de Google/Apple pueden abrirse en Safari; hay que probarlo en un dispositivo real.
