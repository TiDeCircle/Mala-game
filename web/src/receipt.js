// Photo & Thai receipt modal, plus the downloadable 1080×1350 share card.
import { INGREDIENT_MAP, PRICE_PER_100G } from './catalog.js';
import { audio } from './audio.js';
import {
  state,
  dom,
  renderer,
  scene,
  camera,
  getTotalWeight,
  getTotalPrice,
  currentBroth,
  currentSpice,
} from './core/context.js';

let lastCapturedDataUrl = '';

export function openReceiptModal() {
  audio.playServeChime();
  renderer.render(scene, camera);
  lastCapturedDataUrl = dom.canvas.toDataURL('image/png');
  dom.receiptImg.src = lastCapturedDataUrl;

  const broth = currentBroth();
  const spice = currentSpice();
  const grams = getTotalWeight();
  const price = getTotalPrice();

  const counts = {};
  state.picked.forEach((p) => {
    counts[p.id] = (counts[p.id] || 0) + 1;
  });

  const itemLines = Object.entries(counts)
    .map(([id, qty]) => {
      const info = INGREDIENT_MAP[id];
      const w = info.weight * qty;
      return `<div class="receipt-line"><span>${info.name} ×${qty}</span><span>${w}g</span></div>`;
    })
    .join('');

  const nowStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  dom.receiptPaper.innerHTML = `
    <h4>🌶️ ร้านหม่าล่าชั่งขีด</h4>
    <div class="receipt-sub">ขีดละ ${PRICE_PER_100G}.- ฟรีซุป + เครื่องปรุง · เวลา ${nowStr}</div>
    <div class="receipt-divider"></div>
    <div class="receipt-line"><strong>น้ำซุป</strong><span>${broth.name}</span></div>
    <div class="receipt-line"><strong>ความเผ็ด</strong><span>${spice.label} ${spice.badge}</span></div>
    <div class="receipt-divider"></div>
    ${itemLines}
    <div class="receipt-divider"></div>
    <div class="receipt-line"><span>น้ำหนักรวม</span><strong>${grams} กรัม (${(grams / 100).toFixed(1)} ขีด)</strong></div>
    <div class="receipt-total"><span>ยอดรวมสุทธิ</span><span>฿${price}.-</span></div>
  `;

  dom.receiptModal.classList.remove('hidden');
}

export function downloadPhotoAndReceipt() {
  if (!lastCapturedDataUrl) return;
  const img = new Image();
  img.onload = () => {
    const out = document.createElement('canvas');
    out.width = 1080;
    out.height = 1350;
    const ctx = out.getContext('2d');

    ctx.fillStyle = '#fff9f0';
    ctx.fillRect(0, 0, out.width, out.height);

    const pad = 48;
    const photoW = out.width - pad * 2;
    const photoH = 740;
    const srcAspect = img.width / img.height;
    const dstAspect = photoW / photoH;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (srcAspect > dstAspect) {
      sw = img.height * dstAspect;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / dstAspect;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, pad, pad, photoW, photoH);

    const broth = currentBroth();
    const spice = currentSpice();
    const grams = getTotalWeight();
    const price = getTotalPrice();

    ctx.fillStyle = '#241c18';
    ctx.font = 'bold 46px Kanit, Prompt, sans-serif';
    ctx.fillText('🌶️ ร้านหม่าล่าชั่งขีด — ชามของฉัน', pad, photoH + 120);

    ctx.fillStyle = '#6b5b52';
    ctx.font = '28px Prompt, sans-serif';
    ctx.fillText(`${broth.name} · ${spice.label} ${spice.badge}`, pad, photoH + 172);
    ctx.fillText(
      `ทั้งหมด ${state.picked.length} ชิ้น · น้ำหนัก ${grams} กรัม (${(grams / 100).toFixed(1)} ขีด)`,
      pad,
      photoH + 220
    );

    ctx.fillStyle = '#c83214';
    ctx.font = 'bold 64px Kanit, Prompt, sans-serif';
    ctx.fillText(`฿${price}.-`, pad, photoH + 310);

    ctx.fillStyle = '#9b8a80';
    ctx.font = '24px Prompt, sans-serif';
    ctx.fillText(`Cozy Mala Maker · ขีดละ ${PRICE_PER_100G}.- ฟรีซุป + เครื่องปรุง`, pad, out.height - 48);

    const a = document.createElement('a');
    a.download = `my-mala-bowl-${price}baht.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  };
  img.src = lastCapturedDataUrl;
}
