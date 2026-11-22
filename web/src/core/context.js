// Shared game state, DOM references and the Three.js core (renderer, scene, camera).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BROTHS, SPICE_LEVELS, PRICE_PER_100G } from '../catalog.js';
import { applyQuality } from './quality.js';

// ============================================================================
// State (No bowl limit! Pile as high as you want — bowl scales up with your pick)
// ============================================================================
export const state = {
  stage: 'pick', // 'pick' | 'weigh' | 'cook' | 'dine'
  chillerView: 'all',
  chillerPanX: 0, // -0.78 .. +0.78 horizontal glide along the 4-tier chiller
  picked: [], // Array of { uid, id, isNoodle, weight }
  brothId: 'mala_thick',
  spiceId: 2,
  toppingsAdded: [],
  noodleLifted: false,
};

export function getTotalWeight() {
  return state.picked.reduce((sum, p) => sum + p.weight, 0);
}

export function priceForGrams(grams) {
  if (grams <= 0) return 0;
  return Math.max(15, Math.round((grams / 100) * PRICE_PER_100G));
}

export function getTotalPrice() {
  return priceForGrams(getTotalWeight());
}

export function currentBroth() {
  return BROTHS.find((b) => b.id === state.brothId) || BROTHS[0];
}

export function currentSpice() {
  return SPICE_LEVELS.find((s) => s.id === state.spiceId) || SPICE_LEVELS[2];
}

export function clearGroup(group) {
  while (group.children.length > 0) group.remove(group.children[0]);
}

export const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;

// ============================================================================
// DOM References
// ============================================================================
const $ = (id) => document.getElementById(id);

export const dom = {
  canvas: $('scene-canvas'),
  loadingScreen: $('loading-screen'),
  loadingBar: $('loading-bar'),
  loadingLabel: $('loading-label'),
  topBar: $('top-bar'),
  trayTooltip: $('tray-tooltip'),
  tooltipName: $('tooltip-name'),
  tooltipMeta: $('tooltip-meta'),
  btnMute: $('btn-mute'),
  btnQuality: $('btn-quality'),
  stagePanels: {
    pick: $('stage-pick'),
    weigh: $('stage-weigh'),
    cook: $('stage-cook'),
    dine: $('stage-dine'),
  },
  categoryBar: $('category-bar'),
  dockHint: $('dock-hint'),
  btnPanLeft: $('btn-pan-left'),
  btnPanRight: $('btn-pan-right'),
  btnUndo: $('btn-undo'),
  btnClear: $('btn-clear'),
  btnToWeigh: $('btn-to-weigh'),
  weighGramsEl: $('weigh-grams'),
  weighPriceEl: $('weigh-price'),
  brothListEl: $('broth-list'),
  spiceListEl: $('spice-list'),
  orderPaperWrap: $('order-paper-wrap'),
  orderSlipCanvas: $('order-slip-canvas'),
  btnClearInk: $('btn-clear-ink'),
  btnBackPick: $('btn-back-pick'),
  btnToCook: $('btn-to-cook'),
  cookStatusEl: $('cook-status'),
  cookBarEl: $('cook-bar'),
  dineHint: $('dine-hint'),
  toppingButtonsEl: $('topping-buttons'),
  btnLiftNoodle: $('btn-lift-noodle'),
  btnPhoto: $('btn-photo'),
  btnNewBowl: $('btn-new-bowl'),
  receiptModal: $('receipt-modal'),
  receiptImg: $('receipt-img'),
  receiptPaper: $('receipt-paper'),
  btnCloseModal: $('btn-close-modal'),
  modalBackdrop: $('modal-backdrop'),
  btnDownloadPhoto: $('btn-download-photo'),
  btnModalNew: $('btn-modal-new'),
};

// ============================================================================
// Three.js Setup
// ============================================================================
export const renderer = new THREE.WebGLRenderer({
  canvas: dom.canvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
applyQuality(renderer, null);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x110a08);
scene.fog = new THREE.Fog(0x110a08, 4.5, 13);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;

// Portrait phones see very little of the wide chiller at 44°, so widen the lens there.
export function fovForAspect(aspect) {
  return aspect < 0.8 ? 62 : 44;
}

export const camera = new THREE.PerspectiveCamera(
  fovForAspect(window.innerWidth / window.innerHeight),
  window.innerWidth / window.innerHeight,
  0.05,
  40
);
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enabled = false;
controls.minDistance = 0.28;
controls.maxDistance = 0.95;
controls.maxPolarAngle = Math.PI * 0.46;

// Station X offsets (giving the wide 2.4m 4-tier chiller plenty of room)
export const STATION_X = {
  pick: 0.0,
  weigh: 4.2,
  cook: 6.8,
  dine: 9.8,
};

export const CAM_PRESETS = {
  pick: {
    pos: new THREE.Vector3(0.0, 1.56, 1.05),
    target: new THREE.Vector3(0.0, 1.12, -0.35),
  },
  weigh: {
    pos: new THREE.Vector3(STATION_X.weigh - 0.22, 1.48, 0.72),
    target: new THREE.Vector3(STATION_X.weigh + 0.02, 1.08, -0.25),
  },
  cook: {
    pos: new THREE.Vector3(STATION_X.cook, 1.58, 0.62),
    target: new THREE.Vector3(STATION_X.cook, 1.04, -0.3),
  },
  dine: {
    pos: new THREE.Vector3(STATION_X.dine, 1.24, 0.34),
    target: new THREE.Vector3(STATION_X.dine, 0.84, -0.15),
  },
};

// Camera glide targets (lerped every frame in main.js)
export const cam = {
  targetPos: CAM_PRESETS.pick.pos.clone(),
  targetLook: CAM_PRESETS.pick.target.clone(),
  currentLook: CAM_PRESETS.pick.target.clone(),
  transitioning: false,
};

camera.position.copy(cam.targetPos);
camera.lookAt(cam.targetLook);

// Shared picking ray
export const raycaster = new THREE.Raycaster();
export const pointer = new THREE.Vector2(-10, -10);

export function setPointerFromEvent(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}
