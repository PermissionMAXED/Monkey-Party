/**
 * Board 11: Robo Banana Factory (difficulty 4).
 *
 * A clanking banana processing plant. Signature mechanic: conveyor belt
 * nodes auto-move anyone standing on them 2 fields forward at the start
 * of every round. Crushers eat items, steam vents knock you back, and
 * the factory boss overclocks everyone's dice to a d8 for the next round.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers, takeItem } from './index.js';
import { registerEffectDef } from '../../sim/effects.js';

/** Foreman overclock: everyone rolls a d8 while the effect lasts. */
registerEffectDef({
  id: 'dice_d8',
  hooks: {
    onDicePool: (pool) => ({ ...pool, sides: 8 }),
  },
});

const g = graph();

/* --- factory floor ring: 30 nodes -------------------------------------------- */
const ringPos = circle(30, 17, { y: (i, t) => 0.6 + Math.max(0, Math.sin(t * Math.PI * 2)) * 0.8 });
const ring = g.run(
  seq('rf_m', 30),
  ringPos,
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue']),
);
g.link(ring[29], ring[0]);
g.setType('rf_m00', 'start');

/* --- loop A: the assembly conveyor (m05 -> m13), auto-moves riders ------------- */
const pa = ringPos(5);
const pb = ringPos(13);
const CONVEYOR = g.run(
  seq('rf_a', 8),
  alongPath([
    [pa[0] * 0.72, 1.6, pa[2] * 0.72],
    [5.0, 1.8, -5.0],
    [-2.0, 2.0, -6.0],
    [pb[0] * 0.72, 1.6, pb[2] * 0.72],
  ], 8),
  'special',
  () => ({ params: { conveyor: true } }),
);
g.setType('rf_m05', 'junction');
g.link('rf_m05', CONVEYOR[0]);
g.link(CONVEYOR[7], 'rf_m13');

/* --- loop B: vat catwalk (m17 -> m24), above the banana mash ------------------- */
const pc = ringPos(17);
const pd = ringPos(24);
const CATWALK = g.run(
  seq('rf_b', 7),
  alongPath([
    [pc[0] * 0.75, 4.2, pc[2] * 0.75],
    [-4.5, 4.8, 5.5],
    [pd[0] * 0.75, 4.2, pd[2] * 0.75],
  ], 7),
  cycle(['blue', 'red', 'blue', 'item', 'blue', 'blue', 'trap']),
);
g.setType('rf_m17', 'junction');
g.link('rf_m17', CATWALK[0]);
g.link(CATWALK[6], 'rf_m24');

/* --- shortcut: banana chute (m27 -> m09) ----------------------------------------- */
const pe = ringPos(27);
const pf = ringPos(9);
const CHUTE = g.run(
  seq('rf_x', 4),
  alongPath([
    [pe[0] * 0.68, 2.8, pe[2] * 0.68],
    [0.5, 1.6, -1.0],
    [pf[0] * 0.68, 0.9, pf[2] * 0.68],
  ], 4),
  'special',
);
g.setType('rf_m27', 'junction');
g.link('rf_m27', CHUTE[0]);
g.link(CHUTE[3], 'rf_m09');

/* --- landmarks -------------------------------------------------------------------- */
g.setType('rf_b03', 'star');
g.setType('rf_a06', 'star');
g.setType('rf_m21', 'star');
g.setType('rf_m07', 'shop');
g.setType('rf_b01', 'shop');
g.setType('rf_m15', 'boss');

g.setEvent('rf_m03', 'steam_vent');
g.setEvent('rf_m11', 'quality_bonus');
g.setEvent('rf_m19', 'oil_spill');
g.setEvent('rf_m25', 'spare_parts');
g.setEvent('rf_a02', 'crusher');
g.setEvent('rf_a05', 'crusher');
g.setEvent('rf_b04', 'quality_bonus');
g.setEvent('rf_x01', 'steam_vent');

const nodes = g.build();
const nav = makeNav(nodes);
const CONVEYOR_SET = new Set(CONVEYOR);

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'robo_banana_factory',
  name: loc('Robo Banana Factory', 'Robo-Bananenfabrik'),
  description: loc(
    'Conveyor belts drag you 2 fields at every round start, crushers eat items, and the foreman overclocks all dice to d8.',
    'Förderbänder ziehen dich zu jedem Rundenstart 2 Felder weiter, Pressen fressen Gegenstände, und der Vorarbeiter übertaktet alle Würfel auf W8.',
  ),
  difficulty: 4,
  theme: {
    sky: '#33373d',
    fog: { color: '#3c4148', near: 24, far: 80 },
    ambient: '#565c66',
    palette: { primary: '#9aa3ad', secondary: '#f5a623', accent: '#3ecf8e' },
  },
  music: { tempo: 120, scale: 'minor', pattern: [0, 0, 3, 5, 7, 5, 3, 0] },
  nodes,
  starSpawns: ['rf_b03', 'rf_a06', 'rf_m21'],
  shops: [
    { node: 'rf_m07', stock: ['double_dice', 'banana_peel', 'shield_shell', 'turbo_banana', 'shop_coupon'] },
    { node: 'rf_b01', stock: ['mini_gorilla', 'dice_curse', 'chaos_box', 'magnet_banana', 'swap_totem'] },
  ],
  events: {
    crusher: {
      description: loc('The crusher slams down - one of your items is scrap now.', 'Die Presse kracht herab - einer deiner Gegenstände ist jetzt Schrott.'),
      handler(sim, playerId) {
        const items = sim.state?.players?.[playerId]?.items ?? [];
        if (items.length > 0) {
          const lost = takeItem(sim, playerId, sim.rng.int(0, items.length - 1));
          sim.emit('field', { board: 'robo_banana_factory', event: 'crusher', playerId, lost });
        } else {
          sim.coins(playerId, -4);
        }
      },
    },
    steam_vent: {
      description: loc('PSSHH! A steam vent blasts you 2 fields back.', 'ZISCH! Ein Dampfventil schleudert dich 2 Felder zurück.'),
      handler(sim, playerId) {
        const target = nav.back(sim, playerId, 2);
        sim.coins(playerId, -2);
        sim.emit('field', { board: 'robo_banana_factory', event: 'steam_vent', playerId, target });
      },
    },
    oil_spill: {
      description: loc('You slip on spilled oil and scatter coins everywhere.', 'Du rutschst auf Öl aus und verstreust überall Münzen.'),
      handler(sim, playerId) {
        sim.coins(playerId, -sim.rng.int(3, 6));
      },
    },
    spare_parts: {
      description: loc('You salvage spare parts and assemble a random item.', 'Du sammelst Ersatzteile und baust einen zufälligen Gegenstand.'),
      handler(sim, playerId) {
        sim.giveItem(playerId, 'random');
      },
    },
    quality_bonus: {
      description: loc('Quality control approves your bananas. Bonus payout!', 'Die Qualitätskontrolle lobt deine Bananen. Bonuszahlung!'),
      handler(sim, playerId) {
        sim.coins(playerId, sim.rng.int(5, 9));
      },
    },
  },
  mechanics: [
    {
      id: 'rf_conveyor',
      everyRounds: 1,
      initialState: { belt: CONVEYOR.slice(), moved: [] },
      onRoundStart(sim, state) {
        const moved = [];
        for (const pid of allPlayers(sim)) {
          if (CONVEYOR_SET.has(nav.playerNode(sim, pid))) {
            const target = nav.forward(sim, pid, 2);
            moved.push({ playerId: pid, target });
          }
        }
        state.moved = moved;
        sim.emit('mechanic', {
          board: 'robo_banana_factory',
          mechanic: 'rf_conveyor',
          moved,
        });
      },
    },
  ],
  bossEvent: {
    id: 'rf_overclock',
    everyRounds: 4,
    handler(sim) {
      for (const pid of allPlayers(sim)) {
        sim.addEffect(pid, { id: 'dice_d8', turnsLeft: 1 });
      }
      sim.emit('boss', { board: 'robo_banana_factory', boss: 'rf_overclock', effect: 'dice_d8' });
    },
  },
  view: { kind: 'board3d', builder: 'robo_banana_factory' },
};

export default def;
