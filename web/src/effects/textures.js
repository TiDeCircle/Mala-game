// Procedural canvas textures (steam puff, corrugated stainless, amber rail tags, tray contact AO)
import * as THREE from 'three';

export function createSteamTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 250, 244, 0.42)');
  grad.addColorStop(0.5, 'rgba(255, 245, 236, 0.16)');
  grad.addColorStop(1, 'rgba(255, 245, 236, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createCorrugatedStainlessTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  for (let x = 0; x < 256; x++) {
    const v = 165 + Math.round(Math.sin((x / 256) * Math.PI * 36) * 32);
    ctx.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
    ctx.fillRect(x, 0, 1, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Authentic Thai Mala Shop amber-gold label with Thai name + Chinese subtitle
export function createChillerRailTag(thaiName, cnName) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 112;
  const ctx = c.getContext('2d');

  // Warm amber-brown / gold card like reference photo
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#c98834');
  grad.addColorStop(1, '#9c621d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  // Crisp inner border
  ctx.strokeStyle = '#ffe3a3';
  ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, c.width - 10, c.height - 10);

  // Thai title
  ctx.fillStyle = '#1b1108';
  ctx.font = 'bold 34px Kanit, Prompt, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(thaiName, c.width / 2, 42, c.width - 22);

  // Chinese subtitle
  if (cnName) {
    ctx.fillStyle = '#fff5dc';
    ctx.font = '600 24px Prompt, sans-serif';
    ctx.fillText(cnName, c.width / 2, 82, c.width - 24);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(0.095, 0.042),
    new THREE.MeshBasicMaterial({ map: tex })
  );
}

export function createTrayAOTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grad.addColorStop(0, 'rgba(18, 12, 8, 0.42)');
  grad.addColorStop(0.68, 'rgba(18, 12, 8, 0.28)');
  grad.addColorStop(1, 'rgba(18, 12, 8, 0.05)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
