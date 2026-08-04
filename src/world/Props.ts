import * as THREE from 'three';
import { LAYOUT, DOOR_POS } from './layout';
import { woodMaterial } from './Materials';
import type { Interactable } from '../gameplay/Interaction';
import { damp } from '../utils/math';

export interface PropCallbacks {
  onDoor: () => void;
  onPhone: () => void;
  onRadio: () => void;
}

function portraitTexture(disturbing: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 200; c.height = 260;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#241c14';
  ctx.fillRect(0, 0, 200, 260);
  // aged vignette
  const g = ctx.createRadialGradient(100, 110, 20, 100, 130, 150);
  g.addColorStop(0, disturbing ? '#3a2018' : '#6b5a44');
  g.addColorStop(1, '#120c08');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 200, 260);
  // shoulders
  ctx.fillStyle = disturbing ? '#1a0e0e' : '#2b2118';
  ctx.beginPath();
  ctx.ellipse(100, 250, 80, 60, 0, Math.PI, 0, true);
  ctx.fill();
  // head
  ctx.fillStyle = disturbing ? '#8a7a6a' : '#b6a086';
  ctx.beginPath();
  ctx.ellipse(100, 120, 42, 54, 0, 0, Math.PI * 2);
  ctx.fill();
  if (disturbing) {
    // gouged eyes + blood
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(84, 112, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(116, 112, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a0000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(84, 126); ctx.lineTo(80, 200); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(116, 126); ctx.lineTo(120, 200); ctx.stroke();
    // screaming mouth
    ctx.fillStyle = '#100000';
    ctx.beginPath(); ctx.ellipse(100, 150, 12, 22, 0, 0, Math.PI * 2); ctx.fill();
    // scratches over whole frame
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 200, Math.random() * 260);
      ctx.lineTo(Math.random() * 200, Math.random() * 260);
      ctx.stroke();
    }
  } else {
    // calm eyes
    ctx.fillStyle = '#241a14';
    ctx.beginPath(); ctx.ellipse(85, 114, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(115, 114, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2a1e';
    ctx.beginPath(); ctx.moveTo(92, 150); ctx.lineTo(108, 150); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * All set-dressing and interactive objects. Interactables are exposed for the
 * Interaction manager; animated parts advance in `update`.
 */
export class Props {
  readonly group = new THREE.Group();
  readonly interactables: Interactable[] = [];

  private door = new THREE.Group();
  private doorTarget = 0;
  private doorAngle = 0;

  private clockHour: THREE.Mesh;
  private clockMinute: THREE.Mesh;
  clockSpin = 0;               // added to hands each frame when > 0

  private portraits: THREE.Mesh[] = [];
  private portraitCalm: THREE.CanvasTexture;
  private portraitEvil: THREE.CanvasTexture;
  disturbingPortraits = false;

  readonly mirror: THREE.Mesh;
  private mirrorMat: THREE.MeshBasicMaterial;

  private roach: THREE.Mesh;
  private roachT = 0;

  phoneRinging = false;

  constructor(envMap: THREE.Texture | null, private cb: PropCallbacks) {
    const env = (m: THREE.MeshStandardMaterial) => {
      if (envMap) { m.envMap = envMap; m.envMapIntensity = 0.4; }
      return m;
    };

    // ---- Portraits on the right wall ----
    this.portraitCalm = portraitTexture(false);
    this.portraitEvil = portraitTexture(true);
    const frameMat = woodMaterial('#2a1a0e');
    for (let i = 0; i < 3; i++) {
      const z = -2 - i * 3;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.56), frameMat);
      frame.position.set(LAYOUT.wallX - 0.06, 1.6, z);
      this.group.add(frame);
      const pic = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44, 0.6),
        new THREE.MeshStandardMaterial({ map: this.portraitCalm, roughness: 0.85 }),
      );
      pic.position.set(LAYOUT.wallX - 0.1, 1.6, z);
      pic.rotation.y = -Math.PI / 2;
      this.portraits.push(pic);
      this.group.add(pic);
    }

    // ---- Wall clock (right wall, near landing) ----
    const clockBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.06, 24),
      env(new THREE.MeshStandardMaterial({ color: 0x1a120a, roughness: 0.5, metalness: 0.3 })),
    );
    clockBody.rotation.z = Math.PI / 2;
    clockBody.position.set(LAYOUT.wallX - 0.06, 2.1, -0.6);
    this.group.add(clockBody);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 24),
      new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.7 }),
    );
    face.position.set(LAYOUT.wallX - 0.1, 2.1, -0.6);
    face.rotation.y = -Math.PI / 2;
    this.group.add(face);
    const handMat = new THREE.MeshBasicMaterial({ color: 0x101010 });
    this.clockHour = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.008), handMat);
    this.clockMinute = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.16, 0.008), handMat);
    // hands lie in the wall plane (Y-Z) and sweep about the face normal (X)
    this.clockHour.geometry.translate(0, 0.05, 0);
    this.clockMinute.geometry.translate(0, 0.08, 0);
    for (const h of [this.clockHour, this.clockMinute]) {
      h.position.set(LAYOUT.wallX - 0.11, 2.1, -0.6);
      this.group.add(h);
    }

    // ---- Console table + telephone + radio (right wall near landing) ----
    const tableMat = woodMaterial('#20140b');
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 1.0), tableMat);
    top.position.set(LAYOUT.wallX - 0.22, 0.8, -1.3);
    this.group.add(top);
    for (const dz of [-0.42, 0.42]) {
      for (const dx of [-0.16, 0.16]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.8, 0.04), tableMat);
        leg.position.set(LAYOUT.wallX - 0.22 + dx, 0.4, -1.3 + dz);
        this.group.add(leg);
      }
    }
    // telephone
    const phone = new THREE.Group();
    const phoneBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.06, 0.24),
      env(new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 })),
    );
    const handset = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.03, 0.16, 4, 8),
      env(new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 })),
    );
    handset.rotation.x = Math.PI / 2;
    handset.position.y = 0.06;
    phone.add(phoneBase, handset);
    phone.position.set(LAYOUT.wallX - 0.22, 0.85, -1.05);
    this.group.add(phone);
    this.interactables.push({
      object: phone, prompt: 'Answer', enabled: false, maxDist: 2.2,
      onInteract: () => this.cb.onPhone(),
    });

    // radio
    const radio = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.16, 0.14),
      env(new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.6 })),
    );
    radio.position.set(LAYOUT.wallX - 0.22, 0.9, -1.6);
    this.group.add(radio);
    this.interactables.push({
      object: radio, prompt: 'Tune radio', enabled: true, maxDist: 2.2,
      onInteract: () => this.cb.onRadio(),
    });

    // ---- Bathroom sink + mirror (turn corridor, against near wall) ----
    const sink = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.34),
      env(new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.25, metalness: 0.05 })),
    );
    sink.position.set(-6.5, 0.85, -10.0);
    this.group.add(sink);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 0.75, 12),
      sink.material as THREE.Material,
    );
    pedestal.position.set(-6.5, 0.38, -10.0);
    this.group.add(pedestal);
    this.mirrorMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    this.mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), this.mirrorMat);
    this.mirror.position.set(-6.5, 1.55, -9.92);
    this.group.add(this.mirror);
    const mFrame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.76, 0.04), frameMat);
    mFrame.position.set(-6.5, 1.55, -9.9);
    this.group.add(mFrame);

    // ---- End door ----
    this.buildDoor(env);

    // ---- Cockroach ----
    this.roach = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x140a06, roughness: 0.5 }),
    );
    this.roach.scale.set(1, 0.5, 1.6);
    this.roach.position.set(0.3, 0.03, -6);
    this.group.add(this.roach);
  }

  private buildDoor(env: (m: THREE.MeshStandardMaterial) => THREE.MeshStandardMaterial): void {
    const doorMat = woodMaterial('#160d07');
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.9), env(doorMat));
    panel.castShadow = true;
    panel.position.set(0, 1.05, 0.45); // offset from hinge along +z
    // recessed panels
    for (const dy of [0.5, -0.35]) {
      const inset = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.6, 0.55),
        woodMaterial('#0f0805'),
      );
      inset.position.set(0.005, dy, 0.45);
      this.door.add(inset);
    }
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x776644, metalness: 0.8, roughness: 0.3 }),
    );
    handle.position.set(-0.06, 1.0, 0.82);
    this.door.add(panel, handle);
    // hinge position: end-door wall, near -z edge of the opening
    this.door.position.set(DOOR_POS.x + 0.03, 0, -11.35);
    this.group.add(this.door);

    this.interactables.push({
      object: this.door, prompt: 'Open the door', enabled: true, maxDist: 2.4,
      onInteract: () => this.cb.onDoor(),
    });
  }

  openDoor(): void { this.doorTarget = -1.8; }
  closeDoor(): void { this.doorTarget = 0; }

  setPhoneRinging(v: boolean): void {
    this.phoneRinging = v;
    const phoneItem = this.interactables.find((i) => i.prompt === 'Answer');
    if (phoneItem) phoneItem.enabled = v;
  }

  applyPortraits(): void {
    const tx = this.disturbingPortraits ? this.portraitEvil : this.portraitCalm;
    for (const p of this.portraits) {
      (p.material as THREE.MeshStandardMaterial).map = tx;
      (p.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }
  }

  /** Briefly show a texture in the mirror (e.g. a face), then fade to dark. */
  mirrorFlash(tex: THREE.Texture | null): void {
    if (tex) {
      this.mirrorMat.map = tex;
      this.mirrorMat.color.setRGB(1, 1, 1);
    } else {
      this.mirrorMat.map = null;
      this.mirrorMat.color.setHex(0x05070a);
    }
    this.mirrorMat.needsUpdate = true;
  }

  update(dt: number): void {
    // door swing
    this.doorAngle += (this.doorTarget - this.doorAngle) * damp(dt, 6);
    this.door.rotation.y = this.doorAngle;

    // clock
    if (this.clockSpin !== 0) {
      this.clockMinute.rotation.x -= this.clockSpin * dt;
      this.clockHour.rotation.x -= this.clockSpin * dt * 0.083;
    }

    // roach idle scuttle
    this.roachT += dt;
    if (Math.sin(this.roachT * 0.7) > 0.6) {
      this.roach.position.z -= dt * 0.4;
      this.roach.position.x = 0.3 + Math.sin(this.roachT * 20) * 0.05;
      if (this.roach.position.z < -9) this.roach.position.z = -3;
    }
  }
}
