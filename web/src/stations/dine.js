// Stage 4 — dining table: compose the served bowl, toppings, noodle lift, tap-to-eat.
import * as THREE from 'three';
import { TOPPINGS } from '../catalog.js';
import { assets } from '../assetLoader.js';
import { audio } from '../audio.js';
import { state, dom, scene, raycaster, STATION_X, currentBroth, clearGroup, setPointerFromEvent } from '../core/context.js';
import { spawnSteamEmitter } from '../effects/steam.js';

const edibleObjects = [];
const fallingToppings = [];

let malaBowlGroup = null;
let malaSoupMesh = null;
let malaSlots = [];
const diningContentsGroup = new THREE.Group();
const diningToppingsGroup = new THREE.Group();
const noodleLiftGroup = new THREE.Group();
let diningChopsticks = null;

export function buildDineStation() {
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
// Stage 4: Compose the Final Mala Bowl (Exact AGENTS.md Slot System!)
// ============================================================================
export function composeMalaBowl() {
  clearGroup(diningContentsGroup);
  clearGroup(diningToppingsGroup);
  clearGroup(noodleLiftGroup);
  edibleObjects.length = 0;
  state.toppingsAdded = [];
  state.noodleLifted = false;

  const broth = currentBroth();
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
    dom.btnLiftNoodle.classList.remove('hidden');
    dom.btnLiftNoodle.textContent = '🍜 คีบเส้นโชว์';
  } else {
    dom.btnLiftNoodle.classList.add('hidden');
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

export function sprinkleTopping(toppingId, silent = false) {
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

export function toggleNoodleLift() {
  const pickedNoodles = state.picked.filter((p) => p.isNoodle);
  if (pickedNoodles.length === 0) return;

  state.noodleLifted = !state.noodleLifted;
  clearGroup(noodleLiftGroup);

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
    dom.btnLiftNoodle.textContent = '🍜 วางตะเกียบลง';
  } else {
    if (diningChopsticks) diningChopsticks.visible = true;
    dom.btnLiftNoodle.textContent = '🍜 คีบเส้นโชว์';
  }
}

export function initToppingButtons() {
  TOPPINGS.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'topping-btn';
    btn.textContent = `${t.icon} ${t.label}`;
    btn.addEventListener('click', () => sprinkleTopping(t.id));
    dom.toppingButtonsEl.appendChild(btn);
  });
}

function edibleUnderPointer(e) {
  setPointerFromEvent(e);
  const hits = raycaster.intersectObjects(edibleObjects, true);
  if (hits.length === 0) return null;
  let obj = hits[0].object;
  while (obj && !obj.userData.edible) obj = obj.parent;
  return obj;
}

export function onDinePointerMove(e) {
  if (e.pointerType === 'touch') return;
  dom.canvas.style.cursor = edibleUnderPointer(e) ? 'pointer' : 'grab';
}

// A tap/click (not a drag-orbit) on a piece of food eats it.
export function onDineTap(e) {
  const obj = edibleUnderPointer(e);
  if (obj && !obj.userData.eating) {
    obj.userData.eating = true;
    obj.userData.eatT = 0;
    audio.playEatSound();
  }
}

// Stage 4: Subtle soup shimmer, bobbing & eating animation
export function updateDine(dt, elapsed) {
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
