/**
 * Board 9: Ghost Jungle (difficulty 4).
 *
 * A haunted, moonlit jungle. Signature mechanic: every round 4 ghost
 * fields relocate (the mechanic rewrites which 4 nodes are haunted);
 * standing on one costs coins unless a lantern protects you. The ghost
 * king boss swaps two random players.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers } from './index.js';

const g = graph();

/* --- jungle ring: 30 nodes ----------------------------------------------- */
const ringPos = circle(30, 17, { y: (i, t) => 0.7 + Math.sin(t * Math.PI * 6) * 0.5 });
const ring = g.run(
  seq('gj_m', 30),
  ringPos,
  cycle(['blue', 'blue', 'red', 'blue', 'item', 'blue']),
);
g.link(ring[29], ring[0]);
g.setType('gj_m00', 'start');

/* --- loop A: haunted grove (m06 -> m14) ------------------------------------ */
const pa = ringPos(6);
const pb = ringPos(14);
const GROVE = g.run(
  seq('gj_a', 8),
  alongPath([
    [pa[0] * 0.72, 1.8, pa[2] * 0.72],
    [4.0, 2.8, -6.0],
    [-2.0, 3.2, -5.0],
    [pb[0] * 0.72, 1.8, pb[2] * 0.72],
  ], 8),
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue', 'trap', 'blue']),
);
g.setType('gj_m06', 'junction');
g.link('gj_m06', GROVE[0]);
g.link(GROVE[7], 'gj_m14');

/* --- loop B: whispering swamp (m18 -> m25) ----------------------------------- */
const pc = ringPos(18);
const pd = ringPos(25);
const SWAMP = g.run(
  seq('gj_b', 7),
  alongPath([
    [pc[0] * 0.75, -0.3, pc[2] * 0.75],
    [-4.5, -0.6, 6.0],
    [pd[0] * 0.75, -0.3, pd[2] * 0.75],
  ], 7),
  cycle(['red', 'blue', 'blue', 'blue', 'item', 'blue', 'blue']),
);
g.setType('gj_m18', 'junction');
g.link('gj_m18', SWAMP[0]);
g.link(SWAMP[6], 'gj_m25');

/* --- shortcut: phantom path (m27 -> m11), shimmering and unstable ------------ */
const pe = ringPos(27);
const pf = ringPos(11);
const PHANTOM = g.run(
  seq('gj_x', 5),
  alongPath([
    [pe[0] * 0.68, 2.2, pe[2] * 0.68],
    [0.5, 3.0, -0.5],
    [pf[0] * 0.68, 2.2, pf[2] * 0.68],
  ], 5),
  'special',
);
g.setType('gj_m27', 'junction');
g.link('gj_m27', PHANTOM[0]);
g.link(PHANTOM[4], 'gj_m11');

/* --- landmarks ----------------------------------------------------------------- */
g.setType('gj_a04', 'star');
g.setType('gj_b03', 'star');
g.setType('gj_m21', 'star');
g.setType('gj_m08', 'shop');
g.setType('gj_b05', 'shop');
g.setType('gj_m15', 'boss');

g.setEvent('gj_m03', 'lantern');
g.setEvent('gj_m13', 'spook');
g.setEvent('gj_m19', 'whisper_heist');
g.setEvent('gj_m28', 'lantern');
g.setEvent('gj_a02', 'seance');
g.setEvent('gj_a06', 'spook');
g.setEvent('gj_b02', 'seance');
g.setEvent('gj_x02', 'phantom_path');

const nodes = g.build();
const nav = makeNav(nodes);
/** Nodes eligible to become haunted ghost fields (plain ring fields). */
const GHOST_CANDIDATES = nodes
  .filter((n) => n.id.startsWith('gj_m') && (n.type === 'blue' || n.type === 'red'))
  .map((n) => n.id);

function hasLantern(sim, pid) {
  const effects = sim.state?.players?.[pid]?.effects ?? [];
  return effects.some((e) => e.id === 'lantern_light' && e.turnsLeft > 0);
}

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'ghost_jungle',
  name: loc('Ghost Jungle', 'Geisterdschungel'),
  description: loc(
    'Four haunted fields drift to new places every round. Carry a lantern, or the ghosts will tax you - and the ghost king loves swapping monkeys.',
    'Vier Spukfelder wandern jede Runde weiter. Trag eine Laterne, sonst kassieren die Geister - und der Geisterkönig tauscht gern Affen.',
  ),
  difficulty: 4,
  theme: {
    sky: '#1a1226',
    fog: { color: '#241a33', near: 20, far: 65 },
    ambient: '#3c2f52',
    palette: { primary: '#6b4fa0', secondary: '#2f4f4f', accent: '#aefc4e' },
  },
  music: { tempo: 76, scale: 'locrian', pattern: [0, 1, 3, 6, 8, 6, 3, 1] },
  nodes,
  starSpawns: ['gj_a04', 'gj_b03', 'gj_m21'],
  shops: [
    { node: 'gj_m08', stock: ['ghost_banana', 'lucky_mask', 'shield_shell', 'banana_peel', 'double_dice'] },
    { node: 'gj_b05', stock: ['swap_totem', 'dice_curse', 'chaos_box', 'coconut_trap', 'mini_gorilla'] },
  ],
  events: {
    lantern: {
      description: loc('You light a spirit lantern: trap immunity for 3 turns.', 'Du entzündest eine Geisterlaterne: 3 Züge lang immun gegen Fallen.'),
      handler(sim, playerId) {
        sim.addEffect(playerId, { id: 'lantern_light', turnsLeft: 3 });
        sim.emit('field', { board: 'ghost_jungle', event: 'lantern', playerId });
      },
    },
    spook: {
      description: loc('BOO! A ghost rattles coins right out of your fur.', 'BUH! Ein Geist schüttelt dir Münzen aus dem Fell.'),
      handler(sim, playerId) {
        sim.coins(playerId, -sim.rng.int(3, 8));
      },
    },
    seance: {
      description: loc('A monkey medium channels the beyond and hands you an item.', 'Ein Affen-Medium beschwört das Jenseits und reicht dir einen Gegenstand.'),
      handler(sim, playerId) {
        sim.giveItem(playerId, sim.rng.next() < 0.5 ? 'ghost_banana' : 'random');
      },
    },
    phantom_path: {
      description: loc('The phantom path shimmers and carries you 3 fields on.', 'Der Phantompfad flimmert und trägt dich 3 Felder weiter.'),
      handler(sim, playerId) {
        const target = nav.forward(sim, playerId, 3);
        sim.emit('field', { board: 'ghost_jungle', event: 'phantom_path', playerId, target });
      },
    },
    whisper_heist: {
      description: loc('Whispering spirits nick 3 coins from a random rival for you.', 'Flüsternde Geister stibitzen für dich 3 Münzen von einem zufälligen Rivalen.'),
      handler(sim, playerId) {
        const others = allPlayers(sim).filter((pid) => pid !== playerId);
        const victim = sim.rng.pick(others);
        if (victim) sim.stealCoins(victim, playerId, 3);
      },
    },
  },
  mechanics: [
    {
      id: 'gj_ghost_fields',
      everyRounds: 1,
      initialState: { ghostNodes: [], candidates: GHOST_CANDIDATES.slice() },
      onRoundStart(sim, state) {
        state.ghostNodes = sim.rng.shuffle(GHOST_CANDIDATES).slice(0, 4);
        const haunted = new Set(state.ghostNodes);
        const spooked = [];
        for (const pid of allPlayers(sim)) {
          if (haunted.has(nav.playerNode(sim, pid)) && !hasLantern(sim, pid)) {
            sim.coins(pid, -2);
            spooked.push(pid);
          }
        }
        sim.emit('mechanic', {
          board: 'ghost_jungle',
          mechanic: 'gj_ghost_fields',
          ghostNodes: state.ghostNodes.slice(),
          spooked,
        });
      },
    },
  ],
  bossEvent: {
    id: 'gj_ghost_king',
    everyRounds: 4,
    handler(sim) {
      const pids = allPlayers(sim);
      if (pids.length < 2) return;
      const shuffled = sim.rng.shuffle(pids);
      const [a, b] = shuffled;
      const nodeA = nav.playerNode(sim, a);
      const nodeB = nav.playerNode(sim, b);
      sim.teleport(a, nodeB);
      sim.teleport(b, nodeA);
      sim.emit('boss', { board: 'ghost_jungle', boss: 'gj_ghost_king', swapped: [a, b] });
    },
  },
  view: { kind: 'board3d', builder: 'ghost_jungle' },
};

export default def;
