// Builds web-ready copies of the Blender exports.
//
//   ../export/**/*.glb          -> public/**/*.glb   (embedded textures re-encoded as WebP)
//   ../export/textures/*.png    -> public/textures/*.webp
//
// `export/` stays the untouched Blender output (see AGENTS.md). Run this after
// every re-export:  npm run optimize-assets
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { mkdirSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.resolve(webDir, '../export');
const outDir = path.resolve(webDir, 'public');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
let before = 0;
let after = 0;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

for (const src of walk(srcDir)) {
  const rel = path.relative(srcDir, src);
  const ext = path.extname(src).toLowerCase();

  if (ext === '.glb') {
    const out = path.join(outDir, rel);
    mkdirSync(path.dirname(out), { recursive: true });
    const doc = await io.read(src);
    await doc.transform(
      dedup({ propertyTypes: [PropertyType.TEXTURE] }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^normalTexture$/, lossless: true }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!normalTexture$).*/, quality: 88 })
    );
    await io.write(out, doc);
    report(rel, src, out);
  } else if (ext === '.png' && rel.startsWith(`textures${path.sep}Mat_Soup_`)) {
    const out = path.join(outDir, rel.replace(/\.png$/i, '.webp'));
    mkdirSync(path.dirname(out), { recursive: true });
    // Base colour keeps full 1024²; normal/roughness detail is invisible at that size on a bowl.
    // Normal maps are near-flat (stdev ~2 levels), so lossy WebP would erase them: keep lossless.
    const isColor = rel.includes('_BaseColor');
    const isNormal = rel.includes('_Normal');
    let img = sharp(src);
    if (!isColor) img = img.resize(512, 512);
    await img.webp(isNormal ? { lossless: true } : { quality: isColor ? 86 : 90 }).toFile(out);
    report(rel, src, out);
  }
}

console.log(`\nTotal: ${mb(before)} -> ${mb(after)}`);

function report(rel, src, out) {
  const a = statSync(src).size;
  const b = statSync(out).size;
  before += a;
  after += b;
  console.log(`${rel.padEnd(48)} ${mb(a).padStart(9)} -> ${mb(b)}`);
}

function mb(n) {
  return `${(n / 1e6).toFixed(2)} MB`;
}
