/**
 * Board 6: Cloud Canopy (difficulty 2).
 *
 * Platforms in the treetops above the clouds. Signature mechanic: the
 * wind changes every round (announced) and pushes every monkey one step
 * forward or back. Trampoline leaves bounce you ahead, weak branches
 * drop you into the mist below.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers } from './index.js';

const g = graph();

/* --- canopy ring: 28 nodes -------------------------------------------- */
const ringPos = circle(28, 17, { y: (i, t) => 4.0 + Math.sin(t * Math.PI * 6) * 1.4 });
const ring = g.run(
  seq('cc_m', 28),
  ringPos,
  cycle(['blue', 'blue', 'red', 'blue', 'item', 'blue']),
);
g.link(ring[27], ring[0]);
g.setType('cc_m00', 'start');

/* --- loop A: treetop crowns (m05 -> m12), highest platforms ------------ */
const pa = ringPos(5);
const pb = ringPos(12);
const TREETOPS = g.run(
  seq('cc_a', 7),
  alongPath([
    [pa[0] * 0.72, 7.2, pa[2] * 0.72],
    [3.0, 8.4, -6.0],
    [pb[0] * 0.72, 7.2, pb[2] * 0.72],
  ], 7),
  cycle(['blue', 'red', 'blue', 'item', 'blue', 'blue', 'blue']),
);
g.setType('cc_m05', 'junction');
g.link('cc_m05', TREETOPS[0]);
g.link(TREETOPS[6], 'cc_m12');

/* --- loop B: misty understory (m16 -> m23), low and gloomy -------------- */
const pc = ringPos(16);
const pd = ringPos(23);
const MIST = g.run(
  seq('cc_b', 7),
  alongPath([
    [pc[0] * 0.75, 1.6, pc[2] * 0.75],
    [-5.0, 1.0, 6.0],
    [pd[0] * 0.75, 1.6, pd[2] * 0.75],
  ], 7),
  cycle(['red', 'blue', 'blue', 'blue', 'item', 'blue', 'trap']),
);
g.setType('cc_m16', 'junction');
g.link('cc_m16', MIST[0]);
g.link(MIST[6], 'cc_m23');

/* --- shortcut: trampoline vault (m25 -> m09) ----------------------------- */
const pe = ringPos(25);
const pf = ringPos(9);
const VAULT = g.run(
  seq('cc_x', 4),
  alongPath([
    [pe[0] * 0.7, 6.4, pe[2] * 0.7],
    [0.5, 9.0, -1.0],
    [pf[0] * 0.7, 6.4, pf[2] * 0.7],
  ], 4),
  'special',
);
g.setType('cc_m25', 'junction');
g.link('cc_m25', VAULT[0]);
g.link(VAULT[3], 'cc_m09');

/* --- spur: the great nest (m19 -> m21) ----------------------------------- */
const NEST = g.run(
  seq('cc_n', 2),
  alongPath([[ringPos(19)[0] * 0.8, 5.6, ringPos(19)[2] * 0.8], [ringPos(21)[0] * 0.8, 5.8, ringPos(21)[2] * 0.8]], 2),
  cycle(['blue', 'blue']),
);
g.setType('cc_m19', 'junction');
g.link('cc_m19', NEST[0]);
g.link(NEST[1], 'cc_m21');

/* --- landmarks ------------------------------------------------------------ */
g.setType('cc_n01', 'star');
g.setType('cc_a03', 'star');
g.setType('cc_m02', 'star');
g.setType('cc_m07', 'shop');
g.setType('cc_b02', 'shop');
g.setType('cc_m14', 'boss');

g.setEvent('cc_m03', 'trampoline_leaf');
g.setEvent('cc_m10', 'nectar');
g.setEvent('cc_m18', 'fall_through');
g.setEvent('cc_m26', 'storm_cloud');
g.setEvent('cc_a01', 'fall_through');
g.setEvent('cc_a05', 'rainbow_gift');
g.setEvent('cc_b04', 'nectar');
g.setEvent('cc_b05', 'trampoline_leaf');

const nodes = g.build();
const nav = makeNav(nodes);
const HIGH = new Set([...TREETOPS, ...VAULT, ...NEST]);

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'cloud_canopy',
  name: loc('Cloud Canopy', 'Wolkenkronendach'),
  description: loc(
    'Treetop platforms above the clouds. The wind is announced each round and pushes everyone a step - forward or back.',
    'Baumwipfel-Plattformen über den Wolken. Der Wind wird jede Runde angesagt und schiebt alle einen Schritt - vor oder zurück.',
  ),
  difficulty: 2,
  theme: {
    sky: '#bfe6ff',
    fog: { color: '#dff1ff', near: 26, far: 85 },
    ambient: '#e8f6ff',
    palette: { primary: '#eaf6ff', secondary: '#3a7bd5', accent: '#ffb6c1' },
  },
  music: { tempo: 100, scale: 'lydian', pattern: [0, 4, 6, 7, 11, 7, 6, 4] },
  nodes,
  starSpawns: ['cc_n01', 'cc_a03', 'cc_m02'],
  shops: [
    { node: 'cc_m07', stock: ['double_dice', 'turbo_banana', 'lucky_mask', 'shop_coupon', 'shield_shell'] },
    { node: 'cc_b02', stock: ['banana_peel', 'coconut_trap', 'swap_totem', 'ghost_banana', 'chaos_box'] },
  ],
  events: {
    trampoline_leaf: {
      description: loc('Boing! A giant leaf bounces you 4 fields ahead.', 'Boing! Ein Riesenblatt schleudert dich 4 Felder nach vorn.'),
      handler(sim, playerId) {
        const target = nav.forward(sim, playerId, 4);
        sim.emit('field', { board: 'cloud_canopy', event: 'trampoline_leaf', playerId, target });
      },
    },
    fall_through: {
      description: loc('The branch snaps! You fall into the misty understory.', 'Der Ast bricht! Du fällst ins neblige Unterholz.'),
      handler(sim, playerId) {
        sim.teleport(playerId, 'cc_b03');
        sim.coins(playerId, -2);
        sim.emit('field', { board: 'cloud_canopy', event: 'fall_through', playerId, target: 'cc_b03' });
      },
    },
    nectar: {
      description: loc('Sweet flower nectar - the bees pay well for it.', 'Süßer Blütennektar - die Bienen zahlen gut dafür.'),
      handler(sim, playerId) {
        sim.coins(playerId, sim.rng.int(4, 8));
      },
    },
    storm_cloud: {
      description: loc('A grumpy storm cloud zaps your coins.', 'Eine mürrische Gewitterwolke grillt deine Münzen.'),
      handler(sim, playerId) {
        sim.coins(playerId, -sim.rng.int(3, 6));
      },
    },
    rainbow_gift: {
      description: loc('A rainbow ends right here - with a random item.', 'Ein Regenbogen endet genau hier - mit einem zufälligen Gegenstand.'),
      handler(sim, playerId) {
        sim.giveItem(playerId, 'random');
      },
    },
  },
  mechanics: [
    {
      id: 'cc_wind',
      everyRounds: 1,
      initialState: { dir: 1 },
      onRoundStart(sim, state) {
        state.dir = sim.rng.pick([1, -1]) ?? 1;
        for (const pid of allPlayers(sim)) {
          if (state.dir > 0) nav.forward(sim, pid, 1);
          else nav.back(sim, pid, 1);
        }
        sim.emit('mechanic', {
          board: 'cloud_canopy',
          mechanic: 'cc_wind',
          dir: state.dir,
        });
      },
    },
  ],
  bossEvent: {
    id: 'cc_storm_roc',
    everyRounds: 5,
    handler(sim) {
      const blown = [];
      for (const pid of allPlayers(sim)) {
        if (HIGH.has(nav.playerNode(sim, pid))) {
          nav.back(sim, pid, 3);
          blown.push(pid);
        }
      }
      sim.emit('boss', { board: 'cloud_canopy', boss: 'cc_storm_roc', blown });
    },
  },
  view: { kind: 'board3d', builder: 'cloud_canopy' },
};

export default def;
