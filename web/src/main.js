// Cozy Mala Maker — boot, stage flow, input routing and the render loop.
// Each station lives in src/stations/*; shared state & Three.js core in src/core/context.js.
import * as THREE from 'three';
import { CHILLER_VIEWS } from './catalog.js';
import { assets } from './assetLoader.js';
import { audio } from './audio.js';
import {
  state,
  dom,
  renderer,
  scene,
  camera,
  controls,
  cam,
  CAM_PRESETS,
  isTouchDevice,
  fovForAspect,
} from './core/context.js';
import { getQuality, toggleQuality, applyQuality } from './core/quality.js';
import { updateHUD } from './hud.js';
import { updateSteam } from './effects/steam.js';
import {
  buildPickStation,
  enterPick,
  leavePick,
  pickBowlGroup,
  updatePickCameraTarget,
  panChiller,
  setPanButtonDir,
  undoLastPicked,
  clearBowl,
  onPickPointerMove,
  onPickPointerDown,
  onPickPointerUp,
  updatePick,
  updatePickAlways,
} from './stations/pick.js';
import { buildWeighStation, enterWeigh, updateWeigh } from './stations/weigh.js';
import { initOrderSlip, resizeOrderSlipCanvas } from './stations/orderSlip.js';
import { buildCookStation, enterCook, updateCook } from './stations/cook.js';
import {
  buildDineStation,
  composeMalaBowl,
  toggleNoodleLift,
  initToppingButtons,
  onDinePointerMove,
  onDineTap,
  updateDine,
} from './stations/dine.js';
import { openReceiptModal, downloadPhotoAndReceipt } from './receipt.js';

// ============================================================================
// Shop shell + all 4 stations
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

  buildPickStation();
  buildWeighStation();
  buildCookStation();
  buildDineStation();
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

  Object.entries(dom.stagePanels).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== nextStage);
  });

  dom.trayTooltip.classList.add('hidden');
  audio.stopBoiling();

  cam.transitioning = true;
  controls.enabled = false;

  if (nextStage === 'pick') {
    enterPick();
  } else {
    leavePick();
    dom.canvas.style.cursor = nextStage === 'dine' ? 'grab' : 'default';
    const preset = CAM_PRESETS[nextStage];
    cam.targetPos.copy(preset.pos);
    cam.targetLook.copy(preset.target);
  }

  if (nextStage === 'weigh') {
    enterWeigh(pickBowlGroup);
    updateHUD();
    // Ensure handwritten order slip canvas matches paper dimensions
    requestAnimationFrame(() => resizeOrderSlipCanvas(false));
  } else if (nextStage === 'cook') {
    pickBowlGroup.visible = false;
    enterCook();
  } else if (nextStage === 'dine') {
    pickBowlGroup.visible = false;
    composeMalaBowl();
    audio.playServeChime();
    setTimeout(() => {
      if (state.stage === 'dine') {
        cam.transitioning = false;
        controls.target.copy(CAM_PRESETS.dine.target);
        controls.enabled = true;
        controls.update();
      }
    }, 950);
  }
}

function startNewBowl() {
  dom.receiptModal.classList.add('hidden');
  clearBowl();
  setStage('pick');
}

// ============================================================================
// UI Initialization
// ============================================================================
function renderQualityButton() {
  const high = getQuality() === 'high';
  dom.btnQuality.textContent = high ? 'HD' : 'LITE';
  dom.btnQuality.title = high
    ? 'ภาพคมชัด — กดเพื่อสลับเป็นโหมดลื่น (เหมาะกับมือถือ)'
    : 'โหมดลื่น — กดเพื่อสลับเป็นภาพคมชัด';
}

function bindHoldButton(btn, dir) {
  const stop = () => setPanButtonDir(0);
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    setPanButtonDir(dir);
  });
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('lostpointercapture', stop);
}

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
    dom.categoryBar.appendChild(btn);
  });

  // Mouse wheel & keyboard panning in Stage 1 (plus edge-hover, swipe and ‹ › buttons)
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

  bindHoldButton(dom.btnPanLeft, -1);
  bindHoldButton(dom.btnPanRight, 1);

  if (isTouchDevice) {
    dom.dockHint.textContent =
      '✨ แตะค้างที่วัตถุดิบแล้วลากไปปล่อยในชามใส · ปัดจอหรือกดปุ่ม ‹ › เพื่อเลื่อนดูตู้';
    dom.dineHint.textContent = '👆 ลากเพื่อหมุนดูชาม · จีบนิ้วเพื่อซูม · แตะของในชามเพื่อคีบกิน!';
    document.querySelector('.pen-hint').textContent = '✍️ ใช้นิ้วเขียนชื่อ / ขีดติ๊กในช่องได้เลย';
  }

  initOrderSlip();
  initToppingButtons();

  dom.btnMute.addEventListener('click', () => {
    const muted = audio.toggleMute();
    dom.btnMute.textContent = muted ? '🔇' : '🔊';
  });

  renderQualityButton();
  dom.btnQuality.addEventListener('click', () => {
    toggleQuality(renderer, scene);
    renderQualityButton();
  });

  dom.btnUndo.addEventListener('click', undoLastPicked);
  dom.btnClear.addEventListener('click', clearBowl);
  dom.btnToWeigh.addEventListener('click', () => setStage('weigh'));
  dom.btnBackPick.addEventListener('click', () => setStage('pick'));
  dom.btnToCook.addEventListener('click', () => setStage('cook'));

  dom.btnLiftNoodle.addEventListener('click', toggleNoodleLift);
  dom.btnPhoto.addEventListener('click', openReceiptModal);
  dom.btnNewBowl.addEventListener('click', startNewBowl);

  dom.btnCloseModal.addEventListener('click', () => dom.receiptModal.classList.add('hidden'));
  dom.modalBackdrop.addEventListener('click', () => dom.receiptModal.classList.add('hidden'));
  dom.btnDownloadPhoto.addEventListener('click', downloadPhotoAndReceipt);
  dom.btnModalNew.addEventListener('click', startNewBowl);
}

// ============================================================================
// Pointer routing
// ============================================================================
dom.canvas.addEventListener('pointermove', (e) => {
  if (state.stage === 'pick') onPickPointerMove(e);
  else if (state.stage === 'dine') onDinePointerMove(e);
});

let pointerDownPos = { x: 0, y: 0 };
dom.canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pointerDownPos = { x: e.clientX, y: e.clientY };
  if (state.stage === 'pick') {
    // Keep receiving moves for this finger/mouse even if it leaves the canvas.
    dom.canvas.setPointerCapture(e.pointerId);
    onPickPointerDown(e);
  }
});

window.addEventListener('pointerup', (e) => {
  if (state.stage === 'pick') {
    onPickPointerUp(e);
    return;
  }

  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  if (Math.hypot(dx, dy) > 14) return;

  if (state.stage === 'dine' && e.target === dom.canvas) onDineTap(e);
});

window.addEventListener('pointercancel', (e) => {
  if (state.stage === 'pick') onPickPointerUp(e);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = fovForAspect(camera.aspect);
  camera.updateProjectionMatrix();
  applyQuality(renderer, scene);
});

// ============================================================================
// Main Animation Loop
// ============================================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (cam.transitioning || state.stage !== 'dine') {
    camera.position.lerp(cam.targetPos, 1 - Math.exp(-5.5 * dt));
    cam.currentLook.lerp(cam.targetLook, 1 - Math.exp(-5.5 * dt));
    camera.lookAt(cam.currentLook);
  } else if (controls.enabled) {
    controls.update();
  }

  if (state.stage === 'pick') updatePick(dt, elapsed);
  updatePickAlways(dt);

  if (state.stage === 'weigh') updateWeigh(dt);
  if (state.stage === 'cook' && updateCook(dt, elapsed)) setStage('dine');
  if (state.stage === 'dine') updateDine(dt, elapsed);

  updateSteam(dt, elapsed, state.stage);

  renderer.render(scene, camera);
}

// ============================================================================
// Boot
// ============================================================================
async function boot() {
  initUI();
  await assets.loadAll((ratio, label) => {
    const pct = Math.round(ratio * 100);
    dom.loadingBar.style.width = `${pct}%`;
    dom.loadingLabel.textContent = `${pct}% · ${label}`;
  });

  buildEnvironment();
  applyQuality(renderer, scene); // shadow map sizes for the lights just added
  updateHUD();

  dom.topBar.classList.remove('hidden');
  setStage('pick');

  dom.loadingScreen.classList.add('fade-out');
  setTimeout(() => dom.loadingScreen.classList.add('hidden'), 550);

  animate();
}

boot().catch((err) => {
  console.error(err);
  dom.loadingLabel.textContent = `เกิดข้อผิดพลาดในการโหลด: ${err.message}`;
});
