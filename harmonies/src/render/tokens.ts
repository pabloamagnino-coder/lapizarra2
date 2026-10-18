import * as THREE from 'three';
import type { Color, Stack } from '../engine/types';

export const PALETTE: Record<Color, number> = {
  blue: 0x3d8fd1,
  gray: 0x8e9299,
  brown: 0x7b5233,
  green: 0x4f9d3a,
  yellow: 0xe8c547,
  red: 0xc8483a,
};

/** Visual height each token adds to a stack. */
export const TOKEN_HEIGHT: Record<Color, number> = {
  blue: 0.1,
  yellow: 0.1,
  brown: 0.34,
  green: 0.55,
  gray: 0.36,
  red: 0.5,
};

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();

function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

function mat(key: string, make: () => THREE.Material) {
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = make()));
  return m;
}

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra });

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    c.castShadow = true;
    c.receiveShadow = true;
  });
  return o;
}

/** Simple wooden chip used in the central market and the "in hand" tray. */
export function makeChip(color: Color): THREE.Mesh {
  const m = new THREE.Mesh(
    geo('chip', () => new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20)),
    mat(`chip-${color}`, () => std(PALETTE[color], { roughness: 0.55, flatShading: false })),
  );
  m.userData.color = color;
  return shadowed(m);
}

/** Landscape-styled mesh for token `level` of a stack (water, field, trunk, canopy, rock, house). */
export function makeToken(stack: Stack, level: number): THREE.Object3D {
  const color = stack[level];
  const g = new THREE.Group();
  switch (color) {
    case 'blue': {
      const water = new THREE.Mesh(
        geo('water', () => new THREE.CylinderGeometry(0.93, 0.93, 0.1, 6)),
        mat('water', () =>
          new THREE.MeshStandardMaterial({
            color: PALETTE.blue,
            roughness: 0.15,
            metalness: 0.1,
            transparent: true,
            opacity: 0.88,
            emissive: 0x0a2a4a,
          }),
        ),
      );
      water.rotation.y = Math.PI / 6;
      water.position.y = 0.05;
      water.name = 'water';
      g.add(water);
      break;
    }
    case 'yellow': {
      const field = new THREE.Mesh(
        geo('field', () => new THREE.CylinderGeometry(0.93, 0.93, 0.1, 6)),
        mat('field', () => std(PALETTE.yellow)),
      );
      field.rotation.y = Math.PI / 6;
      field.position.y = 0.05;
      g.add(field);
      const wheat = mat('wheat', () => std(0xd9a830));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const r = i % 2 ? 0.35 : 0.6;
        const s = new THREE.Mesh(geo('stalk', () => new THREE.ConeGeometry(0.06, 0.28, 5)), wheat);
        s.position.set(Math.cos(a) * r, 0.24, Math.sin(a) * r);
        g.add(s);
      }
      break;
    }
    case 'brown': {
      const trunk = new THREE.Mesh(
        geo('trunk', () => new THREE.CylinderGeometry(0.15, 0.2, 0.34, 7)),
        mat('trunk', () => std(PALETTE.brown)),
      );
      trunk.position.y = 0.17;
      g.add(trunk);
      if (level === 0) {
        const root = new THREE.Mesh(
          geo('root', () => new THREE.CylinderGeometry(0.45, 0.5, 0.06, 7)),
          mat('soil', () => std(0x5b4a2e)),
        );
        root.position.y = 0.03;
        g.add(root);
      }
      break;
    }
    case 'green': {
      const height = stack.length;
      const radius = 0.38 + height * 0.06;
      const canopy = new THREE.Mesh(
        geo(`canopy-${height}`, () => new THREE.IcosahedronGeometry(radius, 0)),
        mat(`leaf-${height}`, () => std([0x6cb84a, 0x4f9d3a, 0x3b8030][height - 1])),
      );
      canopy.scale.y = 0.8;
      canopy.position.y = radius * 0.7;
      canopy.rotation.y = level * 0.7;
      g.add(canopy);
      if (height === 1) {
        const base = new THREE.Mesh(
          geo('bushbase', () => new THREE.CylinderGeometry(0.5, 0.55, 0.06, 7)),
          mat('soil', () => std(0x5b4a2e)),
        );
        base.position.y = 0.03;
        g.add(base);
      }
      break;
    }
    case 'gray': {
      const r = 0.62 - level * 0.12;
      const rock = new THREE.Mesh(
        geo(`rock-${level}`, () => new THREE.DodecahedronGeometry(r, 0)),
        mat(`rock-${level}`, () => std([0x9a9ea5, 0x8a8e95, 0xb8bcc2][level])),
      );
      rock.scale.y = 0.36 / r;
      rock.position.y = 0.18;
      rock.rotation.y = level * 0.9;
      g.add(rock);
      if (level === 2) {
        const snow = new THREE.Mesh(
          geo('snow', () => new THREE.ConeGeometry(0.22, 0.2, 6)),
          mat('snow', () => std(0xffffff, { roughness: 0.4 })),
        );
        snow.position.y = 0.42;
        g.add(snow);
      }
      break;
    }
    case 'red': {
      const walls = new THREE.Mesh(
        geo('walls', () => new THREE.BoxGeometry(0.5, 0.3, 0.42)),
        mat('walls', () => std(0xf1e4cc)),
      );
      walls.position.y = 0.15;
      g.add(walls);
      const roof = new THREE.Mesh(
        geo('roof', () => new THREE.ConeGeometry(0.42, 0.24, 4)),
        mat('roof', () => std(PALETTE.red)),
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.42;
      g.add(roof);
      const door = new THREE.Mesh(
        geo('door', () => new THREE.BoxGeometry(0.02, 0.15, 0.1)),
        mat('door', () => std(0x6b4423)),
      );
      door.position.set(0.26, 0.08, 0);
      g.add(door);
      break;
    }
  }
  return shadowed(g);
}

export function stackHeight(stack: Stack, upTo = stack.length): number {
  let h = 0;
  for (let i = 0; i < upTo; i++) h += TOKEN_HEIGHT[stack[i]];
  return h;
}
