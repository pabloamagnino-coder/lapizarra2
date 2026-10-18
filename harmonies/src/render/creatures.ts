import * as THREE from 'three';
import type { AnimalCard } from '../engine/types';

/**
 * Low-poly animal figures built from primitives. Each one stands on y=0, faces +x
 * and is about 1 unit tall before the look's size multiplier.
 */

const mat = (color: number, rough = 0.7) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true });

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

function eyes(g: THREE.Group, x: number, y: number, spread: number, r = 0.045) {
  const white = mat(0xffffff, 0.3);
  const black = mat(0x111111, 0.2);
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(r, 8, 6), white, x, y, s * spread));
    g.add(mesh(new THREE.SphereGeometry(r * 0.55, 6, 4), black, x + r * 0.6, y, s * spread));
  }
}

function quadruped(card: AnimalCard): THREE.Group {
  const L = card.look;
  const g = new THREE.Group();
  const body = mat(L.body);
  const accent = mat(L.accent);
  const legH = L.longLegs ? 0.45 : 0.28;
  const torso = mesh(new THREE.CapsuleGeometry(0.22, 0.38, 4, 8), body, 0, legH + 0.2, 0);
  torso.rotation.z = Math.PI / 2;
  g.add(torso);
  const belly = mesh(new THREE.SphereGeometry(0.18, 8, 6), accent, 0.05, legH + 0.12, 0);
  belly.scale.set(1.4, 0.6, 0.9);
  g.add(belly);
  for (const [x, z] of [[0.22, 0.12], [0.22, -0.12], [-0.22, 0.12], [-0.22, -0.12]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.055, 0.045, legH, 6), body, x, legH / 2, z));
  }
  const headY = legH + 0.42;
  const head = mesh(new THREE.SphereGeometry(0.19, 10, 8), body, 0.42, headY, 0);
  g.add(head);
  const snout = mesh(new THREE.ConeGeometry(0.1, 0.2, 8), accent, 0.6, headY - 0.04, 0);
  snout.rotation.z = -Math.PI / 2;
  g.add(snout);
  g.add(mesh(new THREE.SphereGeometry(0.03, 6, 4), mat(0x111111), 0.7, headY - 0.03, 0));
  eyes(g, 0.55, headY + 0.06, 0.09);

  const ears = L.ears ?? 'pointy';
  for (const s of [-1, 1]) {
    if (ears === 'pointy') {
      g.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 4), body, 0.38, headY + 0.2, s * 0.1));
    } else if (ears === 'round') {
      g.add(mesh(new THREE.SphereGeometry(0.06, 6, 4), body, 0.36, headY + 0.17, s * 0.12));
    } else if (ears === 'long') {
      const e = mesh(new THREE.CapsuleGeometry(0.04, 0.28, 3, 6), body, 0.34, headY + 0.3, s * 0.07);
      e.rotation.x = s * 0.15;
      g.add(e);
    }
  }
  if (L.antlers) {
    const antler = mat(0xe8dcc0);
    for (const s of [-1, 1]) {
      const a = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.35, 5), antler, 0.36, headY + 0.32, s * 0.12);
      a.rotation.x = s * 0.35;
      g.add(a);
      const b = mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.18, 5), antler, 0.42, headY + 0.38, s * 0.2);
      b.rotation.z = -0.6;
      g.add(b);
    }
  }
  if (L.horns) {
    for (const s of [-1, 1]) {
      const h = mesh(new THREE.ConeGeometry(0.035, 0.18, 6), mat(0xd8cfb8), 0.5, headY + 0.14, s * 0.1);
      h.rotation.z = -0.7;
      g.add(h);
    }
  }
  const tail = L.tail ?? 'short';
  if (tail === 'bushy') {
    const t = mesh(new THREE.SphereGeometry(0.13, 8, 6), body, -0.5, legH + 0.3, 0);
    t.scale.set(1.8, 0.8, 0.8);
    t.rotation.z = 0.6;
    g.add(t);
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 4), accent, -0.7, legH + 0.42, 0));
  } else if (tail === 'flat') {
    const t = mesh(new THREE.BoxGeometry(0.3, 0.04, 0.14), accent, -0.5, legH + 0.08, 0);
    g.add(t);
  } else if (tail === 'short') {
    g.add(mesh(new THREE.SphereGeometry(0.06, 6, 4), accent, -0.45, legH + 0.28, 0));
  }
  return g;
}

function bird(card: AnimalCard): THREE.Group {
  const L = card.look;
  const g = new THREE.Group();
  const body = mat(L.body);
  const accent = mat(L.accent);
  const legH = L.longLegs ? 0.5 : 0.12;
  for (const z of [0.06, -0.06]) {
    g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, legH, 4), mat(0xe0a040), 0, legH / 2, z));
  }
  const torso = mesh(new THREE.SphereGeometry(0.24, 10, 8), body, 0, legH + 0.2, 0);
  torso.scale.set(1.3, 1, 0.9);
  g.add(torso);
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.SphereGeometry(0.2, 8, 6), accent, -0.05, legH + 0.24, s * 0.2);
    w.scale.set(1.2, 0.5, 0.25);
    w.name = s > 0 ? 'wingL' : 'wingR';
    g.add(w);
  }
  const neck = L.longNeck ? 0.35 : 0;
  if (neck) {
    const n = mesh(new THREE.CylinderGeometry(0.05, 0.07, neck, 6), body, 0.22, legH + 0.35 + neck / 2, 0);
    n.rotation.z = -0.25;
    g.add(n);
  }
  const headY = legH + 0.42 + neck;
  const hx = 0.24 + neck * 0.2;
  g.add(mesh(new THREE.SphereGeometry(0.14, 10, 8), body, hx, headY, 0));
  const beak = mesh(new THREE.ConeGeometry(0.05, L.longNeck ? 0.26 : 0.16, 6), mat(L.beak ?? 0xf2a33a), hx + 0.18, headY - 0.02, 0);
  beak.rotation.z = -Math.PI / 2;
  g.add(beak);
  eyes(g, hx + 0.08, headY + 0.04, 0.08, 0.035);
  const tail = mesh(new THREE.ConeGeometry(0.1, 0.25, 4), accent, -0.35, legH + 0.25, 0);
  tail.rotation.z = Math.PI / 2 + 0.3;
  g.add(tail);
  return g;
}

function fish(card: AnimalCard): THREE.Group {
  const g = new THREE.Group();
  const body = mat(card.look.body, 0.4);
  const torso = mesh(new THREE.SphereGeometry(0.25, 10, 8), body, 0, 0.35, 0);
  torso.scale.set(1.6, 0.8, 0.5);
  g.add(torso);
  const tail = mesh(new THREE.ConeGeometry(0.18, 0.3, 4), mat(card.look.accent), -0.45, 0.35, 0);
  tail.rotation.z = -Math.PI / 2;
  g.add(tail);
  const fin = mesh(new THREE.ConeGeometry(0.08, 0.2, 3), mat(card.look.accent), 0, 0.58, 0);
  g.add(fin);
  eyes(g, 0.28, 0.4, 0.1, 0.035);
  g.rotation.z = 0.25;
  return g;
}

function frog(card: AnimalCard): THREE.Group {
  const g = new THREE.Group();
  const body = mat(card.look.body, 0.5);
  const torso = mesh(new THREE.SphereGeometry(0.28, 10, 8), body, 0, 0.22, 0);
  torso.scale.set(1.1, 0.7, 1);
  g.add(torso);
  g.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(card.look.accent), 0.08, 0.16, 0));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), body, 0.15, 0.42, s * 0.13));
    const leg = mesh(new THREE.SphereGeometry(0.12, 6, 4), body, -0.15, 0.08, s * 0.24);
    leg.scale.set(1.5, 0.6, 0.7);
    g.add(leg);
  }
  eyes(g, 0.2, 0.46, 0.13, 0.05);
  return g;
}

function insect(card: AnimalCard): THREE.Group {
  const g = new THREE.Group();
  const body = mat(card.look.body, 0.5);
  const torso = mesh(new THREE.CapsuleGeometry(0.1, 0.25, 4, 8), body, 0, 0.45, 0);
  torso.rotation.z = Math.PI / 2;
  g.add(torso);
  for (let i = 0; i < 3; i++) {
    const stripe = mesh(new THREE.TorusGeometry(0.1, 0.025, 4, 10), mat(card.look.accent), -0.08 + i * 0.08, 0.45, 0);
    stripe.rotation.y = Math.PI / 2;
    g.add(stripe);
  }
  g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0x222222), 0.23, 0.47, 0));
  const wingMat = new THREE.MeshStandardMaterial({
    color: card.creature === 'insect' && card.id === 'mariposa' ? card.look.body : 0xffffff,
    transparent: true,
    opacity: card.id === 'mariposa' ? 0.95 : 0.55,
    side: THREE.DoubleSide,
    roughness: 0.2,
  });
  const wingSize = card.id === 'mariposa' ? 0.35 : 0.18;
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.CircleGeometry(wingSize, 10), wingMat, 0, 0.6, s * wingSize * 0.9);
    w.rotation.x = Math.PI / 2 + s * 0.4;
    w.name = s > 0 ? 'wingL' : 'wingR';
    g.add(w);
    if (card.id === 'mariposa') {
      const dot = mesh(new THREE.CircleGeometry(0.1, 8), mat(card.look.accent), 0, 0.61, s * wingSize);
      dot.rotation.x = -Math.PI / 2;
      g.add(dot);
    }
  }
  return g;
}

function turtle(card: AnimalCard): THREE.Group {
  const g = new THREE.Group();
  const shell = mesh(new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(card.look.body), 0, 0.1, 0);
  shell.scale.set(1.2, 0.9, 1);
  g.add(shell);
  const skin = mat(card.look.accent);
  g.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), skin, 0.42, 0.17, 0));
  eyes(g, 0.5, 0.21, 0.06, 0.03);
  for (const [x, z] of [[0.22, 0.25], [0.22, -0.25], [-0.22, 0.25], [-0.22, -0.25]]) {
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 4), skin, x, 0.06, z));
  }
  return g;
}

export function buildCreature(card: AnimalCard): THREE.Group {
  let g: THREE.Group;
  switch (card.creature) {
    case 'bird': g = bird(card); break;
    case 'fish': g = fish(card); break;
    case 'frog': g = frog(card); break;
    case 'insect': g = insect(card); break;
    case 'turtle': g = turtle(card); break;
    default: g = quadruped(card);
  }
  const s = card.look.size ?? 1;
  const wrap = new THREE.Group();
  g.scale.setScalar(s);
  wrap.add(g);
  wrap.userData.creature = card.creature;
  return wrap;
}

/** Idle motion: breathing, wing flaps, fish wiggle. */
export function animateCreature(obj: THREE.Object3D, time: number, phase: number) {
  const inner = obj.children[0];
  if (!inner) return;
  const kind = obj.userData.creature as string;
  const t = time + phase;
  inner.position.y = Math.abs(Math.sin(t * 2)) * 0.03;
  if (kind === 'bird' || kind === 'insect') {
    const speed = kind === 'insect' ? 18 : 4;
    const amp = kind === 'insect' ? 0.5 : 0.25;
    inner.traverse((c) => {
      if (c.name === 'wingL') c.rotation.x = (kind === 'insect' ? Math.PI / 2 + 0.4 : 0) + Math.sin(t * speed) * amp;
      if (c.name === 'wingR') c.rotation.x = (kind === 'insect' ? Math.PI / 2 - 0.4 : 0) - Math.sin(t * speed) * amp;
    });
    if (kind === 'insect') inner.position.y = 0.1 + Math.sin(t * 3) * 0.06;
  }
  if (kind === 'fish') inner.rotation.y = Math.sin(t * 3) * 0.25;
}
