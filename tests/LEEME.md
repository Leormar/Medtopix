# Pruebas de la API

Corren contra la base real con usuarios `…@test.medtopix.invalid` y limpian lo que crean.

    node --env-file=.env.local tests/roles.mjs     # cuentas, roles y permisos
    node --env-file=.env.local tests/alarmas.mjs   # cron de dosis, escalamiento, multi-dosis, llaves, push
    node --env-file=.env.local tests/fhir.mjs      # API FHIR para historia clínica
    node --env-file=.env.local tests/social.mjs    # ingreso con Google y Apple (tokens firmados localmente)

`alarmas.mjs` ejecuta el cron sobre TODOS los tratamientos de la base: no correrla contra una base con pacientes reales.
