// Rising steam sprites above the cooking pot and the served bowl.
import * as THREE from 'three';
import { scene } from '../core/context.js';
import { createSteamTexture } from './textures.js';

const steamTex = createSteamTexture();
const steamSprites = [];

export function spawnSteamEmitter(origin, count, spread, height, stationTag) {
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

export function updateSteam(dt, elapsed, stage) {
  steamSprites.forEach((st) => {
    const active = st.stationTag === stage || st.stationTag === 'dine';
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
}
