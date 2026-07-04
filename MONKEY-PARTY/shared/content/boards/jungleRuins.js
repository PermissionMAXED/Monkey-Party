/**
 * Board 1: Jungle Ruins (difficulty 1).
 *
 * Overgrown temple ruins on rolling jungle hills. Signature mechanic: a
 * collapsing rope bridge shortcut that toggles blocked/passable every 3
 * rounds. Events: geysers, vine shortcuts, treasure, snake pits.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers } from './index.js';

const g = graph();

/* --- main ring: 30 nodes over rolling hills ------------------------ */
const ringPos = circle(30, 17, { y: (i, t) => 0.6 + Math.sin(t * Math.PI * 4) * 1.1 });
const ring = g.run(
  seq('jr_m', 30),
  ringPos,
  cycle(['blue', 'blue', 'red', 'blue', 'item', 'blue']),
);
g.link(ring[29], ring[0]);
g.setType('jr_m00', 'start');

/* --- loop A: temple plateau (branch m05 -> rejoin m12) -------------- */
const pa = ringPos(5);
const pb = ringPos(12);
const loopA = g.run(
  seq('jr_a', 8),
  alongPath([
    [pa[0] * 0.78, pa[1] + 1.6, pa[2] * 0.78],
    [3.5, 5.2, -7.5],
    [-2.5, 5.6, -4.0],
    [pb[0] * 0.76, pb[1] + 1.4, pb[2] * 0.76],
  ], 8),
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue', 'blue', 'trap']),
);
g.setType('jr_m05', 'junction');
g.link('jr_m05', loopA[0]);
g.link(loopA[7], 'jr_m12');

/* --- loop B: river bend (branch m17 -> rejoin m24) ------------------ */
const pc = ringPos(17);
const pd = ringPos(24);
const loopB = g.run(
  seq('jr_b', 7),
  alongPath([
    [pc[0] * 0.8, -0.4, pc[2] * 0.8],
    [1.0, -0.8, 9.0],
    [pd[0] * 0.8, -0.3, pd[2] * 0.8],
  ], 7),
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue', 'red']),
);
g.setType('jr_m17', 'junction');
g.link('jr_m17', loopB[0]);
g.link(loopB[6], 'jr_m24');

/* --- shortcut: collapsing rope bridge (branch m26 -> rejoin m10) ---- */
const pe = ringPos(26);
const pf = ringPos(10);
const BRIDGE = g.run(
  seq('jr_x', 5),
  alongPath([
    [pe[0] * 0.7, 2.6, pe[2] * 0.7],
    [0, 3.4, 0],
    [pf[0] * 0.7, 2.6, pf[2] * 0.7],
  ], 5),
  'special',
);
g.setType('jr_m26', 'junction');
g.link('jr_m26', BRIDGE[0]);
g.link(BRIDGE[4], 'jr_m10');

/* --- landmarks ------------------------------------------------------ */
g.setType('jr_m08', 'star');
g.setType('jr_a05', 'star');
g.setType('jr_b03', 'star');
g.setType('jr_a03', 'shop');
g.setType('jr_m21', 'shop');
g.setType('jr_m15', 'boss');

g.setEvent('jr_m03', 'geyser');
g.setEvent('jr_m13', 'snake_pit');
g.setEvent('jr_m19', 'treasure');
g.setEvent('jr_m28', 'vine_shortcut');
g.setEvent('jr_a01', 'ruins_blessing');
g.setEvent('jr_a06', 'snake_pit');
g.setEvent('jr_b02', 'geyser');
g.setEvent('jr_b05', 'treasure');

const nodes = g.build();
const nav = makeNav(nodes);
const PLATEAU = new Set([...loopA, ...BRIDGE]);

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'jungle_ruins',
  name: loc('Jungle Ruins', 'Dschungelruinen'),
  description: loc(
    'Crumbling temples, geysers and a rope bridge that collapses every few rounds.',
    'Verfallene Tempel, Geysire und eine Hängebrücke, die alle paar Runden einstürzt.',
  ),
  difficulty: 1,
  theme: {
    sky: '#87ceeb',
    fog: { color: '#9fd8a5', near: 30, far: 90 },
    ambient: '#c8e6c9',
    palette: { primary: '#2e8b57', secondary: '#8b7355', accent: '#ffd23f' },
  },
  music: { tempo: 96, scale: 'dorian', pattern: [0, 2, 3, 5, 7, 5, 3, 2] },
  nodes,
  starSpawns: ['jr_m08', 'jr_a05', 'jr_b03'],
  shops: [
    { node: 'jr_a03', stock: ['double_dice', 'turbo_banana', 'banana_peel', 'lucky_mask', 'shield_shell'] },
    { node: 'jr_m21', stock: ['coconut_trap', 'swap_totem', 'ghost_banana', 'shop_coupon', 'magnet_banana'] },
  ],
  events: {
    geyser: {
      description: loc('A geyser erupts and blasts you 4 fields forward!', 'Ein Geysir bricht aus und schleudert dich 4 Felder nach vorne!'),
      handler(sim, playerId) {
        const target = nav.forward(sim, playerId, 4);
        sim.emit('field', { board: 'jungle_ruins', event: 'geyser', playerId, target });
      },
    },
    vine_shortcut: {
      description: loc('Grab a vine and swing up to the temple plateau.', 'Schnapp dir eine Liane und schwinge hinauf zum Tempelplateau.'),
      handler(sim, playerId) {
        sim.teleport(playerId, 'jr_a04');
        sim.emit('field', { board: 'jungle_ruins', event: 'vine_shortcut', playerId, target: 'jr_a04' });
      },
    },
    treasure: {
      description: loc('You dig up an ancient coin stash.', 'Du gräbst einen uralten Münzschatz aus.'),
      handler(sim, playerId) {
        sim.coins(playerId, sim.rng.int(5, 10));
      },
    },
    snake_pit: {
      description: loc('Snakes! You drop coins while scrambling out.', 'Schlangen! Beim Herausklettern verlierst du Münzen.'),
      handler(sim, playerId) {
        sim.coins(playerId, -sim.rng.int(3, 8));
      },
    },
    ruins_blessing: {
      description: loc('A forgotten shrine gifts you a random item.', 'Ein vergessener Schrein schenkt dir einen zufälligen Gegenstand.'),
      handler(sim, playerId) {
        sim.giveItem(playerId, 'random');
      },
    },
  },
  mechanics: [
    {
      id: 'jr_collapsing_bridge',
      everyRounds: 3,
      initialState: { collapsed: false, bridge: BRIDGE.slice() },
      onRoundStart(sim, state) {
        state.collapsed = !state.collapsed;
        if (state.collapsed) sim.blockNodes(BRIDGE.slice(), 3);
        sim.emit('mechanic', {
          board: 'jungle_ruins',
          mechanic: 'jr_collapsing_bridge',
          collapsed: state.collapsed,
          nodes: BRIDGE.slice(),
        });
      },
    },
  ],
  bossEvent: {
    id: 'jr_stone_guardian',
    everyRounds: 5,
    handler(sim) {
      const shaken = [];
      for (const pid of allPlayers(sim)) {
        if (PLATEAU.has(nav.playerNode(sim, pid))) {
          sim.coins(pid, -3);
          sim.teleport(pid, 'jr_m00');
          shaken.push(pid);
        }
      }
      sim.emit('boss', { board: 'jungle_ruins', boss: 'jr_stone_guardian', shaken });
    },
  },
  view: { kind: 'board3d', builder: 'jungle_ruins' },
};

export default def;
