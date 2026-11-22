import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CHILLER_VIEWS,
  INGREDIENTS,
  INGREDIENT_MAP,
  BROTHS,
  SPICE_LEVELS,
  TOPPINGS,
  PRICE_PER_100G,
} from './catalog.js';
import { assets } from './assetLoader.js';
import { audio } from './audio.js';
import TRAY_PHYSICS_PILES from './trayPhysicsPiles.json';

// ============================================================================
// State (No bowl limit! Pile as high as you want — bowl scales up with your pick)
// ============================================================================
const state = {
  stage: 'pick', // 'pick' | 'weigh' | 'cook' | 'dine'
  chillerView: 'all',
  chillerPanX: 0, // -0.78 .. +0.78 horizontal glide along the 4-tier chiller
  picked: [], // Array of { uid, id, isNoodle, weight }
  brothId: 'mala_thick',
  spiceId: 2,
  toppingsAdded: [],
  noodleLifted: false,
};

let uidCounter = 1;

// ============================================================================
// DOM References
// ============================================================================
const canvas = document.getElementById('scene-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingLabel = document.getElementById('loading-label');
const topBar = document.getElementById('top-bar');
const trayTooltip = document.getElementById('tray-tooltip');
const tooltipName = document.getElementById('tooltip-name');
const tooltipMeta = document.getElementById('tooltip-meta');

const btnMute = document.getElementById('btn-mute');

const stagePanels = {
  pick: document.getElementById('stage-pick'),
  weigh: document.getElementById('stage-weigh'),
  cook: document.getElementById('stage-cook'),
  dine: document.getElementById('stage-dine'),
};

const categoryBar = document.getElementById('category-bar');
const btnUndo = document.getElementById('btn-undo');
const btnClear = document.getElementById('btn-clear');
const btnToWeigh = document.getElementById('btn-to-weigh');

const weighGramsEl = document.getElementById('weigh-grams');
const weighPriceEl = document.getElementById('weigh-price');
const brothListEl = document.getElementById('broth-list');
const spiceListEl = document.getElementById('spice-list');
const orderPaperWrap = document.getElementById('order-paper-wrap');
const orderSlipCanvas = document.getElementById('order-slip-canvas');
const btnClearInk = document.getElementById('btn-clear-ink');
const btnBackPick = document.getElementById('btn-back-pick');
const btnToCook = document.getElementById('btn-to-cook');

const cookStatusEl = document.getElementById('cook-status');
const cookBarEl = document.getElementById('cook-bar');

const toppingButtonsEl = document.getElementById('topping-buttons');
const btnLiftNoodle = document.getElementById('btn-lift-noodle');
const btnPhoto = document.getElementById('btn-photo');
const btnNewBowl = document.getElementById('btn-new-bowl');

const receiptModal = document.getElementById('receipt-modal');
const receiptImg = document.getElementById('receipt-img');
const receiptPaper = document.getElementById('receipt-paper');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const btnDownloadPhoto = document.getElementById('btn-download-photo');
const btnModalNew = document.getElementById('btn-modal-new');

// ============================================================================
// Three.js Setup
// ============================================================================
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x110a08);
scene.fog = new THREE.Fog(0x110a08, 4.5, 13);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.05, 40);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enabled = false;
controls.minDistance = 0.28;
controls.maxDistance = 0.95;
controls.maxPolarAngle = Math.PI * 0.46;

// Station X offsets (giving the wide 2.4m 4-tier chiller plenty of room)
const STATION_X = {
  pick: 0.0,
  weigh: 4.2,
  cook: 6.8,
  dine: 9.8,
};

const CAM_PRESETS = {
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

let camTargetPos = CAM_PRESETS.pick.pos.clone();
let camTargetLook = CAM_PRESETS.pick.target.clone();
let camCurrentLook = CAM_PRESETS.pick.target.clone();
let camTransitioning = false;

camera.position.copy(camTargetPos);
camera.lookAt(camTargetLook);

// ============================================================================
// Scene Objects & Animation Tracking
// ============================================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);

const trayInteractables = [];
const trayGroups = [];
const edibleObjects = [];
const flyingItems = [];
const fallingToppings = [];
const steamSprites = [];
const potBubbles = [];

let chillerTraysRoot = new THREE.Group();
let pickBowlGroup = new THREE.Group();
let pickBowlItemsGroup = new THREE.Group();
let pickBowlDropRing = null;
let pickBowlHitZone = null;

// First-person Tongs rig (origin = exact gripping tip between the two prongs!)
let tongsRig = new THREE.Group();
let tongsObj = null;
let heldItemGroup = new THREE.Group();
let tongsTargetPos = new THREE.Vector3(0.0, 1.15, 0.25);
let hoveredTray = null;
let heldState = null; // { item, mesh, sourceTray } when holding left-click
let isOverPickBowl = false;

// Inclined drag plane in front of the 4-tier chiller for smooth 3D tongs tracking
const chillerDragPlane = new THREE.Plane(new THREE.Vector3(0, 0.35, 0.94).normalize(), -0.18);

let digitalScaleCanvas = null;
let digitalScaleCtx = null;
let digitalScaleTex = null;
let scaleDisplayGrams = 0;
let scaleTargetGrams = 0;

let potLiquidMesh = null;
let noodleBasketObj = null;
let cookStartTime = 0;
const COOK_DURATION = 3200;

let malaBowlGroup = null;
let malaSoupMesh = null;
let malaSlots = [];
let diningContentsGroup = new THREE.Group();
let diningToppingsGroup = new THREE.Group();
let noodleLiftGroup = new THREE.Group();
let diningChopsticks = null;
let lastCapturedDataUrl = '';

// ============================================================================
// Procedural Textures (Steam, Corrugated Stainless Back, Amber Thai/CN Tags)
// ============================================================================
function createSteamTexture() {
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

function createCorrugatedStainlessTexture() {
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
function createChillerRailTag(thaiName, cnName) {
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

function createTrayAOTexture() {
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
    { x: 330, w: 168, label: 'TOTAL (฿)', value: (grams <= 0 ? 0 : Math.max(15, Math.round((grams / 100) * PRICE_PER_100G))).toFixed(2), color: '#ff5238' },
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

const trayAOTex = createTrayAOTexture();
const trayAOMat = new THREE.MeshBasicMaterial({
  map: trayAOTex,
  transparent: true,
  depthWrite: false,
});

const steamTex = createSteamTexture();

function spawnSteamEmitter(origin, count, spread, height, stationTag) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: steamTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const phase = Math.random();
    sprite.position.set(
      origin.x + (Math.random() - 0.5) * spread,
      origin.y + phase * height,
      origin.z + (Math.random() - 0.5) * spread
    );
    const s = 0.08 + phase * 0.14;
    sprite.scale.set(s, s, 1);
    scene.add(sprite);
    steamSprites.push({
      sprite,
      origin: origin.clone(),
      spread,
      height,
      phase,
      speed: 0.22 + Math.random() * 0.18,
      stationTag,
    });
  }
}

// ============================================================================
// Build the 4-Tier Stainless Steel Chiller Wall (Inspired by Reference Photo)
// ============================================================================
function buildChillerWall() {
  const chillerWidth = 2.48;

  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0x737d87,
    metalness: 0.88,
    roughness: 0.26,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x454d55,
    metalness: 0.84,
    roughness: 0.34,
  });

  const corrugatedBackMat = new THREE.MeshStandardMaterial({
    map: createCorrugatedStainlessTexture(),
    color: 0x5c646d,
    metalness: 0.82,
    roughness: 0.3,
  });

  const ledGlowMat = new THREE.MeshStandardMaterial({
    color: 0xf0f9ff,
    emissive: 0xcbeeff,
    emissiveIntensity: 2.2,
  });

  // 1. Chiller cabinet body (back wall + side walls + base cabinet + canopy)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(chillerWidth, 1.35, 0.05), corrugatedBackMat);
  backWall.position.set(0, 1.34, -0.82);
  backWall.receiveShadow = true;
  chillerTraysRoot.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 1.15), darkSteelMat);
  leftWall.position.set(-chillerWidth / 2 - 0.03, 0.95, -0.27);
  chillerTraysRoot.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 1.15), darkSteelMat);
  rightWall.position.set(chillerWidth / 2 + 0.03, 0.95, -0.27);
  chillerTraysRoot.add(rightWall);

  const baseCabinet = new THREE.Mesh(new THREE.BoxGeometry(chillerWidth, 0.76, 1.1), darkSteelMat);
  baseCabinet.position.set(0, 0.38, -0.27);
  baseCabinet.receiveShadow = true;
  chillerTraysRoot.add(baseCabinet);

  // Sloped stainless front counter apron (under bottom tier)
  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(chillerWidth, 0.14, 0.12), stainlessMat);
  frontLip.position.set(0, 0.78, 0.24);
  frontLip.rotation.x = -0.35;
  chillerTraysRoot.add(frontLip);

  // Top canopy + top LED strip lighting the leafy greens
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(chillerWidth + 0.08, 0.08, 0.65), darkSteelMat);
  canopy.position.set(0, 1.9, -0.54);
  chillerTraysRoot.add(canopy);

  const canopyLed = new THREE.Mesh(new THREE.BoxGeometry(chillerWidth - 0.08, 0.022, 0.035), ledGlowMat);
  canopyLed.position.set(0, 1.85, -0.36);
  chillerTraysRoot.add(canopyLed);

  // Localized cool-white chiller LED pools (moody contrast, vibrant food colors)
  [-0.82, 0.0, 0.82].forEach((lx) => {
    const pLight = new THREE.PointLight(0xd9f0ff, 0.55, 2.1, 1.8);
    pLight.position.set(lx, 1.72, 0.02);
    chillerTraysRoot.add(pLight);
  });

  // Subtle warm shop ambience spill from behind the player (warm-cool cinematic contrast!)
  const warmSpill = new THREE.PointLight(0xffa95c, 0.45, 3.8);
  warmSpill.position.set(-0.4, 1.55, 1.35);
  chillerTraysRoot.add(warmSpill);

  // 2. Define the 4 stacked tiers (all using real hollow DisplayTray + prominent front rail tags & LED strips!)
  const TIER_SPECS = [
    // Tier 0 (Bottom deep sloped stainless bed — meatballs, sausages, crabstick, quail egg)
    {
      tier: 0,
      y: 0.83,
      z: 0.02,
      tilt: 0.25,
      hasRailLed: false,
      railY: 0.81,
      railZ: 0.2,
    },
    // Tier 1 (Lower-middle recessed stainless bed — sliced meats, seafood, tofu)
    {
      tier: 1,
      y: 1.05,
      z: -0.26,
      tilt: 0.24,
      hasRailLed: true,
      railY: 1.03,
      railZ: -0.09,
    },
    // Tier 2 (Upper-middle — mushrooms & noodles, tilted so you clearly see inside every tray!)
    {
      tier: 2,
      y: 1.27,
      z: -0.45,
      tilt: 0.26,
      hasRailLed: true,
      railY: 1.25,
      railZ: -0.28,
    },
    // Tier 3 (Top — lush upright veggies, tilted & lowered cleanly below top HUD!)
    {
      tier: 3,
      y: 1.49,
      z: -0.59,
      tilt: 0.28,
      hasRailLed: true,
      railY: 1.47,
      railZ: -0.42,
    },
  ];

  const dummy = new THREE.Object3D();

  TIER_SPECS.forEach((spec) => {
    const tierItems = INGREDIENTS.filter((item) => item.tier === spec.tier);
    const count = tierItems.length;
    const spacingX = 0.265;

    // Stainless recessed deck under each tier
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(chillerWidth - 0.04, 0.028, 0.34),
      darkSteelMat
    );
    deck.position.set(0, spec.y - 0.015, spec.z);
    deck.rotation.x = spec.tilt;
    deck.receiveShadow = true;
    chillerTraysRoot.add(deck);

    // Brushed stainless front fascia rail + glowing cool-white LED strip directly underneath
    if (spec.hasRailLed) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(chillerWidth - 0.02, 0.052, 0.024),
        stainlessMat
      );
      rail.position.set(0, spec.railY, spec.railZ);
      chillerTraysRoot.add(rail);

      const ledTube = new THREE.Mesh(
        new THREE.BoxGeometry(chillerWidth - 0.08, 0.016, 0.022),
        ledGlowMat
      );
      ledTube.position.set(0, spec.railY - 0.032, spec.railZ - 0.002);
      chillerTraysRoot.add(ledTube);
    }

    // Populate each tray across this tier
    tierItems.forEach((item, idx) => {
      const xPos = (idx - (count - 1) / 2) * spacingX;
      const group = new THREE.Group();
      group.position.set(xPos, spec.y, spec.z);
      group.rotation.x = spec.tilt;
      group.userData = { ingredient: item, baseY: spec.y };

      // Real hollow DisplayTray for ALL 4 tiers (crisp rounded stainless GN pan!)
      const tray = assets.clone('DisplayTray');
      if (tray) {
        tray.rotation.y = Math.PI / 2;
        tray.scale.set(0.88, 0.92, 1.38);
        group.add(tray);
      }

      // Subtle grounded contact-AO shadow on the stainless tray floor
      const aoPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.195, 0.245), trayAOMat);
      aoPlane.rotation.x = -Math.PI / 2;
      aoPlane.position.set(0, 0.007, 0);
      group.add(aoPlane);

      // Authentic amber-gold Thai + Chinese label mounted cleanly ON the front face of the stainless rail
      const labelMesh = createChillerRailTag(item.name, item.cn);
      if (spec.hasRailLed) {
        labelMesh.position.set(xPos, spec.railY, spec.railZ + 0.014);
        chillerTraysRoot.add(labelMesh);
      } else {
        labelMesh.position.set(0, 0.048, 0.178);
        labelMesh.rotation.x = -0.35;
        group.add(labelMesh);
      }

      // Pack tray using REAL Blender Rigid Body Physics settled transforms!
      const rawTemplate = assets.cloneRaw(item.id);
      if (rawTemplate) {
        let sourceMesh = rawTemplate.isMesh ? rawTemplate : null;
        if (!sourceMesh) {
          rawTemplate.traverse((c) => {
            if (!sourceMesh && c.isMesh) sourceMesh = c;
          });
        }

        const physList = TRAY_PHYSICS_PILES[item.id];
        if (sourceMesh && physList && physList.length > 0) {
          const inst = new THREE.InstancedMesh(sourceMesh.geometry, sourceMesh.material, physList.length);
          inst.castShadow = true;
          inst.receiveShadow = true;

          physList.forEach((tr, pIdx) => {
            dummy.position.set(tr.p[0], tr.p[1], tr.p[2]);
            dummy.quaternion.set(tr.q[0], tr.q[1], tr.q[2], tr.q[3]);
            dummy.scale.set(tr.s[0], tr.s[1], tr.s[2]);
            dummy.updateMatrix();
            inst.setMatrixAt(pIdx, dummy.matrix);
          });

          inst.instanceMatrix.needsUpdate = true;
          group.add(inst);
        }
      }

      // Hitbox for effortless clicking (covers entire tray + piled food)
      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.17, 0.3),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hitbox.position.set(0, 0.085, 0);
      hitbox.userData = { trayGroup: group, ingredient: item };
      group.add(hitbox);

      trayInteractables.push(hitbox);
      trayGroups.push(group);
      chillerTraysRoot.add(group);
    });
  });
}

// ============================================================================
// Build the Cozy Mini Mala Shop Environment (All 4 Stations)
// ============================================================================
function buildEnvironment() {
  // Moody nocturnal warm-ambient base
  const hemi = new THREE.HemisphereLight(0xffdfc2, 0x160c09, 0.26);
  scene.add(hemi);

  // Deep espresso wood floor & warm dark plaster wall
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 10),
    new THREE.MeshStandardMaterial({ color: 0x221510, roughness: 0.88 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(5, 0, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 5),
    new THREE.MeshStandardMaterial({ color: 0x261712, roughness: 0.92 })
  );
  wall.position.set(5, 2.5, -1.65);
  wall.receiveShadow = true;
  scene.add(wall);

  // --- STATION 1: 4-Tier Stainless Chiller Wall (x = 0) ---
  const chillerDirLight = new THREE.DirectionalLight(0xfff5ea, 0.82);
  chillerDirLight.position.set(-0.6, 2.5, 1.35);
  chillerDirLight.target.position.set(0, 1.12, -0.35);
  chillerDirLight.castShadow = true;
  chillerDirLight.shadow.mapSize.set(2048, 2048);
  chillerDirLight.shadow.camera.left = -1.6;
  chillerDirLight.shadow.camera.right = 1.6;
  chillerDirLight.shadow.camera.top = 1.4;
  chillerDirLight.shadow.camera.bottom = -1.2;
  chillerDirLight.shadow.camera.near = 0.5;
  chillerDirLight.shadow.camera.far = 5.5;
  chillerDirLight.shadow.bias = -0.0005;
  chillerDirLight.shadow.normalBias = 0.004;
  scene.add(chillerDirLight, chillerDirLight.target);

  buildChillerWall();
  scene.add(chillerTraysRoot);

  // PickBowl (clear plastic bowl positioned clearly in lower foreground, gliding with player!)
  const pickBowlMesh = assets.clone('PickBowl');
  if (pickBowlMesh) {
    pickBowlMesh.scale.setScalar(1.18);
    pickBowlGroup.add(pickBowlMesh);
  }
  pickBowlGroup.add(pickBowlItemsGroup);

  // Warm golden drop-zone ring around PickBowl (glows when dragging an item!)
  pickBowlDropRing = new THREE.Mesh(
    new THREE.RingGeometry(0.125, 0.148, 36),
    new THREE.MeshBasicMaterial({
      color: 0xffd83b,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  pickBowlDropRing.rotation.x = -Math.PI / 2;
  pickBowlDropRing.position.set(0, 0.008, 0);
  pickBowlGroup.add(pickBowlDropRing);

  // Generous invisible drop cylinder over PickBowl for effortless drag-and-drop
  pickBowlHitZone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.28, 16),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  pickBowlHitZone.position.set(0, 0.12, 0);
  pickBowlGroup.add(pickBowlHitZone);

  pickBowlGroup.position.set(0.0, 0.92, 0.56);
  scene.add(pickBowlGroup);

  // First-person 3D Tongs (Mouse = Tongs! Pivot at gripping tips, handle extending to player's right hand)
  tongsObj = assets.clone('Tongs');
  if (tongsObj) {
    tongsObj.scale.setScalar(1.25);
    // Shift so +X tip (+0.115 * 1.25) sits right at tongsRig origin (0,0,0)!
    tongsObj.position.set(-0.144, 0, 0);
    tongsRig.add(tongsObj);
  }
  tongsRig.add(heldItemGroup);
  tongsRig.rotation.order = 'YXZ';
  // Tips point forward-down-left into trays; handle extends back-up-right toward player's right hand!
  tongsRig.rotation.set(0.0, 2.15, -0.58);
  tongsRig.position.copy(tongsTargetPos);
  scene.add(tongsRig);

  // --- STATION 2: Weighing & Cashier Counter ---
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

  // --- STATION 3: Cooking Pot ---
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

  // --- STATION 4: Warm Dining Table ---
  const dx = STATION_X.dine;
  const dineSpot = new THREE.SpotLight(0xffb86c, 2.3, 4.5, Math.PI / 5, 0.68);
  dineSpot.position.set(dx - 0.15, 2.15, 0.2);
  dineSpot.target.position.set(dx, 0.78, -0.15);
  dineSpot.castShadow = true;
  dineSpot.shadow.mapSize.set(1024, 1024);
  scene.add(dineSpot, dineSpot.target);

  const dineRim = new THREE.PointLight(0xff7838, 0.75, 2.4);
  dineRim.position.set(dx - 0.55, 1.18, -0.58);
  scene.add(dineRim);

  const lamp = assets.clone('CeilingLight');
  if (lamp) {
    lamp.position.set(dx, 1.95, -0.15);
    scene.add(lamp);
  }

  const table = assets.clone('Table_Folding');
  if (table) {
    table.position.set(dx, 0, -0.2);
    // Soften bright white folding table into cozy warm-beige linen/wood tone so the black bowl pops!
    table.traverse((n) => {
      if (n.isMesh && n.material && n.material.name === 'Mat_FoldingTableTop') {
        n.material = n.material.clone();
        n.material.color.setHex(0xc9b39c);
        n.material.roughness = 0.72;
      }
    });
    scene.add(table);
  }

  const stool = assets.clone('Stool_Plastic');
  if (stool) {
    stool.position.set(dx, 0, 0.45);
    scene.add(stool);
  }

  const condimentSet = assets.clone('CondimentSet');
  if (condimentSet) {
    condimentSet.position.set(dx - 0.38, 0.745, -0.36);
    scene.add(condimentSet);
  }

  const tissueBox = assets.clone('TissueBox');
  if (tissueBox) {
    tissueBox.position.set(dx + 0.36, 0.745, -0.36);
    tissueBox.rotation.y = -0.3;
    scene.add(tissueBox);
  }

  const drinkCup = assets.clone('DrinkCup');
  if (drinkCup) {
    drinkCup.position.set(dx + 0.34, 0.745, -0.05);
    scene.add(drinkCup);
  }

  const spoon = assets.clone('Spoon');
  if (spoon) {
    spoon.position.set(dx + 0.22, 0.75, 0.08);
    spoon.rotation.y = 0.4;
    scene.add(spoon);
  }

  diningChopsticks = assets.clone('Chopsticks');
  if (diningChopsticks) {
    diningChopsticks.position.set(dx + 0.28, 0.75, 0.05);
    diningChopsticks.rotation.y = 0.25;
    scene.add(diningChopsticks);
  }

  malaBowlGroup = assets.clone('MalaBowl');
  if (malaBowlGroup) {
    malaBowlGroup.position.set(dx, 0.745, -0.15);
    malaBowlGroup.scale.setScalar(1.32);
    malaSoupMesh = malaBowlGroup.getObjectByName('MalaBowl_Soup');
    malaSlots = [];
    for (let i = 1; i <= 12; i++) {
      const slot = malaBowlGroup.getObjectByName(`Slot_${String(i).padStart(2, '0')}`);
      if (slot) malaSlots.push(slot);
    }
    malaBowlGroup.add(diningContentsGroup);
    malaBowlGroup.add(diningToppingsGroup);
    malaBowlGroup.add(noodleLiftGroup);
    scene.add(malaBowlGroup);
  }

  spawnSteamEmitter(new THREE.Vector3(dx, 0.86, -0.15), 10, 0.16, 0.36, 'dine');
}

// ============================================================================
// Chiller Camera View & Panning Controls
// ============================================================================
function updatePickCameraTarget() {
  const v = CHILLER_VIEWS.find((cv) => cv.id === state.chillerView) || CHILLER_VIEWS[0];
  state.chillerPanX = Math.max(-0.78, Math.min(0.78, state.chillerPanX));
  camTargetPos.set(state.chillerPanX, v.y, v.z);
  camTargetLook.set(state.chillerPanX, v.lookY, -0.35);
}

function panChiller(deltaX) {
  if (state.stage !== 'pick') return;
  state.chillerPanX = Math.max(-0.78, Math.min(0.78, state.chillerPanX + deltaX));
  updatePickCameraTarget();
}

// ============================================================================
// Picking Logic & Flying Arc Animation
// ============================================================================
function getTotalWeight() {
  return state.picked.reduce((sum, p) => sum + p.weight, 0);
}

function getTotalPrice() {
  const grams = getTotalWeight();
  if (grams === 0) return 0;
  return Math.max(15, Math.round((grams / 100) * PRICE_PER_100G));
}

function getPieceCount() {
  return state.picked.filter((p) => !p.isNoodle).length;
}

function updateHUD() {
  const count = state.picked.length;
  const grams = getTotalWeight();
  const price = getTotalPrice();

  btnUndo.disabled = count === 0;
  btnClear.disabled = count === 0;
  btnToWeigh.disabled = count === 0;

  weighGramsEl.textContent = `${grams} กรัม (${(grams / 100).toFixed(1)} ขีด)`;
  weighPriceEl.textContent = `฿${price}.-`;
}

function startGrabIngredient(trayGroup, item, hitPoint) {
  const rawMesh = assets.cloneRaw(item.id);
  if (!rawMesh) return;

  audio.playTongsClick();
  rawMesh.position.set(0, -0.008, 0);
  rawMesh.scale.setScalar((item.scale || 1) * 0.95);
  rawMesh.rotation.set(0.2, Math.random() * Math.PI * 2, 0.15);

  while (heldItemGroup.children.length > 0) {
    heldItemGroup.remove(heldItemGroup.children[0]);
  }
  heldItemGroup.add(rawMesh);

  heldState = { item, mesh: rawMesh, sourceTray: trayGroup };
  if (hitPoint) {
    tongsTargetPos.copy(hitPoint);
    tongsTargetPos.y += 0.045;
  }
  trayTooltip.classList.add('hidden');
}

function releaseHeldIngredient(dropIntoBowl) {
  if (!heldState) return;
  const { item, mesh } = heldState;
  heldState = null;
  isOverPickBowl = false;

  // Detach from tongs tip
  const startWorld = new THREE.Vector3();
  mesh.getWorldPosition(startWorld);
  heldItemGroup.remove(mesh);

  if (!dropIntoBowl) {
    // Put back gently (cancelled grab)
    audio.playTongsClick();
    return;
  }

  const entry = {
    uid: uidCounter++,
    id: item.id,
    isNoodle: !!item.isNoodle,
    weight: item.weight,
  };
  state.picked.push(entry);
  updateHUD();

  mesh.userData.uid = entry.uid;
  mesh.position.copy(startWorld);
  mesh.scale.setScalar(1.0);
  scene.add(mesh);

  const idx = state.picked.length - 1;
  const layer = Math.floor(idx / 6);
  const ringAngle = idx * 2.39996;
  const maxRad = Math.max(0.028, 0.068 - layer * 0.006);
  const ringRad = Math.min(maxRad, 0.016 + Math.sqrt(idx % 6) * 0.022);
  const targetLocal = new THREE.Vector3(
    Math.cos(ringAngle) * ringRad,
    0.024 + layer * 0.02,
    Math.sin(ringAngle) * ringRad
  );

  flyingItems.push({
    mesh,
    start: startWorld,
    targetLocal,
    t: 0,
    duration: 0.22,
    rotTarget: new THREE.Euler(
      (Math.random() - 0.5) * 0.6,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.6
    ),
  });
}

function undoLastPicked() {
  if (state.picked.length === 0) return;
  const removed = state.picked.pop();
  audio.playTongsClick();

  for (let i = pickBowlItemsGroup.children.length - 1; i >= 0; i--) {
    if (pickBowlItemsGroup.children[i].userData.uid === removed.uid) {
      pickBowlItemsGroup.remove(pickBowlItemsGroup.children[i]);
      break;
    }
  }
  for (let i = flyingItems.length - 1; i >= 0; i--) {
    if (flyingItems[i].mesh.userData.uid === removed.uid) {
      scene.remove(flyingItems[i].mesh);
      flyingItems.splice(i, 1);
      break;
    }
  }
  updateHUD();
}

function clearBowl() {
  state.picked = [];
  while (pickBowlItemsGroup.children.length > 0) {
    pickBowlItemsGroup.remove(pickBowlItemsGroup.children[0]);
  }
  while (flyingItems.length > 0) {
    const f = flyingItems.pop();
    scene.remove(f.mesh);
  }
  updateHUD();
}

let hintTimeout = null;
function showTempHint(msg) {
  const hint = document.querySelector('.dock-hint');
  if (!hint) return;
  const orig = '✨ คลิกถาดไหนก็ได้ทั้ง 4 ชั้นเพื่อคีบ · เลื่อนซ้าย-ขวาได้ด้วยปุ่ม ‹ › หรือลูกกลิ้งเมาส์';
  hint.textContent = msg;
  clearTimeout(hintTimeout);
  hintTimeout = setTimeout(() => {
    hint.textContent = orig;
  }, 2400);
}

// ============================================================================
// Stage Transitions
// ============================================================================
function setStage(nextStage) {
  state.stage = nextStage;

  const order = ['pick', 'weigh', 'cook', 'dine'];
  const currentIdx = order.indexOf(nextStage);
  document.querySelectorAll('.step-pill').forEach((el) => {
    const idx = order.indexOf(el.dataset.step);
    el.classList.toggle('active', idx === currentIdx);
    el.classList.toggle('done', idx < currentIdx);
  });

  Object.entries(stagePanels).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== nextStage);
  });

  trayTooltip.classList.add('hidden');
  audio.stopBoiling();

  camTransitioning = true;
  controls.enabled = false;

  if (nextStage === 'pick') {
    updatePickCameraTarget();
    pickBowlGroup.visible = true;
    pickBowlGroup.position.set(state.chillerPanX, 0.92, 0.56);
    tongsRig.visible = true;
    canvas.style.cursor = 'none';
  } else {
    releaseHeldIngredient(false);
    tongsRig.visible = false;
    canvas.style.cursor = nextStage === 'dine' ? 'grab' : 'default';
    const preset = CAM_PRESETS[nextStage];
    camTargetPos = preset.pos.clone();
    camTargetLook = preset.target.clone();
  }

  if (nextStage === 'weigh') {
    tongsRig.visible = false;
    pickBowlGroup.visible = true;
    // Place PickBowl directly on top of the stainless pan of Shop_DigitalScale
    pickBowlGroup.position.set(STATION_X.weigh - 0.16, 0.9 + 0.114, -0.18);
    scaleDisplayGrams = 0;
    scaleTargetGrams = getTotalWeight();
    drawDigitalScaleLCD(0);
    audio.playScaleTick();
    updateHUD();
    // Ensure handwritten order slip canvas matches paper dimensions
    requestAnimationFrame(() => resizeOrderSlipCanvas(false));
  } else if (nextStage === 'cook') {
    pickBowlGroup.visible = false;
    const broth = BROTHS.find((b) => b.id === state.brothId) || BROTHS[0];
    if (potLiquidMesh) potLiquidMesh.material.color.setHex(broth.potColor);
    cookStartTime = performance.now();
    cookBarEl.style.width = '0%';
    cookStatusEl.textContent = 'กำลังลวกวัตถุดิบในหม้อ...';
    audio.startBoiling();
  } else if (nextStage === 'dine') {
    pickBowlGroup.visible = false;
    composeMalaBowl();
    audio.playServeChime();
    setTimeout(() => {
      if (state.stage === 'dine') {
        camTransitioning = false;
        controls.target.copy(CAM_PRESETS.dine.target);
        controls.enabled = true;
        controls.update();
      }
    }, 950);
  }
}

// ============================================================================
// Stage 4: Compose the Final Mala Bowl (Exact AGENTS.md Slot System!)
// ============================================================================
function composeMalaBowl() {
  while (diningContentsGroup.children.length > 0) {
    diningContentsGroup.remove(diningContentsGroup.children[0]);
  }
  while (diningToppingsGroup.children.length > 0) {
    diningToppingsGroup.remove(diningToppingsGroup.children[0]);
  }
  while (noodleLiftGroup.children.length > 0) {
    noodleLiftGroup.remove(noodleLiftGroup.children[0]);
  }
  edibleObjects.length = 0;
  state.toppingsAdded = [];
  state.noodleLifted = false;

  const broth = BROTHS.find((b) => b.id === state.brothId) || BROTHS[0];
  assets.applyBrothToSoupMesh(malaSoupMesh, broth);

  const pickedNoodles = state.picked.filter((p) => p.isNoodle);
  if (pickedNoodles.length > 0) {
    pickedNoodles.forEach((noodle, idx) => {
      const bed = assets.cloneNoodleBed(noodle.id, idx === 0 ? 'A' : 'B');
      if (bed) {
        bed.position.set(0, 0.056, 0);
        bed.rotation.y = idx * 1.8 + Math.random() * 0.6;
        diningContentsGroup.add(bed);
      }
    });
    btnLiftNoodle.classList.remove('hidden');
    btnLiftNoodle.textContent = '🍜 คีบเส้นโชว์';
  } else {
    btnLiftNoodle.classList.add('hidden');
  }

  // Scale up MalaBowl dynamically as you pick more ingredients (per TODO.md!)
  const totalCount = state.picked.length;
  const bowlScale = Math.min(1.85, 1.32 + Math.max(0, totalCount - 8) * 0.028);
  if (malaBowlGroup) {
    malaBowlGroup.scale.setScalar(bowlScale);
  }

  const pieces = state.picked.filter((p) => !p.isNoodle);
  const slotOrder = [...malaSlots].sort(() => Math.random() - 0.5);

  pieces.forEach((piece, i) => {
    const cooked = assets.cloneCooked(piece.id);
    if (!cooked) return;

    const layer = Math.floor(i / Math.max(1, slotOrder.length));
    if (layer === 0 && slotOrder[i]) {
      cooked.position.copy(slotOrder[i].position);
    } else {
      // Pile extra pieces naturally in a delicious overflowing mound on top!
      const angle = i * 2.39996;
      const rad = Math.min(0.062, 0.014 + Math.sqrt(i % 10) * 0.018);
      cooked.position.set(
        Math.cos(angle) * rad,
        0.066 + layer * 0.016 + Math.random() * 0.006,
        Math.sin(angle) * rad
      );
    }

    cooked.rotation.set(
      (Math.random() - 0.5) * 0.22,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.22
    );
    cooked.scale.setScalar(0.96 + Math.random() * 0.1);
    cooked.userData = {
      edible: true,
      ingredientId: piece.id,
      baseY: cooked.position.y,
      bobPhase: Math.random() * Math.PI * 2,
      eating: false,
    };

    diningContentsGroup.add(cooked);
    edibleObjects.push(cooked);
  });

  if (state.spiceId >= 2) {
    sprinkleTopping('Topping_ChiliFlake', true);
  }
}

function sprinkleTopping(toppingId, silent = false) {
  if (!silent) audio.playSprinkle();
  state.toppingsAdded.push(toppingId);

  const count = 4;
  for (let i = 0; i < count; i++) {
    const mesh = assets.clone(toppingId);
    if (!mesh) continue;
    const angle = Math.random() * Math.PI * 2;
    const rad = Math.random() * 0.052;
    const targetY = 0.066 + Math.random() * 0.004;
    mesh.position.set(Math.cos(angle) * rad, targetY + (silent ? 0 : 0.11 + i * 0.025), Math.sin(angle) * rad);
    mesh.rotation.set(
      (Math.random() - 0.5) * 0.5,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.5
    );
    mesh.scale.setScalar(0.85 + Math.random() * 0.35);
    diningToppingsGroup.add(mesh);

    if (!silent) {
      fallingToppings.push({ mesh, targetY, vel: 0 });
    }
  }
}

function toggleNoodleLift() {
  const pickedNoodles = state.picked.filter((p) => p.isNoodle);
  if (pickedNoodles.length === 0) return;

  state.noodleLifted = !state.noodleLifted;
  while (noodleLiftGroup.children.length > 0) {
    noodleLiftGroup.remove(noodleLiftGroup.children[0]);
  }

  if (state.noodleLifted) {
    audio.playEatSound();
    // Noodle_Lift hangs from y=0 (top pinch point) down to y=-0.13 -> place top pinch at y=0.148
    const liftMesh = assets.cloneNoodleLift(pickedNoodles[0].id);
    if (liftMesh) {
      liftMesh.position.set(0, 0.148, 0);
      noodleLiftGroup.add(liftMesh);
    }
    // Chopsticks runs from -0.116 (handle) to +0.124 (thin tips).
    // Rotate Y by PI so thin tips point LEFT into (0, 0.142, 0) pinching the top of the noodles,
    // while the handles extend cleanly up-right toward the diner's hand!
    const liftChopsticks = assets.clone('Chopsticks');
    if (liftChopsticks) {
      liftChopsticks.position.set(0.098, 0.166, 0.008);
      liftChopsticks.rotation.set(0.06, Math.PI - 0.22, 0.22);
      noodleLiftGroup.add(liftChopsticks);
    }
    if (diningChopsticks) diningChopsticks.visible = false;
    btnLiftNoodle.textContent = '🍜 วางตะเกียบลง';
  } else {
    if (diningChopsticks) diningChopsticks.visible = true;
    btnLiftNoodle.textContent = '🍜 คีบเส้นโชว์';
  }
}

// ============================================================================
// Photo & Thai Receipt Modal
// ============================================================================
function openReceiptModal() {
  audio.playServeChime();
  renderer.render(scene, camera);
  lastCapturedDataUrl = canvas.toDataURL('image/png');
  receiptImg.src = lastCapturedDataUrl;

  const broth = BROTHS.find((b) => b.id === state.brothId) || BROTHS[0];
  const spice = SPICE_LEVELS.find((s) => s.id === state.spiceId) || SPICE_LEVELS[2];
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

  receiptPaper.innerHTML = `
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

  receiptModal.classList.remove('hidden');
}

function downloadPhotoAndReceipt() {
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

    const broth = BROTHS.find((b) => b.id === state.brothId) || BROTHS[0];
    const spice = SPICE_LEVELS.find((s) => s.id === state.spiceId) || SPICE_LEVELS[2];
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
    ctx.fillText('Cozy Mala Maker · ขีดละ 29.- ฟรีซุป + เครื่องปรุง', pad, out.height - 48);

    const a = document.createElement('a');
    a.download = `my-mala-bowl-${price}baht.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  };
  img.src = lastCapturedDataUrl;
}

// ============================================================================
// Handwritten Paper Order Slip (Freehand Ballpoint Pen + Smart Checkbox Detection)
// ============================================================================
let slipPenColor = '#1a4bb8';
let slipDrawing = false;
let slipLastPt = null;
let slipCtx = null;
let lastPenSoundTime = 0;

function resizeOrderSlipCanvas(clear = false) {
  if (!orderSlipCanvas || !orderPaperWrap) return;
  const bg = orderPaperWrap.querySelector('.order-paper-bg');
  if (!bg) return;
  const w = bg.offsetWidth;
  const h = bg.offsetHeight;
  if (w === 0 || h === 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = Math.round(w * dpr);
  const targetH = Math.round(h * dpr);

  if (orderSlipCanvas.width !== targetW || orderSlipCanvas.height !== targetH) {
    orderSlipCanvas.style.width = `${w}px`;
    orderSlipCanvas.style.height = `${h}px`;
    orderSlipCanvas.width = targetW;
    orderSlipCanvas.height = targetH;
    slipCtx = orderSlipCanvas.getContext('2d');
    slipCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  } else if (clear && slipCtx) {
    slipCtx.clearRect(0, 0, w, h);
  }
}

function detectSlipCheckboxAt(clientX, clientY) {
  const options = orderPaperWrap.querySelectorAll('.slip-option');
  for (const el of options) {
    const r = el.getBoundingClientRect();
    // Generous hit area covering the checkbox + label text
    if (clientX >= r.left - 4 && clientX <= r.right + 4 && clientY >= r.top - 2 && clientY <= r.bottom + 2) {
      if (el.dataset.broth) {
        if (state.brothId !== el.dataset.broth) {
          state.brothId = el.dataset.broth;
          orderPaperWrap.querySelectorAll('[data-broth]').forEach((n) => n.classList.remove('detected'));
          el.classList.add('detected');
        }
      } else if (el.dataset.spice !== undefined) {
        const spId = Number(el.dataset.spice);
        if (state.spiceId !== spId) {
          state.spiceId = spId;
          orderPaperWrap.querySelectorAll('[data-spice]').forEach((n) => n.classList.remove('detected'));
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
  if (!orderSlipCanvas) return;

  // Pen color switcher
  document.querySelectorAll('.pen-dot').forEach((btn) => {
    btn.addEventListener('click', () => {
      slipPenColor = btn.dataset.color || '#1a4bb8';
      document.querySelectorAll('.pen-dot').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  btnClearInk.addEventListener('click', () => {
    resizeOrderSlipCanvas(true);
    orderPaperWrap.querySelectorAll('[data-extra]').forEach((n) => n.classList.remove('detected'));
    audio.playTongsClick();
  });

  const getLocalPt = (e) => {
    const rect = orderSlipCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  orderSlipCanvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    resizeOrderSlipCanvas(false);
    if (!slipCtx) return;
    orderSlipCanvas.setPointerCapture(e.pointerId);
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

  orderSlipCanvas.addEventListener('pointermove', (e) => {
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
  orderSlipCanvas.addEventListener('pointerup', endStroke);
  orderSlipCanvas.addEventListener('pointercancel', endStroke);
}

// ============================================================================
// UI Initialization
// ============================================================================
function initUI() {
  // Chiller quick-focus tier pills (all 4 tiers stay visible simultaneously!)
  CHILLER_VIEWS.forEach((view) => {
    const btn = document.createElement('button');
    btn.className = `cat-btn ${view.id === state.chillerView ? 'active' : ''}`;
    btn.textContent = `${view.icon} ${view.label}`;
    btn.addEventListener('click', () => {
      state.chillerView = view.id;
      document.querySelectorAll('.cat-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updatePickCameraTarget();
    });
    categoryBar.appendChild(btn);
  });

  // Mouse wheel & keyboard panning in Stage 1 (plus smooth edge-hover panning!)
  window.addEventListener(
    'wheel',
    (e) => {
      if (state.stage !== 'pick') return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      panChiller(delta * 0.0014);
    },
    { passive: true }
  );

  window.addEventListener('keydown', (e) => {
    if (state.stage !== 'pick') return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') panChiller(-0.32);
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') panChiller(0.32);
  });

  // Printed Order Slip: Broths (7 authentic options)
  BROTHS.forEach((broth) => {
    const row = document.createElement('div');
    row.className = `slip-option ${broth.id === state.brothId ? 'detected' : ''}`;
    row.dataset.broth = broth.id;
    row.innerHTML = `<span class="slip-box"></span><span>${broth.name}</span>`;
    brothListEl.appendChild(row);
  });

  // Printed Order Slip: Spice Levels (4 authentic options)
  SPICE_LEVELS.forEach((sp) => {
    const row = document.createElement('div');
    row.className = `slip-option ${sp.id === state.spiceId ? 'detected' : ''}`;
    row.dataset.spice = String(sp.id);
    row.innerHTML = `<span class="slip-box"></span><span>${sp.label}</span>`;
    spiceListEl.appendChild(row);
  });

  initOrderSlipDrawing();

  // Toppings
  TOPPINGS.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'topping-btn';
    btn.textContent = `${t.icon} ${t.label}`;
    btn.addEventListener('click', () => sprinkleTopping(t.id));
    toppingButtonsEl.appendChild(btn);
  });

  btnMute.addEventListener('click', () => {
    const muted = audio.toggleMute();
    btnMute.textContent = muted ? '🔇' : '🔊';
  });

  btnUndo.addEventListener('click', undoLastPicked);
  btnClear.addEventListener('click', clearBowl);
  btnToWeigh.addEventListener('click', () => setStage('weigh'));
  btnBackPick.addEventListener('click', () => setStage('pick'));
  btnToCook.addEventListener('click', () => setStage('cook'));

  btnLiftNoodle.addEventListener('click', toggleNoodleLift);
  btnPhoto.addEventListener('click', openReceiptModal);
  btnNewBowl.addEventListener('click', () => {
    clearBowl();
    setStage('pick');
  });

  btnCloseModal.addEventListener('click', () => receiptModal.classList.add('hidden'));
  modalBackdrop.addEventListener('click', () => receiptModal.classList.add('hidden'));
  btnDownloadPhoto.addEventListener('click', downloadPhotoAndReceipt);
  btnModalNew.addEventListener('click', () => {
    receiptModal.classList.add('hidden');
    clearBowl();
    setStage('pick');
  });
}

// ============================================================================
// Pointer Interaction
// ============================================================================
let pointerNormX = 0.5;
let pointerNormY = 0.5;
let pointerInsideWindow = false;

function updatePointer(e) {
  pointerNormX = e.clientX / window.innerWidth;
  pointerNormY = e.clientY / window.innerHeight;
  pointerInsideWindow = true;
  pointer.x = pointerNormX * 2 - 1;
  pointer.y = -pointerNormY * 2 + 1;
}

window.addEventListener('pointerleave', () => {
  pointerInsideWindow = false;
});
window.addEventListener('blur', () => {
  pointerInsideWindow = false;
});

function findTrayHit() {
  const hits = raycaster.intersectObjects(trayInteractables, false);
  if (hits.length > 0) {
    return { ...hits[0].object.userData, point: hits[0].point };
  }
  const deepHits = raycaster.intersectObjects(trayGroups, true);
  for (const h of deepHits) {
    let cur = h.object;
    while (cur) {
      if (cur.userData && cur.userData.ingredient) {
        return { trayGroup: cur, ingredient: cur.userData.ingredient, point: h.point };
      }
      cur = cur.parent;
    }
  }
  return null;
}

function checkPointerOverPickBowl(clientX, clientY) {
  if (!pickBowlGroup.visible) return false;
  if (pickBowlHitZone) {
    const bowlHits = raycaster.intersectObject(pickBowlHitZone, false);
    if (bowlHits.length > 0) return true;
  }
  // Generous screen-space fallback around PickBowl center so dropping feels super natural
  const bowlCenter = new THREE.Vector3();
  pickBowlGroup.getWorldPosition(bowlCenter);
  bowlCenter.y += 0.05;
  bowlCenter.project(camera);
  const sx = (bowlCenter.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-bowlCenter.y * 0.5 + 0.5) * window.innerHeight;
  return Math.hypot(clientX - sx, clientY - sy) < 125;
}

canvas.addEventListener('pointermove', (e) => {
  updatePointer(e);

  if (state.stage === 'pick') {
    canvas.style.cursor = 'none';
    raycaster.setFromCamera(pointer, camera);

    if (heldState) {
      // Dragging a grabbed ingredient toward the bowl!
      isOverPickBowl = checkPointerOverPickBowl(e.clientX, e.clientY);
      if (isOverPickBowl) {
        const bw = new THREE.Vector3();
        pickBowlGroup.getWorldPosition(bw);
        tongsTargetPos.set(bw.x, bw.y + 0.145, bw.z + 0.01);
      } else {
        const planeHit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(chillerDragPlane, planeHit)) {
          tongsTargetPos.copy(planeHit);
          tongsTargetPos.z = Math.max(-0.55, Math.min(0.68, tongsTargetPos.z));
          tongsTargetPos.y = Math.max(0.86, Math.min(1.82, tongsTargetPos.y));
        }
      }
      hoveredTray = null;
      trayTooltip.classList.add('hidden');
      return;
    }

    const hit = findTrayHit();
    if (hit) {
      const { trayGroup, ingredient, point } = hit;
      hoveredTray = trayGroup;

      // Place tongs tips right over the hovered food!
      tongsTargetPos.copy(point);
      tongsTargetPos.y += 0.032;
      tongsTargetPos.z += 0.025;

      tooltipName.textContent = `${ingredient.name} ${ingredient.cn || ''}`;
      tooltipMeta.textContent = `~${ingredient.weight} กรัม · กดค้างเพื่อคีบ`;
      trayTooltip.style.left = `${e.clientX}px`;
      trayTooltip.style.top = `${e.clientY - 12}px`;
      trayTooltip.classList.remove('hidden');
    } else {
      hoveredTray = null;
      trayTooltip.classList.add('hidden');
      const planeHit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(chillerDragPlane, planeHit)) {
        tongsTargetPos.copy(planeHit);
        tongsTargetPos.z = Math.max(-0.55, Math.min(0.68, tongsTargetPos.z));
        tongsTargetPos.y = Math.max(0.86, Math.min(1.82, tongsTargetPos.y));
      }
    }
  } else if (state.stage === 'dine') {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(edibleObjects, true);
    canvas.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
  }
});

let pointerDownPos = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pointerDownPos = { x: e.clientX, y: e.clientY };

  if (state.stage === 'pick') {
    updatePointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hit = findTrayHit();
    if (hit) {
      startGrabIngredient(hit.trayGroup, hit.ingredient, hit.point);
    }
  }
});

window.addEventListener('pointerup', (e) => {
  if (state.stage === 'pick') {
    if (heldState) {
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const overBowl = checkPointerOverPickBowl(e.clientX, e.clientY);
      releaseHeldIngredient(overBowl);
    }
    return;
  }

  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  if (Math.hypot(dx, dy) > 14) return;

  if (state.stage === 'dine' && e.target === canvas) {
    updatePointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(edibleObjects, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.edible) obj = obj.parent;
      if (obj && !obj.userData.eating) {
        obj.userData.eating = true;
        obj.userData.eatT = 0;
        audio.playEatSound();
      }
    }
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================================
// Main Animation Loop
// ============================================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (camTransitioning || state.stage !== 'dine') {
    camera.position.lerp(camTargetPos, 1 - Math.exp(-5.5 * dt));
    camCurrentLook.lerp(camTargetLook, 1 - Math.exp(-5.5 * dt));
    camera.lookAt(camCurrentLook);
  } else if (controls.enabled) {
    controls.update();
  }

  // Smooth edge-hover panning along the 4-tier chiller + PickBowl gliding
  if (state.stage === 'pick') {
    if (pointerInsideWindow && pointerNormY > 0.12 && pointerNormY < 0.85) {
      const edgeZone = 0.16;
      let panSpeed = 0;
      if (pointerNormX < edgeZone) {
        const strength = (edgeZone - pointerNormX) / edgeZone;
        panSpeed = -(strength * strength) * 1.15;
      } else if (pointerNormX > 1 - edgeZone) {
        const strength = (pointerNormX - (1 - edgeZone)) / edgeZone;
        panSpeed = (strength * strength) * 1.15;
      }
      if (panSpeed !== 0) {
        panChiller(panSpeed * dt);
      }
    }

    pickBowlGroup.position.x += (state.chillerPanX - pickBowlGroup.position.x) * Math.min(1, dt * 8);
    const bowlTargetY = isOverPickBowl ? 0.942 : 0.92;
    pickBowlGroup.position.y += (bowlTargetY - pickBowlGroup.position.y) * Math.min(1, dt * 12);

    if (pickBowlDropRing) {
      const targetOpacity = heldState ? (isOverPickBowl ? 0.92 : 0.35 + Math.sin(elapsed * 6) * 0.12) : 0.0;
      pickBowlDropRing.material.opacity += (targetOpacity - pickBowlDropRing.material.opacity) * Math.min(1, dt * 12);
      const ringScale = isOverPickBowl ? 1.12 + Math.sin(elapsed * 8) * 0.04 : 1.0;
      pickBowlDropRing.scale.setScalar(ringScale);
    }
  }

  // Subtle tray hover lift
  trayGroups.forEach((g) => {
    const targetY = g === hoveredTray && !heldState ? g.userData.baseY + 0.012 : g.userData.baseY;
    g.position.y += (targetY - g.position.y) * Math.min(1, dt * 14);
  });

  // First-person 3D Tongs cursor tracking & realistic pinch squeeze!
  if (tongsRig && state.stage === 'pick') {
    tongsRig.position.lerp(tongsTargetPos, 1 - Math.exp(-26 * dt));
    // Squeeze prongs together while holding an ingredient!
    if (tongsObj) {
      const targetSqueeze = heldState ? 0.62 : 1.0;
      tongsObj.scale.z += (1.25 * targetSqueeze - tongsObj.scale.z) * Math.min(1, dt * 20);
    }
    // Slight natural wrist tilt when carrying food over the bowl
    const targetPitch = isOverPickBowl ? -0.78 : heldState ? -0.42 : -0.58;
    tongsRig.rotation.z += (targetPitch - tongsRig.rotation.z) * Math.min(1, dt * 14);
  }

  // Flying ingredient arcs into PickBowl
  for (let i = flyingItems.length - 1; i >= 0; i--) {
    const f = flyingItems[i];
    f.t += dt / f.duration;
    const p = Math.min(1, f.t);
    const endWorld = f.targetLocal.clone().applyMatrix4(pickBowlItemsGroup.matrixWorld);
    const pos = new THREE.Vector3().lerpVectors(f.start, endWorld, p);
    pos.y += Math.sin(p * Math.PI) * 0.22;
    f.mesh.position.copy(pos);
    f.mesh.rotation.x += dt * 4;
    f.mesh.rotation.y += dt * 5;

    if (p >= 1) {
      scene.remove(f.mesh);
      f.mesh.position.copy(f.targetLocal);
      f.mesh.rotation.copy(f.rotTarget);
      pickBowlItemsGroup.add(f.mesh);
      audio.playBowlDrop();
      flyingItems.splice(i, 1);
    }
  }

  // Digital scale smooth LED count-up animation
  if (state.stage === 'weigh' && Math.abs(scaleTargetGrams - scaleDisplayGrams) > 0.2) {
    scaleDisplayGrams += (scaleTargetGrams - scaleDisplayGrams) * Math.min(1, dt * 6.5);
    if (Math.abs(scaleTargetGrams - scaleDisplayGrams) <= 0.5) {
      scaleDisplayGrams = scaleTargetGrams;
    }
    drawDigitalScaleLCD(scaleDisplayGrams);
  }

  // Stage 3: Cooking pot bubbles & noodle basket dunking
  if (state.stage === 'cook') {
    const progress = Math.min(1, (performance.now() - cookStartTime) / COOK_DURATION);
    cookBarEl.style.width = `${Math.round(progress * 100)}%`;

    if (progress < 0.45) {
      cookStatusEl.textContent = 'กำลังลวกวัตถุดิบในหม้อ...';
    } else if (progress < 0.8) {
      cookStatusEl.textContent = 'เคี่ยวน้ำซุปหม่าล่าหอมๆ...';
    } else {
      cookStatusEl.textContent = 'ตักจัดลงชามเซรามิก...';
    }

    if (noodleBasketObj) {
      noodleBasketObj.position.y = 1.15 + Math.sin(elapsed * 7) * 0.045;
    }

    potBubbles.forEach((b) => {
      const s = 0.5 + 0.65 * Math.abs(Math.sin(elapsed * b.speed + b.phase));
      b.mesh.scale.setScalar(s);
      b.mesh.position.y = 1.138 + Math.max(0, Math.sin(elapsed * b.speed + b.phase)) * 0.012;
    });

    if (progress >= 1) {
      setStage('dine');
    }
  }

  // Stage 4: Subtle soup shimmer, bobbing & eating animation
  if (state.stage === 'dine') {
    if (malaSoupMesh && malaSoupMesh.material?.map) {
      malaSoupMesh.material.map.offset.x = Math.sin(elapsed * 0.3) * 0.015;
      malaSoupMesh.material.map.offset.y = Math.cos(elapsed * 0.25) * 0.015;
    }

    for (let i = edibleObjects.length - 1; i >= 0; i--) {
      const obj = edibleObjects[i];
      if (obj.userData.eating) {
        obj.userData.eatT += dt * 3.2;
        const t = obj.userData.eatT;
        obj.position.y = obj.userData.baseY + t * 0.14;
        obj.scale.setScalar(Math.max(0.01, 1 - t));
        if (t >= 1) {
          diningContentsGroup.remove(obj);
          edibleObjects.splice(i, 1);
        }
      } else {
        obj.position.y = obj.userData.baseY + Math.sin(elapsed * 2.1 + obj.userData.bobPhase) * 0.0012;
      }
    }

    for (let i = fallingToppings.length - 1; i >= 0; i--) {
      const ft = fallingToppings[i];
      ft.vel += 0.9 * dt;
      ft.mesh.position.y -= ft.vel * dt;
      if (ft.mesh.position.y <= ft.targetY) {
        ft.mesh.position.y = ft.targetY;
        fallingToppings.splice(i, 1);
      }
    }
  }

  // Rising steam particles
  steamSprites.forEach((st) => {
    const active = st.stationTag === state.stage || st.stationTag === 'dine';
    st.sprite.visible = active;
    if (!active) return;
    st.phase = (st.phase + dt * st.speed) % 1;
    st.sprite.position.y = st.origin.y + st.phase * st.height;
    st.sprite.position.x = st.origin.x + Math.sin(elapsed * 1.4 + st.phase * 6) * 0.03;
    const alpha = Math.sin(st.phase * Math.PI) * (st.stationTag === 'cook' ? 0.55 : 0.34);
    st.sprite.material.opacity = alpha;
    const scale = 0.07 + st.phase * 0.15;
    st.sprite.scale.set(scale, scale, 1);
  });

  renderer.render(scene, camera);
}

// ============================================================================
// Boot
// ============================================================================
async function boot() {
  initUI();
  await assets.loadAll((ratio, label) => {
    const pct = Math.round(ratio * 100);
    loadingBar.style.width = `${pct}%`;
    loadingLabel.textContent = `${pct}% · ${label}`;
  });

  buildEnvironment();
  updateHUD();

  topBar.classList.remove('hidden');
  setStage('pick');

  loadingScreen.classList.add('fade-out');
  setTimeout(() => loadingScreen.classList.add('hidden'), 550);

  animate();
}

boot().catch((err) => {
  console.error(err);
  loadingLabel.textContent = `เกิดข้อผิดพลาดในการโหลด: ${err.message}`;
});
