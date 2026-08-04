import * as THREE from 'three';

/** A gaunt, anguished face — hollow sockets, agonised mouth, weeping blood.
 *  Transparent background: it overlays the skull so only the features read. */
export function makeFaceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 340;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 340);

  // faint gaunt shading to sink the eyes/temples (kept translucent)
  const g = ctx.createRadialGradient(128, 150, 40, 128, 165, 120);
  g.addColorStop(0, 'rgba(20,16,18,0)');
  g.addColorStop(0.7, 'rgba(12,9,12,0.25)');
  g.addColorStop(1, 'rgba(6,5,8,0.6)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(128, 165, 74, 112, 0, 0, Math.PI * 2);
  ctx.fill();

  // hollow cheeks (shadow)
  ctx.fillStyle = 'rgba(8,6,9,0.5)';
  ctx.beginPath(); ctx.ellipse(80, 200, 22, 48, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(176, 200, 22, 48, -0.3, 0, Math.PI * 2); ctx.fill();

  // deep black eye sockets, set high and wide
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(94, 135, 24, 30, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(162, 135, 24, 30, -0.15, 0, Math.PI * 2); ctx.fill();
  // faint dead glimmer deep in the sockets
  ctx.fillStyle = 'rgba(140,150,150,0.5)';
  ctx.beginPath(); ctx.arc(98, 142, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(158, 142, 3, 0, Math.PI * 2); ctx.fill();
  // heavy brow shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(70, 112); ctx.lineTo(118, 122); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(186, 112); ctx.lineTo(138, 122); ctx.stroke();

  // thin nose / dark nasal cavity
  ctx.fillStyle = 'rgba(10,6,8,0.7)';
  ctx.beginPath(); ctx.ellipse(128, 190, 9, 16, 0, 0, Math.PI * 2); ctx.fill();

  // stretched, agonised open mouth showing dark throat + broken teeth
  ctx.fillStyle = '#0a0004';
  ctx.beginPath(); ctx.ellipse(128, 250, 30, 52, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(150,140,120,0.55)';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(128 + i * 11 - 3, 212, 6, 10);   // upper teeth
    ctx.fillRect(128 + i * 11 - 3, 286, 5, 9);    // lower teeth
  }
  ctx.strokeStyle = '#2a0000'; ctx.lineWidth = 3; ctx.stroke();

  // cracked skin + veins
  ctx.strokeStyle = 'rgba(20,15,18,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    ctx.beginPath();
    const x = 70 + Math.random() * 116, y = 90 + Math.random() * 180;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30);
    ctx.stroke();
  }

  // blood weeping from the sockets
  ctx.strokeStyle = 'rgba(80,0,0,0.8)'; ctx.lineWidth = 3;
  for (const ex of [94, 162]) {
    ctx.beginPath();
    ctx.moveTo(ex, 150);
    ctx.lineTo(ex + (Math.random() - 0.5) * 10, 240 + Math.random() * 80);
    ctx.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A terrifying humanoid apparition built procedurally: emaciated, hunched, with
 * unnaturally long arms ending in clawed hands, thin bent legs, and lank black
 * hair hanging over a hollow face. Sickly grey skin with a faint sub-surface
 * glow so it reads as a half-seen shape in near-darkness. Feet sit at y=0.
 */
export function buildFigure(): { group: THREE.Group; setOpacity: (o: number) => void } {
  const group = new THREE.Group();
  const mats: THREE.Material[] = [];

  const skin = () => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x6f6a5f,
      roughness: 0.72,          // slightly clammy/wet
      metalness: 0.0,
      emissive: 0x0a0c10,       // faint glow so the silhouette reads in the dark
      transparent: true,
      opacity: 1,
    });
    mats.push(m);
    return m;
  };
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x050506, roughness: 0.55, metalness: 0.1, transparent: true, opacity: 1,
    side: THREE.DoubleSide,
  });
  mats.push(hairMat);

  // ---- legs (thin, slightly bent) + feet ----
  for (const s of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.42, 4, 8), skin());
    thigh.position.set(s * 0.1, 0.62, 0.01);
    thigh.rotation.x = -0.08;
    group.add(thigh);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.42, 4, 8), skin());
    shin.position.set(s * 0.11, 0.24, -0.02);
    shin.rotation.x = 0.12;
    group.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.2), skin());
    foot.position.set(s * 0.11, 0.03, 0.06);
    group.add(foot);
  }

  // pelvis
  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.08, 4, 8), skin());
  pelvis.rotation.z = Math.PI / 2;
  pelvis.position.set(0, 0.9, 0);
  group.add(pelvis);

  // ---- hunched torso (leans forward), children are torso-local ----
  const torso = new THREE.Group();
  torso.position.set(0, 0.92, 0);
  torso.rotation.x = 0.22;      // the hunch
  group.add(torso);

  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.22, 4, 10), skin());
  belly.position.set(0, 0.24, 0);
  torso.add(belly);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.2, 4, 10), skin());
  chest.position.set(0, 0.52, 0);
  torso.add(chest);
  // emaciated ribs / sternum shadow
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.19 - i * 0.015, 0.015, 0.02), skin());
    rib.position.set(0, 0.4 + i * 0.06, 0.1);
    torso.add(rib);
  }
  // jutting collarbones / bony shoulders
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), skin());
    shoulder.scale.set(1.2, 0.8, 1);
    shoulder.position.set(s * 0.16, 0.6, 0.02);
    torso.add(shoulder);
  }

  // neck (thin, craned)
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8), skin());
  neck.position.set(0, 0.72, 0.03);
  neck.rotation.x = 0.25;
  torso.add(neck);

  // ---- head: gaunt, tilted, hair over the face ----
  const head = new THREE.Group();
  head.position.set(0.02, 0.84, 0.06);
  head.rotation.set(0.36, 0.12, 0.26);   // chin tucked down, lolling to one side
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 18), skin());
  skull.scale.set(0.86, 1.12, 0.9);
  head.add(skull);
  // gaunt jaw
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.12), skin());
  jaw.position.set(0, -0.09, 0.02);
  head.add(jaw);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.25),
    new THREE.MeshBasicMaterial({ map: makeFaceTexture(), transparent: true }),
  );
  face.position.set(0, -0.01, 0.1);
  head.add(face);

  // lank hair: strands anchored at the crown, HANGING DOWN over the face + shoulders
  const strandGeo = new THREE.PlaneGeometry(0.035, 0.6);
  strandGeo.translate(0, -0.3, 0);                 // pivot at the top so it hangs down
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const front = Math.cos(a) > -0.2;              // heavier drape toward the face
    const strand = new THREE.Mesh(strandGeo, hairMat);
    strand.position.set(
      Math.sin(a) * 0.085,
      0.07,                                        // crown of the skull
      Math.cos(a) * 0.075 + 0.01,
    );
    // hang down, splay along the skull curve, drape forward over the face
    strand.rotation.x = (front ? 0.2 : -0.14) + (Math.random() - 0.5) * 0.12;
    strand.rotation.z = Math.sin(a) * 0.28 + (Math.random() - 0.5) * 0.14;
    strand.scale.y = 0.85 + Math.random() * 0.7;
    head.add(strand);
  }

  // ---- unnaturally long arms hanging past the knees, clawed hands ----
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();               // pivot at the shoulder
    arm.position.set(s * 0.17, 0.6, 0.02);
    arm.rotation.z = s * 0.06;
    arm.rotation.x = -0.1;
    torso.add(arm);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.44, 4, 8), skin());
    upper.position.y = -0.24;
    arm.add(upper);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.46, 4, 8), skin());
    fore.position.y = -0.68;
    arm.add(fore);

    // clawed hand
    const hand = new THREE.Group();
    hand.position.y = -0.94;
    arm.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.03), skin());
    hand.add(palm);
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.13, 3, 6), skin());
      finger.position.set((f - 1.5) * 0.022, -0.11, 0.005);
      finger.rotation.x = 0.25;
      hand.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.08, 3, 6), skin());
    thumb.position.set(s * 0.045, -0.05, 0.01);
    thumb.rotation.z = s * 0.7;
    hand.add(thumb);
  }

  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.renderOrder = 2; });

  return {
    group,
    setOpacity: (o: number) => {
      for (const m of mats) (m as THREE.Material & { opacity: number }).opacity = o;
      (face.material as THREE.MeshBasicMaterial).opacity = o;
    },
  };
}
