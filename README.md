# 🎯 Sistema Inteligente de Visión Artificial — UCV 2026

> Implementación de un sistema inteligente de visión artificial para la detección
> de objetos básicos y evaluación de su precisión en imágenes digitales.
>
> **Universidad César Vallejo · Ingeniería de Sistemas · 2026**

---

## 📋 Descripción

Sistema web que permite detectar objetos en imágenes y en tiempo real mediante
cámara web, usando el modelo **YOLOv8n** (You Only Look Once v8 Nano). El sistema
calcula métricas de precisión como confianza promedio, y opcionalmente Precision,
Recall y F1-score cuando se dispone de ground truth.

### Funcionalidades principales

- **Detección por imagen** — sube una imagen (JPG, PNG, WEBP) y obtén los objetos
  detectados con bounding boxes y porcentaje de confianza
- **Detección por cámara** — activa tu webcam y detecta objetos en tiempo real
  con canvas overlay y métricas en vivo
- **Evaluación de precisión** — métricas descriptivas automáticas; soporte de
  ground truth para Precision / Recall / F1
- **Resumen de sesión** — acumulado de detecciones, clase más frecuente y
  estadísticas globales

---

## 🗂️ Estructura del proyecto

```
VisionArtificialUCV/
│
├── backend/
│   ├── app.py           ← API REST (Flask) — 4 endpoints
│   ├── detector.py      ← Módulo YOLOv8 (detección desde archivo o bytes)
│   ├── evaluator.py     ← Métricas: IoU, Precision, Recall, F1
│   ├── models/
│   │   └── yolov8n.pt   ← Descarga automática al primer uso
│   ├── uploads/
│   │   └── imagenes_subidas/
│   └── results/
│
├── frontend/
│   ├── index.html               ← Página de inicio
│   ├── deteccion-imagen.html    ← Detección por imagen
│   ├── deteccion-camara.html    ← Detección por cámara
│   ├── css/
│   │   ├── style.css    ← Variables globales y componentes compartidos
│   │   ├── home.css     ← Estilos de la página de inicio
│   │   ├── imagen.css   ← Estilos de detección por imagen
│   │   └── camara.css   ← Estilos de detección por cámara
│   ├── js/
│   │   ├── home.js      ← Animaciones de la página de inicio
│   │   ├── imagen.js    ← Lógica completa de detección por imagen
│   │   └── camara.js    ← Lógica completa de detección por cámara
│   └── assets/
│       ├── logo_ucv.png
│       └── icons/
│
├── dataset/
│   ├── imagenes/        ← Imágenes de prueba
│   ├── etiquetas/       ← Anotaciones YOLO (.txt)
│   └── README_DATASET.md
│
├── docs/
│   ├── manual_usuario.pdf
│   └── informe_final.docx
│
├── requirements.txt
└── README.md
```

---

## ⚙️ Requisitos

| Herramienta  | Versión mínima | Notas                              |
|--------------|----------------|------------------------------------|
| Python       | 3.9+           | Recomendado 3.10 o 3.11            |
| pip          | 23+            | `python -m pip install --upgrade pip` |
| Navegador    | Moderno        | Chrome, Edge o Firefox reciente    |
| Cámara web   | Opcional       | Solo para detección en tiempo real |

> **GPU opcional** — el sistema funciona en CPU. Con una GPU NVIDIA compatible
> con CUDA, la detección es significativamente más rápida.

---

## 🚀 Instalación y ejecución

### 1. Clonar o descargar el proyecto

```bash
# Opción A: clonar con git
git clone <url-del-repositorio>
cd VisionArtificialUCV

# Opción B: descomprimir el ZIP y entrar a la carpeta
cd VisionArtificialUCV
```

### 2. Crear entorno virtual (recomendado)

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

> La primera instalación descarga PyTorch (~200 MB). Ten paciencia.

### 4. Iniciar el servidor backend

```bash
cd backend
python app.py
```

Deberías ver:

```
=======================================================
  Sistema Inteligente de Visión Artificial - UCV 2026
  Servidor corriendo en http://localhost:5000
=======================================================
```

> La primera vez que se detecte una imagen, YOLOv8 descargará automáticamente
> el modelo `yolov8n.pt` (~6 MB) en la carpeta `backend/models/`.

### 5. Abrir el frontend

Con el servidor corriendo, abre en tu navegador:

```
frontend/index.html
```

O haz doble clic sobre el archivo `index.html` en tu explorador de archivos.

---

## 🔌 API Endpoints

| Método | Ruta                    | Descripción                              |
|--------|-------------------------|------------------------------------------|
| GET    | `/`                     | Health check — info del servidor         |
| POST   | `/api/detect/image`     | Detección desde imagen (multipart/form)  |
| POST   | `/api/detect/camera`    | Detección desde frame base64 (JSON)      |
| GET    | `/api/session/summary`  | Resumen acumulado de la sesión           |
| POST   | `/api/session/reset`    | Limpiar historial de sesión              |

### Ejemplo — detección por imagen (cURL)

```bash
curl -X POST http://localhost:5000/api/detect/image \
  -F "image=@foto.jpg" \
  -F "confidence=25"
```

### Respuesta

```json
{
  "success": true,
  "total": 3,
  "detections": [
    { "label": "person", "confidence": 91.4, "bbox": {"x1":50,"y1":30,"x2":200,"y2":400} },
    { "label": "laptop", "confidence": 78.2, "bbox": {"x1":210,"y1":150,"x2":420,"y2":310} },
    { "label": "cup",    "confidence": 55.7, "bbox": {"x1":430,"y1":280,"x2":500,"y2":370} }
  ],
  "image_b64": "<imagen anotada en base64>",
  "metrics": {
    "total_detections": 3,
    "avg_confidence": 75.1,
    "confidence_grade": "Buena"
  }
}
```

---

## 📐 Métricas de evaluación

### Sin ground truth (automático)

| Métrica           | Descripción                                      |
|-------------------|--------------------------------------------------|
| Confianza promedio| Media de los scores de confianza de YOLO         |
| Confianza máx/mín | Rango de confianza en la imagen                  |
| Calificación      | Excelente / Buena / Aceptable / Baja             |

### Con ground truth (manual)

| Métrica    | Fórmula                                      |
|------------|----------------------------------------------|
| Precision  | TP / (TP + FP)                               |
| Recall     | TP / (TP + FN)                               |
| F1-Score   | 2 × (P × R) / (P + R)                       |
| IoU        | Intersección / Unión de bounding boxes       |

El umbral de IoU por defecto es **0.50** (estándar COCO).

---

## 🛠️ Tecnologías utilizadas

| Capa       | Tecnología          | Versión  |
|------------|---------------------|----------|
| Detección  | YOLOv8 (Ultralytics)| 8.2.x    |
| Backend    | Flask               | 3.0.x    |
| CORS       | Flask-CORS          | 4.0.x    |
| CV         | OpenCV              | 4.10.x   |
| Imágenes   | Pillow              | 10.x     |
| Frontend   | HTML5 / CSS3 / JS   | Vanilla  |
| Fuentes    | Google Fonts (Syne, DM Sans) | —  |

---

## 🐛 Solución de problemas frecuentes

**El servidor no inicia**
```
ModuleNotFoundError: No module named 'flask'
```
→ Asegúrate de haber activado el entorno virtual y corrido `pip install -r requirements.txt`.

---

**La cámara no se activa**
```
NotAllowedError: Permission denied
```
→ En Chrome/Edge ve a `Configuración → Privacidad → Cámara` y permite el acceso.
Si abres el HTML como archivo local (`file://`), algunos navegadores bloquean la cámara;
sirve el frontend con un servidor local:
```bash
cd frontend
python -m http.server 8080
# Luego abre: http://localhost:8080
```

---

**El modelo no descarga automáticamente**

Descárgalo manualmente y colócalo en `backend/models/`:
```bash
# Desde Python
from ultralytics import YOLO
YOLO('yolov8n.pt')   # descarga y cachea el modelo
```

---

**CORS error en el navegador**

Asegúrate de que el backend esté corriendo en `http://localhost:5000` y que
`flask-cors` esté instalado. El archivo `app.py` ya tiene `CORS(app)` configurado.

---

## 👥 Autores

Proyecto universitario desarrollado para el curso de **Ingeniería de Sistemas**
en la **Universidad César Vallejo**, sede __________, 2026.

| Nombre         | Rol                     |
|----------------|-------------------------|
| ______________ | Desarrollo backend      |
| ______________ | Desarrollo frontend     |
| ______________ | Evaluación y dataset    |

**Docente asesor:** ______________________________

---

## 📄 Licencia

Proyecto académico — Universidad César Vallejo 2026.
Uso exclusivo educativo y de investigación.