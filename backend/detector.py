"""
detector.py
Módulo de detección de objetos usando YOLOv8.
Proyecto: Sistema Inteligente de Visión Artificial - UCV 2026
"""

import os
import cv2
import numpy as np
from ultralytics import YOLO
from PIL import Image
import base64
import io


# Ruta del modelo (relativa al backend/)
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "yolov8n.pt")

# Instancia global del modelo (se carga una sola vez)
_model = None


def get_model() -> YOLO:
    """
    Carga el modelo YOLOv8 una sola vez y lo reutiliza (singleton).
    Descarga automáticamente si no existe en models/.
    """
    global _model
    if _model is None:
        _model = YOLO(MODEL_PATH)  # descarga yolov8n.pt si no existe
    return _model


def detect_objects(image_path: str, conf_threshold: float = 0.25) -> dict:
    """
    Realiza la detección de objetos sobre una imagen guardada en disco.

    Args:
        image_path    : Ruta absoluta o relativa a la imagen.
        conf_threshold: Umbral mínimo de confianza (0.0 – 1.0).

    Returns:
        dict con:
            - detections  : lista de objetos detectados
            - total        : total de detecciones
            - image_b64    : imagen anotada en base64 (JPEG)
            - image_size   : (ancho, alto) original
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Imagen no encontrada: {image_path}")

    model = get_model()

    # Inferencia
    results = model.predict(
        source=image_path,
        conf=conf_threshold,
        verbose=False
    )

    result = results[0]  # primera (y única) imagen

    # Imagen original para anotar
    img = cv2.imread(image_path)
    h, w = img.shape[:2]

    detections = []

    for box in result.boxes:
        cls_id    = int(box.cls[0])
        cls_name  = model.names[cls_id]
        conf      = float(box.conf[0])
        x1, y1, x2, y2 = map(int, box.xyxy[0])

        detections.append({
            "label"     : cls_name,
            "confidence": round(conf * 100, 2),   # en porcentaje
            "bbox"      : {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        })

        # Dibujar bounding box en la imagen
        color = _get_color(cls_id)
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

        label_text = f"{cls_name} {conf:.0%}"
        (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        cv2.rectangle(img, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(img, label_text, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

    results_dir = os.path.join(os.path.dirname(__file__), "results")
    os.makedirs(results_dir, exist_ok=True)
    output_path = os.path.join(
        results_dir,
        f"resultado_{os.path.basename(image_path)}"
        )
    cv2.imwrite(output_path, img)
    # Convertir imagen anotada a base64
    _, buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    image_b64 = base64.b64encode(buffer).decode("utf-8")

    return {
        "detections" : detections,
        "total"      : len(detections),
        "image_b64"  : image_b64,
        "image_size" : {"width": w, "height": h},
        "saved_image": output_path
    }


def detect_from_bytes(image_bytes: bytes, conf_threshold: float = 0.25) -> dict:
    """
    Realiza detección directamente desde bytes (útil para cámara / stream).

    Args:
        image_bytes   : Bytes de la imagen (JPEG, PNG, WEBP).
        conf_threshold: Umbral de confianza.

    Returns:
        Mismo dict que detect_objects().
    """
    # Decodificar bytes → numpy array
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img    = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("No se pudo decodificar la imagen recibida.")

    # Guardar en memoria como archivo temporal para YOLO
    tmp_path = os.path.join(os.path.dirname(__file__), "uploads", "imagenes_subidas", "_tmp_frame.jpg")
    cv2.imwrite(tmp_path, img)

    return detect_objects(tmp_path, conf_threshold)


# ---------------------------------------------------------------------------
# Utilidades internas
# ---------------------------------------------------------------------------

def _get_color(cls_id: int) -> tuple:
    """Genera un color BGR determinista por clase."""
    palette = [
        (0, 114, 189), (217, 83, 25),  (237, 177, 32),
        (126, 47, 142),(119, 172, 48),  (77, 190, 238),
        (162, 20, 47),  (0, 168, 107),  (255, 128, 0),
        (128, 0, 255),
    ]
    return palette[cls_id % len(palette)]