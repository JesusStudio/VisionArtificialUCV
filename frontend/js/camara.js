/**
 * camara.js  —  Página Detección por Cámara
 * Sistema Inteligente de Visión Artificial · UCV 2026
 *
 * Funcionalidad:
 *   - Activar / detener cámara web (getUserMedia)
 *   - Capturar frames a intervalo configurable
 *   - Enviar frame al backend POST /api/detect/camera (base64)
 *   - Dibujar bounding boxes sobre canvas overlay
 *   - Lista de detecciones en tiempo real
 *   - Métricas en vivo + resumen de sesión
 *   - FPS estimado
 *   - Toast de notificaciones
 */

const API_BASE = 'http://localhost:5000';

/* ── Referencias al DOM ──────────────────────────────────── */
const videoEl          = document.getElementById('videoEl');
const overlayCanvas    = document.getElementById('overlayCanvas');
const cameraInactive   = document.getElementById('cameraInactive');
const recBadge         = document.getElementById('recBadge');
const fpsBadge         = document.getElementById('fpsBadge');
const btnCamera        = document.getElementById('btnCamera');
const btnCameraText    = document.getElementById('btnCameraText');
const confSlider       = document.getElementById('confSlider');
const confValue        = document.getElementById('confValue');
const intervalSelect   = document.getElementById('intervalSelect');
const emptyDetections  = document.getElementById('emptyDetections');
const detectionsList   = document.getElementById('detectionsList');
const liveTotalBadge   = document.getElementById('liveTotalBadge');
const liveTotal        = document.getElementById('liveTotal');
const mTotal           = document.getElementById('mTotal');
const mAvgConf         = document.getElementById('mAvgConf');
const mFrames          = document.getElementById('mFrames');
const sFrames          = document.getElementById('sFrames');
const sDetections      = document.getElementById('sDetections');
const sTopClass        = document.getElementById('sTopClass');
const btnResetSession  = document.getElementById('btnResetSession');
const toast            = document.getElementById('toast');

const ctx = overlayCanvas.getContext('2d');

/* ── Estado ──────────────────────────────────────────────── */
let stream         = null;      // MediaStream
let detectionTimer = null;      // setInterval handle
let isRunning      = false;

let frameCount      = 0;
let totalDetections = 0;
let classCounts     = {};       // { label: count }
let toastTimeout    = null;
let lastFrameTime   = null;
let currentFps      = 0;

/* Colores para bounding boxes por clase */
const COLOR_PALETTE = [
  '#3b82f6','#f97316','#22c55e','#a855f7',
  '#eab308','#06b6d4','#ef4444','#10b981',
];
const classColorMap = {};

/* ══════════════════════════════════════════════════════════
   SLIDER DE CONFIANZA
   ══════════════════════════════════════════════════════════ */
confSlider.addEventListener('input', () => {
  confValue.textContent = confSlider.value + '%';
});


/* ══════════════════════════════════════════════════════════
   BOTÓN ACTIVAR / DETENER CÁMARA
   ══════════════════════════════════════════════════════════ */
btnCamera.addEventListener('click', () => {
  isRunning ? stopCamera() : startCamera();
});

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
      audio: false,
    });

    videoEl.srcObject = stream;
    await videoEl.play();

    /* Mostrar video, ocultar estado inactivo */
    cameraInactive.style.display = 'none';
    videoEl.style.display        = 'block';
    recBadge.classList.add('active');
    fpsBadge.classList.add('active');

    /* Botón → detener */
    btnCamera.classList.add('active');
    btnCameraText.textContent = 'Detener Cámara';
    isRunning = true;

    /* Sincronizar canvas con video */
    videoEl.addEventListener('loadedmetadata', syncCanvas);
    syncCanvas();

    /* Arrancar detección periódica */
    const interval = parseInt(intervalSelect.value);
    detectionTimer = setInterval(captureAndDetect, interval);

    showToast('📷 Cámara activada correctamente', 'success');

  } catch (err) {
    console.error('Error al acceder a la cámara:', err);
    const msg = err.name === 'NotAllowedError'
      ? '❌ Permiso de cámara denegado. Habilítalo en tu navegador.'
      : `❌ No se pudo acceder a la cámara: ${err.message}`;
    showToast(msg, 'error');
  }
}

function stopCamera() {
  /* Detener stream */
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  clearInterval(detectionTimer);
  detectionTimer = null;
  isRunning      = false;

  /* Limpiar canvas */
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  /* UI */
  videoEl.style.display        = 'none';
  cameraInactive.style.display = 'flex';
  recBadge.classList.remove('active');
  fpsBadge.classList.remove('active');
  btnCamera.classList.remove('active');
  btnCameraText.textContent = 'Activar Cámara';

  showToast('⏹ Cámara detenida', 'info');
}


/* ══════════════════════════════════════════════════════════
   SINCRONIZAR CANVAS CON VIDEO
   ══════════════════════════════════════════════════════════ */
function syncCanvas() {
  overlayCanvas.width  = videoEl.videoWidth  || videoEl.clientWidth;
  overlayCanvas.height = videoEl.videoHeight || videoEl.clientHeight;
}


/* ══════════════════════════════════════════════════════════
   CAMBIO DE INTERVALO EN VIVO
   ══════════════════════════════════════════════════════════ */
intervalSelect.addEventListener('change', () => {
  if (!isRunning) return;
  clearInterval(detectionTimer);
  const interval = parseInt(intervalSelect.value);
  detectionTimer = setInterval(captureAndDetect, interval);
});


/* ══════════════════════════════════════════════════════════
   CAPTURA DE FRAME Y ENVÍO AL BACKEND
   ══════════════════════════════════════════════════════════ */
async function captureAndDetect() {
  if (!isRunning || videoEl.readyState < 2) return;

  /* Capturar frame en canvas oculto */
  const captureCanvas  = document.createElement('canvas');
  captureCanvas.width  = videoEl.videoWidth;
  captureCanvas.height = videoEl.videoHeight;
  const captureCtx     = captureCanvas.getContext('2d');
  captureCtx.drawImage(videoEl, 0, 0);

  const frameBase64 = captureCanvas.toDataURL('image/jpeg', 0.8);

  /* Calcular FPS */
  const now = performance.now();
  if (lastFrameTime) {
    currentFps = Math.round(1000 / (now - lastFrameTime));
    fpsBadge.textContent = `${currentFps} fps`;
  }
  lastFrameTime = now;

  try {
    const response = await fetch(`${API_BASE}/api/detect/camera`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        image     : frameBase64,
        confidence: parseInt(confSlider.value),
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.success) {
      renderOverlay(data.detections, videoEl.videoWidth, videoEl.videoHeight);
      renderLiveDetections(data.detections, data.metrics);
      updateSessionStats(data.detections);
    }

  } catch (err) {
    /* Errores de red silenciosos en tiempo real para no saturar con toasts */
    console.warn('Frame detection error:', err.message);
  }
}


/* ══════════════════════════════════════════════════════════
   DIBUJAR BOUNDING BOXES EN CANVAS
   ══════════════════════════════════════════════════════════ */
function renderOverlay(detections, videoW, videoH) {
  /* Asegurar tamaño correcto */
  if (overlayCanvas.width !== videoW || overlayCanvas.height !== videoH) {
    overlayCanvas.width  = videoW;
    overlayCanvas.height = videoH;
  }

  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  detections.forEach(det => {
    const { x1, y1, x2, y2 } = det.bbox;
    const color = getClassColor(det.label);

    /* Box */
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    /* Fondo de etiqueta */
    const label     = `${det.label} ${det.confidence}%`;
    ctx.font        = 'bold 13px DM Sans, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const padX = 6, padY = 4;
    const labelH = 20;

    ctx.fillStyle = color;
    ctx.fillRect(x1, y1 - labelH - padY, textWidth + padX * 2, labelH + padY);

    /* Texto */
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x1 + padX, y1 - padY - 2);
  });
}


/* ══════════════════════════════════════════════════════════
   RENDER LISTA DETECCIONES EN TIEMPO REAL
   ══════════════════════════════════════════════════════════ */
function renderLiveDetections(detections, metrics) {
  frameCount++;
  mFrames.textContent = frameCount;

  /* Badge total */
  liveTotal.textContent    = detections.length;
  liveTotalBadge.style.display = detections.length > 0 ? 'inline-flex' : 'none';

  mTotal.textContent  = detections.length;
  mAvgConf.textContent = detections.length > 0
    ? (metrics.avg_confidence + '%')
    : '—';

  if (detections.length === 0) {
    emptyDetections.style.display  = 'flex';
    detectionsList.style.display   = 'none';
    return;
  }

  emptyDetections.style.display  = 'none';
  detectionsList.style.display   = 'flex';
  detectionsList.innerHTML       = '';

  detections.forEach((det, i) => {
    const color = getClassColor(det.label);
    const tag   = document.createElement('div');
    tag.className = 'detection-tag detection-tag--camera';
    tag.style.animationDelay = `${i * 30}ms`;
    tag.style.borderLeft     = `3px solid ${color}`;
    tag.innerHTML = `
      <span class="detection-tag__label">${det.label}</span>
      <span class="detection-tag__conf">${det.confidence}%</span>
    `;

    /* Barra */
    const bar = document.createElement('div');
    bar.className = 'detection-tag__bar';
    bar.innerHTML = `<div class="detection-tag__bar-fill" style="width:0%;background:${color};"></div>`;
    tag.appendChild(bar);
    detectionsList.appendChild(tag);

    requestAnimationFrame(() => {
      setTimeout(() => {
        bar.querySelector('.detection-tag__bar-fill').style.width = det.confidence + '%';
      }, 40 + i * 25);
    });
  });
}


/* ══════════════════════════════════════════════════════════
   ACTUALIZAR ESTADÍSTICAS DE SESIÓN
   ══════════════════════════════════════════════════════════ */
function updateSessionStats(detections) {
  totalDetections += detections.length;

  detections.forEach(det => {
    classCounts[det.label] = (classCounts[det.label] || 0) + 1;
  });

  sFrames.textContent     = frameCount;
  sDetections.textContent = totalDetections;

  const topEntry = Object.entries(classCounts)
    .sort((a, b) => b[1] - a[1])[0];
  sTopClass.textContent = topEntry ? topEntry[0] : '—';
}


/* ══════════════════════════════════════════════════════════
   RESET DE SESIÓN
   ══════════════════════════════════════════════════════════ */
btnResetSession.addEventListener('click', async () => {
  frameCount      = 0;
  totalDetections = 0;
  classCounts     = {};

  sFrames.textContent     = '0';
  sDetections.textContent = '0';
  sTopClass.textContent   = '—';
  mFrames.textContent     = '0';

  /* Notificar al backend también */
  try {
    await fetch(`${API_BASE}/api/session/reset`, { method: 'POST' });
  } catch (_) {}

  showToast('🔄 Sesión reiniciada', 'info');
});


/* ══════════════════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════════════════ */

/** Devuelve un color consistente por clase (crea si no existe) */
function getClassColor(label) {
  if (!classColorMap[label]) {
    const idx = Object.keys(classColorMap).length % COLOR_PALETTE.length;
    classColorMap[label] = COLOR_PALETTE[idx];
  }
  return classColorMap[label];
}

/** Muestra un toast temporal */
function showToast(msg, type = 'info') {
  clearTimeout(toastTimeout);
  toast.textContent   = msg;
  toast.style.display = 'flex';
  toast.style.borderColor = type === 'success' ? 'rgba(74,222,128,0.35)'
                          : type === 'error'   ? 'rgba(248,113,113,0.35)'
                          : type === 'warn'    ? 'rgba(251,191,36,0.35)'
                          : 'var(--border-light)';
  toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

/* Limpiar al cerrar la pestaña */
window.addEventListener('beforeunload', () => {
  if (isRunning) stopCamera();
});