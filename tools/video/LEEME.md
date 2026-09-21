# Video de MedTopix

Genera `video/medtopix.mp4` y `img/video-poster.jpg`: escenas HTML 1920×1080 → PNG con Chrome headless →
narración con edge-tts (`es-CO-SalomeNeural`) → música sintetizada con ffmpeg con ducking bajo la voz →
tomas con Ken Burns y fundidos → H.264 + AAC con faststart.

    python3 -m venv venv && venv/bin/pip install edge-tts
    venv/bin/python build_video.py        # variables opcionales: VOZ, RATE, OUT, POSTER, STAGE

Requiere ffmpeg y Google Chrome. Las fotos salen de `img/fotos/` (créditos en `img/fotos/CREDITOS.txt`).
Las salidas y las fotos usan rutas absolutas a `/Users/leo/Medtopix`; los temporales (audio, png, seg…) se crean junto a los scripts y están en `.gitignore`.
Esta carpeta no se despliega (está en `.vercelignore`).
