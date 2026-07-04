/**
 * Character system tests (package P6).
 *
 * Data side (shared/content/characters): registry count, unique ids, perk
 * hook whitelist, unlock tiers, build-parameter ranges, localized text,
 * voice/emote configs, and the registrar's own self-check.
 *
 * Client side (src/characters): meshes can't render headless, but three.js
 * itself is pure JS, so the factory/animator/cosmetics modules are imported
 * (guarded) and exercised as scene-graph data: part wiring, pose/animator
 * math, cosmetic attach/re-tint, preview turntable, and the tri budget.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { characters } from '#shared/registries.js';
import registerAll, {
  CHARACTER_DEFS, CHARACTER_IDS, ALLOWED_PERK_HOOKS, assertPerkHooks,
} from '#shared/content/characters/index.js';

/* ------------------------------------------------------------------ */
/* Constants from the P6 spec                                          */
/* ------------------------------------------------------------------ */

const SPEC_ALLOWED_HOOKS = [
  'onTurnStart', 'onDicePool', 'onDiceRoll', 'onMoveSteps', 'onShopPrice',
  'onCoinsGained', 'onCoinsLost', 'onPassNode', 'onLandNode',
  'onTrapTriggered', 'onMinigameCoins', 'onStarPrice', 'onItemUse',
];

const EMOTES = ['dance', 'taunt', 'laugh', 'cry', 'flex', 'facepalm'];
const EAR_STYLES = ['round', 'small', 'big', 'tufted', 'pointy'];
const TAIL_STYLES = ['none', 'short', 'long', 'curl', 'thick'];
const SNOUT_STYLES = ['short', 'long', 'wide', 'flat', 'cone'];
const BROW_STYLES = ['soft', 'flat', 'arched', 'heavy'];
const UNLOCK_TIERS = [5, 10, 20, 35, 50, 75];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

test('registerAll registers exactly 16 characters', () => {
  const count = registerAll();
  assert.equal(count, 16, 'registry count after registerAll');
  assert.equal(characters.count(), 16);
  assert.equal(CHARACTER_DEFS.length, 16);
});

test('registerAll is idempotent', () => {
  registerAll();
  registerAll();
  assert.equal(characters.count(), 16);
});

test('all 16 character ids are unique and registered', () => {
  registerAll();
  assert.equal(new Set(CHARACTER_IDS).size, 16, 'ids unique');
  for (const id of CHARACTER_IDS) {
    const def = characters.get(id);
    assert.ok(def, `"${id}" is registered`);
    assert.equal(def.id, id);
  }
});

test('one character per species (silhouette variety)', () => {
  const species = CHARACTER_DEFS.map((d) => d.species);
  assert.equal(new Set(species).size, 16, 'all species distinct');
});

/* ------------------------------------------------------------------ */
/* Perk hooks                                                          */
/* ------------------------------------------------------------------ */

test('exported hook whitelist matches the P6 spec', () => {
  assert.deepEqual([...ALLOWED_PERK_HOOKS].sort(), [...SPEC_ALLOWED_HOOKS].sort());
});

test('every perk hook name is in the allowed list and is a function', () => {
  for (const def of CHARACTER_DEFS) {
    assert.ok(def.perk && typeof def.perk === 'object', `${def.id}: has perk`);
    assert.equal(typeof def.perk.id, 'string');
    assert.ok(def.perk.id.length > 0, `${def.id}: perk id non-empty`);
    assert.ok(def.perk.description?.en, `${def.id}: perk description.en`);
    assert.ok(def.perk.description?.de, `${def.id}: perk description.de`);
    const hooks = def.perk.hooks;
    assert.ok(hooks && typeof hooks === 'object', `${def.id}: perk.hooks object`);
    for (const [name, fn] of Object.entries(hooks)) {
      assert.ok(
        SPEC_ALLOWED_HOOKS.includes(name),
        `${def.id}: hook "${name}" must be one of ${SPEC_ALLOWED_HOOKS.join(', ')}`,
      );
      assert.equal(typeof fn, 'function', `${def.id}: hook "${name}" is a function`);
    }
  }
});

test('self-check throws on unknown hook names and non-function hooks', () => {
  assert.throws(
    () => assertPerkHooks({ id: 'bogus', perk: { hooks: { onBananaPhone: () => {} } } }),
    /unknown perk hook "onBananaPhone"/,
  );
  assert.throws(
    () => assertPerkHooks({ id: 'bogus', perk: { hooks: { onShopPrice: 42 } } }),
    /must be a function/,
  );
  assert.throws(() => assertPerkHooks({ id: 'bogus', perk: { hooks: null } }), /must be an object/);
  // A valid def passes.
  assertPerkHooks(CHARACTER_DEFS[0]);
});

test('value-shaping perk hooks are pure pass-through functions on neutral input', () => {
  // Hooks that shape plain numeric values must return the value unchanged
  // when their trigger condition doesn't apply (ctx.reason mismatch etc.).
  // ctx.sim always exists inside the real sim; a minimal stub stands in.
  const simStub = {
    state: { players: { p1: { node: 'n1' } }, minigame: null, round: 1 },
    board: { nodes: [] },
  };
  const neutralCtx = { sim: simStub, playerId: 'p1', reason: '__none__' };
  for (const def of CHARACTER_DEFS) {
    for (const name of ['onCoinsLost', 'onCoinsGained', 'onMinigameCoins']) {
      const hook = def.perk.hooks[name];
      if (!hook) continue;
      assert.equal(hook(7, neutralCtx), 7, `${def.id}.${name}: neutral input unchanged`);
    }
  }
});

test('kiko onShopPrice discounts ~10% and never breaks 1-coin prices', () => {
  const kiko = CHARACTER_DEFS.find((d) => d.id === 'kiko');
  const hook = kiko.perk.hooks.onShopPrice;
  assert.equal(hook(1), 1);
  assert.equal(hook(10), 9);
  assert.equal(hook(20), 18);
  for (let price = 2; price <= 40; price += 1) {
    const out = hook(price);
    assert.ok(out >= 1 && out < price, `discounted price ${out} in (0, ${price})`);
    assert.ok(price - out <= Math.max(1, Math.ceil(price * 0.1)), 'discount <= ~10%');
  }
});

/* ------------------------------------------------------------------ */
/* Unlocks                                                             */
/* ------------------------------------------------------------------ */

test('unlock thresholds: 10 starters at 0 + tiers 5/10/20/35/50/75', () => {
  const costs = CHARACTER_DEFS.map((d) => d.unlock.bananas);
  for (const c of costs) {
    assert.equal(typeof c, 'number');
    assert.ok(Number.isInteger(c) && c >= 0, `unlock cost ${c} is a non-negative int`);
  }
  const starters = costs.filter((c) => c === 0);
  assert.equal(starters.length, 10, '10 default characters at bananas:0');
  const paid = costs.filter((c) => c > 0).sort((a, b) => a - b);
  assert.deepEqual(paid, UNLOCK_TIERS, 'unlockables at 5/10/20/35/50/75');
});

/* ------------------------------------------------------------------ */
/* Build params, blurbs, voice, emotes                                 */
/* ------------------------------------------------------------------ */

test('build params are complete and in range for every character', () => {
  for (const def of CHARACTER_DEFS) {
    const b = def.build;
    assert.ok(b && typeof b === 'object', `${def.id}: build object`);
    assert.ok(b.scale >= 0.8 && b.scale <= 1.6, `${def.id}: scale ${b.scale} in [0.8, 1.6]`);
    assert.ok(b.armLen >= 0.8 && b.armLen <= 1.6, `${def.id}: armLen ${b.armLen} in [0.8, 1.6]`);
    assert.ok(b.potbelly >= 0 && b.potbelly <= 1, `${def.id}: potbelly ${b.potbelly} in [0, 1]`);
    assert.match(b.furColor, HEX_COLOR, `${def.id}: furColor hex`);
    assert.match(b.faceColor, HEX_COLOR, `${def.id}: faceColor hex`);
    assert.match(b.bellyColor, HEX_COLOR, `${def.id}: bellyColor hex`);
    assert.ok(EAR_STYLES.includes(b.earStyle), `${def.id}: earStyle "${b.earStyle}"`);
    assert.ok(TAIL_STYLES.includes(b.tail), `${def.id}: tail "${b.tail}"`);
    assert.ok(SNOUT_STYLES.includes(b.snout), `${def.id}: snout "${b.snout}"`);
    assert.ok(BROW_STYLES.includes(b.brow), `${def.id}: brow "${b.brow}"`);
  }
});

test('builds are varied: not all clones of one silhouette', () => {
  assert.ok(new Set(CHARACTER_DEFS.map((d) => d.build.scale)).size >= 6, 'scale variety');
  assert.ok(new Set(CHARACTER_DEFS.map((d) => d.build.furColor)).size >= 12, 'fur variety');
  assert.ok(new Set(CHARACTER_DEFS.map((d) => d.build.earStyle)).size >= 4, 'ear variety');
  assert.ok(new Set(CHARACTER_DEFS.map((d) => d.build.tail)).size >= 4, 'tail variety');
  assert.ok(new Set(CHARACTER_DEFS.map((d) => d.build.snout)).size >= 4, 'snout variety');
});

test('name, blurb, voice and emotes are well-formed', () => {
  for (const def of CHARACTER_DEFS) {
    assert.ok(def.name && typeof def.name === 'string', `${def.id}: name`);
    assert.ok(def.blurb?.en && def.blurb?.de, `${def.id}: blurb en+de`);
    assert.equal(typeof def.voice?.pitch, 'number', `${def.id}: voice.pitch`);
    assert.ok(def.voice.pitch > 0, `${def.id}: voice.pitch > 0`);
    assert.ok(def.voice.style?.length > 0, `${def.id}: voice.style`);
    assert.ok(Array.isArray(def.emotes) && def.emotes.length >= 2, `${def.id}: >=2 emotes`);
    for (const emote of def.emotes) {
      assert.ok(EMOTES.includes(emote), `${def.id}: emote "${emote}" known`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* Client modules (guarded import; three.js runs headless in Node)     */
/* ------------------------------------------------------------------ */

/** Import a src/characters module, returning null if it can't load. */
async function tryImport(path) {
  try {
    return await import(path);
  } catch {
    return null;
  }
}

const clipsMod = await tryImport('../src/characters/clips.js');
const factoryMod = await tryImport('../src/characters/monkeyFactory.js');
const animatorMod = await tryImport('../src/characters/animator.js');
const cosmeticsMod = await tryImport('../src/characters/cosmetics.js');
const indexMod = await tryImport('../src/characters/index.js');

test('src/characters modules import without throwing', () => {
  assert.ok(clipsMod, 'clips.js loads');
  assert.ok(factoryMod, 'monkeyFactory.js loads');
  assert.ok(animatorMod, 'animator.js loads');
  assert.ok(cosmeticsMod, 'cosmetics.js loads');
  assert.ok(indexMod, 'index.js loads');
  assert.equal(typeof factoryMod.buildMonkey, 'function');
  assert.equal(typeof animatorMod.createAnimator, 'function');
  assert.equal(typeof cosmeticsMod.applyCosmetics, 'function');
  assert.equal(typeof indexMod.buildCharacterPreview, 'function');
});

test('clips: data shape, looping flags, variants, emote coverage', (t) => {
  if (!clipsMod) return t.skip('clips module unavailable');
  const { CLIPS, getClip, hashId, EMOTE_CLIPS, VICTORY_VARIANTS, LOSE_VARIANTS } = clipsMod;

  assert.deepEqual([...EMOTE_CLIPS].sort(), [...EMOTES].sort());
  for (const name of ['idle', 'walk', 'run', 'jump', 'land', 'hit', 'cheer', 'sad', ...EMOTES]) {
    assert.ok(CLIPS[name], `clip "${name}" exists`);
  }
  assert.equal(VICTORY_VARIANTS, 3);
  assert.equal(LOSE_VARIANTS, 2);
  for (let i = 0; i < 3; i += 1) assert.ok(CLIPS[`victory_${i}`], `victory_${i}`);
  for (let i = 0; i < 2; i += 1) assert.ok(CLIPS[`lose_${i}`], `lose_${i}`);

  const partNames = ['root', 'torso', 'head', 'earL', 'earR', 'armL', 'armR',
    'handL', 'handR', 'legL', 'legR', 'tail', 'face'];
  for (const [name, clip] of Object.entries(CLIPS)) {
    assert.ok(clip.duration > 0, `${name}: duration > 0`);
    assert.equal(typeof clip.loop, 'boolean', `${name}: loop flag`);
    for (const [part, keys] of Object.entries(clip.tracks)) {
      assert.ok(partNames.includes(part), `${name}: track part "${part}" known`);
      assert.ok(keys.length >= 1, `${name}.${part}: has keys`);
      let prevT = -Infinity;
      for (const key of keys) {
        assert.ok(key.t >= 0 && key.t <= clip.duration, `${name}.${part}: t in [0, duration]`);
        assert.ok(key.t >= prevT, `${name}.${part}: keys sorted by t`);
        assert.ok(key.pos || key.rot || key.scale, `${name}.${part}: key has a channel`);
        prevT = key.t;
      }
    }
  }

  // idle must breathe (torso) and sway the tail; loops.
  assert.ok(CLIPS.idle.loop && CLIPS.idle.tracks.torso && CLIPS.idle.tracks.tail);

  // victory/lose resolve deterministically per character id.
  for (const id of CHARACTER_IDS) {
    assert.equal(getClip('victory', id), getClip('victory', id), `${id}: victory stable`);
    assert.equal(getClip('lose', id), getClip('lose', id), `${id}: lose stable`);
    assert.equal(getClip('victory', id), CLIPS[`victory_${hashId(id) % 3}`]);
    assert.equal(getClip('lose', id), CLIPS[`lose_${hashId(id) % 2}`]);
  }
  const victoryPicks = new Set(CHARACTER_IDS.map((id) => hashId(id) % 3));
  assert.ok(victoryPicks.size >= 2, 'roster uses more than one victory variant');
  assert.equal(getClip('nope_not_a_clip'), null);
});

test('monkeyFactory: parts contract, setPose, tri budget for all 16', (t) => {
  if (!factoryMod) return t.skip('factory module unavailable');
  const partNames = ['root', 'torso', 'head', 'earL', 'earR', 'armL', 'armR',
    'handL', 'handR', 'legL', 'legR', 'tail', 'face'];
  for (const def of CHARACTER_DEFS) {
    const monkey = factoryMod.buildMonkey(def);
    assert.ok(monkey.group?.isObject3D, `${def.id}: group is an Object3D`);
    assert.equal(typeof monkey.setPose, 'function', `${def.id}: setPose`);
    for (const part of partNames) {
      assert.ok(monkey.parts[part]?.isObject3D, `${def.id}: part "${part}"`);
      assert.ok(monkey.parts[part].userData.basePos, `${def.id}: "${part}" rest transform stored`);
    }

    let tris = 0;
    monkey.group.traverse((obj) => {
      if (!obj.isMesh) return;
      const g = obj.geometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    });
    assert.ok(tris >= 400 && tris <= 900, `${def.id}: ~500-900 tris (got ${Math.round(tris)})`);

    // setPose applies offsets and resets cleanly via 'idle'.
    const restY = monkey.parts.root.position.y;
    monkey.setPose('victory');
    assert.notEqual(monkey.parts.armL.rotation.z, monkey.parts.armL.userData.baseRot.z);
    monkey.setPose('idle');
    assert.equal(monkey.parts.root.position.y, restY, `${def.id}: idle resets root`);
  }
});

test('monkeyFactory: species differentiators change the silhouette', (t) => {
  if (!factoryMod) return t.skip('factory module unavailable');
  const byId = (id) => CHARACTER_DEFS.find((d) => d.id === id);
  const count = (monkey) => {
    let n = 0;
    monkey.group.traverse((o) => { if (o.isMesh) n += 1; });
    return n;
  };
  // Gorilla bulk: rilla scales to the top of the range.
  assert.equal(byId('rilla').build.scale, 1.6);
  // Gibbon arms are the longest in the roster.
  assert.equal(Math.max(...CHARACTER_DEFS.map((d) => d.build.armLen)), byId('gibbs').build.armLen);
  // Proboscis nose cone + howler throat sac + mandrill stripes add meshes
  // versus the same def without its species tag.
  for (const id of ['mango', 'loko', 'bongo']) {
    const def = byId(id);
    const withSpecies = count(factoryMod.buildMonkey(def));
    const without = count(factoryMod.buildMonkey({ ...def, species: 'generic' }));
    assert.ok(
      id === 'mango' ? withSpecies >= without : withSpecies > without,
      `${id}: species differentiator adds geometry (${withSpecies} vs ${without})`,
    );
  }
});

test('animator: play/update/current, looping, one-shot hold, crossfade', (t) => {
  if (!factoryMod || !animatorMod) return t.skip('modules unavailable');
  const monkey = factoryMod.buildMonkey(CHARACTER_DEFS[0]);
  const animator = animatorMod.createAnimator(monkey);
  assert.equal(animator.current, null, 'no clip before first play');

  animator.play('idle', { fade: 0 });
  assert.equal(animator.current, 'idle');
  animator.update(1.2);
  assert.ok(monkey.parts.torso.scale.y > 1, 'idle breathe scales torso at mid-clip');

  // Looping: advancing a full duration wraps instead of freezing.
  animator.update(2.4);
  assert.equal(animator.current, 'idle');

  // Crossfade: halfway through the fade the pose is between clips.
  animator.play('walk', { fade: 0.15 });
  animator.update(0.075);
  const midFade = monkey.parts.legL.rotation.x;
  animator.update(0.075);
  assert.equal(animator.current, 'walk');
  const postFade = monkey.parts.legL.rotation.x;
  assert.notEqual(midFade, postFade, 'pose keeps moving through the fade');

  // One-shot clips hold their final frame.
  animator.play('land', { fade: 0 });
  animator.update(10);
  assert.equal(animator.current, 'land');
  const heldY = monkey.parts.root.position.y;
  animator.update(1);
  assert.equal(monkey.parts.root.position.y, heldY, 'one-shot holds final frame');

  // Emote + variant playback resolve for every roster character.
  for (const def of CHARACTER_DEFS) {
    const m = factoryMod.buildMonkey(def);
    const a = animatorMod.createAnimator(m);
    for (const name of ['victory', 'lose', ...def.emotes]) {
      a.play(name, { fade: 0 });
      a.update(0.1);
      assert.equal(a.current, name, `${def.id}: "${name}" plays`);
    }
  }
});

test('cosmetics: catalog entries and slots', (t) => {
  if (!cosmeticsMod) return t.skip('cosmetics module unavailable');
  const { COSMETICS, getCosmetic, cosmeticsBySlot } = cosmeticsMod;
  assert.ok(COSMETICS.length >= 12, `>=12 catalog entries (got ${COSMETICS.length})`);
  const slots = new Set();
  const ids = new Set();
  for (const entry of COSMETICS) {
    assert.ok(entry.id?.length > 0, 'cosmetic id');
    assert.ok(!ids.has(entry.id), `cosmetic id "${entry.id}" unique`);
    ids.add(entry.id);
    assert.ok(['hat', 'glasses', 'accessory', 'skin'].includes(entry.slot), `slot "${entry.slot}"`);
    slots.add(entry.slot);
    assert.ok(entry.name?.en && entry.name?.de, `${entry.id}: name en+de`);
    assert.ok(Number.isInteger(entry.unlock?.bananas) && entry.unlock.bananas >= 0, `${entry.id}: unlock`);
  }
  assert.equal(slots.size, 4, 'all four slots covered');
  for (const id of ['pirate_hat', 'crown', 'cap', 'sunglasses', 'monocle', 'cape', 'scarf', 'gold_skin', 'neon_skin']) {
    assert.ok(getCosmetic(id), `catalog has "${id}"`);
  }
  assert.equal(getCosmetic('nope'), null);
  assert.ok(cosmeticsBySlot('hat').length >= 3, 'several hats');
  assert.ok(cosmeticsBySlot('skin').length >= 2, 'several skins');
});

test('cosmetics: applyCosmetics attaches props, re-tints skins, clears cleanly', (t) => {
  if (!factoryMod || !cosmeticsMod) return t.skip('modules unavailable');
  const monkey = factoryMod.buildMonkey(CHARACTER_DEFS[0]);
  const furMesh = (() => {
    let found = null;
    monkey.group.traverse((o) => { if (!found && o.isMesh && o.userData.tintRole === 'fur') found = o; });
    return found;
  })();
  const baseMaterial = furMesh.material;

  cosmeticsMod.applyCosmetics(monkey, {
    hat: 'pirate_hat', glasses: 'sunglasses', accessory: 'cape', skin: 'gold_skin',
  });
  assert.ok(monkey.parts.head.getObjectByName('cosmetic:hat'), 'hat attached to head');
  assert.ok(monkey.parts.face.getObjectByName('cosmetic:glasses'), 'glasses attached to face');
  assert.ok(monkey.parts.torso.getObjectByName('cosmetic:accessory'), 'accessory attached to torso');
  assert.notEqual(furMesh.material, baseMaterial, 'gold skin replaces fur material');

  // Re-applying swaps rather than stacking; clearing restores everything.
  cosmeticsMod.applyCosmetics(monkey, { hat: 'crown' });
  const hats = [];
  monkey.parts.head.traverse((o) => { if (o.name === 'cosmetic:hat') hats.push(o); });
  assert.equal(hats.length, 1, 'one hat after swap');
  assert.equal(furMesh.material, baseMaterial, 'skin removed restores base material');
  assert.equal(monkey.parts.face.getObjectByName('cosmetic:glasses'), undefined, 'glasses cleared');
});

test('buildCharacterPreview: self-rotating idle group', (t) => {
  if (!indexMod) return t.skip('index module unavailable');
  const preview = indexMod.buildCharacterPreview(CHARACTER_DEFS[0], { hat: 'cap' });
  assert.ok(preview.isObject3D);
  assert.ok(preview.userData.monkey, 'exposes monkey');
  assert.ok(preview.userData.animator, 'exposes animator');
  assert.equal(preview.userData.animator.current, 'idle', 'idles by default');
  const before = preview.rotation.y;
  preview.userData.update(0.5);
  assert.ok(preview.rotation.y > before, 'turntable rotates');
  preview.userData.dispose();
});
