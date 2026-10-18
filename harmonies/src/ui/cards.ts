import { hexToWorld } from '../engine/hex';
import type { AnimalCard, Req } from '../engine/types';

const REQ_STYLE: Record<Req, { fill: string; label: string }> = {
  water: { fill: '#3d8fd1', label: '' },
  field: { fill: '#e8c547', label: '' },
  tree1: { fill: '#6cb84a', label: '1' },
  tree2: { fill: '#4f9d3a', label: '2' },
  tree3: { fill: '#3b8030', label: '3' },
  mountain1: { fill: '#9a9ea5', label: '1' },
  mountain2: { fill: '#8a8e95', label: '2' },
  mountain3: { fill: '#6e7279', label: '3' },
  building: { fill: '#c8483a', label: '⌂' },
};

export const REQ_NAME: Record<Req, string> = {
  water: 'agua',
  field: 'campo',
  tree1: 'árbol de 1',
  tree2: 'árbol de 2',
  tree3: 'árbol de 3',
  mountain1: 'montaña de 1',
  mountain2: 'montaña de 2',
  mountain3: 'montaña de 3',
  building: 'edificio',
};

function hexPath(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Small SVG diagram of an animal's habitat pattern. */
export function patternSvg(card: AnimalCard, size = 16): string {
  const pts = card.pattern.map((p) => ({ ...hexToWorld(p.dq, p.dr, size), p }));
  const minX = Math.min(...pts.map((p) => p.x)) - size;
  const maxX = Math.max(...pts.map((p) => p.x)) + size;
  const minZ = Math.min(...pts.map((p) => p.z)) - size;
  const maxZ = Math.max(...pts.map((p) => p.z)) + size;
  const w = maxX - minX;
  const h = maxZ - minZ;
  const shapes = pts
    .map(({ x, z, p }, i) => {
      const cx = x - minX;
      const cy = z - minZ;
      const s = REQ_STYLE[p.req];
      const label = s.label
        ? `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${s.label}</text>`
        : '';
      const cube = i === 0 ? `<circle cx="${cx}" cy="${cy - (s.label ? 9 : 0)}" r="4.5" fill="#fff" stroke="#333" stroke-width="1.2"/>` : '';
      return `<polygon points="${hexPath(cx, cy, size - 1.2)}" fill="${s.fill}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>${label}${cube}`;
    })
    .join('');
  return `<svg viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}">${shapes}</svg>`;
}

export function patternText(card: AnimalCard): string {
  const [first, ...rest] = card.pattern;
  return `Sobre ${REQ_NAME[first.req]}${rest.length ? ', junto a ' + rest.map((p) => REQ_NAME[p.req]).join(' y ') : ''}`;
}

export function cardHtml(
  card: AnimalCard,
  opts: { placed?: number; extraClass?: string; data?: string; disabled?: boolean } = {},
): string {
  const placed = opts.placed ?? 0;
  const track = card.points
    .map((pts, i) => `<span class="pt ${i < placed ? 'got' : ''} ${i === placed - 1 ? 'cur' : ''}">${pts}</span>`)
    .join('');
  return `
  <div class="card ${opts.extraClass ?? ''} ${opts.disabled ? 'disabled' : ''}" ${opts.data ?? ''} title="${patternText(card)}">
    <div class="card-head"><span class="emoji">${card.emoji}</span><span class="name">${card.name}</span></div>
    <div class="pattern">${patternSvg(card)}</div>
    <div class="track">${track}</div>
  </div>`;
}
