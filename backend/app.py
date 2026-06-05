"""
app.py
API REST principal con Flask.
Proyecto: Sistema Inteligente de Visión Artificial - UCV 2026
"""

import os
import json
import uuid
import base64
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from detector  import detect_objects, detect_from_bytes
from evaluator import evaluate_detections, summarize_session

# ---------------------------------------------------------------------------
# Configuración de la app
# ---------------------------------------------------------------------------

app = Flask(__name__)
CORS(app)  # Permite peticiones desde el frontend (HTML/JS)

BASE_DIR    = os.path.dirname(__file__)
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
UPLOAD_DIR  = os.path.join(BASE_DIR, "uploads", "imagenes_subidas")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB máximo por imagen

app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# Asegurar que existan los directorios necesarios
os.makedirs(UPLOAD_DIR,  exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# Historial de resultados de la sesión (en memoria)
_session_results: list = []


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _error(msg: str, code: int = 400):
    return jsonify({"success": False, "error": msg}), code


# ---------------------------------------------------------------------------
# Rutas / Endpoints
# ---------------------------------------------------------------------------

@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def frontend_files(path):
    return send_from_directory(FRONTEND_DIR, path)


# ── Detección desde imagen subida ──────────────────────────────────────────

@app.route("/api/detect/image", methods=["POST"])
def detect_image():
    
    """
    Recibe una imagen como multipart/form-data.
    Parámetros opcionales (form):
        - confidence : float 0–100 (default 25)
    Retorna:
        JSON con detecciones, métricas e imagen anotada en base64.
    """
    if "image" not in request.files:
        return _error("No se encontró el campo 'image' en la solicitud.")

    file = request.files["image"]

    if file.filename == "":
        return _error("No se seleccionó ningún archivo.")

    if not _allowed_file(file.filename):
        return _error(f"Formato no permitido. Usa: {', '.join(ALLOWED_EXTENSIONS)}")

    # Umbral de confianza
    try:
        conf_threshold = float(request.form.get("confidence", 25)) / 100.0
        conf_threshold = max(0.01, min(conf_threshold, 1.0))
    except ValueError:
        conf_threshold = 0.25

    # Guardar imagen con nombre único
    ext      = secure_filename(file.filename).rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    # Detección
    try:
        detection_result = detect_objects(filepath, conf_threshold)
    except Exception as e:
        return _error(f"Error en detección: {str(e)}", 500)
        
    
    # Evaluación de métricas
    metrics = evaluate_detections(detection_result["detections"])
    
    result_data = {
    "filename": filename,
    "detections": detection_result["detections"],
    "metrics": metrics
    }
    result_file = os.path.join(
    RESULTS_DIR,
    f"{os.path.splitext(filename)[0]}.json"
    )
    with open(result_file, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=4, ensure_ascii=False)
    _session_results.append(metrics)
    return jsonify({
    "success": True,
    "filename": filename,
    "detections": detection_result["detections"],
    "total": detection_result["total"],
    "image_b64": detection_result["image_b64"],
    "image_size": detection_result["image_size"],
    "metrics": metrics,
})
    
    




# ── Detección desde frame de cámara ────────────────────────────────────────

@app.route("/api/detect/camera", methods=["POST"])
def detect_camera():
    """
    Recibe un frame de la cámara como JSON con imagen en base64.
    Body JSON esperado:
        {
            "image"     : "<base64 string>",
            "confidence": 25          (opcional, 0–100)
        }
    Retorna:
        JSON con detecciones e imagen anotada.
    """
    data = request.get_json(silent=True)

    if not data or "image" not in data:
        return _error("Se esperaba JSON con campo 'image' en base64.")

    # Decodificar base64
    try:
        header, encoded = (data["image"].split(",", 1)
                           if "," in data["image"]
                           else ("", data["image"]))
        image_bytes = base64.b64decode(encoded)
    except Exception:
        return _error("No se pudo decodificar la imagen base64.")

    # Umbral de confianza
    try:
        conf_threshold = float(data.get("confidence", 25)) / 100.0
        conf_threshold = max(0.01, min(conf_threshold, 1.0))
    except (ValueError, TypeError):
        conf_threshold = 0.25

    # Detección
    try:
        detection_result = detect_from_bytes(image_bytes, conf_threshold)
    except Exception as e:
        return _error(f"Error en detección: {str(e)}", 500)

    # Evaluación básica
    metrics = evaluate_detections(detection_result["detections"])

    return jsonify({
        "success"   : True,
        "detections": detection_result["detections"],
        "total"     : detection_result["total"],
        "image_b64" : detection_result["image_b64"],
        "metrics"   : metrics,
    })


# ── Resumen de sesión ──────────────────────────────────────────────────────

@app.route("/api/session/summary", methods=["GET"])
def session_summary():
    """
    Devuelve estadísticas acumuladas de todas las detecciones de la sesión.
    """
    summary = summarize_session(_session_results)
    return jsonify({"success": True, "summary": summary})


@app.route("/api/session/reset", methods=["POST"])
def session_reset():
    """
    Limpia el historial de resultados de la sesión actual.
    """
    _session_results.clear()
    return jsonify({"success": True, "message": "Sesión reiniciada correctamente."})


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 55)
    print("  Sistema Inteligente de Visión Artificial - UCV 2026")
    print("  Servidor corriendo en http://localhost:5000")
    print("=" * 55)
    app.run(debug=True, host="0.0.0.0", port=5000)