import * as THREE from 'three';

/**
 * Procedural PBR material factory. Every texture is drawn to a canvas at
 * runtime, so the game ships with zero image assets and always renders.
 * Normal maps are derived from generated height fields via a Sobel filter.
 */

function makeCanvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { c, ctx };
}

function valueNoise(ctx: CanvasRenderingContext2D, size: number, cells: number, alpha: number): void {
  // blocky value noise smoothed by the browser's image scaling
  const s = document.createElement('canvas');
  s.width = s.height = cells;
  const sctx = s.getContext('2d')!;
  const img = sctx.createImageData(cells, cells);
  for (let i = 0; i < cells * cells; i++) {
    const v = Math.floor(Math.random() * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(s, 0, 0, size, size);
  ctx.globalAlpha = 1;
}

/** Derive a tangent-space normal map from a grayscale height canvas. */
function heightToNormal(height: HTMLCanvasElement, strength: number): THREE.CanvasTexture {
  const size = height.width;
  const hctx = height.getContext('2d')!;
  const src = hctx.getImageData(0, 0, size, size).data;
  const { c, ctx } = makeCanvas(size);
  const out = ctx.createImageData(size, size);
  const at = (x: number, y: number) => {
    const xx = (x + size) % size;
    const yy = (y + size) % size;
    return src[(yy * size + xx) * 4] / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function tex(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---- Wallpaper -----------------------------------------------------------
export function wallpaperMaterial(): THREE.MeshStandardMaterial {
  const size = 512;
  const { c, ctx } = makeCanvas(size);
  // base
  ctx.fillStyle = '#2c2a24';
  ctx.fillRect(0, 0, size, size);
  // vertical stripes
  for (let x = 0; x < size; x += 32) {
    ctx.fillStyle = x % 64 === 0 ? '#322f28' : '#292620';
    ctx.fillRect(x, 0, 16, size);
  }
  // damask motif
  ctx.strokeStyle = 'rgba(120,100,70,0.18)';
  ctx.lineWidth = 2;
  for (let gy = 0; gy < size; gy += 128) {
    for (let gx = 0; gx < size; gx += 128) {
      const cx = gx + 64;
      const cy = gy + 64;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.2) {
        const r = 30 + 14 * Math.sin(a * 4);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r * 1.3;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  // grime + water stains
  valueNoise(ctx, size, 64, 0.12);
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(10,6,4,0.55)');
  grad.addColorStop(0.5, 'rgba(10,6,4,0)');
  grad.addColorStop(1, 'rgba(20,10,4,0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 30 + Math.random() * 80;
    const st = ctx.createRadialGradient(x, y, 0, x, y, r);
    st.addColorStop(0, 'rgba(40,25,10,0.28)');
    st.addColorStop(1, 'rgba(40,25,10,0)');
    ctx.fillStyle = st;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // height for normal (stripe relief + noise)
  const { c: hc, ctx: hctx } = makeCanvas(size);
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 32) {
    hctx.fillStyle = '#606060';
    hctx.fillRect(x, 0, 16, size);
  }
  valueNoise(hctx, size, 128, 0.35);

  const map = tex(c, true);
  const normalMap = heightToNormal(hc, 2.2);
  const mat = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughness: 0.92,
    metalness: 0,
    normalScale: new THREE.Vector2(0.6, 0.6),
  });
  map.repeat.set(3, 2);
  normalMap.repeat.set(3, 2);
  return mat;
}

// ---- Hardwood floor ------------------------------------------------------
export function floorMaterial(): THREE.MeshStandardMaterial {
  const size = 512;
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#20150c';
  ctx.fillRect(0, 0, size, size);
  const plankH = 64;
  for (let y = 0; y < size; y += plankH) {
    const offset = ((y / plankH) % 2) * 60;
    for (let x = -60; x < size; x += 128) {
      const shade = 18 + Math.random() * 22;
      ctx.fillStyle = `rgb(${shade + 20},${shade + 8},${shade})`;
      ctx.fillRect(x + offset, y + 1, 126, plankH - 2);
      // grain lines
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 6; g++) {
        ctx.beginPath();
        const gy = y + 6 + g * 9 + Math.random() * 3;
        ctx.moveTo(x + offset, gy);
        ctx.bezierCurveTo(x + offset + 40, gy + 2, x + offset + 80, gy - 2, x + offset + 126, gy);
        ctx.stroke();
      }
    }
    // board gaps
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, y, size, 2);
  }
  valueNoise(ctx, size, 96, 0.1);
  // dark vignette grime
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const { c: hc, ctx: hctx } = makeCanvas(size);
  hctx.fillStyle = '#909090';
  hctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += plankH) {
    hctx.fillStyle = '#404040';
    hctx.fillRect(0, y, size, 2);
  }
  valueNoise(hctx, size, 128, 0.4);

  const map = tex(c, true);
  const normalMap = heightToNormal(hc, 1.8);
  map.repeat.set(4, 8);
  normalMap.repeat.set(4, 8);
  const mat = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughness: 0.55,
    metalness: 0.0,
    normalScale: new THREE.Vector2(0.5, 0.5),
  });
  return mat;
}

// ---- Ceiling / plaster ---------------------------------------------------
export function plasterMaterial(color = '#1c1a17'): THREE.MeshStandardMaterial {
  const size = 256;
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  valueNoise(ctx, size, 64, 0.14);
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 20 + Math.random() * 50;
    const st = ctx.createRadialGradient(x, y, 0, x, y, r);
    st.addColorStop(0, 'rgba(30,20,8,0.3)');
    st.addColorStop(1, 'rgba(30,20,8,0)');
    ctx.fillStyle = st;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const { c: hc, ctx: hctx } = makeCanvas(size);
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, size, size);
  valueNoise(hctx, size, 96, 0.5);
  const map = tex(c, true);
  const normalMap = heightToNormal(hc, 1.2);
  map.repeat.set(3, 3);
  normalMap.repeat.set(3, 3);
  return new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.96, metalness: 0 });
}

// ---- Painted wood (trim, doors) -----------------------------------------
export function woodMaterial(color = '#3a2417'): THREE.MeshStandardMaterial {
  const size = 256;
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + 6, size * 0.6, y - 6, size, y);
    ctx.lineWidth = 0.5 + Math.random();
    ctx.stroke();
  }
  valueNoise(ctx, size, 64, 0.08);
  const map = tex(c, true);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0.05 });
}

/** Blood texture with transparency, used for decals that "grow". */
export function bloodTexture(): THREE.CanvasTexture {
  const size = 256;
  const { c, ctx } = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size * 0.35;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.4);
  g.addColorStop(0, 'rgba(90,0,0,0.95)');
  g.addColorStop(0.6, 'rgba(60,0,0,0.85)');
  g.addColorStop(1, 'rgba(40,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
  ctx.fill();
  // drips
  ctx.fillStyle = 'rgba(70,0,0,0.9)';
  for (let i = 0; i < 10; i++) {
    const x = cx + (Math.random() - 0.5) * size * 0.5;
    const w = 3 + Math.random() * 8;
    const h = 40 + Math.random() * 120;
    ctx.fillRect(x, cy, w, h);
    ctx.beginPath();
    ctx.arc(x + w / 2, cy + h, w / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
