# lapizarra2

## harmonies/ — prototipo 3D del juego de mesa Harmonies (Libellud)

- Stack: Vite + TypeScript + Three.js (sin framework de UI). Sonido sintetizado con Web Audio.
- Comandos (desde `harmonies/`): `npm run dev`, `npm test` (Vitest), `npm run typecheck`, `npm run build`.
- `src/engine/` es lógica pura y testeada, sin DOM ni Three.js. Mantenerla así: la idea es reutilizarla
  en un servidor autoritativo para el multijugador online.
- `src/render/view.ts` dibuja y anima; `src/main.ts` conecta clicks → `Game` → animaciones, y corre los bots.
- La UI y los textos del juego están en español rioplatense (voseo).
- Las reglas siguen el reglamento oficial; el estado de cada regla está en `harmonies/README.md`.
- Legal: el juego es de Libellud. El repo es privado y para prototipo; el plan es pedir licencia antes de
  publicar. No copiar arte, textos ni las cartas oficiales: las cartas de animales son propias.
- Pendiente: cartas de espíritu, forma real de los tableros A/B, multijugador online, versión móvil.
