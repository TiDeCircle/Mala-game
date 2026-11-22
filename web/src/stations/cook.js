// Stage 3 — boiling pot with bubbles, dunking noodle basket and steam.
import * as THREE from 'three';
import { assets } from '../assetLoader.js';
import { audio } from '../audio.js';
import { scene, dom, STATION_X, currentBroth } from '../core/context.js';
import { spawnSteamEmitter } from '../effects/steam.js';

const COOK_DURATION = 3200;
const potBubbles = [];
let potLiquidMesh = null;
let noodleBasketObj = null;
let cookStartTime = 0;

export function buildCookStation() {
  const cx = STATION_X.cook;
  const cookLight = new THREE.PointLight(0xff9b4a, 1.65, 3.8);
  cookLight.position.set(cx, 1.95, 0.15);
  scene.add(cookLight);

  const kitchenCounter = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.9, 0.95),
    new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.6, roughness: 0.35 })
  );
  kitchenCounter.position.set(cx, 0.45, -0.3);
  kitchenCounter.receiveShadow = true;
  scene.add(kitchenCounter);

  const pot = assets.clone('CookingPot');
  if (pot) {
    pot.position.set(cx, 0.9, -0.3);
    pot.scale.setScalar(1.1);
    scene.add(pot);
  }

  potLiquidMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.195, 0.195, 0.015, 28),
    new THREE.MeshStandardMaterial({ color: 0xa8280e, roughness: 0.2, metalness: 0.05 })
  );
  potLiquidMesh.position.set(cx, 1.135, -0.3);
  scene.add(potLiquidMesh);

  const bubbleGeo = new THREE.SphereGeometry(0.014, 10, 10);
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xffd2b3,
    roughness: 0.1,
    transparent: true,
    opacity: 0.72,
  });
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(bubbleGeo, bubbleMat);
    const angle = Math.random() * Math.PI * 2;
    const rad = Math.random() * 0.15;
    b.position.set(cx + Math.cos(angle) * rad, 1.14, -0.3 + Math.sin(angle) * rad);
    scene.add(b);
    potBubbles.push({
      mesh: b,
      phase: Math.random() * Math.PI * 2,
      speed: 3 + Math.random() * 4,
    });
  }

  noodleBasketObj = assets.clone('NoodleBasket');
  if (noodleBasketObj) {
    noodleBasketObj.position.set(cx + 0.08, 1.18, -0.22);
    noodleBasketObj.rotation.set(0.25, -0.6, 0);
    scene.add(noodleBasketObj);
  }

  spawnSteamEmitter(new THREE.Vector3(cx, 1.16, -0.3), 12, 0.22, 0.55, 'cook');
}

export function enterCook() {
  if (potLiquidMesh) potLiquidMesh.material.color.setHex(currentBroth().potColor);
  cookStartTime = performance.now();
  dom.cookBarEl.style.width = '0%';
  dom.cookStatusEl.textContent = 'กำลังลวกวัตถุดิบในหม้อ...';
  audio.startBoiling();
}

// Returns true once the cooking timer has finished.
export function updateCook(dt, elapsed) {
  const progress = Math.min(1, (performance.now() - cookStartTime) / COOK_DURATION);
  dom.cookBarEl.style.width = `${Math.round(progress * 100)}%`;

  if (progress < 0.45) {
    dom.cookStatusEl.textContent = 'กำลังลวกวัตถุดิบในหม้อ...';
  } else if (progress < 0.8) {
    dom.cookStatusEl.textContent = 'เคี่ยวน้ำซุปหม่าล่าหอมๆ...';
  } else {
    dom.cookStatusEl.textContent = 'ตักจัดลงชามเซรามิก...';
  }

  if (noodleBasketObj) {
    noodleBasketObj.position.y = 1.15 + Math.sin(elapsed * 7) * 0.045;
  }

  potBubbles.forEach((b) => {
    const s = 0.5 + 0.65 * Math.abs(Math.sin(elapsed * b.speed + b.phase));
    b.mesh.scale.setScalar(s);
    b.mesh.position.y = 1.138 + Math.max(0, Math.sin(elapsed * b.speed + b.phase)) * 0.012;
  });

  return progress >= 1;
}
