/**
 * Board 8: Icy Coconut Peak (difficulty 3).
 *
 * A frosty mountain of frozen coconuts. Ice fields slide you 2 extra
 * fields past your landing spot. Signature mechanic: the frozen lake
 * shortcut freezes/thaws every 2 rounds (thawed = blocked). The avalanche
 * boss pushes everyone 3 fields downhill; the hot spring is a cozy safe
 * zone.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers } from './index.js';
import { registerEffectDef } from '../../sim/effects.js';

/** Hot-spring buff: full trap immunity (board hazards + placed traps). */
registerEffectDef({
  id: 'cozy_warmth',
  hooks: {
    onTrapTriggered: (chain) => ({ ...chain, cancelled: true }),
  },
});

const g = graph();

/* --- base ring: 26 nodes ------------------------------------------------ */
const ringPos = circle(26, 17, { y: (i, t) => 0.5 + Math.sin(t * Math.PI * 2) * 0.6 });
const ring = g.run(
  seq('ip_m', 26),
  ringPos,
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue']),
);
g.link(ring[25], ring[0]);
g.setType('ip_m00', 'start');

/* --- loop A: switchback ascent to the summit (m05 -> m14) ----------------- */
const pa = ringPos(5);
const pb = ringPos(14);
const ASCENT = g.run(
  seq('ip_a', 8),
  alongPath([
    [pa[0] * 0.72, 2.2, pa[2] * 0.72],
    [4.0, 5.0, -5.0],
    [-1.0, 8.2, -3.0],
    [pb[0] * 0.7, 3.0, pb[2] * 0.7],
  ], 8),
  cycle(['blue', 'blue', 'red', 'blue', 'item', 'blue', 'blue', 'red']),
);
g.setType('ip_m05', 'junction');
g.link('ip_m05', ASCENT[0]);
g.link(ASCENT[7], 'ip_m14');

/* --- loop B: glacier traverse (m17 -> m24) --------------------------------- */
const pc = ringPos(17);
const pd = ringPos(24);
const GLACIER = g.run(
  seq('ip_b', 7),
  alongPath([
    [pc[0] * 0.75, 3.0, pc[2] * 0.75],
    [-5.0, 3.8, 5.5],
    [pd[0] * 0.75, 3.0, pd[2] * 0.75],
  ], 7),
  cycle(['blue', 'red', 'blue', 'item', 'blue', 'blue', 'trap']),
);
g.setType('ip_m17', 'junction');
g.link('ip_m17', GLACIER[0]);
g.link(GLACIER[6], 'ip_m24');

/* --- shortcut: frozen lake crossing (m22 -> m03), thaws shut --------------- */
const pe = ringPos(22);
const pf = ringPos(3);
const LAKE = g.run(
  seq('ip_x', 5),
  alongPath([
    [pe[0] * 0.6, 0.2, pe[2] * 0.6],
    [0.5, 0.1, 1.0],
    [pf[0] * 0.6, 0.2, pf[2] * 0.6],
  ], 5),
  'special',
);
g.setType('ip_m22', 'junction');
g.link('ip_m22', LAKE[0]);
g.link(LAKE[4], 'ip_m03');

/* --- spur: hot spring terrace (m10 -> m12) ---------------------------------- */
const SPRING = g.run(
  seq('ip_h', 2),
  alongPath([
    [ringPos(10)[0] * 0.78, 1.6, ringPos(10)[2] * 0.78],
    [ringPos(12)[0] * 0.78, 1.7, ringPos(12)[2] * 0.78],
  ], 2),
  cycle(['blue', 'blue']),
);
g.setType('ip_m10', 'junction');
g.link('ip_m10', SPRING[0]);
g.link(SPRING[1], 'ip_m12');

/* --- landmarks ---------------------------------------------------------------- */
g.setType('ip_a06', 'star');
g.setType('ip_b03', 'star');
g.setType('ip_m20', 'star');
g.setType('ip_m08', 'shop');
g.setType('ip_a02', 'shop');
g.setType('ip_m16', 'boss');

g.setEvent('ip_m02', 'ice_slide');
g.setEvent('ip_m13', 'coconut_cache');
g.setEvent('ip_m19', 'snowball_ambush');
g.setEvent('ip_m25', 'ice_slide');
g.setEvent('ip_h00', 'hot_spring');
g.setEvent('ip_h01', 'hot_spring');
g.setEvent('ip_a04', 'yeti_gift');
g.setEvent('ip_b04', 'snowball_ambush');
g.setEvent('ip_x02', 'ice_slide');

const nodes = g.build();
const nav = makeNav(nodes);

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'icy_coconut_peak',
  name: loc('Icy Coconut Peak', 'Eisiger Kokosnussgipfel'),
  description: loc(
    'Ice fields slide you 2 extra fields, the frozen lake thaws shut every other phase, and the avalanche sweeps everyone downhill.',
    'Eisfelder lassen dich 2 Extra-Felder rutschen, der zugefrorene See taut regelmäßig auf, und die Lawine fegt alle bergab.',
  ),
  difficulty: 3,
  theme: {
    sky: '#dff3ff',
    fog: { color: '#eaf7ff', near: 28, far: 90 },
    ambient: '#f2faff',
    palette: { primary: '#bfe8ff', secondary: '#7fb2cc', accent: '#8b5a2b' },
  },
  music: { tempo: 92, scale: 'major', pattern: [0, 4, 7, 12, 7, 4, 2, 4] },
  nodes,
  starSpawns: ['ip_a06', 'ip_b03', 'ip_m20'],
  shops: [
    { node: 'ip_m08', stock: ['double_dice', 'turbo_banana', 'banana_peel', 'shield_shell', 'shop_coupon'] },
    { node: 'ip_a02', stock: ['coconut_trap', 'lucky_mask', 'swap_totem', 'magnet_banana', 'golden_ticket'] },
  ],
  events: {
    ice_slide: {
      description: loc('Sheet ice! You skid 2 fields past your landing spot.', 'Blankes Eis! Du rutschst 2 Felder über dein Ziel hinaus.'),
      handler(sim, playerId) {
        const target = nav.forward(sim, playerId, 2);
        sim.emit('field', { board: 'icy_coconut_peak', event: 'ice_slide', playerId, target });
      },
    },
    coconut_cache: {
      description: loc('A frozen coconut cache - still perfectly good coins inside.', 'Ein gefrorenes Kokosnusslager - die Münzen darin sind noch top.'),
      handler(sim, playerId) {
        sim.coins(playerId, sim.rng.int(5, 9));
      },
    },
    snowball_ambush: {
      description: loc('Snow monkeys ambush you with snowballs and grab coins.', 'Schneeaffen überfallen dich mit Schneebällen und schnappen Münzen.'),
      handler(sim, playerId) {
        sim.coins(playerId, -sim.rng.int(3, 7));
      },
    },
    hot_spring: {
      description: loc('Ahh, the hot spring. Cozy warmth shields you from traps for 2 turns.', 'Ahh, die heiße Quelle. Wohlige Wärme schützt dich 2 Züge vor Fallen.'),
      handler(sim, playerId) {
        sim.addEffect(playerId, { id: 'cozy_warmth', turnsLeft: 2 });
        sim.coins(playerId, 3);
      },
    },
    yeti_gift: {
      description: loc('A shy yeti presses a random item into your paw.', 'Ein schüchterner Yeti drückt dir einen zufälligen Gegenstand in die Pfote.'),
      handler(sim, playerId) {
        sim.giveItem(playerId, 'random');
      },
    },
  },
  mechanics: [
    {
      id: 'ip_freeze_thaw',
      everyRounds: 2,
      initialState: { frozen: true, lake: LAKE.slice() },
      onRoundStart(sim, state) {
        state.frozen = !state.frozen;
        if (!state.frozen) sim.blockNodes(LAKE.slice(), 2);
        sim.emit('mechanic', {
          board: 'icy_coconut_peak',
          mechanic: 'ip_freeze_thaw',
          frozen: state.frozen,
          nodes: LAKE.slice(),
        });
      },
    },
  ],
  bossEvent: {
    id: 'ip_avalanche',
    everyRounds: 4,
    handler(sim) {
      const swept = [];
      for (const pid of allPlayers(sim)) {
        const target = nav.back(sim, pid, 3);
        swept.push({ playerId: pid, target });
      }
      sim.emit('boss', { board: 'icy_coconut_peak', boss: 'ip_avalanche', swept });
    },
  },
  view: { kind: 'board3d', builder: 'icy_coconut_peak' },
};

export default def;
