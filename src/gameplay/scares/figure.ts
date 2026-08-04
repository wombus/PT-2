import * as THREE from 'three';

/** A screaming/anguished face texture for apparitions and mirrors. */
export function makeFaceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, 256, 320);
  // face
  const g = ctx.createRadialGradient(128, 150, 20, 128, 160, 150);
  g.addColorStop(0, '#c9c2b4');
  g.addColorStop(0.7, '#8a8375');
  g.addColorStop(1, '#0a0a0c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(128, 155, 78, 100, 0, 0, Math.PI * 2);
  ctx.fill();
  // sunken eyes
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(96, 140, 20, 26, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(160, 140, 20, 26, -0.2, 0, Math.PI * 2); ctx.fill();
  // faint pupils
  ctx.fillStyle = '#4a1010';
  ctx.beginPath(); ctx.arc(98, 146, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(158, 146, 4, 0, Math.PI * 2); ctx.fill();
  // gaping mouth
  ctx.fillStyle = '#08000a';
  ctx.beginPath(); ctx.ellipse(128, 225, 26, 44, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a0000'; ctx.lineWidth = 2;
  ctx.stroke();
  // blood streaks
  ctx.strokeStyle = 'rgba(90,0,0,0.7)'; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const x = 80 + Math.random() * 96;
    ctx.moveTo(x, 120 + Math.random() * 40);
    ctx.lineTo(x + (Math.random() - 0.5) * 20, 300);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A pale, wrong-proportioned humanoid apparition built from primitives.
 * Slightly emissive so it reads in near-darkness. Returns the group plus its
 * material for fading in/out.
 */
export function buildFigure(): { group: THREE.Group; setOpacity: (o: number) => void } {
  const group = new THREE.Group();
  const mats: THREE.MeshStandardMaterial[] = [];
  const skin = () => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x9a9488,
      roughness: 0.85,
      metalness: 0,
      emissive: 0x14161c,
      transparent: true,
      opacity: 1,
    });
    mats.push(m);
    return m;
  };

  // torso — too thin, too long
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.75, 4, 10), skin());
  torso.position.y = 1.15;
  group.add(torso);

  // head — tilted
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), skin());
  head.position.set(0.04, 1.72, 0);
  head.rotation.z = 0.35;
  head.scale.set(0.9, 1.15, 0.9);
  group.add(head);

  // face plane on the head
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.26),
    new THREE.MeshBasicMaterial({ map: makeFaceTexture(), transparent: true }),
  );
  face.position.set(0.04, 1.72, 0.12);
  group.add(face);

  // long arms hanging past the knees
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.95, 4, 8), skin());
    arm.position.set(side * 0.17, 0.95, 0.02);
    arm.rotation.z = side * 0.05;
    group.add(arm);
  }
  // legs
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.7, 4, 8), skin());
    leg.position.set(side * 0.08, 0.4, 0);
    group.add(leg);
  }

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.renderOrder = 2;
  });

  return {
    group,
    setOpacity: (o: number) => {
      for (const m of mats) m.opacity = o;
      (face.material as THREE.MeshBasicMaterial).opacity = o;
    },
  };
}
