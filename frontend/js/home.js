/**
 * home.js  —  Página de Inicio
 * Sistema Inteligente de Visión Artificial · UCV 2026
 *
 * Funcionalidad:
 *   - Animación de entrada de los contadores de stats
 *   - Efecto hover mejorado en las cards de modo
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Animación de contadores en stats ───────────────────── */
  const statValues = document.querySelectorAll('.stat-item__value');

  statValues.forEach(el => {
    const raw    = el.textContent.trim();
    const number = parseInt(raw);          // NaN si no es numérico (ej. "YOLOv8", "RT")
    if (isNaN(number)) return;

    el.textContent = '0';
    let start    = null;
    const duration = 1000;

    const step = timestamp => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);  // ease-out cubic
      el.textContent = Math.floor(eased * number) + (raw.includes('+') ? '+' : '');
      if (progress < 1) requestAnimationFrame(step);
    };

    // Observador para arrancar cuando el elemento sea visible
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          requestAnimationFrame(step);
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });

    observer.observe(el);
  });


  /* ── Efecto cursor magnético en las mode-cards ──────────── */
  const cards = document.querySelectorAll('.mode-card');

  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect  = card.getBoundingClientRect();
      const x     = ((e.clientX - rect.left) / rect.width  - 0.5) * 8;
      const y     = ((e.clientY - rect.top)  / rect.height - 0.5) * 8;
      card.style.transform = `translateY(-3px) rotateX(${-y}deg) rotateY(${x}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

});