/**
 * Board 2: Volcano Island (difficulty 3).
 *
 * A smoking caldera. Signature mechanic: the lava level rises every 3
 * rounds, progressively blocking the low routes. The eruption boss rains
 * embers on everyone still on the outer ring (-5). Jump pads launch
 * players over the lava.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers } from './index.js';

const g = graph();

/* --- outer beach ring: 28 nodes ------------------------------------- */
const ringPos = circle(28, 18, { y: (i, t) => 0.4 + Math.sin(t * Math.PI * 2) * 0.5 });
const ring = g.run(
  seq('vi_o', 28),
  ringPos,
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue', 'red']),
);
g.link(ring[27], ring[0]);
g.setType('vi_o00', 'start');

/* --- ascent loop A: crater rim climb (o04 -> o13) ------------------- */
const pa = ringPos(4);
const pb = ringPos(13);
const loopA = g.run(
  seq('vi_a', 8),
  alongPath([
    [pa[0] * 0.72, 2.0, pa[2] * 0.72],
    [5.0, 5.4, -6.0],
    [-3.0, 6.2, -6.5],
    [pb[0] * 0.72, 2.2, pb[2] * 0.72],
  ], 8),
  cycle(['blue', 'blue', 'red', 'blue', 'item', 'blue', 'blue', 'trap']),
);
g.setType('vi_o04', 'junction');
g.link('vi_o04', loopA[0]);
g.link(loopA[7], 'vi_o13');

/* --- ascent loop B: obsidian ridge (o16 -> o24) ---------------------- */
const pc = ringPos(16);
const pd = ringPos(24);
const loopB = g.run(
  seq('vi_b', 7),
  alongPath([
    [pc[0] * 0.75, 1.8, pc[2] * 0.75],
    [-4.0, 4.6, 7.0],
    [pd[0] * 0.75, 1.6, pd[2] * 0.75],
  ], 7),
  cycle(['red', 'blue', 'blue', 'item', 'blue', 'trap', 'blue']),
);
g.setType('vi_o16', 'junction');
g.link('vi_o16', loopB[0]);
g.link(loopB[6], 'vi_o24');

/* --- shortcut: caldera floor crossing (o09 -> o20), lowest ground ---- */
const pe = ringPos(9);
const pf = ringPos(20);
const FLOOR = g.run(
  seq('vi_c', 5),
  alongPath([
    [pe[0] * 0.6, 0.1, pe[2] * 0.6],
    [0, -0.2, 0],
    [pf[0] * 0.6, 0.1, pf[2] * 0.6],
  ], 5),
  'special',
);
g.setType('vi_o09', 'junction');
g.link('vi_o09', FLOOR[0]);
g.link(FLOOR[4], 'vi_o20');

/* --- landmarks ------------------------------------------------------ */
g.setType('vi_a05', 'star');
g.setType('vi_b03', 'star');
g.setType('vi_o22', 'star');
g.setType('vi_o07', 'shop');
g.setType('vi_a02', 'shop');
g.setType('vi_o18', 'boss');

g.setEvent('vi_o02', 'jump_pad');
g.setEvent('vi_o11', 'ember_shower');
g.setEvent('vi_o15', 'obsidian_treasure');
g.setEvent('vi_o26', 'jump_pad');
g.setEvent('vi_a04', 'magma_forge');
g.setEvent('vi_a06', 'lava_surge');
g.setEvent('vi_b04', 'obsidian_treasure');
g.setEvent('vi_c02', 'ember_shower');

const nodes = g.build();
const nav = makeNav(nodes);
const OUTER = new Set(ring);
/** Node sets swallowed by each lava level (1..3). */
const LAVA_LEVELS = [
  FLOOR.slice(),
  ['vi_o10', 'vi_o11', 'vi_o19', 'vi_o21'],
  ['vi_o02', 'vi_o26', 'vi_b06'],
];

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'volcano_island',
  name: loc('Volcano Island', 'Vulkaninsel'),
  description: loc(
    'The lava rises every 3 rounds and swallows the low paths. Climb or burn.',
    'Alle 3 Runden steigt die Lava und verschlingt die tiefen Wege. Klettere oder verbrenne.',
  ),
  difficulty: 3,
  theme: {
    sky: '#2b1b17',
    fog: { color: '#4a2c22', near: 25, far: 80 },
    ambient: '#5c3a2e',
    palette: { primary: '#e5484d', secondary: '#4a3428', accent: '#ff8c00' },
  },
  music: { tempo: 128, scale: 'phrygian', pattern: [0, 1, 4, 5, 7, 5, 4, 1] },
  nodes,
  starSpawns: ['vi_a05', 'vi_b03', 'vi_o22'],
  shops: [
    { node: 'vi_o07', stock: ['double_dice', 'banana_peel', 'shield_shell', 'shop_coupon', 'turbo_banana'] },
    { node: 'vi_a02', stock: ['mini_gorilla', 'chaos_box', 'dice_curse', 'lucky_mask', 'magnet_banana'] },
  ],
  events: {
    jump_pad: {
      description: loc('A basalt jump pad launches you 4 fields over the lava!', 'Ein Basalt-Sprungfeld katapultiert dich 4 Felder über die Lava!'),
      handler(sim, playerId) {
        const target = nav.forward(sim, playerId, 4);
        sim.emit('field', { board: 'volcano_island', event: 'jump_pad', playerId, target });
      },
    },
    ember_shower: {
      description: loc('Glowing embers rain down and singe your coin pouch.', 'Glühende Funken regnen herab und versengen deinen Münzbeutel.'),
      handler(sim, playerId) {
        sim.coins(playerId, -sim.rng.int(3, 6));
      },
    },
    obsidian_treasure: {
      description: loc('You chip valuable obsidian from the rock.', 'Du schlägst wertvollen Obsidian aus dem Fels.'),
      handler(sim, playerId) {
        sim.coins(playerId, sim.rng.int(6, 10));
      },
    },
    lava_surge: {
      description: loc('A lava surge! You retreat 3 fields.', 'Eine Lavawelle! Du weichst 3 Felder zurück.'),
      handler(sim, playerId) {
        const target = nav.back(sim, playerId, 3);
        sim.emit('field', { board: 'volcano_island', event: 'lava_surge', playerId, target });
      },
    },
    magma_forge: {
      description: loc('The magma forge hammers out a random item for you.', 'Die Magmaschmiede hämmert dir einen zufälligen Gegenstand.'),
      handler(sim, playerId) {
        sim.giveItem(playerId, 'random');
      },
    },
  },
  mechanics: [
    {
      id: 'vi_lava_rise',
      everyRounds: 3,
      initialState: { level: 0, maxLevel: 3, flooded: [] },
      onRoundStart(sim, state) {
        state.level = Math.min(state.maxLevel, state.level + 1);
        const flooded = LAVA_LEVELS.slice(0, state.level).flat();
        state.flooded = flooded;
        sim.blockNodes(flooded, 3);
        sim.emit('mechanic', {
          board: 'volcano_island',
          mechanic: 'vi_lava_rise',
          level: state.level,
          nodes: flooded,
        });
      },
    },
  ],
  bossEvent: {
    id: 'vi_eruption',
    everyRounds: 5,
    handler(sim) {
      const hit = [];
      for (const pid of allPlayers(sim)) {
        if (OUTER.has(nav.playerNode(sim, pid))) {
          sim.coins(pid, -5);
          hit.push(pid);
        }
      }
      sim.emit('boss', { board: 'volcano_island', boss: 'vi_eruption', hit });
    },
  },
  view: { kind: 'board3d', builder: 'volcano_island' },
};

export default def;
