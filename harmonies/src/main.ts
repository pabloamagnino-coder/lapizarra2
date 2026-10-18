import { Sound } from './audio/sound';
import { animal } from './engine/animals';
import { botChooseCard, botChooseSlot, botNextCube } from './engine/bot';
import { Game, GameError, MAX_HAND, type PlayerSetup } from './engine/game';
import type { Color, Side } from './engine/types';
import { View } from './render/view';
import { cardHtml } from './ui/cards';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

const sound = new Sound();
const view = new View($('#stage'));
let game: Game | null = null;

const ui = {
  busy: false,
  cubeCard: null as number | null,
  viewing: 0,
};

const TOKEN_HINT: Record<Color, string> = {
  blue: 'Agua: solo en un espacio vacío. Armá un río largo.',
  yellow: 'Campo: solo en un espacio vacío. Cada grupo de 2+ vale 5.',
  brown: 'Tronco: en un espacio vacío o sobre otro tronco. Coronalo con hojas.',
  green: 'Hojas: vacío o sobre 1–2 troncos. Árboles de 1/3/7 puntos.',
  gray: 'Montaña: apilá hasta 3. Solo puntúa si toca otra montaña.',
  red: 'Edificio: sobre 1 ficha gris, marrón o roja. 5 pts si toca 3 colores.',
};

const COLOR_NAME: Record<Color, string> = {
  blue: 'agua', yellow: 'campo', brown: 'tronco', green: 'hojas', gray: 'montaña', red: 'edificio',
};

// ---- helpers -------------------------------------------------------------------

let toastTimer = 0;
function toast(msg: string, big = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('big', big);
  t.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), big ? 2200 : 1800);
}

const sleep = (s: number) => view.tweens.wait(s);

function humanTurn() {
  return !!game && !game.finished && !game.player.isBot && !ui.busy;
}

async function guarded(fn: () => Promise<void>) {
  if (ui.busy) return;
  ui.busy = true;
  refresh();
  try {
    await fn();
  } catch (e) {
    if (e instanceof GameError) {
      toast(e.message);
      sound.error();
    } else {
      console.error(e);
    }
  } finally {
    ui.busy = false;
    refresh();
  }
}

// ---- actions (shared by humans and bots) ------------------------------------------

async function doTakeSlot(slot: number) {
  game!.takeSlot(slot);
  sound.pickup();
  await view.takeSlot(slot);
}

async function doPlaceToken(pendingIndex: number, cell: number) {
  const g = game!;
  const color = g.turn.pending[pendingIndex];
  g.placeToken(pendingIndex, cell);
  const anim = view.placeToken(g.current, pendingIndex, cell, g.player.board);
  window.setTimeout(() => sound.place(color), 380);
  await anim;
}

async function doDiscard(pendingIndex: number) {
  game!.discardToken(pendingIndex);
  sound.error();
  await view.discardToken(pendingIndex);
}

async function doTakeCard(riverIndex: number) {
  const g = game!;
  const id = g.river[riverIndex]!;
  g.takeCard(riverIndex);
  sound.card();
  lastCardTaken = id;
  refresh();
}

async function doPlaceCube(handIndex: number, cell: number) {
  const g = game!;
  const card = animal(g.player.hand[handIndex].cardId);
  const before = g.score(g.current).animals;
  g.placeCube(handIndex, cell);
  ui.cubeCard = null;
  refresh();
  sound.animal(card.creature);
  await view.placeCube(g.current, cell, card.id, g.player.board);
  const gained = g.score(g.current).animals - before;
  const completed = g.player.done.some((h) => h.cardId === card.id);
  toast(`${card.emoji} ¡Llegó ${card.name}! +${gained}${completed ? ' · carta completa' : ''}`, true);
  if (completed) sound.complete();
}

async function doEndTurn() {
  const g = game!;
  const slot = g.turn.takenSlot!;
  g.endTurn();
  ui.cubeCard = null;
  view.refillSlot(slot, g.central[slot]);
  if (g.finished) {
    refresh();
    await sleep(0.6);
    showFinal();
    return;
  }
  ui.viewing = g.current;
  refresh();
  await view.focus(g.current);
  sound.turn();
  const last = g.endTriggered ? ' · ¡última ronda!' : '';
  toast(`${g.player.isBot ? '🤖' : '🙂'} Turno: ${g.player.name}${last}`);
}

// ---- bots ----------------------------------------------------------------------------

async function runBots() {
  while (game && !game.finished && game.player.isBot) {
    const g = game;
    ui.busy = true;
    refresh();
    await sleep(0.7);
    const card = botChooseCard(g);
    if (card !== null) {
      await doTakeCard(card);
      await sleep(0.4);
    }
    const plan = botChooseSlot(g);
    await doTakeSlot(plan.slot);
    for (const m of plan.moves) {
      await sleep(0.25);
      if (m.cell === null) await doDiscard(m.pendingIndex);
      else await doPlaceToken(m.pendingIndex, m.cell);
    }
    let cube;
    while ((cube = botNextCube(g))) {
      await sleep(0.3);
      await doPlaceCube(cube.handIndex, cube.cell);
    }
    await sleep(0.5);
    await doEndTurn();
    ui.busy = false;
  }
  refresh();
}

// ---- input -----------------------------------------------------------------------------

view.handlers = {
  onSlotClick: (slot) => {
    if (!humanTurn()) return;
    const g = game!;
    if (g.turn.takenSlot !== null) {
      toast('Ya tomaste tus fichas este turno');
      return;
    }
    if (!g.central[slot]) return;
    void guarded(() => doTakeSlot(slot));
  },
  onTrayClick: (i) => {
    if (!humanTurn()) return;
    ui.cubeCard = null;
    view.setTraySelection(i);
    sound.hover();
    refresh();
  },
  onCellClick: (player, cell) => {
    if (!humanTurn()) return;
    const g = game!;
    if (player !== g.current) {
      toast(`Ese es el tablero de ${g.players[player].name}`);
      return;
    }
    if (ui.cubeCard !== null) {
      const hi = ui.cubeCard;
      if (g.cubeSpotsFor(hi).includes(cell)) void guarded(() => doPlaceCube(hi, cell));
      else {
        sound.error();
        toast('Ese animal no puede vivir ahí');
      }
      return;
    }
    if (g.turn.takenSlot === null) {
      toast('Primero elegí 3 fichas del centro (los platos de la derecha)');
      return;
    }
    if (!g.turn.pending.length) {
      toast('Ya colocaste tus fichas: poné animales o terminá el turno');
      return;
    }
    const pi = Math.min(view.selectedTray, g.turn.pending.length - 1);
    if (!g.legalCells(g.turn.pending[pi]).includes(cell)) {
      sound.error();
      toast(`No se puede poner ${COLOR_NAME[g.turn.pending[pi]]} ahí`);
      return;
    }
    void guarded(() => doPlaceToken(pi, cell));
  },
  onCellHover: () => {},
};

$('#river').addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-river]');
  if (!el || !humanTurn()) return;
  const g = game!;
  if (!g.canTakeCard()) {
    toast(g.turn.tookCard ? 'Solo una carta por turno' : `Máximo ${MAX_HAND} animales en mano`);
    sound.error();
    return;
  }
  void guarded(() => doTakeCard(Number(el.dataset.river)));
});

$('#hand').addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-hand]');
  if (!el || !humanTurn()) return;
  const hi = Number(el.dataset.hand);
  if (ui.cubeCard === hi) {
    ui.cubeCard = null;
  } else if (game!.cubeSpotsFor(hi).length) {
    ui.cubeCard = hi;
    sound.hover();
  } else {
    toast('Todavía no tenés el hábitat de ese animal');
    sound.error();
  }
  refresh();
});

$('#tray').addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tray]');
  if (!el || !humanTurn()) return;
  ui.cubeCard = null;
  view.setTraySelection(Number(el.dataset.tray));
  refresh();
});

$('#btn-end').addEventListener('click', () => {
  if (humanTurn() && game!.canEndTurn()) void guarded(doEndTurn).then(runBots);
});

$('#btn-discard').addEventListener('click', () => {
  if (!humanTurn()) return;
  void guarded(() => doDiscard(view.selectedTray));
});

$('#players').addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-player]');
  if (!el || !game || ui.busy) return;
  const p = Number(el.dataset.player);
  ui.viewing = p;
  void (p === game.current ? view.focus(p) : view.peek(p));
  refresh();
});

window.addEventListener('keydown', (e) => {
  if (!humanTurn()) return;
  const g = game!;
  if (['1', '2', '3'].includes(e.key)) {
    const i = Number(e.key) - 1;
    if (i < g.turn.pending.length) {
      ui.cubeCard = null;
      view.setTraySelection(i);
      refresh();
    }
  } else if (e.key === 'Enter' && g.canEndTurn()) {
    void guarded(doEndTurn).then(runBots);
  } else if (e.key === 'Escape') {
    ui.cubeCard = null;
    refresh();
  }
});

window.addEventListener('pointerdown', () => sound.unlock(), { once: false });

$('#btn-sound').addEventListener('click', (e) => {
  sound.setMuted(!sound.muted);
  (e.currentTarget as HTMLElement).textContent = sound.muted ? '🔇' : '🔊';
});
$('#btn-ambient').addEventListener('click', (e) => {
  sound.setAmbient(!sound.ambientOn);
  (e.currentTarget as HTMLElement).style.opacity = sound.ambientOn ? '1' : '0.4';
});
$('#btn-rules').addEventListener('click', () => showRules());

// ---- rendering of the HUD ------------------------------------------------------------------

let lastCardTaken: string | null = null;

function refresh() {
  const g = game;
  if (!g) return;
  const scores = g.players.map((_, i) => g.score(i));
  const me = g.player;
  const myTurn = !me.isBot && !g.finished;

  $('#players').innerHTML = g.players
    .map(
      (p, i) => `<div class="ptab ${i === g.current ? 'active' : ''} ${i === ui.viewing && i !== g.current ? 'viewing' : ''}" data-player="${i}" role="button">
        ${p.isBot ? '🤖' : '🙂'} ${p.name} <span class="sc">${scores[i].total}</span></div>`,
    )
    .join('');
  view.setNames(g.players.map((p) => p.name), scores.map((s) => s.total), g.current);

  const canTake = myTurn && !ui.busy && g.canTakeCard();
  $('#river').innerHTML = g.river
    .map((id, i) =>
      id
        ? cardHtml(animal(id), { extraClass: canTake ? 'clickable' : '', data: `data-river="${i}"`, disabled: !canTake })
        : `<div class="card disabled"><div class="note">${g.deck.length ? 'Se repone al terminar el turno' : 'Mazo vacío'}</div></div>`,
    )
    .join('');

  const handHtml = me.hand
    .map((h, i) => {
      const spots = myTurn ? g.cubeSpotsFor(i).length : 0;
      const cls = ['clickable', spots ? 'can-place' : '', ui.cubeCard === i ? 'selected' : '', h.cardId === lastCardTaken ? 'pop' : '']
        .filter(Boolean)
        .join(' ');
      return cardHtml(animal(h.cardId), { placed: h.placed, extraClass: cls, data: `data-hand="${i}"` });
    })
    .join('');
  lastCardTaken = null;
  const done = me.done.length
    ? `<div class="done-strip" title="Cartas completas">${me.done.map((h) => animal(h.cardId).emoji).join('')}</div>`
    : '';
  $('#hand').innerHTML =
    handHtml + done ||
    '<div class="empty">Tomá animales de la izquierda (uno por turno, hasta 4). Cuando su hábitat exista en tu tablero, colocalos.</div>';
  $('#hand-count').textContent = `${me.name} · ${me.hand.length}/${MAX_HAND}`;

  // Status + tray
  const pending = g.turn.pending;
  const sel = Math.min(view.selectedTray, Math.max(0, pending.length - 1));
  let status = '';
  if (g.finished) status = 'Partida terminada';
  else if (me.isBot) status = `🤖 ${me.name} está jugando…`;
  else if (ui.cubeCard !== null) {
    const c = animal(me.hand[ui.cubeCard].cardId);
    status = `Elegí dónde vive ${c.emoji} ${c.name}<span class="hint">Los hexágonos dorados cumplen su patrón. Esc para cancelar.</span>`;
  } else if (g.turn.takenSlot === null) {
    status = 'Elegí 3 fichas del centro<span class="hint">Hacé click en un plato a la derecha de tu tablero.</span>';
  } else if (pending.length) {
    status = `Colocá tus fichas (${pending.length})<span class="hint">${TOKEN_HINT[pending[sel]]}</span>`;
  } else {
    status = 'Fichas colocadas<span class="hint">Colocá animales si podés y terminá el turno.</span>';
  }
  if (g.endTriggered && !g.finished) status += '<span class="hint">⏳ Última ronda</span>';
  $('#status').innerHTML = status;
  $('#tray').innerHTML = pending
    .map((c, i) => `<div class="tok ${c} ${i === sel && ui.cubeCard === null ? 'sel' : ''}" data-tray="${i}" title="${COLOR_NAME[c]} (${i + 1})"></div>`)
    .join('');

  const endBtn = $<HTMLButtonElement>('#btn-end');
  endBtn.disabled = !(myTurn && !ui.busy && g.canEndTurn());
  const stuck = myTurn && pending.length > 0 && g.legalCells(pending[sel]).length === 0;
  $('#btn-discard').classList.toggle('hidden', !stuck);

  const s = scores[ui.viewing] ?? scores[g.current];
  $('#score').innerHTML = `
    <h3>Puntaje · ${g.players[ui.viewing]?.name ?? ''}</h3>
    <table>
      <tr><td>🌳 Árboles</td><td>${s.trees}</td></tr>
      <tr><td>⛰️ Montañas</td><td>${s.mountains}</td></tr>
      <tr><td>🌾 Campos</td><td>${s.fields}</td></tr>
      <tr><td>🏠 Edificios</td><td>${s.buildings}</td></tr>
      <tr><td>${g.side === 'A' ? '🏞️ Río' : '🏝️ Islas'}</td><td>${s.water}</td></tr>
      <tr><td>🦊 Animales</td><td>${s.animals}</td></tr>
      <tr class="total"><td>Total</td><td>${s.total}</td></tr>
    </table>
    <p class="note">Ronda ${g.round} · bolsa: ${g.bag.length} fichas · libres: ${g.emptyCells()}</p>`;

  // Board highlights
  if (myTurn && !ui.busy) {
    if (ui.cubeCard !== null) view.highlight(g.current, g.cubeSpotsFor(ui.cubeCard), 'cube');
    else if (pending.length) view.highlight(g.current, g.legalCells(pending[sel]), 'place');
    else view.highlight(g.current, [], 'none');
  } else view.highlight(g.current, [], 'none');
}

// ---- modals ------------------------------------------------------------------------------------

function openModal(html: string) {
  $('#modal-box').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() {
  $('#modal').classList.add('hidden');
}

function showSetup() {
  let count = 2;
  let side: Side = 'A';
  const rows: PlayerSetup[] = [
    { name: 'Vos', isBot: false },
    { name: 'Bot Zorro', isBot: true },
    { name: 'Bot Búho', isBot: true },
    { name: 'Bot Oso', isBot: true },
  ];
  const render = () => {
    openModal(`
      <h2>🌿 Harmonies 3D</h2>
      <p class="sub">Construí tu paisaje, atraé animales. Prototipo de mesa en 3D.</p>
      <div class="field"><label>Jugadores</label>
        <div class="seg" id="seg-count">${[1, 2, 3, 4].map((n) => `<button data-n="${n}" class="${n === count ? 'on' : ''}">${n}</button>`).join('')}</div>
      </div>
      <div class="field">
        ${rows
          .slice(0, count)
          .map(
            (r, i) => `<div class="setup-row">
              <input type="text" data-name="${i}" value="${r.name}" maxlength="16" />
              <select data-type="${i}"><option value="h" ${!r.isBot ? 'selected' : ''}>Humano</option><option value="b" ${r.isBot ? 'selected' : ''}>Bot</option></select>
            </div>`,
          )
          .join('')}
        <p class="note">Varios humanos = se turnan en la misma compu (hot-seat).</p>
      </div>
      <div class="field"><label>Lado del tablero</label>
        <div class="seg" id="seg-side">
          <button data-side="A" class="${side === 'A' ? 'on' : ''}">A · Río</button>
          <button data-side="B" class="${side === 'B' ? 'on' : ''}">B · Islas</button>
        </div>
      </div>
      <div class="foot"><button class="ghost" id="btn-how">📖 Cómo se juega</button><button class="primary" id="btn-start">Jugar</button></div>`);
    const box = $('#modal-box');
    box.querySelectorAll<HTMLButtonElement>('#seg-count button').forEach((b) =>
      b.addEventListener('click', () => {
        save();
        count = Number(b.dataset.n);
        render();
      }),
    );
    box.querySelectorAll<HTMLButtonElement>('#seg-side button').forEach((b) =>
      b.addEventListener('click', () => {
        save();
        side = b.dataset.side as Side;
        render();
      }),
    );
    $('#btn-how').addEventListener('click', () => {
      save();
      showRules(render);
    });
    $('#btn-start').addEventListener('click', () => {
      save();
      sound.unlock();
      closeModal();
      startGame(rows.slice(0, count), side);
    });
  };
  const save = () => {
    document.querySelectorAll<HTMLInputElement>('[data-name]').forEach((el) => {
      rows[Number(el.dataset.name)].name = el.value.trim() || `Jugador ${Number(el.dataset.name) + 1}`;
    });
    document.querySelectorAll<HTMLSelectElement>('[data-type]').forEach((el) => {
      rows[Number(el.dataset.type)].isBot = el.value === 'b';
    });
  };
  render();
}

function showRules(back?: () => void) {
  openModal(`
    <div class="rules">
      <h2>📖 Cómo se juega</h2>
      <p>Cada uno arma su propio paisaje en un tablero de 23 hexágonos. Gana quien más puntos tenga al final.</p>
      <h4>En tu turno</h4>
      <ol>
        <li><b>Obligatorio:</b> tomá un grupo de 3 fichas del centro y colocá las 3 en tu tablero.</li>
        <li><b>Opcional (1 vez):</b> tomá una carta de animal (máximo 4 sin completar).</li>
        <li><b>Opcional:</b> poné animales donde tu paisaje cumpla su patrón (se puede rotar). Nada se apila encima de un animal.</li>
      </ol>
      <h4>Fichas y puntos</h4>
      <ul>
        <li>🌳 <b>Árbol</b>: hojas solas, sobre 1 o sobre 2 troncos → 1 / 3 / 7.</li>
        <li>⛰️ <b>Montaña</b>: 1–3 grises apiladas → 1 / 3 / 7, solo si toca otra montaña.</li>
        <li>🌾 <b>Campo</b>: cada grupo de 2+ amarillas → 5.</li>
        <li>🏠 <b>Edificio</b>: roja sobre gris, marrón o roja → 5 si toca 3 colores distintos.</li>
        <li>🏞️ <b>Río (lado A)</b>: tu río más largo → 0, 2, 5, 8, 11, 15 y +4 por ficha extra.</li>
        <li>🏝️ <b>Islas (lado B)</b>: cada grupo de tierra separado por agua → 5.</li>
        <li>🦊 <b>Animales</b>: el número más alto que destapaste en cada carta.</li>
      </ul>
      <h4>Fin</h4>
      <p>Cuando la bolsa no alcanza para reponer o alguien queda con 2 o menos espacios libres, se completa la ronda y se cuenta. Empate: gana quien puso más animales.</p>
      <p class="note">Atajos: 1-2-3 elegir ficha · Enter terminar turno · Esc cancelar animal · arrastrá para girar la cámara.</p>
      <div class="foot"><button class="primary" id="btn-close">Entendido</button></div>
    </div>`);
  $('#btn-close').addEventListener('click', () => (back ? back() : closeModal()));
}

function showFinal() {
  const g = game!;
  const scores = g.players.map((_, i) => g.score(i));
  const best = Math.max(...scores.map((s) => s.total));
  const winners = scores.map((s, i) => (s.total === best ? i : -1)).filter((i) => i >= 0);
  sound.victory();
  const rows = g.players
    .map((p, i) => {
      const s = scores[i];
      return `<tr class="${winners.includes(i) ? 'win' : ''}"><td>${winners.includes(i) ? '🏆 ' : ''}${p.name}</td>
        <td>${s.trees}</td><td>${s.mountains}</td><td>${s.fields}</td><td>${s.buildings}</td><td>${s.water}</td><td>${s.animals}</td><td><b>${s.total}</b></td></tr>`;
    })
    .join('');
  openModal(`
    <div class="final">
      <h2>🏆 ${winners.map((i) => g.players[i].name).join(' y ')} ${winners.length > 1 ? 'empatan' : 'gana'}</h2>
      <p class="sub">Así quedaron los paisajes:</p>
      <table>
        <tr><th>Jugador</th><th>🌳</th><th>⛰️</th><th>🌾</th><th>🏠</th><th>${g.side === 'A' ? '🏞️' : '🏝️'}</th><th>🦊</th><th>Total</th></tr>
        ${rows}
      </table>
      <div class="foot"><button class="ghost" id="btn-look">Ver tableros</button><button class="primary" id="btn-again">Jugar otra vez</button></div>
    </div>`);
  $('#btn-look').addEventListener('click', closeModal);
  $('#btn-again').addEventListener('click', showSetup);
}

// ---- boot ---------------------------------------------------------------------------------------

function startGame(players: PlayerSetup[], side: Side) {
  game = new Game({ players, side });
  ui.cubeCard = null;
  ui.viewing = 0;
  view.setupPlayers(players.map((p) => p.name));
  game.players.forEach((p, i) => {
    view.syncBoard(i, p.board);
    view.syncCreatures(i, p.board);
  });
  view.syncMarket(game.central);
  void view.focus(0, true);
  refresh();
  toast(`🙂 Turno: ${game.player.name}`);
  void runBots();
}

view.setupPlayers(['']);
void view.focus(0, true);
showSetup();

if (import.meta.env.DEV) {
  // Handy for debugging and automated browser checks.
  Object.assign(window, { __dbg: { view, get game() { return game; }, ui } });
}
