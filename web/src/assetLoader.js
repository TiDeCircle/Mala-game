import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLB_PACKS } from './catalog.js';

class AssetLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.texLoader = new THREE.TextureLoader();
    this.nodes = new Map();
    this.soupMaps = {};
  }

  async loadAll(onProgress) {
    const entries = Object.entries(GLB_PACKS);
    let completed = 0;
    const total = entries.length + 6; // +6 for all baked soup texture sets

    const bump = (label) => {
      completed++;
      if (onProgress) onProgress(completed / total, label);
    };

    // Load all 6 baked 1024x1024 PBR soup texture sets
    const loadSoupSet = async (key, prefix) => {
      const [map, normalMap, roughnessMap] = await Promise.all([
        this.loadTex(`/textures/${prefix}_BaseColor.png`, true),
        this.loadTex(`/textures/${prefix}_Normal.png`, false),
        this.loadTex(`/textures/${prefix}_Roughness.png`, false),
      ]);
      this.soupMaps[key] = { map, normalMap, roughnessMap };
      bump(`น้ำซุป (${key})`);
    };

    await Promise.all([
      loadSoupSet('mala', 'Mat_Soup_Mala'),
      loadSoupSet('mala_clear', 'Mat_Soup_MalaClear'),
      loadSoupSet('creamy', 'Mat_Soup_Creamy'),
      loadSoupSet('black', 'Mat_Soup_Black'),
      loadSoupSet('tomato', 'Mat_Soup_Tomato'),
      loadSoupSet('milk', 'Mat_Soup_Milk'),
      ...entries.map(async ([key, url]) => {
        const gltf = await this.loader.loadAsync(url);
        this.indexScene(gltf.scene);
        bump(key);
      }),
    ]);
  }

  loadTex(url, isColor) {
    return new Promise((resolve) => {
      this.texLoader.load(
        url,
        (tex) => {
          tex.flipY = false;
          if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          resolve(tex);
        },
        undefined,
        () => resolve(null)
      );
    });
  }

  indexScene(root) {
    root.updateMatrixWorld(true);
    // Index top-level named children (preserving parent-child hierarchies like MalaBowl -> Slots, Scale_Dial -> Needle)
    root.children.forEach((child) => {
      if (!child.name) return;
      this.normalizeMaterials(child);
      this.nodes.set(child.name, child);
    });
  }

  normalizeMaterials(obj) {
    obj.traverse((n) => {
      if (!n.isMesh) return;
      n.castShadow = true;
      n.receiveShadow = true;

      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach((mat) => {
        if (!mat) return;
        const mName = mat.name || '';
        const oName = n.name || '';

        // Clear plastic PickBowl & glass
        if (mName === 'Mat_PickBowl' || oName === 'PickBowl') {
          mat.transparent = true;
          mat.opacity = 0.36;
          mat.roughness = 0.08;
          mat.metalness = 0.05;
          mat.depthWrite = false;
          mat.side = THREE.DoubleSide;
          n.castShadow = false;
        } else if (mName === 'Mat_ClearGlass' || oName.includes('Glass') || oName.includes('Lid')) {
          mat.transparent = true;
          mat.opacity = 0.24;
          mat.roughness = 0.05;
          mat.metalness = 0.1;
          mat.depthWrite = false;
          n.castShadow = false;
        } else if (mName === 'Mat_WhiteLED' || oName.includes('LED')) {
          mat.emissive = new THREE.Color(0xfff6e5);
          mat.emissiveIntensity = 1.6;
        } else if (mName === 'Mat_WarmCeilingLight') {
          mat.emissive = new THREE.Color(0xffb45c);
          mat.emissiveIntensity = 1.4;
        } else if (mName === 'Mat_ShopSignGlow') {
          mat.emissive = new THREE.Color(0xff6b35);
          mat.emissiveIntensity = 0.9;
        }

        // Fix baked UV margin bleed on cooked noodle textures (replace pure-black unbaked background pixels!)
        if (mName.includes('Noodle_Cooked') && mat.map && mat.map.image) {
          this.fixNoodleBlackBg(mat);
        }
      });
    });
  }

  fixNoodleBlackBg(mat) {
    const img = mat.map.image;
    if (!img || !img.width || !img.height) return;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imgData.data;

    // Compute average color of non-black noodle pixels
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] + d[i + 1] + d[i + 2] > 60) {
        sumR += d[i];
        sumG += d[i + 1];
        sumB += d[i + 2];
        count++;
      }
    }
    if (count === 0) return;
    const avgR = Math.round(sumR / count);
    const avgG = Math.round(sumG / count);
    const avgB = Math.round(sumB / count);

    // Replace dark unbaked UV background pixels with average noodle color
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] + d[i + 1] + d[i + 2] < 75) {
        d[i] = avgR;
        d[i + 1] = avgG;
        d[i + 2] = avgB;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const cleanTex = new THREE.CanvasTexture(c);
    cleanTex.flipY = false;
    cleanTex.colorSpace = THREE.SRGBColorSpace;
    mat.map = cleanTex;
    mat.needsUpdate = true;
  }

  has(name) {
    return this.nodes.has(name);
  }

  clone(name) {
    const src = this.nodes.get(name);
    if (!src) {
      console.warn(`[AssetLibrary] Missing node: ${name}`);
      return null;
    }
    const copy = src.clone(true);
    copy.position.set(0, 0, 0);
    copy.rotation.set(0, 0, 0);
    copy.scale.set(1, 1, 1);
    return copy;
  }

  cloneRaw(id) {
    return this.clone(`${id}_Raw`);
  }

  cloneCooked(id) {
    return this.clone(`${id}_Cooked`);
  }

  cloneNoodleBed(id, variant = 'A') {
    return this.clone(`${id}_Bed_${variant}`) || this.clone(`${id}_Bed_A`);
  }

  cloneNoodleLift(id) {
    return this.clone(`${id}_Lift`);
  }

  applyBrothToSoupMesh(soupMesh, broth) {
    if (!soupMesh) return;
    if (broth.isDry) {
      soupMesh.visible = false;
      return;
    }
    soupMesh.visible = true;
    const set = this.soupMaps[broth.textureKey] || this.soupMaps.mala;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(broth.tint),
      map: set?.map || null,
      normalMap: set?.normalMap || null,
      roughnessMap: set?.roughnessMap || null,
      roughness: broth.roughness,
      metalness: 0.04,
      transparent: !!broth.clearSoup,
      opacity: broth.clearSoup ? 0.84 : 1.0,
    });
    soupMesh.material = mat;
    soupMesh.receiveShadow = true;
    soupMesh.castShadow = false;
  }
}

export const assets = new AssetLibrary();
