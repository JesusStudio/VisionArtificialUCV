"""
evaluator.py
Módulo de evaluación de precisión para las detecciones YOLOv8.
Proyecto: Sistema Inteligente de Visión Artificial - UCV 2026
"""

from __future__ import annotations
from typing import List, Dict, Any


# ---------------------------------------------------------------------------
# Funciones principales de evaluación
# ---------------------------------------------------------------------------

def calculate_iou(box_a: dict, box_b: dict) -> float:
    """
    Calcula el Intersection over Union (IoU) entre dos bounding boxes.

    Args:
        box_a, box_b: dicts con claves x1, y1, x2, y2.

    Returns:
        IoU en [0.0, 1.0].
    """
    x_left   = max(box_a["x1"], box_b["x1"])
    y_top    = max(box_a["y1"], box_b["y1"])
    x_right  = min(box_a["x2"], box_b["x2"])
    y_bottom = min(box_a["y2"], box_b["y2"])

    if x_right < x_left or y_bottom < y_top:
        return 0.0

    intersection = (x_right - x_left) * (y_bottom - y_top)

    area_a = (box_a["x2"] - box_a["x1"]) * (box_a["y2"] - box_a["y1"])
    area_b = (box_b["x2"] - box_b["x1"]) * (box_b["y2"] - box_b["y1"])
    union  = area_a + area_b - intersection

    if union == 0:
        return 0.0

    return round(intersection / union, 4)


def evaluate_detections(
    detections  : List[Dict[str, Any]],
    ground_truth: List[Dict[str, Any]] | None = None,
    iou_threshold: float = 0.5,
) -> dict:
    """
    Evalúa métricas de precisión para un conjunto de detecciones.

    Si se proporciona ground_truth, calcula TP, FP, FN, Precision, Recall y F1.
    Si NO se proporciona, devuelve estadísticas descriptivas de confianza.

    Args:
        detections   : Lista de dicts con "label", "confidence" (%), "bbox".
        ground_truth : Lista de dicts con "label", "bbox" (opcional).
        iou_threshold: Umbral IoU para considerar una detección correcta.

    Returns:
        dict con métricas calculadas.
    """
    if not detections:
        return _empty_metrics()

    # ── Métricas descriptivas (siempre disponibles) ──────────────────────
    confidences = [d["confidence"] for d in detections]
    labels      = [d["label"]      for d in detections]

    label_counts: Dict[str, int] = {}
    for lbl in labels:
        label_counts[lbl] = label_counts.get(lbl, 0) + 1

    avg_conf = round(sum(confidences) / len(confidences), 2)
    max_conf = round(max(confidences), 2)
    min_conf = round(min(confidences), 2)

    base_metrics = {
        "total_detections" : len(detections),
        "unique_classes"   : len(label_counts),
        "class_counts"     : label_counts,
        "avg_confidence"   : avg_conf,
        "max_confidence"   : max_conf,
        "min_confidence"   : min_conf,
        "confidence_grade" : _grade_confidence(avg_conf),
    }

    # ── Métricas con ground truth ─────────────────────────────────────────
    if ground_truth is not None:
        gt_matched = [False] * len(ground_truth)
        tp, fp = 0, 0

        for det in detections:
            matched = False
            for i, gt in enumerate(ground_truth):
                if gt_matched[i]:
                    continue
                if det["label"] != gt["label"]:
                    continue
                iou = calculate_iou(det["bbox"], gt["bbox"])
                if iou >= iou_threshold:
                    tp += 1
                    gt_matched[i] = True
                    matched = True
                    break
            if not matched:
                fp += 1

        fn = sum(1 for m in gt_matched if not m)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1        = (2 * precision * recall / (precision + recall)
                     if (precision + recall) > 0 else 0.0)

        base_metrics.update({
            "true_positives" : tp,
            "false_positives": fp,
            "false_negatives": fn,
            "precision"      : round(precision * 100, 2),
            "recall"         : round(recall    * 100, 2),
            "f1_score"       : round(f1        * 100, 2),
            "iou_threshold"  : iou_threshold,
        })

    return base_metrics


def summarize_session(all_results: List[dict]) -> dict:
    """
    Genera un resumen global de múltiples imágenes analizadas en la sesión.

    Args:
        all_results: Lista de dicts retornados por evaluate_detections().

    Returns:
        dict con totales y promedios de la sesión.
    """
    if not all_results:
        return {"message": "Sin datos de sesión para resumir."}

    total_images     = len(all_results)
    total_detections = sum(r.get("total_detections", 0) for r in all_results)
    avg_confidence   = round(
        sum(r.get("avg_confidence", 0) for r in all_results) / total_images, 2
    )

    # Acumular conteo de clases
    global_classes: Dict[str, int] = {}
    for r in all_results:
        for cls, cnt in r.get("class_counts", {}).items():
            global_classes[cls] = global_classes.get(cls, 0) + cnt

    top_class = max(global_classes, key=global_classes.get) if global_classes else "N/A"

    return {
        "total_images"    : total_images,
        "total_detections": total_detections,
        "avg_confidence"  : avg_confidence,
        "global_classes"  : global_classes,
        "top_class"       : top_class,
        "avg_per_image"   : round(total_detections / total_images, 2),
    }


# ---------------------------------------------------------------------------
# Utilidades internas
# ---------------------------------------------------------------------------

def _empty_metrics() -> dict:
    return {
        "total_detections": 0,
        "unique_classes"  : 0,
        "class_counts"    : {},
        "avg_confidence"  : 0,
        "max_confidence"  : 0,
        "min_confidence"  : 0,
        "confidence_grade": "Sin detecciones",
    }


def _grade_confidence(avg_conf: float) -> str:
    """Clasifica la confianza promedio en una etiqueta descriptiva."""
    if avg_conf >= 85:
        return "Excelente"
    elif avg_conf >= 70:
        return "Buena"
    elif avg_conf >= 50:
        return "Aceptable"
    else:
        return "Baja"