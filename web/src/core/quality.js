// Render quality presets. "low" targets phones and weak laptops:
// 1x pixel ratio, cheaper PCF shadows at half resolution.
import * as THREE from 'three';

const STORAGE_KEY = 'mala.quality';
const LEVELS = ['high', 'low'];

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return LEVELS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

function writeStored(v) {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* private mode etc. — preference just won't persist */
  }
}

function detectDefault() {
  const fromUrl = new URLSearchParams(location.search).get('quality');
  if (LEVELS.includes(fromUrl)) return fromUrl;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if (coarse || (mem && mem <= 4) || (cores && cores <= 4)) return 'low';
  return 'high';
}

let level = readStored() || detectDefault();

export function getQuality() {
  return level;
}

export function setQuality(next, renderer, scene) {
  level = next;
  writeStored(next);
  applyQuality(renderer, scene);
}

export function toggleQuality(renderer, scene) {
  setQuality(level === 'high' ? 'low' : 'high', renderer, scene);
  return level;
}

export function applyQuality(renderer, scene) {
  const high = level === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const shadowType = high ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  const typeChanged = renderer.shadowMap.type !== shadowType;
  renderer.shadowMap.type = shadowType;

  if (!scene) return;
  scene.traverse((obj) => {
    if (obj.isLight && obj.castShadow && obj.shadow) {
      obj.userData.fullShadowSize ??= obj.shadow.mapSize.x;
      const size = high ? obj.userData.fullShadowSize : Math.max(512, obj.userData.fullShadowSize / 2);
      if (obj.shadow.mapSize.x !== size) {
        obj.shadow.mapSize.set(size, size);
        obj.shadow.map?.dispose();
        obj.shadow.map = null;
      }
    }
    if (typeChanged && obj.material) {
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => (m.needsUpdate = true));
    }
  });
}
