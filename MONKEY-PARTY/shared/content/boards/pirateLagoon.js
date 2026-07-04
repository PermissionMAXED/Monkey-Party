/**
 * Board 4: Pirate Lagoon (difficulty 3).
 *
 * A tropical lagoon with a beached galleon. Signature mechanic: the tide
 * alternates every round, flooding (blocking) the sandbank shortcut on
 * high tide. The kraken boss steals items; cannons shoot players across
 * the map.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers, takeItem } from './index.js';

const g = graph();

/* --- beach ring: 28 nodes -------------------------------------------- */
const ringPos = circle(28, 17, { y: (i, t) => 0.5 + Math.sin(t * Math.PI * 6) * 0.35 });
const ring = g.run(
  seq('pl_m', 28),
  ringPos,
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue']),
);
g.link(ring[27], ring[0]);
g.setType('pl_m00', 'start');

/* --- loop A: the galleon deck (m03 -> m11) ---------------------------- */
const pa = ringPos(3);
const pb = ringPos(11);
const SHIP = g.run(
  seq('pl_s', 8),
  alongPath([
    [pa[0] * 0.7, 2.6, pa[2] * 0.7],
    [5.0, 3.6, -6.0],
    [-2.0, 4.2, -7.0],
    [pb[0] * 0.7, 2.6, pb[2] * 0.7],
  ], 8),
  cycle(['blue', 'blue', 'red', 'blue', 'item', 'blue', 'blue', 'trap']),
);
g.setType('pl_m03', 'junction');
g.link('pl_m03', SHIP[0]);
g.link(SHIP[7], 'pl_m11');

/* --- loop B: smuggler cove (m15 -> m22) -------------------------------- */
const pc = ringPos(15);
const pd = ringPos(22);
const COVE = g.run(
  seq('pl_v', 7),
  alongPath([
    [pc[0] * 0.75, 0.3, pc[2] * 0.75],
    [-6.5, 0.9, 6.5],
    [pd[0] * 0.75, 0.3, pd[2] * 0.75],
  ], 7),
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue', 'blue']),
);
g.setType('pl_m15', 'junction');
g.link('pl_m15', COVE[0]);
g.link(COVE[6], 'pl_m22');

/* --- shortcut: tidal sandbank (m24 -> m08), floods at high tide -------- */
const pe = ringPos(24);
const pf = ringPos(8);
const SANDBANK = g.run(
  seq('pl_k', 6),
  alongPath([
    [pe[0] * 0.65, 0.1, pe[2] * 0.65],
    [1.0, 0.05, -1.0],
    [pf[0] * 0.65, 0.1, pf[2] * 0.65],
  ], 6),
  'special',
);
g.setType('pl_m24', 'junction');
g.link('pl_m24', SANDBANK[0]);
g.link(SANDBANK[5], 'pl_m08');

/* --- landmarks --------------------------------------------------------- */
g.setType('pl_s05', 'star');
g.setType('pl_v03', 'star');
g.setType('pl_m18', 'star');
g.setType('pl_m06', 'shop');
g.setType('pl_s02', 'shop');
g.setType('pl_m12', 'boss');

g.setEvent('pl_m05', 'buried_treasure');
g.setEvent('pl_m17', 'storm_surge');
g.setEvent('pl_m21', 'parrot_tip');
g.setEvent('pl_m26', 'buried_treasure');
g.setEvent('pl_s04', 'cannon_travel');
g.setEvent('pl_s06', 'rum_ration');
g.setEvent('pl_v02', 'cannon_travel');
g.setEvent('pl_v05', 'storm_surge');
g.setEvent('pl_k03', 'buried_treasure');

const nodes = g.build();
const nav = makeNav(nodes);
/** Cannon destinations, cross-map (from ship -> cove, from cove -> ship). */
const CANNON_TARGETS = { pl_s04: 'pl_v04', pl_v02: 'pl_s03' };

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'pirate_lagoon',
  name: loc('Pirate Lagoon', 'Piratenlagune'),
  description: loc(
    'The tide floods the sandbank every other round, cannons launch you across the bay, and the kraken wants your loot.',
    'Die Flut überspült jede zweite Runde die Sandbank, Kanonen schießen dich über die Bucht, und der Krake will deine Beute.',
  ),
  difficulty: 3,
  theme: {
    sky: '#7ec8e3',
    fog: { color: '#a5d8e6', near: 32, far: 100 },
    ambient: '#bfe3ee',
    palette: { primary: '#1e6f9f', secondary: '#c2a878', accent: '#e5c07b' },
  },
  music: { tempo: 104, scale: 'mixolydian', pattern: [0, 4, 5, 7, 9, 7, 5, 4] },
  nodes,
  starSpawns: ['pl_s05', 'pl_v03', 'pl_m18'],
  shops: [
    { node: 'pl_m06', stock: ['double_dice', 'coconut_trap', 'banana_peel', 'shield_shell', 'magnet_banana'] },
    { node: 'pl_s02', stock: ['swap_totem', 'ghost_banana', 'lucky_mask', 'chaos_box', 'golden_ticket'] },
  ],
  events: {
    cannon_travel: {
      description: loc('Climb into the cannon and fly across the lagoon!', 'Kletter in die Kanone und flieg über die Lagune!'),
      handler(sim, playerId) {
        const from = nav.playerNode(sim, playerId);
        const target = CANNON_TARGETS[from] ?? 'pl_m00';
        sim.teleport(playerId, target);
        sim.emit('field', { board: 'pirate_lagoon', event: 'cannon_travel', playerId, from, target });
      },
    },
    buried_treasure: {
      description: loc('X marks the spot - you dig up pirate gold.', 'X markiert die Stelle - du gräbst Piratengold aus.'),
      handler(sim, playerId) {
        sim.coins(playerId, sim.rng.int(6, 12));
      },
    },
    rum_ration: {
      description: loc('The quartermaster trades a random item for your silence.', 'Der Quartiermeister tauscht dein Schweigen gegen einen zufälligen Gegenstand.'),
      handler(sim, playerId) {
        sim.giveItem(playerId, 'random');
      },
    },
    parrot_tip: {
      description: loc('A parrot squawks a hot tip - but tips cost peanuts.', 'Ein Papagei kräht einen heißen Tipp - aber Tipps kosten Erdnüsse.'),
      handler(sim, playerId) {
        const gain = sim.rng.next() < 0.6 ? sim.rng.int(4, 8) : -2;
        sim.coins(playerId, gain);
      },
    },
    storm_surge: {
      description: loc('A storm surge washes you 3 fields back.', 'Eine Sturmflut spült dich 3 Felder zurück.'),
      handler(sim, playerId) {
        const target = nav.back(sim, playerId, 3);
        sim.emit('field', { board: 'pirate_lagoon', event: 'storm_surge', playerId, target });
      },
    },
  },
  mechanics: [
    {
      id: 'pl_tide',
      everyRounds: 1,
      initialState: { highTide: false, sandbank: SANDBANK.slice() },
      onRoundStart(sim, state) {
        state.highTide = !state.highTide;
        if (state.highTide) sim.blockNodes(SANDBANK.slice(), 1);
        sim.emit('mechanic', {
          board: 'pirate_lagoon',
          mechanic: 'pl_tide',
          highTide: state.highTide,
          nodes: SANDBANK.slice(),
        });
      },
    },
  ],
  bossEvent: {
    id: 'pl_kraken',
    everyRounds: 4,
    handler(sim) {
      const robbed = [];
      for (const pid of allPlayers(sim)) {
        const items = sim.state?.players?.[pid]?.items ?? [];
        if (items.length > 0) {
          const lost = takeItem(sim, pid, sim.rng.int(0, items.length - 1));
          robbed.push({ playerId: pid, item: lost });
        } else {
          sim.coins(pid, -2);
        }
      }
      sim.emit('boss', { board: 'pirate_lagoon', boss: 'pl_kraken', robbed });
    },
  },
  view: { kind: 'board3d', builder: 'pirate_lagoon' },
};

export default def;
