// Stage 2 — cashier counter with the glowing digital scale.
import * as THREE from 'three';
import { PRICE_PER_100G } from '../catalog.js';
import { assets } from '../assetLoader.js';
import { audio } from '../audio.js';
import { scene, STATION_X, getTotalWeight, priceForGrams } from '../core/context.js';

let digitalScaleCanvas = null;
let digitalScaleCtx = null;
let digitalScaleTex = null;
let scaleDisplayGrams = 0;
let scaleTargetGrams = 0;

function createDigitalScaleDisplay() {
  digitalScaleCanvas = document.createElement('canvas');
  digitalScaleCanvas.width = 512;
  digitalScaleCanvas.height = 160;
  digitalScaleCtx = digitalScaleCanvas.getContext('2d');
  digitalScaleTex = new THREE.CanvasTexture(digitalScaleCanvas);
  digitalScaleTex.colorSpace = THREE.SRGBColorSpace;
  drawDigitalScaleLCD(0);

  return new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.095),
    new THREE.MeshBasicMaterial({ map: digitalScaleTex })
  );
}

function drawDigitalScaleLCD(grams) {
  if (!digitalScaleCtx || !digitalScaleTex) return;
  const ctx = digitalScaleCtx;
  const w = digitalScaleCanvas.width;
  const h = digitalScaleCanvas.height;

  // Dark commercial digital scale bezel
  ctx.fillStyle = '#121619';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#3c464f';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  const boxes = [
    { x: 14, w: 152, label: 'WEIGHT (g)', value: Math.round(grams).toString().padStart(4, '0'), color: '#4cff8f' },
    { x: 180, w: 136, label: '฿ / 100g', value: `${PRICE_PER_100G}.00`, color: '#ffd84d' },
    { x: 330, w: 168, label: 'TOTAL (฿)', value: priceForGrams(grams).toFixed(2), color: '#ff5238' },
  ];

  boxes.forEach((b) => {
    // Recessed dark LCD window
    ctx.fillStyle = '#070a0b';
    ctx.fillRect(b.x, 36, b.w, 104);
    ctx.strokeStyle = '#252d33';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, 36, b.w, 104);

    // Header label
    ctx.fillStyle = '#a8b5bf';
    ctx.font = 'bold 18px Prompt, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, 20);

    // Glowing LED digits
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = b.color;
    ctx.font = 'bold 42px Consolas, "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(b.value, b.x + b.w - 10, 92);
    ctx.shadowBlur = 0;
  });

  digitalScaleTex.needsUpdate = true;
}

export function buildWeighStation() {
  const wx = STATION_X.weigh;
  const weighLight = new THREE.SpotLight(0xffd29e, 1.75, 4.5, Math.PI / 4.5, 0.68);
  weighLight.position.set(wx - 0.15, 2.2, 0.55);
  weighLight.target.position.set(wx, 0.95, -0.25);
  weighLight.castShadow = true;
  scene.add(weighLight, weighLight.target);

  const counter = assets.clone('CashierCounter');
  if (counter) {
    counter.position.set(wx + 0.05, 0, -0.32);
    scene.add(counter);
  }

  // Commercial Digital Scale (Shop_DigitalScale + live glowing LED readout!)
  const digitalScaleGroup = new THREE.Group();
  digitalScaleGroup.position.set(wx - 0.16, 0.9, -0.18);
  digitalScaleGroup.rotation.y = 0.22;

  const digitalScale = assets.clone('Shop_DigitalScale');
  if (digitalScale) {
    digitalScale.scale.setScalar(0.88);
    digitalScaleGroup.add(digitalScale);
  }

  // Angled glowing LED screen mounted cleanly on the front face of the digital scale
  const lcdScreen = createDigitalScaleDisplay();
  lcdScreen.position.set(0.0, 0.056, 0.205);
  lcdScreen.rotation.x = -0.32;
  digitalScaleGroup.add(lcdScreen);
  scene.add(digitalScaleGroup);

  const priceBoard = assets.clone('PriceBoard');
  if (priceBoard) {
    priceBoard.position.set(wx + 0.28, 0.9, -0.58);
    priceBoard.rotation.y = -0.18;
    scene.add(priceBoard);
  }

  const qrStand = assets.clone('QRPaymentStand');
  if (qrStand) {
    qrStand.position.set(wx + 0.36, 0.9, -0.18);
    qrStand.rotation.y = -0.35;
    scene.add(qrStand);
  }
}

export function enterWeigh(pickBowlGroup) {
  pickBowlGroup.visible = true;
  // Place PickBowl directly on top of the stainless pan of Shop_DigitalScale
  pickBowlGroup.position.set(STATION_X.weigh - 0.16, 0.9 + 0.114, -0.18);
  scaleDisplayGrams = 0;
  scaleTargetGrams = getTotalWeight();
  drawDigitalScaleLCD(0);
  audio.playScaleTick();
}

// Digital scale smooth LED count-up animation
export function updateWeigh(dt) {
  if (Math.abs(scaleTargetGrams - scaleDisplayGrams) <= 0.2) return;
  scaleDisplayGrams += (scaleTargetGrams - scaleDisplayGrams) * Math.min(1, dt * 6.5);
  if (Math.abs(scaleTargetGrams - scaleDisplayGrams) <= 0.5) {
    scaleDisplayGrams = scaleTargetGrams;
  }
  drawDigitalScaleLCD(scaleDisplayGrams);
}
