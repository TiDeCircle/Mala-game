// Stage 1 — the 4-tier chiller wall, first-person tongs and the clear PickBowl.
import * as THREE from 'three';
import { INGREDIENTS, CHILLER_VIEWS } from '../catalog.js';
import { assets } from '../assetLoader.js';
import { audio } from '../audio.js';
import TRAY_PHYSICS_PILES from '../trayPhysicsPiles.json';
import {
  state,
  dom,
  scene,
  camera,
  cam,
  raycaster,
  setPointerFromEvent,
  clearGroup,
} from '../core/context.js';
import { createCorrugatedStainlessTexture, createChillerRailTag, createTrayAOTexture } from '../effects/textures.js';
import { updateHUD } from '../hud.js';

const trayInteractables = [];
const trayGroups = [];
const flyingItems = [];

const chillerTraysRoot = new THREE.Group();
export const pickBowlGroup = new THREE.Group();
const pickBowlItemsGroup = new THREE.Group();
let pickBowlDropRing = null;
let pickBowlHitZone = null;

// First-person Tongs rig (origin = exact gripping tip between the two prongs!)
export const tongsRig = new THREE.Group();
let tongsObj = null;
const heldItemGroup = new THREE.Group();
const tongsTargetPos = new THREE.Vector3(0.0, 1.15, 0.25);
let hoveredTray = null;
let heldState = null; // { item, mesh, sourceTray } when holding left-click
let isOverPickBowl = false;
let uidCounter = 1;

// Inclined drag plane in front of the 4-tier chiller for smooth 3D tongs tracking
const chillerDragPlane = new THREE.Plane(new THREE.Vector3(0, 0.35, 0.94).normalize(), -0.18);

const trayAOMat = new THREE.MeshBasicMaterial({
  map: createTrayAOTexture(),
  transparent: true,
  depthWrite: false,
});

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

export function buildPickStation() {
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
}

// ============================================================================
// Chiller Camera View & Panning Controls
// ============================================================================
export function updatePickCameraTarget() {
  const v = CHILLER_VIEWS.find((cv) => cv.id === state.chillerView) || CHILLER_VIEWS[0];
  state.chillerPanX = Math.max(-0.78, Math.min(0.78, state.chillerPanX));
  cam.targetPos.set(state.chillerPanX, v.y, v.z);
  cam.targetLook.set(state.chillerPanX, v.lookY, -0.35);
}

export function panChiller(deltaX) {
  if (state.stage !== 'pick') return;
  state.chillerPanX = Math.max(-0.78, Math.min(0.78, state.chillerPanX + deltaX));
  updatePickCameraTarget();
}

// Held ‹ › buttons glide continuously (-1, 0, +1)
let panButtonDir = 0;
export function setPanButtonDir(dir) {
  panButtonDir = dir;
}

export function enterPick() {
  updatePickCameraTarget();
  pickBowlGroup.visible = true;
  pickBowlGroup.position.set(state.chillerPanX, 0.92, 0.56);
  tongsRig.visible = true;
  dom.canvas.style.cursor = 'none';
}

export function leavePick() {
  releaseHeldIngredient(false);
  panButtonDir = 0;
  swipe = null;
  tongsRig.visible = false;
}

// ============================================================================
// Picking Logic & Flying Arc Animation
// ============================================================================
function startGrabIngredient(trayGroup, item, hitPoint) {
  const rawMesh = assets.cloneRaw(item.id);
  if (!rawMesh) return;

  audio.playTongsClick();
  rawMesh.position.set(0, -0.008, 0);
  rawMesh.scale.setScalar((item.scale || 1) * 0.95);
  rawMesh.rotation.set(0.2, Math.random() * Math.PI * 2, 0.15);

  clearGroup(heldItemGroup);
  heldItemGroup.add(rawMesh);

  heldState = { item, mesh: rawMesh, sourceTray: trayGroup };
  if (hitPoint) {
    tongsTargetPos.copy(hitPoint);
    tongsTargetPos.y += 0.045;
  }
  dom.trayTooltip.classList.add('hidden');
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

export function undoLastPicked() {
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

export function clearBowl() {
  state.picked = [];
  clearGroup(pickBowlItemsGroup);
  while (flyingItems.length > 0) {
    const f = flyingItems.pop();
    scene.remove(f.mesh);
  }
  updateHUD();
}

// ============================================================================
// Pointer Interaction (mouse = hover tongs; touch = press-drag + swipe to pan)
// ============================================================================
let pointerNormX = 0.5;
let pointerNormY = 0.5;
let pointerInsideWindow = false;
let lastPointerType = 'mouse';
let swipe = null; // { pointerId, startX, startPan } while a finger pans the chiller

function trackPointer(e) {
  pointerNormX = e.clientX / window.innerWidth;
  pointerNormY = e.clientY / window.innerHeight;
  pointerInsideWindow = true;
  lastPointerType = e.pointerType || 'mouse';
  setPointerFromEvent(e);
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

function aimTongsAtDragPlane() {
  const planeHit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(chillerDragPlane, planeHit)) {
    tongsTargetPos.copy(planeHit);
    tongsTargetPos.z = Math.max(-0.55, Math.min(0.68, tongsTargetPos.z));
    tongsTargetPos.y = Math.max(0.86, Math.min(1.82, tongsTargetPos.y));
  }
}

export function onPickPointerMove(e) {
  trackPointer(e);
  dom.canvas.style.cursor = 'none';

  if (swipe && e.pointerId === swipe.pointerId) {
    state.chillerPanX = swipe.startPan - ((e.clientX - swipe.startX) / window.innerWidth) * 1.8;
    updatePickCameraTarget();
    return;
  }

  if (heldState) {
    // Dragging a grabbed ingredient toward the bowl!
    isOverPickBowl = checkPointerOverPickBowl(e.clientX, e.clientY);
    if (isOverPickBowl) {
      const bw = new THREE.Vector3();
      pickBowlGroup.getWorldPosition(bw);
      tongsTargetPos.set(bw.x, bw.y + 0.145, bw.z + 0.01);
    } else {
      aimTongsAtDragPlane();
    }
    hoveredTray = null;
    dom.trayTooltip.classList.add('hidden');
    return;
  }

  // Touch has no hover: only drags (handled above) move the tongs.
  if (e.pointerType === 'touch') return;

  const hit = findTrayHit();
  if (hit) {
    const { trayGroup, ingredient, point } = hit;
    hoveredTray = trayGroup;

    // Place tongs tips right over the hovered food!
    tongsTargetPos.copy(point);
    tongsTargetPos.y += 0.032;
    tongsTargetPos.z += 0.025;

    dom.tooltipName.textContent = `${ingredient.name} ${ingredient.cn || ''}`;
    dom.tooltipMeta.textContent = `~${ingredient.weight} กรัม · กดค้างเพื่อคีบ`;
    dom.trayTooltip.style.left = `${e.clientX}px`;
    dom.trayTooltip.style.top = `${e.clientY - 12}px`;
    dom.trayTooltip.classList.remove('hidden');
  } else {
    hoveredTray = null;
    dom.trayTooltip.classList.add('hidden');
    aimTongsAtDragPlane();
  }
}

export function onPickPointerDown(e) {
  trackPointer(e);
  const hit = findTrayHit();
  if (hit) {
    startGrabIngredient(hit.trayGroup, hit.ingredient, hit.point);
  } else if (e.pointerType !== 'mouse') {
    swipe = { pointerId: e.pointerId, startX: e.clientX, startPan: state.chillerPanX };
  }
}

export function onPickPointerUp(e) {
  if (swipe && e.pointerId === swipe.pointerId) swipe = null;
  if (heldState) {
    trackPointer(e);
    const overBowl = checkPointerOverPickBowl(e.clientX, e.clientY);
    releaseHeldIngredient(overBowl);
  }
  // A lifted finger must not keep the edge-pan running from its last position.
  if (e.pointerType !== 'mouse') pointerInsideWindow = false;
}

// ============================================================================
// Per-frame update
// ============================================================================
function edgePanSpeed() {
  // Mouse: hover near the edge. Touch: only while dragging food toward the edge.
  if (!pointerInsideWindow) return 0;
  if (lastPointerType !== 'mouse' && !heldState) return 0;
  if (pointerNormY <= 0.12 || pointerNormY >= 0.85) return 0;
  const edgeZone = 0.16;
  if (pointerNormX < edgeZone) {
    const strength = (edgeZone - pointerNormX) / edgeZone;
    return -(strength * strength) * 1.15;
  }
  if (pointerNormX > 1 - edgeZone) {
    const strength = (pointerNormX - (1 - edgeZone)) / edgeZone;
    return strength * strength * 1.15;
  }
  return 0;
}

export function updatePick(dt, elapsed) {
  // Smooth edge-hover / button panning along the 4-tier chiller + PickBowl gliding
  const panSpeed = panButtonDir !== 0 ? panButtonDir * 0.9 : edgePanSpeed();
  if (panSpeed !== 0) panChiller(panSpeed * dt);

  pickBowlGroup.position.x += (state.chillerPanX - pickBowlGroup.position.x) * Math.min(1, dt * 8);
  const bowlTargetY = isOverPickBowl ? 0.942 : 0.92;
  pickBowlGroup.position.y += (bowlTargetY - pickBowlGroup.position.y) * Math.min(1, dt * 12);

  if (pickBowlDropRing) {
    const targetOpacity = heldState ? (isOverPickBowl ? 0.92 : 0.35 + Math.sin(elapsed * 6) * 0.12) : 0.0;
    pickBowlDropRing.material.opacity += (targetOpacity - pickBowlDropRing.material.opacity) * Math.min(1, dt * 12);
    const ringScale = isOverPickBowl ? 1.12 + Math.sin(elapsed * 8) * 0.04 : 1.0;
    pickBowlDropRing.scale.setScalar(ringScale);
  }

  // First-person 3D Tongs cursor tracking & realistic pinch squeeze!
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

// Runs in every stage: tray hover settle and in-flight drops finishing their arc.
export function updatePickAlways(dt) {
  // Subtle tray hover lift
  trayGroups.forEach((g) => {
    const targetY = g === hoveredTray && !heldState ? g.userData.baseY + 0.012 : g.userData.baseY;
    g.position.y += (targetY - g.position.y) * Math.min(1, dt * 14);
  });

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
}
