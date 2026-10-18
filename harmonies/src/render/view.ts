import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { animal } from '../engine/animals';
import { CELLS, hexToWorld } from '../engine/hex';
import type { Board, Color } from '../engine/types';
import { animateCreature, buildCreature } from './creatures';
import { makeChip, makeToken, stackHeight, TOKEN_HEIGHT } from './tokens';
import { ease, Tweens } from './tween';

const BOARD_SPACING = 18;
const BOARD_Y = 0.32;
const MARKET_OFFSET = new THREE.Vector3(8, 0, -0.5);
const TRAY_OFFSET = new THREE.Vector3(0, 1.4, 6.2);

type HighlightKind = 'place' | 'cube' | 'none';

interface PlayerView {
  group: THREE.Group;
  center: THREE.Vector3;
  cellHits: THREE.Mesh[];
  cellStacks: THREE.Group[];
  rings: THREE.Mesh[];
  creatures: THREE.Object3D[];
  nameplate: THREE.Sprite;
}

export interface ViewHandlers {
  onCellClick?: (player: number, cell: number) => void;
  onCellHover?: (player: number, cell: number | null) => void;
  onSlotClick?: (slot: number) => void;
  onTrayClick?: (index: number) => void;
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly tweens = new Tweens();
  handlers: ViewHandlers = {};

  private players: PlayerView[] = [];
  private market = new THREE.Group();
  private slotGroups: THREE.Group[] = [];
  private slotChips: THREE.Mesh[][] = [];
  private slotHits: THREE.Mesh[] = [];
  private tray: THREE.Mesh[] = [];
  private trayGroup = new THREE.Group();
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private sun: THREE.DirectionalLight;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hovered: { player: number; cell: number } | null = null;
  private hoverSlot: number | null = null;
  private timer = new THREE.Timer();
  private elapsed = 0;
  active = 0;
  selectedTray = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xbfe0ef);
    this.scene.fog = new THREE.Fog(0xbfe0ef, 30, 80);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.camera.position.set(3, 15, 15);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 40;

    this.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x6a7a4a, 1.1));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.far = 60;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(120, 48),
      new THREE.MeshStandardMaterial({ color: 0x9cc77a, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.scatterScenery();

    this.scene.add(this.market, this.trayGroup);
    this.buildMarket();

    window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---- setup ---------------------------------------------------------------

  setupPlayers(names: string[]) {
    for (const p of this.players) {
      this.scene.remove(p.group);
      for (const c of p.creatures) this.scene.remove(c);
    }
    for (const chip of this.tray) this.trayGroup.remove(chip);
    this.tray = [];
    this.players = names.map((name, i) => this.buildBoard(name, i));
  }

  private buildBoard(name: string, index: number): PlayerView {
    const group = new THREE.Group();
    group.position.x = index * BOARD_SPACING;
    this.scene.add(group);

    const pts = CELLS.map((c) => hexToWorld(c.q, c.r));
    const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
    const cz = (Math.min(...pts.map((p) => p.z)) + Math.max(...pts.map((p) => p.z))) / 2;
    const inner = new THREE.Group();
    inner.position.set(-cx, 0, -cz);
    group.add(inner);

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 0.3, 10.2),
      new THREE.MeshStandardMaterial({ color: 0xa0764a, roughness: 0.8 }),
    );
    slab.position.y = 0.12;
    slab.castShadow = slab.receiveShadow = true;
    group.add(slab);
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.2, 10.6),
      new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.8 }),
    );
    rim.position.y = 0.05;
    rim.receiveShadow = true;
    group.add(rim);

    const tileGeo = new THREE.CylinderGeometry(0.97, 0.97, 0.05, 6);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0xe3d5ad, roughness: 0.9 });
    const hitGeo = new THREE.CylinderGeometry(0.9, 0.9, 2.4, 6);
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const ringGeo = new THREE.RingGeometry(0.72, 0.9, 6);

    const cellHits: THREE.Mesh[] = [];
    const cellStacks: THREE.Group[] = [];
    const rings: THREE.Mesh[] = [];
    for (const c of CELLS) {
      const { x, z } = hexToWorld(c.q, c.r);
      const tile = new THREE.Mesh(tileGeo, tileMat);
      tile.rotation.y = Math.PI / 6;
      tile.position.set(x, BOARD_Y - 0.02, z);
      tile.receiveShadow = true;
      inner.add(tile);

      const stack = new THREE.Group();
      stack.position.set(x, BOARD_Y, z);
      inner.add(stack);
      cellStacks.push(stack);

      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.set(x, BOARD_Y + 1.2, z);
      hit.userData = { player: index, cell: c.index };
      inner.add(hit);
      cellHits.push(hit);

      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = Math.PI / 6;
      ring.position.set(x, BOARD_Y + 0.02, z);
      ring.visible = false;
      ring.renderOrder = 2;
      inner.add(ring);
      rings.push(ring);
    }

    const nameplate = makeLabel(name);
    nameplate.position.set(0, 0.8, -6);
    group.add(nameplate);

    return {
      group,
      center: new THREE.Vector3(group.position.x, 0, 0),
      cellHits,
      cellStacks,
      rings,
      creatures: [],
      nameplate,
    };
  }

  private buildMarket() {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.3, 0.25, 32),
      new THREE.MeshStandardMaterial({ color: 0xb48a5a, roughness: 0.8 }),
    );
    plate.scale.z = 2.6;
    plate.position.y = 0.12;
    plate.castShadow = plate.receiveShadow = true;
    this.market.add(plate);
    for (let s = 0; s < 5; s++) {
      const g = new THREE.Group();
      g.position.set(0, 0.25, -4.4 + s * 2.2);
      const dish = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 0.85, 0.08, 24),
        new THREE.MeshStandardMaterial({ color: 0x8a6438, roughness: 0.7 }),
      );
      dish.receiveShadow = true;
      g.add(dish);
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 1.2, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.y = 0.5;
      hit.userData = { slot: s };
      g.add(hit);
      this.slotHits.push(hit);
      this.market.add(g);
      this.slotGroups.push(g);
      this.slotChips.push([]);
    }
  }

  private scatterScenery() {
    const rng = (a: number, b: number) => a + Math.random() * (b - a);
    const trunk = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, flatShading: true });
    const leaves = [0x5a9e3c, 0x4a8a32, 0x6db04a].map((c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true }));
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a9ea5, flatShading: true });
    for (let i = 0; i < 70; i++) {
      // Keep scenery in a ring around the play area (boards span x ≈ -6..62).
      const a = Math.random() * Math.PI * 2;
      const x = 28 + Math.cos(a) * rng(42, 80);
      const z = -6 + Math.sin(a) * rng(20, 45);
      if (Math.random() < 0.75) {
        const t = new THREE.Group();
        const h = rng(1.5, 3.5);
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, h, 6), trunk);
        tr.position.y = h / 2;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(rng(1, 1.8), rng(2.5, 4.5), 7), leaves[i % 3]);
        cone.position.y = h + 1.2;
        t.add(tr, cone);
        t.position.set(x, 0, z);
        t.traverse((c) => (c.castShadow = true));
        this.scene.add(t);
      } else {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rng(0.6, 1.8), 0), rockMat);
        r.position.set(x, 0.3, z);
        r.scale.y = 0.6;
        this.scene.add(r);
      }
    }
  }

  // ---- sync ----------------------------------------------------------------

  /** Rebuild a cell's token meshes from the board state. */
  syncCell(player: number, cell: number, board: Board, pop = false) {
    const pv = this.players[player];
    const g = pv.cellStacks[cell];
    g.clear();
    const stack = board[cell].stack;
    let y = 0;
    stack.forEach((_, level) => {
      const t = makeToken(stack, level);
      t.position.y = y;
      t.rotation.y = (cell * 1.7 + level) % (Math.PI * 2);
      if (stack[level] === 'blue' || stack[level] === 'yellow') t.rotation.y = 0;
      g.add(t);
      if (pop && level === stack.length - 1) {
        t.scale.setScalar(0.4);
        void this.tweens.run(0.35, (k) => t.scale.setScalar(0.4 + 0.6 * k), ease.outBack);
      }
      y += TOKEN_HEIGHT[stack[level]];
    });
    pv.rings[cell].position.y = BOARD_Y + stackHeight(stack) + 0.03;
  }

  syncBoard(player: number, board: Board) {
    for (let i = 0; i < board.length; i++) this.syncCell(player, i, board);
  }

  /** Show only the first n central spaces (3 in solo mode), centered on the plate. */
  setSlotCount(n: number) {
    this.slotGroups.forEach((g, i) => {
      g.visible = i < n;
      g.position.z = (i - (n - 1) / 2) * 2.2;
    });
  }

  syncMarket(central: (Color[] | null)[]) {
    central.forEach((tokens, s) => this.setSlot(s, tokens, false));
  }

  private setSlot(slot: number, tokens: Color[] | null, animate: boolean) {
    const g = this.slotGroups[slot];
    for (const c of this.slotChips[slot]) g.remove(c);
    this.slotChips[slot] = [];
    if (!tokens) return;
    tokens.forEach((color, i) => {
      const chip = makeChip(color);
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const target = new THREE.Vector3(Math.cos(a) * 0.38, 0.12, Math.sin(a) * 0.38);
      chip.position.copy(target);
      g.add(chip);
      this.slotChips[slot].push(chip);
      if (animate) {
        chip.position.y = 4 + i;
        void this.tweens.wait(i * 0.08).then(() =>
          this.tweens.run(0.5, (k) => (chip.position.y = target.y + (4 + i) * (1 - k)), ease.outBounce),
        );
      }
    });
  }

  // ---- animations ------------------------------------------------------------

  async focus(player: number, instant = false) {
    this.active = player;
    const c = this.players[player].center.clone().add(new THREE.Vector3(3.2, 0, 0.6));
    this.market.position.copy(this.players[player].center).add(MARKET_OFFSET);
    this.trayGroup.position.copy(this.players[player].center).add(TRAY_OFFSET);
    this.sun.position.set(c.x - 8, 20, c.z + 10);
    this.sun.target.position.copy(c);
    const fromT = this.controls.target.clone();
    const fromP = this.camera.position.clone();
    const toP = c.clone().add(new THREE.Vector3(0, 15.5, 14.5));
    if (instant) {
      this.controls.target.copy(c);
      this.camera.position.copy(toP);
      return;
    }
    await this.tweens.run(0.9, (k) => {
      this.controls.target.lerpVectors(fromT, c, k);
      this.camera.position.lerpVectors(fromP, toP, k);
    });
  }

  /** Look at another player's board without changing whose turn it is. */
  async peek(player: number) {
    const c = this.players[player].center.clone().add(new THREE.Vector3(0, 0, 0.6));
    const fromT = this.controls.target.clone();
    const fromP = this.camera.position.clone();
    const toP = c.clone().add(new THREE.Vector3(0, 15, 13));
    await this.tweens.run(0.7, (k) => {
      this.controls.target.lerpVectors(fromT, c, k);
      this.camera.position.lerpVectors(fromP, toP, k);
    });
  }

  private trayPos(i: number, n: number) {
    return new THREE.Vector3((i - (n - 1) / 2) * 0.95, 0, 0);
  }

  private layoutTray(animate = true) {
    const n = this.tray.length;
    this.tray.forEach((chip, i) => {
      const to = this.trayPos(i, n);
      const from = chip.position.clone();
      chip.userData.trayIndex = i;
      if (!animate) chip.position.copy(to);
      else void this.tweens.run(0.25, (k) => chip.position.lerpVectors(from, to, k));
    });
    this.updateTraySelection();
  }

  setTraySelection(i: number) {
    this.selectedTray = i;
    this.updateTraySelection();
  }

  private updateTraySelection() {
    this.tray.forEach((chip, i) => {
      chip.scale.setScalar(i === this.selectedTray ? 1.35 : 1);
    });
  }

  async takeSlot(slot: number) {
    const chips = this.slotChips[slot];
    this.slotChips[slot] = [];
    const n = chips.length;
    await Promise.all(
      chips.map(async (chip, i) => {
        const start = new THREE.Vector3();
        chip.getWorldPosition(start);
        this.slotGroups[slot].remove(chip);
        this.trayGroup.add(chip);
        const localStart = this.trayGroup.worldToLocal(start.clone());
        const end = this.trayPos(i, n);
        chip.userData.trayIndex = i;
        chip.userData.flying = true;
        await this.tweens.wait(i * 0.06);
        await this.tweens.run(0.55, (k) => {
          chip.position.lerpVectors(localStart, end, k);
          chip.position.y += Math.sin(k * Math.PI) * 2.2;
          chip.rotation.x = k * Math.PI * 2;
        });
        chip.userData.flying = false;
      }),
    );
    this.tray = chips;
    this.selectedTray = 0;
    this.updateTraySelection();
  }

  async placeToken(player: number, pendingIndex: number, cell: number, board: Board) {
    const chip = this.tray[pendingIndex];
    this.tray.splice(pendingIndex, 1);
    const pv = this.players[player];
    if (chip) {
      const start = new THREE.Vector3();
      chip.getWorldPosition(start);
      this.trayGroup.remove(chip);
      this.scene.add(chip);
      const end = new THREE.Vector3();
      pv.cellStacks[cell].getWorldPosition(end);
      end.y += stackHeight(board[cell].stack.slice(0, -1)) + 0.1;
      chip.scale.setScalar(1.2);
      await this.tweens.run(0.42, (k) => {
        chip.position.lerpVectors(start, end, k);
        chip.position.y += Math.sin(k * Math.PI) * 1.6;
      });
      this.scene.remove(chip);
    }
    this.syncCell(player, cell, board, true);
    this.puff(pv.cellStacks[cell], board[cell].stack.at(-1)!);
    this.selectedTray = Math.min(this.selectedTray, Math.max(0, this.tray.length - 1));
    this.layoutTray();
  }

  async discardToken(pendingIndex: number) {
    const chip = this.tray[pendingIndex];
    this.tray.splice(pendingIndex, 1);
    if (chip) {
      await this.tweens.run(0.35, (k) => {
        chip.scale.setScalar(1 - k);
        chip.position.y = -k;
      });
      this.trayGroup.remove(chip);
    }
    this.selectedTray = 0;
    this.layoutTray();
  }

  refillSlot(slot: number, tokens: Color[] | null) {
    this.setSlot(slot, tokens, true);
  }

  /** The star moment: the animal appears big above its habitat, then settles on top. */
  async placeCube(player: number, cell: number, cardId: string, board: Board) {
    const card = animal(cardId);
    const pv = this.players[player];
    const stackGroup = pv.cellStacks[cell];
    const base = new THREE.Vector3();
    stackGroup.getWorldPosition(base);
    const restY = base.y + stackHeight(board[cell].stack);
    const creature = buildCreature(card);
    creature.position.set(base.x, restY + 3, base.z);
    creature.scale.setScalar(0.01);
    creature.rotation.y = Math.PI / 2;
    this.scene.add(creature);

    this.burst(new THREE.Vector3(base.x, restY + 3, base.z), 0xfff3a0, 36);
    await this.tweens.run(0.6, (k) => {
      creature.scale.setScalar(0.01 + 1.6 * k);
      creature.rotation.y = Math.PI / 2 + k * Math.PI * 2;
    }, ease.outBack);
    await this.tweens.run(0.6, (k) => (creature.rotation.y = Math.PI / 2 + Math.sin(k * Math.PI * 2) * 0.4));
    await this.tweens.run(0.55, (k) => {
      creature.position.y = restY + 3 * (1 - k);
      creature.scale.setScalar(1.6 - 0.9 * k);
      creature.rotation.y = Math.PI / 2 - k * (Math.PI / 2 + 0.6);
    }, ease.outCubic);
    this.burst(new THREE.Vector3(base.x, restY + 0.2, base.z), 0xffffff, 16);
    creature.userData.phase = Math.random() * 10;
    pv.creatures.push(creature);
    pv.rings[cell].position.y = restY + 0.03;
  }

  /** Restore creatures for a board (e.g. after a reload). */
  syncCreatures(player: number, board: Board) {
    const pv = this.players[player];
    for (const c of pv.creatures) this.scene.remove(c);
    pv.creatures = [];
    board.forEach((cell, i) => {
      if (!cell.cube) return;
      const c = buildCreature(animal(cell.cube));
      const p = new THREE.Vector3();
      pv.cellStacks[i].getWorldPosition(p);
      c.position.set(p.x, p.y + stackHeight(cell.stack), p.z);
      c.scale.setScalar(0.7);
      c.rotation.y = -0.6;
      c.userData.phase = Math.random() * 10;
      this.scene.add(c);
      pv.creatures.push(c);
    });
  }

  highlight(player: number, cells: number[], kind: HighlightKind) {
    const color = kind === 'cube' ? 0xffc93c : 0x7dffb0;
    this.players.forEach((pv, p) =>
      pv.rings.forEach((r, i) => {
        r.visible = kind !== 'none' && p === player && cells.includes(i);
        (r.material as THREE.MeshBasicMaterial).color.setHex(color);
      }),
    );
  }

  setNames(names: string[], scores: number[], active: number) {
    this.players.forEach((pv, i) => {
      updateLabel(pv.nameplate, `${names[i]} · ${scores[i]}`, i === active);
    });
  }

  private puff(at: THREE.Object3D, color: Color) {
    const p = new THREE.Vector3();
    at.getWorldPosition(p);
    const tint: Record<Color, number> = {
      blue: 0xbfe6ff, yellow: 0xfff0a0, green: 0xc8f0a0, brown: 0xd8c0a0, gray: 0xe0e0e0, red: 0xffd0c0,
    };
    this.burst(p.add(new THREE.Vector3(0, 0.3, 0)), tint[color], 10, 0.6);
  }

  private burst(at: THREE.Vector3, color: number, count: number, power = 1) {
    const geo = new THREE.OctahedronGeometry(0.07, 0);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(at);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.3, Math.random() - 0.5)
        .normalize()
        .multiplyScalar((2 + Math.random() * 3) * power);
      this.scene.add(m);
      this.particles.push({ mesh: m, vel: v, life: 1 });
    }
  }

  // ---- input -------------------------------------------------------------------

  private pick(e: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets: THREE.Object3D[] = [...this.slotHits.filter((h) => h.parent!.visible), ...this.tray, ...this.players.flatMap((p) => p.cellHits)];
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    return hit?.object;
  }

  private onPointerMove(e: PointerEvent) {
    const o = this.pick(e);
    const cell = o?.userData.cell as number | undefined;
    const player = o?.userData.player as number | undefined;
    const slot = o?.userData.slot as number | undefined;
    const isTray = o ? this.tray.includes(o as THREE.Mesh) : false;
    this.renderer.domElement.style.cursor = o ? 'pointer' : 'default';

    const next = cell !== undefined && player !== undefined ? { player, cell } : null;
    if (next?.cell !== this.hovered?.cell || next?.player !== this.hovered?.player) {
      this.hovered = next;
      this.handlers.onCellHover?.(next?.player ?? -1, next?.cell ?? null);
    }
    const s = slot ?? null;
    if (s !== this.hoverSlot) {
      if (this.hoverSlot !== null) this.slotGroups[this.hoverSlot].scale.setScalar(1);
      if (s !== null && this.slotChips[s].length) this.slotGroups[s].scale.setScalar(1.08);
      this.hoverSlot = s;
    }
    if (isTray) this.renderer.domElement.style.cursor = 'pointer';
  }

  private onClick(e: MouseEvent) {
    const o = this.pick(e);
    if (!o) return;
    if (o.userData.slot !== undefined) this.handlers.onSlotClick?.(o.userData.slot);
    else if (this.tray.includes(o as THREE.Mesh)) this.handlers.onTrayClick?.(this.tray.indexOf(o as THREE.Mesh));
    else if (o.userData.cell !== undefined) this.handlers.onCellClick?.(o.userData.player, o.userData.cell);
  }

  // ---- loop ----------------------------------------------------------------------

  private resize() {
    const w = this.renderer.domElement.parentElement!.clientWidth;
    const h = this.renderer.domElement.parentElement!.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame() {
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.elapsed += dt;
    this.tweens.tick(dt);
    this.controls.update();

    for (const p of this.particles) {
      p.life -= dt * 1.3;
      p.vel.y -= 6 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 5;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life);
    }
    const dead = this.particles.filter((p) => p.life <= 0);
    if (dead.length) {
      for (const p of dead) this.scene.remove(p.mesh);
      this.particles = this.particles.filter((p) => p.life > 0);
    }

    for (const pv of this.players) {
      for (const c of pv.creatures) animateCreature(c, this.elapsed, c.userData.phase ?? 0);
      for (const r of pv.rings) {
        if (r.visible) (r.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(this.elapsed * 5) * 0.3;
      }
    }
    this.tray.forEach((chip, i) => {
      if (chip.userData.flying) return;
      chip.position.y = Math.sin(this.elapsed * 2 + i) * 0.08;
      chip.rotation.y += dt * 0.6;
    });

    this.renderer.render(this.scene, this.camera);
  }
}

function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(5.3, 1, 1);
  sprite.userData.canvas = canvas;
  updateLabel(sprite, text, false);
  return sprite;
}

function updateLabel(sprite: THREE.Sprite, text: string, active: boolean) {
  const canvas = sprite.userData.canvas as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = active ? 'rgba(255,214,90,0.95)' : 'rgba(40,40,40,0.65)';
  ctx.beginPath();
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 40);
  ctx.fill();
  ctx.fillStyle = active ? '#3a2a00' : '#ffffff';
  ctx.font = '600 46px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  (sprite.material.map as THREE.CanvasTexture).needsUpdate = true;
}
