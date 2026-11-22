// Stage 2 — handwritten paper order slip (freehand pen + checkbox detection).
import { BROTHS, SPICE_LEVELS } from '../catalog.js';
import { audio } from '../audio.js';
import { state, dom } from '../core/context.js';

let slipPenColor = '#1a4bb8';
let slipDrawing = false;
let slipLastPt = null;
let slipCtx = null;
let lastPenSoundTime = 0;

export function resizeOrderSlipCanvas(clear = false) {
  if (!dom.orderSlipCanvas || !dom.orderPaperWrap) return;
  const bg = dom.orderPaperWrap.querySelector('.order-paper-bg');
  if (!bg) return;
  const w = bg.offsetWidth;
  const h = bg.offsetHeight;
  if (w === 0 || h === 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = Math.round(w * dpr);
  const targetH = Math.round(h * dpr);

  if (dom.orderSlipCanvas.width !== targetW || dom.orderSlipCanvas.height !== targetH) {
    dom.orderSlipCanvas.style.width = `${w}px`;
    dom.orderSlipCanvas.style.height = `${h}px`;
    dom.orderSlipCanvas.width = targetW;
    dom.orderSlipCanvas.height = targetH;
    slipCtx = dom.orderSlipCanvas.getContext('2d');
    slipCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  } else if (clear && slipCtx) {
    slipCtx.clearRect(0, 0, w, h);
  }
}

function detectSlipCheckboxAt(clientX, clientY) {
  const options = dom.orderPaperWrap.querySelectorAll('.slip-option');
  for (const el of options) {
    const r = el.getBoundingClientRect();
    // Generous hit area covering the checkbox + label text
    if (clientX >= r.left - 4 && clientX <= r.right + 4 && clientY >= r.top - 2 && clientY <= r.bottom + 2) {
      if (el.dataset.broth) {
        if (state.brothId !== el.dataset.broth) {
          state.brothId = el.dataset.broth;
          dom.orderPaperWrap.querySelectorAll('[data-broth]').forEach((n) => n.classList.remove('detected'));
          el.classList.add('detected');
        }
      } else if (el.dataset.spice !== undefined) {
        const spId = Number(el.dataset.spice);
        if (state.spiceId !== spId) {
          state.spiceId = spId;
          dom.orderPaperWrap.querySelectorAll('[data-spice]').forEach((n) => n.classList.remove('detected'));
          el.classList.add('detected');
        }
      } else if (el.dataset.extra) {
        el.classList.add('detected');
      }
      break;
    }
  }
}

function initOrderSlipDrawing() {
  if (!dom.orderSlipCanvas) return;

  // Pen color switcher
  document.querySelectorAll('.pen-dot').forEach((btn) => {
    btn.addEventListener('click', () => {
      slipPenColor = btn.dataset.color || '#1a4bb8';
      document.querySelectorAll('.pen-dot').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  dom.btnClearInk.addEventListener('click', () => {
    resizeOrderSlipCanvas(true);
    dom.orderPaperWrap.querySelectorAll('[data-extra]').forEach((n) => n.classList.remove('detected'));
    audio.playTongsClick();
  });

  const getLocalPt = (e) => {
    const rect = dom.orderSlipCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  dom.orderSlipCanvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    resizeOrderSlipCanvas(false);
    if (!slipCtx) return;
    dom.orderSlipCanvas.setPointerCapture(e.pointerId);
    slipDrawing = true;
    slipLastPt = getLocalPt(e);

    // Draw initial ballpoint ink dot
    slipCtx.fillStyle = slipPenColor;
    slipCtx.beginPath();
    slipCtx.arc(slipLastPt.x, slipLastPt.y, 1.3, 0, Math.PI * 2);
    slipCtx.fill();

    detectSlipCheckboxAt(e.clientX, e.clientY);
    audio.playPenTick();
  });

  dom.orderSlipCanvas.addEventListener('pointermove', (e) => {
    if (!slipDrawing || !slipCtx || !slipLastPt) return;
    const pt = getLocalPt(e);
    const dist = Math.hypot(pt.x - slipLastPt.x, pt.y - slipLastPt.y);
    if (dist < 1.2) return;

    slipCtx.strokeStyle = slipPenColor;
    slipCtx.lineWidth = Math.max(1.8, Math.min(2.8, 2.5 - dist * 0.03));
    slipCtx.lineCap = 'round';
    slipCtx.lineJoin = 'round';
    slipCtx.beginPath();
    slipCtx.moveTo(slipLastPt.x, slipLastPt.y);
    slipCtx.lineTo(pt.x, pt.y);
    slipCtx.stroke();

    slipLastPt = pt;
    detectSlipCheckboxAt(e.clientX, e.clientY);

    const now = performance.now();
    if (now - lastPenSoundTime > 95) {
      lastPenSoundTime = now;
      audio.playPenTick();
    }
  });

  const endStroke = () => {
    slipDrawing = false;
    slipLastPt = null;
  };
  dom.orderSlipCanvas.addEventListener('pointerup', endStroke);
  dom.orderSlipCanvas.addEventListener('pointercancel', endStroke);
}

export function initOrderSlip() {
  // Printed Order Slip: Broths (7 authentic options)
  BROTHS.forEach((broth) => {
    const row = document.createElement('div');
    row.className = `slip-option ${broth.id === state.brothId ? 'detected' : ''}`;
    row.dataset.broth = broth.id;
    row.innerHTML = `<span class="slip-box"></span><span>${broth.name}</span>`;
    dom.brothListEl.appendChild(row);
  });

  // Printed Order Slip: Spice Levels (4 authentic options)
  SPICE_LEVELS.forEach((sp) => {
    const row = document.createElement('div');
    row.className = `slip-option ${sp.id === state.spiceId ? 'detected' : ''}`;
    row.dataset.spice = String(sp.id);
    row.innerHTML = `<span class="slip-box"></span><span>${sp.label}</span>`;
    dom.spiceListEl.appendChild(row);
  });

  initOrderSlipDrawing();
}
