/**
 * imagen.js  —  Página Detección por Imagen
 * Sistema Inteligente de Visión Artificial · UCV 2026
 *
 * Funcionalidad:
 *   - Drag & drop / click para seleccionar imagen
 *   - Slider de umbral de confianza
 *   - Envío al backend POST /api/detect/image
 *   - Renderizado de imagen anotada (base64)
 *   - Lista de objetos detectados con barra de confianza
 *   - Métricas de precisión
 *   - Toast de notificaciones
 */

const API_BASE = 'http://localhost:5000';

/* ── Referencias al DOM ──────────────────────────────────── */
const dropzone        = document.getElementById('dropzone');
const fileInput       = document.getElementById('fileInput');
const btnClearImage   = document.getElementById('btnClearImage');
const confSlider      = document.getElementById('confSlider');
const confValue       = document.getElementById('confValue');
const btnAnalyze      = document.getElementById('btnAnalyze');
const btnAnalyzeText  = document.getElementById('btnAnalyzeText');
const emptyResult     = document.getElementById('emptyResult');
const resultImageWrap = document.getElementById('resultImageWrap');
const resultImage     = document.getElementById('resultImage');
const totalBadge      = document.getElementById('totalBadge');
const totalCount      = document.getElementById('totalCount');
const detectionsList  = document.getElementById('detectionsList');
const metricsRow      = document.getElementById('metricsRow');
const mTotal          = document.getElementById('mTotal');
const mAvgConf        = document.getElementById('mAvgConf');
const mGrade          = document.getElementById('mGrade');
const toast           = document.getElementById('toast');

/* ── Estado ──────────────────────────────────────────────── */
let selectedFile = null;
let toastTimeout = null;

/* ══════════════════════════════════════════════════════════
   SLIDER DE CONFIANZA
   ══════════════════════════════════════════════════════════ */
confSlider.addEventListener('input', () => {
  confValue.textContent = confSlider.value + '%';
});


/* ══════════════════════════════════════════════════════════
   DRAG & DROP
   ══════════════════════════════════════════════════════════ */
dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelected(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
});


/* ══════════════════════════════════════════════════════════
   MANEJO DE ARCHIVO SELECCIONADO
   ══════════════════════════════════════════════════════════ */
function handleFileSelected(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showToast('⚠️ Formato no válido. Usa JPG, PNG o WEBP.', 'warn');
    return;
  }
  if (file.size > 16 * 1024 * 1024) {
    showToast('⚠️ Imagen demasiado grande (máx. 16 MB).', 'warn');
    return;
  }

  selectedFile = file;

  /* Mostrar preview en dropzone */
  const reader = new FileReader();
  reader.onload = e => {
    dropzone.classList.add('dropzone--preview');
    dropzone.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
  };
  reader.readAsDataURL(file);

  btnAnalyze.disabled    = false;
  btnClearImage.style.display = 'inline-flex';
}


/* ══════════════════════════════════════════════════════════
   LIMPIAR IMAGEN
   ══════════════════════════════════════════════════════════ */
btnClearImage.addEventListener('click', () => {
  resetDropzone();
  resetResults();
  selectedFile           = null;
  btnAnalyze.disabled    = true;
  btnClearImage.style.display = 'none';
});

function resetDropzone() {
  dropzone.classList.remove('dropzone--preview');
  dropzone.innerHTML = `
    <div class="dropzone__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    </div>
    <div class="dropzone__title">Seleccionar imagen</div>
    <div class="dropzone__hint">
      Haz clic para cargar una imagen desde tu dispositivo<br>
      Formatos: JPG, PNG, WEBP
    </div>
    <input type="file" id="fileInput" accept=".jpg,.jpeg,.png,.webp" />
  `;
  /* Reconectar listener al nuevo input */
  document.getElementById('fileInput').addEventListener('change', e => {
    if (e.target.files[0]) handleFileSelected(e.target.files[0]);
  });
}

function resetResults() {
  emptyResult.style.display     = '';
  resultImageWrap.style.display = 'none';
  resultImage.src               = '';
  totalBadge.style.display      = 'none';
  detectionsList.innerHTML      = `
    <div class="empty-state" style="padding:24px;">
      <p>Sin detecciones aún</p>
    </div>
  `;
  mTotal.textContent    = '—';
  mAvgConf.textContent  = '—';
  mGrade.textContent    = '—';
}


/* ══════════════════════════════════════════════════════════
   BOTÓN ANALIZAR  →  llamada al backend
   ══════════════════════════════════════════════════════════ */
btnAnalyze.addEventListener('click', analyzeImage);

async function analyzeImage() {
  if (!selectedFile) return;

  /* Estado de carga */
  btnAnalyze.disabled   = true;
  btnAnalyzeText.innerHTML = `
    <span class="spinner" style="color:var(--accent-blue);"></span>
    Analizando…
  `;

  try {
    const formData = new FormData();
    formData.append('image',      selectedFile);
    formData.append('confidence', confSlider.value);

    const response = await fetch(`${API_BASE}/api/detect/image`, {
      method: 'POST',
      body:   formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Error ${response.status}`);
    }

    const data = await response.json();
    renderResults(data);
    showToast(`✅ ${data.total} objeto(s) detectado(s)`, 'success');

  } catch (error) {
    console.error('Error al analizar:', error);
    showToast(`❌ ${error.message}`, 'error');
  } finally {
    btnAnalyze.disabled      = false;
    btnAnalyzeText.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      Analizar Imagen
    `;
  }
}


/* ══════════════════════════════════════════════════════════
   RENDERIZAR RESULTADOS
   ══════════════════════════════════════════════════════════ */
function renderResults(data) {
  /* ── Imagen anotada ─────────────────────────────── */
  emptyResult.style.display     = 'none';
  resultImageWrap.style.display = 'flex';
  resultImage.src               = `data:image/jpeg;base64,${data.image_b64}`;

  /* Badge total */
  totalBadge.style.display = 'inline-flex';
  totalCount.textContent   = data.total;

  /* ── Lista de detecciones ───────────────────────── */
  if (data.total === 0) {
    detectionsList.innerHTML = `
      <div class="empty-state" style="padding:24px;">
        <p>No se detectaron objetos con el umbral actual.<br>Prueba bajando la confianza.</p>
      </div>
    `;
  } else {
    detectionsList.innerHTML = '';
    data.detections.forEach((det, i) => {
      const tier = confTier(det.confidence);
      const tag  = document.createElement('div');
      tag.className   = 'detection-tag';
      tag.style.animationDelay = `${i * 50}ms`;
      tag.innerHTML   = `
        <span class="detection-tag__label">${det.label}</span>
        <span class="detection-tag__conf ${tier.cls}">${det.confidence}%</span>
      `;

      /* Barra de confianza debajo */
      const bar = document.createElement('div');
      bar.className = 'detection-tag__bar';
      bar.innerHTML = `
        <div class="detection-tag__bar-fill ${tier.bar}"
             style="width:0%;"></div>
      `;
      tag.appendChild(bar);
      detectionsList.appendChild(tag);

      /* Animar barra con pequeño delay */
      requestAnimationFrame(() => {
        setTimeout(() => {
          bar.querySelector('.detection-tag__bar-fill').style.width = det.confidence + '%';
        }, 60 + i * 40);
      });
    });
  }

  /* ── Métricas ───────────────────────────────────── */
  const m = data.metrics;
  mTotal.textContent   = m.total_detections;
  mAvgConf.textContent = m.avg_confidence + '%';
  mGrade.textContent   = m.confidence_grade;
}


/* ══════════════════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════════════════ */

/** Devuelve clases CSS según nivel de confianza */
function confTier(conf) {
  if (conf >= 70) return { cls: 'conf-high',   bar: 'bar-high'   };
  if (conf >= 45) return { cls: 'conf-medium', bar: 'bar-medium' };
  return              { cls: 'conf-low',    bar: 'bar-low'    };
}

/** Muestra un toast temporal */
function showToast(msg, type = 'info') {
  clearTimeout(toastTimeout);
  toast.textContent    = msg;
  toast.style.display  = 'flex';
  toast.style.borderColor = type === 'success' ? 'rgba(74,222,128,0.35)'
                          : type === 'error'   ? 'rgba(248,113,113,0.35)'
                          : type === 'warn'    ? 'rgba(251,191,36,0.35)'
                          : 'var(--border-light)';
  toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}