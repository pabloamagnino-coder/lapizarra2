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

## Reglas implementadas y qué tan seguras son

Fuentes: reseñas y resúmenes de terceros, sin el reglamento oficial. Desde el entorno de
desarrollo no se pudo acceder a boardgamearena.com ni a libellud.com.

| Regla | Estado |
|---|---|
| Turno: tomar 3 fichas del centro y colocarlas todas; opcional 1 carta (máx. 4); colocar animales | ✅ coincide en varias fuentes |
| Apilado: agua y campo solo en vacío; montaña hasta 3; árbol = hojas sobre 0–2 troncos; edificio = rojo sobre gris/marrón/rojo | ✅ casi todo confirmado (el texto exacto de agua y campo no) |
| Árboles 1/3/7 · Montañas 1/3/7 si tocan otra montaña · Campos 5 por grupo de 2+ · Edificio 5 si toca 3 colores | ✅ |
| Río (lado A) 0/2/5/8/11/15 y +4 por ficha extra, medido por el camino más corto | ✅ |
| Islas (lado B): 5 por cada grupo de tierra separado por agua | ⚠️ simplificado; en el juego real el lado B es otro tablero |
| Fin: la bolsa no alcanza o alguien queda con ≤2 espacios libres; se completa la ronda; empate gana quien puso más animales | ✅ |
| Fichas por color (23/23/21/19/19/15 = 120) | ⚠️ total confirmado (120), reparto sin verificar |
| Cartas de animales | 🆕 24 cartas propias, no las 32 oficiales |
| Cartas de espíritu de la naturaleza, modo solitario oficial | ❌ todavía no |

## Próximos pasos

1. Validar las reglas con el reglamento oficial del juego físico (el PDF de la caja).
2. Pulido: vista previa de la ficha antes de soltarla, deshacer, mejores modelos y música.
3. Multijugador online: servidor autoritativo por WebSocket que reutilice `src/engine`.
4. Versión para celular: controles táctiles y layout vertical.
