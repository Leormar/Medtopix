# MedTopix · Integración con historia clínica electrónica (HCE)

Guía para el equipo de TI de una IPS. MedTopix expone una **fachada FHIR R4** para que la historia clínica:

1. cree en MedTopix al paciente y sus tratamientos (farmacológicos y nutricionales), y
2. lea de vuelta cada dosis registrada y el porcentaje de adherencia, para mostrarlo dentro de la historia.

> **Estado:** prototipo académico en desarrollo (Máster Salud Digital e IA · OBS Business School). No está validado con
> pacientes ni certificado. Lea la sección [Qué NO es todavía](#qué-no-es-todavía) antes de planear una integración.

En Colombia la interoperabilidad de la historia clínica electrónica se rige por la **Ley 2015 de 2020** y la
**Resolución 866 de 2021** (conjunto de elementos de datos). Por esa razón se eligió FHIR como lenguaje de la integración.
Esto **no** significa que MedTopix cumpla o esté certificado frente a esas normas: es la dirección del diseño, no una declaración de conformidad.

---

## 1. Datos básicos

| | |
|---|---|
| URL base | `https://medtopix.vercel.app/api/fhir` |
| Versión | FHIR R4 (4.0.1), solo JSON |
| Autenticación | `Authorization: Bearer mtx_…` (llave de API) |
| Peticiones `POST` | `Content-Type: application/json` (el contenido es FHIR JSON) |
| Respuestas | `Content-Type: application/fhir+json; charset=utf-8` |
| Errores | siempre un `OperationOutcome` con el código HTTP correspondiente |
| Declaración de capacidades | `GET /api/fhir/metadata` (no requiere llave) |

> **Por qué `application/json` y no `application/fhir+json` al enviar:** la plataforma donde corre el prototipo solo
> interpreta cuerpos `application/json`. Si envía `application/fhir+json` recibirá un `415` con esa misma indicación.

## 2. Cómo obtener la llave

1. Un **profesional de la salud** de la institución inicia sesión en <https://medtopix.vercel.app/app>.
2. Va a **Mi cuenta → Integración con historia clínica** y crea una llave. Se muestra **una sola vez**; MedTopix solo guarda su huella (hash).
3. La llave se puede **revocar** en cualquier momento desde el mismo lugar; deja de funcionar de inmediato.

**Alcance de la llave:** ve exactamente los casos que ve el usuario que la emitió — los pacientes que él creó y los casos a los
que fue vinculado con el código del caso. No existe una llave «de toda la institución».

| Rol del dueño de la llave | Leer | Crear pacientes y tratamientos |
|---|---|---|
| Profesional de la salud | sí | sí |
| Farmaceuta | sí (casos vinculados) | no → `403` |

## 3. Recursos y operaciones

| Recurso | Qué es en MedTopix | Leer por id | Buscar | Crear |
|---|---|---|---|---|
| `Patient` | Ficha del paciente (el «caso») | `GET Patient/{id}` | `?identifier=` · `?name=` | `POST Patient` |
| `MedicationRequest` | Tratamiento farmacológico con su hora de recordatorio | `GET MedicationRequest/{id}` | `?patient=` | `POST MedicationRequest` |
| `NutritionOrder` | Tratamiento nutricional con su hora de recordatorio | `GET NutritionOrder/{id}` | `?patient=` | `POST NutritionOrder` |
| `MedicationAdministration` | Cada dosis: usada, en otro horario, no usada o sin respuesta | `GET MedicationAdministration/{id}` | `?patient=` · `?request=` · `?effective-time=` | — solo lectura |
| `Observation` | % de adherencia de los últimos 30 días, una por tratamiento | `GET Observation/adh-{idTratamiento}` | `?patient=` · `?code=adherence` | — solo lectura |

Las búsquedas devuelven un `Bundle` de tipo `searchset` con `total`. No hay paginación: cada búsqueda entrega como máximo 1 000 recursos.
No se admiten `PUT`, `PATCH` ni `DELETE` (→ `405`).

## 4. Flujo típico

```
HCE                                   MedTopix                              Paciente
 │  POST Patient ─────────────────────▶ crea la ficha y un código del caso
 │ ◀──────────── 201 + código del caso
 │  (la HCE imprime o envía el código) ─────────────────────────────────────▶ crea su cuenta con el código
 │  POST MedicationRequest ───────────▶ programa el recordatorio ───────────▶ alarma · «Usó / Otro horario / No usó»
 │  POST NutritionOrder ──────────────▶ ídem, tratamiento nutricional
 │  GET MedicationAdministration ─────▶ dosis por dosis
 │  GET Observation?code=adherence ───▶ % de adherencia a 30 días
 │  (la HCE lo muestra en la historia)
```

## 5. Ejemplos

En todos: `KEY="mtx_…"` y `BASE="https://medtopix.vercel.app/api/fhir"`.

### 5.1 Crear el paciente

```bash
curl -s -X POST "$BASE/Patient" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{
    "resourceType": "Patient",
    "identifier": [{ "system": "urn:oid:hce-de-la-ips", "value": "CC-52123456" }],
    "name": [{ "given": ["María"], "family": "González Pérez" }],
    "birthDate": "1958-04-02",
    "telecom": [{ "system": "phone", "value": "3100000000" }]
  }'
```

Respuesta `201 Created`, con cabecera `Location: …/Patient/12`:

```json
{
  "resourceType": "Patient",
  "id": "12",
  "meta": { "lastUpdated": "2026-09-21T14:03:11.000Z" },
  "identifier": [
    { "use": "official", "system": "https://medtopix.vercel.app/fhir/sid/documento", "value": "CC-52123456" },
    { "use": "secondary", "system": "https://medtopix.vercel.app/fhir/sid/codigo-caso", "value": "NY3P-DJQ9" }
  ],
  "active": true,
  "name": [{ "use": "official", "text": "María González Pérez" }],
  "telecom": [{ "system": "phone", "value": "3100000000" }],
  "birthDate": "1958-04-02"
}
```

- El identificador con `system …/sid/codigo-caso` es el **código del caso**. La HCE debe entregárselo al paciente: con él crea su
  cuenta en MedTopix y queda unido a esta ficha. También sirve para que un farmaceuta o un nutricionista se sumen al caso.
- **Idempotencia:** si ya existe un paciente visible para la llave con el mismo número de documento, la respuesta es `200 OK`
  con la ficha existente y no se crea nada. Reenviar la misma petición es seguro.
- Se toma el primer `identifier` que no sea el código del caso. El `system` que envíe la HCE no se conserva.

### 5.2 Buscar y leer pacientes

```bash
curl -s "$BASE/Patient?identifier=CC-52123456" -H "Authorization: Bearer $KEY"   # también acepta system|valor y el código del caso
curl -s "$BASE/Patient?name=gonz"              -H "Authorization: Bearer $KEY"
curl -s "$BASE/Patient/12"                     -H "Authorization: Bearer $KEY"
```

### 5.3 Enviar un tratamiento farmacológico

```bash
curl -s -X POST "$BASE/MedicationRequest" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{
    "resourceType": "MedicationRequest",
    "status": "active", "intent": "order",
    "subject": { "reference": "Patient/12" },
    "medicationCodeableConcept": { "text": "Timolol 0,5 % solución oftálmica" },
    "dosageInstruction": [{
      "text": "1 gota en cada ojo",
      "timing": { "repeat": { "frequency": 1, "period": 12, "periodUnit": "h", "timeOfDay": ["08:00:00"] } },
      "route": { "text": "Colirio / ocular" }
    }],
    "note": [{ "text": "No suspender sin indicación médica." }]
  }'
```

| Campo FHIR | Campo en MedTopix | Obligatorio |
|---|---|---|
| `subject.reference` | paciente | sí |
| `medicationCodeableConcept.text` (o `coding[0].display`) | nombre del medicamento | sí |
| `dosageInstruction[0].timing.repeat.timeOfDay[0]` (`HH:MM:SS` o `HH:MM`) | hora de la primera dosis | sí |
| `dosageInstruction[0].timing.repeat` → `frequency`/`period`/`periodUnit` | frecuencia | no (por defecto, una vez al día) |
| `dosageInstruction[0].asNeededBoolean: true` | frecuencia «Según necesidad» | no |
| `dosageInstruction[0].text` | dosis por toma | no |
| `dosageInstruction[0].route.text` | vía | no |
| `note[0].text` (o `dosageInstruction[0].patientInstruction`) | notas / instrucciones | no |

**Frecuencias admitidas.** MedTopix solo maneja: *Cada 4 horas, Cada 6 horas, Cada 8 horas, Cada 12 horas, Una vez al día* y
*Según necesidad*. El `repeat` se convierte a horas (`period` × unidad ÷ `frequency`, con `periodUnit` `h` o `d`); si el resultado
no es 4, 6, 8, 12 o 24 la respuesta es `400` con la lista de valores admitidos. Si no hay `repeat`, se intenta leer un texto como
«cada 8 horas» en `timing.code.text` o en la dosis. A partir de la hora inicial y la frecuencia, MedTopix calcula las demás dosis del día
(08:00 cada 12 horas → 08:00 y 20:00).

### 5.4 Enviar un tratamiento nutricional

```bash
curl -s -X POST "$BASE/NutritionOrder" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{
    "resourceType": "NutritionOrder",
    "status": "active", "intent": "order",
    "patient": { "reference": "Patient/12" },
    "dateTime": "2026-09-21",
    "oralDiet": {
      "instruction": "Dieta baja en sodio",
      "schedule": [{ "repeat": { "frequency": 1, "period": 1, "periodUnit": "d", "timeOfDay": ["12:30:00"] } }]
    },
    "note": [{ "text": "Evitar embutidos y enlatados." }]
  }'
```

El nombre de la indicación sale de `oralDiet.instruction`; si no viene, de `note[0].text`. La hora sale de
`oralDiet.schedule[0].repeat.timeOfDay[0]` y es obligatoria.

### 5.5 Leer las dosis (adherencia dosis por dosis)

```bash
curl -s "$BASE/MedicationAdministration?patient=12&effective-time=ge2026-09-01&effective-time=le2026-09-30" \
  -H "Authorization: Bearer $KEY"
```

```json
{
  "resourceType": "MedicationAdministration",
  "id": "348",
  "status": "completed",
  "medicationCodeableConcept": { "text": "Timolol 0,5 % solución oftálmica" },
  "subject": { "reference": "Patient/12" },
  "effectiveDateTime": "2026-09-18T22:15:00-05:00",
  "request": { "reference": "MedicationRequest/41" },
  "extension": [{ "url": "https://medtopix.vercel.app/fhir/StructureDefinition/hora-programada", "valueTime": "20:00:00" }],
  "note": [{ "text": "Aplicada en otro horario (programada para las 20:00)." }]
}
```

| Registro en MedTopix | `status` | Detalle |
|---|---|---|
| Usó la medicación | `completed` | `effectiveDateTime` = hora programada de la dosis (la app no guarda la hora exacta del toque) |
| La aplicó en otro horario | `completed` | `effectiveDateTime` = hora real indicada por el paciente, más una `note` |
| No la usó | `not-done` | `statusReason[0].text` = «El paciente reporta que no la usó» |
| Sin respuesta | `not-done` | `statusReason[0].text` = «Sin respuesta del paciente». Lo marca el servidor cuando nadie confirma la dosis una hora después |

- `effective-time` admite los prefijos `ge`, `gt`, `le`, `lt` y `eq` (por defecto) y se puede repetir para formar un rango. Solo se compara la **fecha**.
- La extensión `hora-programada` trae la hora a la que estaba programada la dosis.
- Solo aparecen dosis de tratamientos **farmacológicos**. La adherencia a los nutricionales se lee en `Observation`.
- **Zona horaria:** MedTopix guarda fecha y hora **locales del paciente**. El desplazamiento se calcula con la zona horaria de la cuenta
  del paciente; si el paciente aún no tiene cuenta o no ha informado su zona, se asume `-05:00` (Colombia). No lo use para cálculos que dependan de la hora exacta fuera de Colombia.
- Es **autorreporte** del paciente, no una administración presenciada por personal de salud. El autorreporte tiende a sobrestimar la adherencia (OMS, 2004).

### 5.6 Leer el porcentaje de adherencia

```bash
curl -s "$BASE/Observation?patient=12&code=adherence" -H "Authorization: Bearer $KEY"
```

```json
{
  "resourceType": "Observation",
  "id": "adh-41",
  "status": "final",
  "code": {
    "coding": [{ "system": "https://medtopix.vercel.app/fhir/CodeSystem/medtopix", "code": "adherence-30d", "display": "Adherencia al tratamiento, últimos 30 días" }],
    "text": "Adherencia a Timolol 0,5 % solución oftálmica (30 días)"
  },
  "subject": { "reference": "Patient/12" },
  "focus": [{ "reference": "MedicationRequest/41" }],
  "effectivePeriod": { "start": "2026-08-23", "end": "2026-09-21" },
  "valueQuantity": { "value": 86.7, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" },
  "component": [
    { "code": { "coding": [{ "system": "…/CodeSystem/medtopix", "code": "adherence-count-yes",  "display": "Usó la medicación" }] },        "valueInteger": 48 },
    { "code": { "coding": [{ "system": "…/CodeSystem/medtopix", "code": "adherence-count-late", "display": "La aplicó en otro horario" }] }, "valueInteger": 4 },
    { "code": { "coding": [{ "system": "…/CodeSystem/medtopix", "code": "adherence-count-no",   "display": "No la usó" }] },                "valueInteger": 3 },
    { "code": { "coding": [{ "system": "…/CodeSystem/medtopix", "code": "adherence-count-none", "display": "Sin respuesta" }] },            "valueInteger": 5 }
  ]
}
```

- **Fórmula:** (usó + otro horario) ÷ (usó + otro horario + no usó + sin respuesta), sobre los últimos 30 días. «Sin respuesta» cuenta como **no adherente**.
- Hay una `Observation` por tratamiento, farmacológico o nutricional; `focus` apunta al `MedicationRequest` o al `NutritionOrder`.
- Sin registros en el periodo no hay `valueQuantity`: viene `dataAbsentReason`.
- El código es **local** (`…/CodeSystem/medtopix | adherence-30d`). No se usa LOINC ni SNOMED CT porque el prototipo no ha hecho ese mapeo y no se quiso inventar uno.

## 6. Errores

| HTTP | `issue.code` | Cuándo |
|---|---|---|
| `400` | `required` · `value` · `invalid` · `not-supported` | Falta paciente, nombre u hora; fecha mal formada; JSON inválido; frecuencia no admitida |
| `401` | `login` | Llave ausente, mal formada, inexistente o revocada |
| `403` | `forbidden` | La llave es de un farmaceuta e intenta crear |
| `404` | `not-found` | El recurso no existe **o pertenece a otro profesional** (no se distingue, a propósito) |
| `405` | `not-supported` | `PUT`/`PATCH`/`DELETE`, o `POST` sobre un recurso de solo lectura |
| `415` | `not-supported` | `POST` con un `Content-Type` distinto de `application/json` |
| `500` | `exception` | Error interno |

```json
{ "resourceType": "OperationOutcome",
  "issue": [{ "severity": "error", "code": "required",
              "diagnostics": "Falta la hora del recordatorio (dosageInstruction[0].timing.repeat.timeOfDay[0] = \"HH:MM:SS\")." }] }
```

## 7. Seguridad y datos personales

- Todo el tráfico va por **HTTPS**. La llave viaja solo en la cabecera `Authorization`; no la ponga en la URL ni en registros.
- La llave es **revocable**, MedTopix guarda únicamente su hash SHA-256 y registra la fecha del último uso.
- El alcance es el de su dueño (sección 2). Un recurso ajeno responde `404`, igual que uno inexistente.
- Todo texto entrante se sanea (se neutralizan `< > " ' \``) porque la aplicación lo muestra en pantalla. No envíe HTML.
- Son **datos de salud, sensibles** según la **Ley 1581 de 2012**. La institución es responsable de contar con la autorización del
  titular antes de enviar sus datos a MedTopix. La base de datos del prototipo está en la nube, **fuera de Colombia**.
- No hay límite de peticiones implementado todavía; úsela con moderación (el prototipo corre en planes de bajo costo).

## Qué NO es todavía

- **No es un servidor FHIR completo ni certificado.** Es una fachada con cinco recursos y las operaciones de la tabla de la sección 3. No hay `PUT`, `PATCH`, `DELETE`, `_include`, `_revinclude`, paginación, historial ni validación contra perfiles.
- **No hay SMART on FHIR ni OAuth 2.0.** Solo llave de API estática por usuario.
- **No hay suscripciones ni webhooks.** La HCE debe consultar (polling); MedTopix no avisa cuando cambia algo.
- **No hay terminologías estándar.** Medicamentos, vías y diagnósticos son texto libre: sin CUM, ATC, SNOMED CT, LOINC ni CIE-10. Los `coding` que envíe la HCE no se conservan (solo su `display`, si falta el texto).
- **No se pueden modificar ni suspender tratamientos por la API**; eso se hace en la aplicación. Todo tratamiento se reporta como `active`.
- **No se exponen** las notas de seguimiento del equipo tratante, el equipo tratante ni los profesionales (`Practitioner`).
- **No es una declaración de cumplimiento** de la Ley 2015 de 2020, la Resolución 866 de 2021 ni de ningún perfil nacional.
- **Es un prototipo no validado:** sin acuerdos de nivel de servicio, sin auditoría de seguridad externa y sin pruebas con pacientes reales. No lo conecte a una historia clínica en producción con datos reales sin una revisión legal y de seguridad previa.
