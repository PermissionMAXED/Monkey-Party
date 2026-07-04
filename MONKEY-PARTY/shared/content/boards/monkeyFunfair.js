/**
 * Board 10: Monkey Funfair (difficulty 2).
 *
 * A carnival board with a juiced economy: blue fields pay +4 and red
 * fields cost -4 (node params.coinDelta). Mini-lottery, bumper cars that
 * bounce you to a random adjacent field, and a ferris wheel whose gondola
 * exit rotates every round (signature mechanic).
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers, leaderOf } from './index.js';

const g = graph();

/** Funfair economy: juiced blue/red payouts via node params. */
const econ = (type) => (type === 'blue' ? { params: { coinDelta: 4 } } : type === 'red' ? { params: { coinDelta: -4 } } : {});
const typedRun = (ids, posFn, typeFn) => g.run(ids, posFn, typeFn, (i) => econ(typeFn(i)));

/* --- promenade ring: 30 nodes ----------------------------------------------- */
const ringType = cycle(['blue', 'blue', 'red', 'blue', 'item', 'blue']);
const ringPos = circle(30, 17, { y: 0.4 });
const ring = typedRun(seq('mf_m', 30), ringPos, ringType);
g.link(ring[29], ring[0]);
g.setType('mf_m00', 'start');

/* --- loop A: midway games alley (m04 -> m12) ---------------------------------- */
const pa = ringPos(4);
const pb = ringPos(12);
const MIDWAY = typedRun(
  seq('mf_a', 7),
  alongPath([
    [pa[0] * 0.72, 0.5, pa[2] * 0.72],
    [7.0, 0.7, -3.5],
    [pb[0] * 0.72, 0.5, pb[2] * 0.72],
  ], 7),
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue', 'blue']),
);
g.setType('mf_m04', 'junction');
g.link('mf_m04', MIDWAY[0]);
g.link(MIDWAY[6], 'mf_m12');

/* --- loop B: rollercoaster ride (m16 -> m24), swoops up and down --------------- */
const pc = ringPos(16);
const pd = ringPos(24);
const COASTER = typedRun(
  seq('mf_c', 8),
  alongPath([
    [pc[0] * 0.74, 1.0, pc[2] * 0.74],
    [-6.0, 5.0, 3.0],
    [-1.0, 2.0, 8.0],
    [pd[0] * 0.74, 1.0, pd[2] * 0.74],
  ], 8),
  cycle(['blue', 'blue', 'red', 'blue', 'blue', 'item', 'blue', 'blue']),
);
g.setType('mf_m16', 'junction');
g.link('mf_m16', COASTER[0]);
g.link(COASTER[7], 'mf_m24');

/* --- shortcut: bumper car arena (m08 -> m20) ------------------------------------ */
const pe = ringPos(8);
const pf = ringPos(20);
const ARENA = g.run(
  seq('mf_x', 4),
  alongPath([
    [pe[0] * 0.6, 0.3, pe[2] * 0.6],
    [0.5, 0.3, 0.5],
    [pf[0] * 0.6, 0.3, pf[2] * 0.6],
  ], 4),
  'special',
);
g.setType('mf_m08', 'junction');
g.link('mf_m08', ARENA[0]);
g.link(ARENA[3], 'mf_m20');

/* --- spur: ferris wheel boarding (m27 -> m29) ------------------------------------- */
const WHEEL = g.run(
  seq('mf_f', 3),
  alongPath([
    [ringPos(27)[0] * 0.78, 0.6, ringPos(27)[2] * 0.78],
    [ringPos(29)[0] * 0.78, 0.6, ringPos(29)[2] * 0.78],
  ], 3),
  cycle(['blue', 'blue', 'blue']),
);
g.setType('mf_m27', 'junction');
g.link('mf_m27', WHEEL[0]);
g.link(WHEEL[2], 'mf_m29');

/* --- landmarks --------------------------------------------------------------------- */
g.setType('mf_c04', 'star');
g.setType('mf_a03', 'star');
g.setType('mf_m22', 'star');
g.setType('mf_m06', 'shop');
g.setType('mf_a05', 'shop');
g.setType('mf_m18', 'boss');

g.setEvent('mf_m02', 'mini_lottery');
g.setEvent('mf_m14', 'cotton_candy');
g.setEvent('mf_m26', 'mini_lottery');
g.setEvent('mf_f01', 'ferris_wheel');
g.setEvent('mf_x01', 'bumper_car');
g.setEvent('mf_x02', 'bumper_car');
g.setEvent('mf_a01', 'strength_test');
g.setEvent('mf_c02', 'strength_test');
g.setEvent('mf_c06', 'cotton_candy');

const nodes = g.build();
const nav = makeNav(nodes);
/** Ring nodes the rotating gondola can drop passengers at (N/E/S/W). */
const GONDOLA_STOPS = ['mf_m29', 'mf_m07', 'mf_m15', 'mf_m23'];

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'monkey_funfair',
  name: loc('Monkey Funfair', 'Affen-Jahrmarkt'),
  description: loc(
    'Big payouts, big losses: blue pays +4, red costs -4. Ride the ferris wheel, bounce through bumper cars, win the lottery.',
    'Große Gewinne, große Verluste: Blau zahlt +4, Rot kostet -4. Fahr Riesenrad, rempel durch die Autoscooter, knack die Lotterie.',
  ),
  difficulty: 2,
  theme: {
    sky: '#ffe9f0',
    fog: { color: '#ffd9e6', near: 30, far: 95 },
    ambient: '#fff0d9',
    palette: { primary: '#ff5aa0', secondary: '#ffd23f', accent: '#3ecf8e' },
  },
  music: { tempo: 132, scale: 'major', pattern: [0, 4, 7, 9, 12, 9, 7, 4] },
  nodes,
  starSpawns: ['mf_c04', 'mf_a03', 'mf_m22'],
  shops: [
    { node: 'mf_m06', stock: ['double_dice', 'turbo_banana', 'banana_peel', 'shop_coupon', 'chaos_box'] },
    { node: 'mf_a05', stock: ['swap_totem', 'lucky_mask', 'magnet_banana', 'golden_ticket', 'mini_gorilla'] },
  ],
  events: {
    mini_lottery: {
      description: loc('Scratch a banana ticket: jackpot, small win, or a dud.', 'Rubbel ein Bananenlos: Jackpot, kleiner Gewinn oder Niete.'),
      handler(sim, playerId) {
        const roll = sim.rng.next();
        const prize = roll < 0.1 ? 15 : roll < 0.45 ? 4 : -1;
        sim.coins(playerId, prize);
        sim.emit('field', { board: 'monkey_funfair', event: 'mini_lottery', playerId, prize });
      },
    },
    bumper_car: {
      description: loc('CRASH! A bumper car knocks you onto a random adjacent field.', 'RUMMS! Ein Autoscooter rammt dich auf ein zufälliges Nachbarfeld.'),
      handler(sim, playerId) {
        const here = nav.byId.get(nav.playerNode(sim, playerId));
        const target = sim.rng.pick(here?.next ?? []);
        if (target) {
          sim.teleport(playerId, target);
          sim.emit('field', { board: 'monkey_funfair', event: 'bumper_car', playerId, target });
        }
      },
    },
    ferris_wheel: {
      description: loc('Hop in a gondola - it drops you wherever the wheel points this round.', 'Steig in eine Gondel - sie setzt dich ab, wohin das Rad diese Runde zeigt.'),
      handler(sim, playerId) {
        const angle = sim.state?.board?.mechanics?.mf_ferris?.angle ?? 0;
        const target = GONDOLA_STOPS[angle % GONDOLA_STOPS.length];
        sim.teleport(playerId, target);
        sim.emit('field', { board: 'monkey_funfair', event: 'ferris_wheel', playerId, target });
      },
    },
    cotton_candy: {
      description: loc('Free cotton candy! Sugar rush worth a few coins.', 'Gratis Zuckerwatte! Der Zuckerschub ist ein paar Münzen wert.'),
      handler(sim, playerId) {
        sim.coins(playerId, 3);
      },
    },
    strength_test: {
      description: loc('Swing the hammer! Ring the bell for 8, or whiff for -2.', 'Schwing den Hammer! Triff die Glocke für 8 oder blamier dich für -2.'),
      handler(sim, playerId) {
        const rang = sim.rng.next() < 0.5;
        sim.coins(playerId, rang ? 8 : -2);
        sim.emit('field', { board: 'monkey_funfair', event: 'strength_test', playerId, rang });
      },
    },
  },
  mechanics: [
    {
      id: 'mf_ferris',
      everyRounds: 1,
      initialState: { angle: 0, stops: GONDOLA_STOPS.slice() },
      onRoundStart(sim, state) {
        state.angle = (state.angle + 1) % GONDOLA_STOPS.length;
        sim.emit('mechanic', {
          board: 'monkey_funfair',
          mechanic: 'mf_ferris',
          angle: state.angle,
          stop: GONDOLA_STOPS[state.angle],
        });
      },
    },
  ],
  bossEvent: {
    id: 'mf_ringmaster',
    everyRounds: 5,
    handler(sim) {
      const leader = leaderOf(sim);
      const swings = [];
      for (const pid of allPlayers(sim)) {
        const delta = pid === leader ? -6 : (sim.rng.next() < 0.5 ? 1 : -1) * sim.rng.int(2, 6);
        sim.coins(pid, delta);
        swings.push({ playerId: pid, delta });
      }
      sim.emit('boss', { board: 'monkey_funfair', boss: 'mf_ringmaster', swings });
    },
  },
  view: { kind: 'board3d', builder: 'monkey_funfair' },
};

export default def;
