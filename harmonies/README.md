# Harmonies 3D (prototipo)

Prototipo de una versión 3D del juego de mesa **Harmonies** (Johan Benvenuto / Libellud, 2024)
para jugar en la compu: vos contra bots o varias personas en la misma máquina.

> ⚠️ Proyecto privado de prueba. Harmonies es un juego con licencia de Libellud (BGA lo tiene
> porque está licenciado). Antes de publicar esto hay que pedir la licencia. Las cartas de
> animales, el arte 3D y los sonidos de este repo son **originales**: no copian el material del juego.

## Cómo correrlo

```bash
cd harmonies
npm install
npm run dev        # abre http://localhost:5173
npm test           # tests del motor de reglas
npm run build      # build de producción en dist/
```

Controles: click en un plato del centro → click en un hexágono para poner cada ficha
(`1`/`2`/`3` cambia de ficha) → click en una carta de tu mano y en un hexágono dorado para
poner el animal → `Enter` termina el turno. Arrastrá para girar la cámara y usá la rueda para el zoom.

## Estructura

```
src/engine/   motor de reglas puro (sin 3D): tablero hex, apilado, patrones, puntaje, partida, bot
src/render/   Three.js: tablero, fichas con forma de paisaje, animales low-poly, animaciones
src/audio/    sonido 100 % sintetizado con Web Audio (sin archivos)
src/ui/       HUD en HTML/CSS y cartas en SVG
src/main.ts   controlador: conecta los clicks, el motor, las animaciones y los bots
tests/        tests del motor (Vitest)
```

El motor está separado del render a propósito: el mismo `Game` se puede correr en un
servidor para el multijugador online sin reescribir las reglas.

## Reglas implementadas

Contrastadas con el reglamento oficial en inglés (`LIBELLUD_HARMONIES_RULES_EN`). El PDF no se
sube al repo porque es material de Libellud.

| Regla | Estado |
|---|---|
| Turno: tomar 3 fichas de un espacio y colocarlas todas; opcional 1 carta (máx. 4 sin completar); animales ilimitados, en cualquier orden y entre fichas | ✅ reglamento |
| Apilado: nunca debajo, nunca sobre un animal; árbol = verde sobre 0–2 marrones; montaña = 1–3 grises; edificio = rojo sobre gris/marrón/rojo | ✅ reglamento |
| Patrones: cualquier orientación, alturas exactas, edificio de cualquier base, una ficha puede servir a varios hábitats, el animal colocado no se mueve | ✅ reglamento |
| Árboles y montañas 1/3/7 (montaña sola = 0) · Campos 5 por grupo de 2+ · Edificio 5 si toca 3 colores distintos (solo ficha superior) | ✅ reglamento |
| Río (lado A): camino más corto entre extremos, 0/2/5/8/11/15 y +4 por ficha después de la 6ª | ✅ reglas / ⚠️ tabla leída de un gráfico |
| Islas (lado B): 5 por grupo de espacios separado por agua, vacíos incluidos, mínimo 1 | ✅ reglamento / ⚠️ el lado B del tablero real tiene otra forma |
| Fichas: 23 azules, 23 grises, 21 marrones, 19 verdes, 19 amarillas, 15 rojas | ✅ reglamento |
| Fin: bolsa vacía al reponer o ≤2 espacios libres; se completa la ronda; empate → más cubos; si persiste, victoria compartida | ✅ reglamento |
| Modo solitario: 3 espacios, 3 cartas, se descartan las 6 fichas sobrantes, cambio de carta si no tomaste, soles 40/70/90/110/130/140/150/160 (+1 lado A) | ✅ reglamento |
| Forma del tablero (23 hexágonos en columnas 5-4-5-4-5) | ⚠️ supuesto, el texto no lo dice |
| Cartas de animales | 🆕 24 cartas propias, no las 32 oficiales |
| Cartas de espíritu de la naturaleza | ❌ todavía no |

## Próximos pasos

1. Validar las reglas con el reglamento oficial del juego físico (el PDF de la caja).
2. Pulido: vista previa de la ficha antes de soltarla, deshacer, mejores modelos y música.
3. Multijugador online: servidor autoritativo por WebSocket que reutilice `src/engine`.
4. Versión para celular: controles táctiles y layout vertical.
