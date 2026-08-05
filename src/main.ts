import * as THREE from 'three';
import { Engine } from './core/Engine';
import { AssetManager } from './core/AssetManager';
import { PostProcessing } from './core/PostProcessing';
import { Input } from './core/Input';
import { AudioManager } from './core/AudioManager';
import { detectQuality, type QualityLevel } from './core/Quality';
import { Hallway } from './world/Hallway';
import { Lighting } from './world/Lighting';
import { Props } from './world/Props';
import { Atmosphere } from './world/Atmosphere';
import { Player } from './gameplay/Player';
import { Interaction } from './gameplay/Interaction';
import { ScareSystem } from './gameplay/ScareSystem';
import { LoopManager } from './gameplay/LoopManager';
import type { GameContext } from './gameplay/context';
import { Ui } from './ui/Ui';
import { clamp, damp } from './utils/math';
import { pick } from './utils/rng';

type State = 'loading' | 'title' | 'warning' | 'playing' | 'paused';

function boot(): void {
  const container = document.getElementById('app')!;
  let quality: QualityLevel = detectQuality();

  // ---- core ----
  const engine = new Engine(container, quality);
  const assets = new AssetManager(engine.renderer);
  const envMap = assets.buildEnvironment();
  engine.scene.environment = envMap;

  const hallway = new Hallway(envMap, engine.quality.reflections);
  engine.scene.add(hallway.group);

  const lighting = new Lighting(engine.quality.shadowMapSize);
  engine.scene.add(lighting.group);

  const audio = new AudioManager();

  // forward refs resolved before gameplay begins
  let loop!: LoopManager;
  let radioStop: (() => void) | null = null;

  const phoneLines = [
    'You found something in your head. What was it? Something like… a piece of me.',
    'I can hear the baby. Can you hear it? It won’t stop crying.',
    '10 years in a bad marriage sent 3 kids to an early grave.',
    'Don’t look behind you. I said DON’T.',
  ];
  const radioLines = [
    '… authorities urge residents to remain indoors. Do not approach …',
    '… the bodies were found in the hallway, arranged in a circle …',
    '… she killed them one by one. The father was last …',
    '… forgive me. forgive me. forgive me. forgive …',
  ];

  const props = new Props(envMap, {
    onDoor: () => loop.advance(),
    onPhone: () => {
      audio.stopPhoneRing();
      props.setPhoneRinging(false);
      audio.stinger(0.35);
      ui.say(pick(phoneLines), 6);
    },
    onRadio: () => {
      if (radioStop) { radioStop(); radioStop = null; ui.say('', 0.1); return; }
      radioStop = audio.radioStatic(0.14);
      ui.say(pick(radioLines), 6);
    },
  }, engine.quality.reflections);
  engine.scene.add(props.group);

  let atmosphere = new Atmosphere(engine.quality.particles);
  engine.scene.add(atmosphere.group);

  const player = new Player(engine.camera);
  const post = new PostProcessing(engine);
  const interaction = new Interaction(engine.camera);
  for (const it of props.interactables) interaction.add(it);

  // ---- shared context ----
  const _v = new THREE.Vector3();
  const _f = new THREE.Vector3();
  const ctx: GameContext = {
    engine,
    scene: engine.scene,
    camera: engine.camera,
    player,
    audio,
    lighting,
    props,
    ui: undefined as unknown as Ui, // set just below
    post,
    loop: 0,
    behind(dist) {
      _f.set(Math.sin(player.yaw) * -1, 0, Math.cos(player.yaw) * -1);
      return new THREE.Vector3(
        player.position.x + _f.x * dist * -1,
        0,
        player.position.z + _f.z * dist * -1,
      );
    },
    ahead(dist) {
      _f.set(Math.sin(player.yaw) * -1, 0, Math.cos(player.yaw) * -1);
      return new THREE.Vector3(
        player.position.x + _f.x * dist,
        0,
        player.position.z + _f.z * dist,
      );
    },
    isLookingAt(p, threshold = 0.6) {
      engine.camera.getWorldDirection(_f);
      _v.subVectors(p, engine.camera.position).normalize();
      return _f.dot(_v) > threshold;
    },
    panOf(p) {
      const local = engine.camera.worldToLocal(p.clone());
      return clamp(local.x / 3, -1, 1);
    },
    triggerReset() { loop.hardReset(); },
  };

  // ---- UI ----
  const ui = new Ui({
    onBegin: () => { state = 'warning'; ui.showWarning(); },
    onAccept: () => startGame(),
    onResume: () => resumeGame(),
    onQuality: (q) => applyQuality(q),
    onSensitivity: (v) => { input.sensitivity = v; },
    onMaster: (v) => audio.setMasterVolume(v),
    onInvert: (v) => { input.invertY = v; },
  });
  ctx.ui = ui;
  ui.setQualitySelect(quality);

  const scares = new ScareSystem(ctx);
  loop = new LoopManager(ctx, scares);

  let state: State = 'loading';

  // ---- input ----
  const input = new Input(engine.renderer.domElement);
  input.onInteract = () => { if (state === 'playing' && input.locked && !loop.transitioning) interaction.use(); };
  // Esc toggles the pause menu
  input.onPause = () => {
    if (state === 'playing') { state = 'paused'; ui.hideClickHint(); input.exitLock(); ui.showPause(); }
    else if (state === 'paused') resumeGame();
  };
  // clicking the world while unlocked (re)captures the pointer — the key fix
  input.onCanvasClick = () => { if (state === 'playing' && !input.locked) input.requestLock(); };
  input.onLockChange = (locked) => {
    if (locked) {
      state = 'playing';
      ui.hideClickHint();
      ui.hidePause();
    } else if (state === 'playing') {
      // lost the pointer without opening the menu → invite a click to resume
      ui.showClickHint();
    }
  };

  async function startGame(): Promise<void> {
    await audio.init();
    audio.startAmbient();
    ui.enterGame();
    state = 'playing';
    loop.begin();
    ui.showClickHint();   // stays until the pointer actually locks
    input.requestLock();
  }

  function resumeGame(): void {
    ui.hidePause();
    state = 'playing';
    ui.showClickHint();
    input.requestLock();
  }

  function applyQuality(q: QualityLevel): void {
    quality = q;
    engine.applyQuality(q);
    engine.renderer.shadowMap.needsUpdate = true;
    // rebuild the post stack (SSAO/bloom toggles depend on the preset)
    post.build();
    post.resize();
    // atmosphere: swap the mote system for the new count; toggle reflections
    engine.scene.remove(atmosphere.group);
    atmosphere = new Atmosphere(engine.quality.particles);
    engine.scene.add(atmosphere.group);
    props.setReflections(engine.quality.reflections);
    hallway.setReflections(engine.quality.reflections);
  }

  // ---- resize ----
  window.addEventListener('resize', () => { engine.resize(); post.resize(); });

  // ---- loading sequence ----
  let loadFrac = 0;
  const loadTimer = window.setInterval(() => {
    loadFrac = Math.min(1, loadFrac + 0.2 + Math.random() * 0.25);
    ui.setLoading(loadFrac);
    if (loadFrac >= 1) {
      clearInterval(loadTimer);
      window.setTimeout(() => { state = 'title'; ui.showTitle(); }, 350);
    }
  }, 140);

  // ---- main loop ----
  let last = performance.now();
  let fear = 0;
  let clock = 0;
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;

    if (state === 'playing' && input.locked) {
      player.update(dt, input);
      interaction.update();
      ui.setPrompt(interaction.focused ? interaction.focused.prompt : null);
      ui.setReticleActive(!!interaction.focused);
      scares.update(dt);
      lighting.update(dt);
      props.update(dt);

      fear += (scares.fearLevel - fear) * damp(dt, 3);
      post.setFear(fear);
    }

    // atmosphere drifts continuously so the world stays alive behind menus
    atmosphere.update(dt, clock);

    ui.update(dt);
    post.render(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
