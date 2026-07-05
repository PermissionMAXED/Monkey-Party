/**
 * Character select: grid of the 16 monkeys (characters registry) with a
 * live 3D turntable preview (buildCharacterPreview rendered by ONE shared
 * small renderer), perk panel, cosmetics drawer with banana unlocks, and
 * per-local-seat selection tabs for couch mode.
 *
 * Banana economy: locked characters/cosmetics show their cost; unlocking
 * deducts from profile.goldenBananas (tracked in profile.bananasSpent) and
 * appends to unlockedCharacters/unlockedCosmetics. Unlocks only gate what
 * LOCAL players can pick - bots and remote players are unaffected. An
 * unaffordable tap shakes the item and plays the buzzer.
 */

import * as THREE from 'three';
import { COSMETICS, cosmeticsBySlot, applyCosmetics } from '../characters/cosmetics.js';
import { buildCharacterPreview } from '../characters/index.js';
import { t, localized, onLangChange } from './i18n.js';
import { el, div, button, clearNode, portraitImg, toast, playSfx } from './dom.js';

const SLOTS = ['hat', 'glasses', 'accessory', 'skin'];

/* ------------------------------------------------------------------ */
/* ONE shared small preview renderer (reused across mounts)            */
/* ------------------------------------------------------------------ */

let preview = null;

function getPreviewRenderer() {
  if (preview) return preview;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(420, 280, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfeee2, 0x2a3a24, 1.2));
  const key = new THREE.DirectionalLight(0xfff2d8, 2.0);
  key.position.set(3, 6, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(38, 420 / 280, 0.1, 50);
  camera.position.set(0, 1.15, 3.3);
  camera.lookAt(0, 0.95, 0);
  const slot = new THREE.Group();
  scene.add(slot);

  let raf = 0;
  let last = 0;
  let running = false;
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    for (const child of slot.children) child.userData?.update?.(dt);
    renderer.render(scene, camera);
  }

  preview = {
    canvas,
    show(def, cosmetics) {
      for (const child of [...slot.children]) {
        child.userData?.dispose?.();
        slot.remove(child);
      }
      if (!def) return;
      try {
        const g = buildCharacterPreview(def, cosmetics);
        slot.add(g);
      } catch (err) {
        console.warn('[ui:charselect] preview failed:', err);
      }
    },
    applyLoadout(loadout) {
      const g = slot.children[0];
      const monkey = g?.userData?.monkey;
      if (monkey) {
        try {
          applyCosmetics(monkey, loadout);
        } catch { /* cosmetics are optional */ }
      }
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
  return preview;
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

const FILTERS = ['all', 'owned', 'locked'];
const FILTER_LABEL_KEYS = {
  all: 'char.filter.all',
  owned: 'char.filter.owned',
  locked: 'char.filter.locked',
};

export function createCharSelectScreen(ctx) {
  let root = null;
  let unsubs = [];
  /** pid -> {charId, cosmetics:{hat,glasses,accessory,skin}} */
  let picks = new Map();
  let humanPids = [];
  let activePid = null;
  /** Character-grid ownership filter: 'all' | 'owned' | 'locked'. */
  let gridFilter = 'all';

  const session = () => ctx.session;

  /* ---------------- unlock helpers ---------------- */

  function charUnlocked(def) {
    const cost = def?.unlock?.bananas ?? 0;
    if (cost <= 0) return true;
    return ctx.profile.get().unlockedCharacters.includes(def.id);
  }

  function cosmeticUnlocked(c) {
    if ((c?.unlock?.bananas ?? 0) <= 0) return true;
    return ctx.profile.get().unlockedCosmetics.includes(c.id);
  }

  /** Shake an unaffordable item (WAAPI, so no extra CSS is needed). */
  function shake(node) {
    node?.animate?.([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-7px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(3px)' },
      { transform: 'translateX(0)' },
    ], { duration: 320, easing: 'ease-out' });
  }

  /**
   * Spend bananas on an unlock. Deducts from the bank into bananasSpent
   * and appends to the matching unlocked list. On an unaffordable tap the
   * tapped element shakes and the buzzer plays.
   */
  function tryUnlock(kind, id, cost, node = null) {
    const profile = ctx.profile.get();
    if (profile.goldenBananas < cost) {
      toast(`🔒 ${t('char.cost', { n: cost })}`, 'error');
      playSfx('buzzer', { vol: 0.5 });
      shake(node);
      return false;
    }
    const listKey = kind === 'char' ? 'unlockedCharacters' : 'unlockedCosmetics';
    ctx.profile.set({
      goldenBananas: profile.goldenBananas - cost,
      bananasSpent: profile.bananasSpent + cost,
      [listKey]: [...profile[listKey], id],
    });
    playSfx('fanfare', { vol: 0.6 });
    toast(t('char.unlocked'), 'success');
    return true;
  }

  /* ---------------- selection state ---------------- */

  function pickOf(pid) {
    let p = picks.get(pid);
    if (!p) {
      p = {
        charId: null,
        cosmetics: {
          hat: null, glasses: null, accessory: null, skin: null,
        },
      };
      picks.set(pid, p);
    }
    return p;
  }

  function commit(pid) {
    const p = pickOf(pid);
    if (!p.charId) return;
    try {
      session()?.selectCharacter(pid, p.charId, p.cosmetics);
    } catch (err) {
      toast(err?.message ?? String(err), 'error');
    }
  }

  function showPreview() {
    const p = pickOf(activePid);
    const def = p.charId ? ctx.registries.characters.get(p.charId) : ctx.registries.characters.all()[0];
    getPreviewRenderer().show(def, p.cosmetics);
  }

  /* ---------------- pieces ---------------- */

  function seatTabs(lobby) {
    const wrap = div('seat-tabs');
    if (humanPids.length <= 1) return wrap;
    for (const pid of humanPids) {
      const seat = lobby.seats.find((s) => s.pid === pid);
      const p = pickOf(pid);
      const tab = el('button', `seat-tab${pid === activePid ? ' seat-tab--on' : ''}${p.charId ? ' seat-tab--done' : ''}`);
      tab.type = 'button';
      tab.textContent = seat?.name ?? pid;
      tab.addEventListener('click', () => {
        playSfx('click');
        activePid = pid;
        render();
        showPreview();
      });
      wrap.appendChild(tab);
    }
    return wrap;
  }

  function takenBy(defId, lobby) {
    // Show which OTHER seat already picked this monkey (duplicates allowed,
    // this is purely informative).
    const seat = lobby.seats.find((s) => s.pid !== activePid && s.characterId === defId);
    return seat?.name ?? null;
  }

  function charCell(def, lobby) {
    const p = pickOf(activePid);
    const unlocked = charUnlocked(def);
    const cost = def?.unlock?.bananas ?? 0;
    const cell = el('button', `char-cell${p.charId === def.id ? ' char-cell--selected' : ''}${unlocked ? '' : ' char-cell--locked'}`);
    cell.type = 'button';
    cell.appendChild(portraitImg(def, 48));
    cell.appendChild(div('char-cell__name', def.name));
    if (!unlocked) {
      cell.appendChild(div('char-cell__lock', '🔒'));
      cell.appendChild(div('char-cell__cost', `${cost} 🍌`));
    }
    const taken = takenBy(def.id, lobby);
    if (taken) cell.appendChild(div('char-cell__taken', taken));
    cell.title = `${def.name} — ${localized(def.perk?.description)}`;

    cell.addEventListener('click', () => {
      if (!unlocked && !tryUnlock('char', def.id, cost, cell)) return;
      p.charId = def.id;
      commit(activePid);
      playSfx('pop');
      render();
      showPreview();
    });
    return cell;
  }

  function cosmeticsDrawer() {
    const p = pickOf(activePid);
    const wrap = div('cosmetic-drawer');
    for (const slot of SLOTS) {
      wrap.appendChild(el('div', 'ui-section-label', t(`char.slot.${slot}`)));
      const row = div('cosmetic-row');

      const setSlot = (value) => {
        p.cosmetics[slot] = value;
        commit(activePid);
        getPreviewRenderer().applyLoadout(p.cosmetics);
        render();
      };

      const noneChip = el('button', `cosmetic-chip${p.cosmetics[slot] == null ? ' cosmetic-chip--on' : ''}`);
      noneChip.type = 'button';
      noneChip.textContent = t('char.none');
      noneChip.addEventListener('click', () => {
        playSfx('click');
        setSlot(null);
      });
      row.appendChild(noneChip);

      for (const c of cosmeticsBySlot(slot)) {
        const unlocked = cosmeticUnlocked(c);
        const on = p.cosmetics[slot] === c.id;
        const chip = el('button', `cosmetic-chip${on ? ' cosmetic-chip--on' : ''}${unlocked ? '' : ' cosmetic-chip--locked'}`);
        chip.type = 'button';
        chip.textContent = unlocked ? localized(c.name) : `🔒 ${localized(c.name)}`;
        if (!unlocked) {
          chip.appendChild(el('span', 'cosmetic-chip__cost', ` ${c.unlock.bananas}🍌`));
        }
        chip.addEventListener('click', () => {
          playSfx('click');
          if (!unlocked && !tryUnlock('cosmetic', c.id, c.unlock.bananas, chip)) return;
          setSlot(on ? null : c.id);
        });
        row.appendChild(chip);
      }
      wrap.appendChild(row);
    }
    return wrap;
  }

  /* ---------------- render ---------------- */

  function render() {
    if (!root) return;
    clearNode(root);
    const s = session();
    if (!s) {
      ctx.router.go('mainMenu');
      return;
    }
    const lobby = s.getLobby();
    if (!lobby) return;

    const wrap = div('ui-screen');
    const head = div('ui-row');
    head.style.width = 'min(1220px, 96vw)';
    head.style.justifyContent = 'space-between';
    const seat = lobby.seats.find((x) => x.pid === activePid);

    /* Prominent banana-bank balance (the unlock currency wallet). */
    const bank = div('shop-wallet');
    bank.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:2px;margin-bottom:0;';
    const bankValue = el('b', '', `🍌 ${ctx.profile.get().goldenBananas}`);
    bankValue.style.cssText = 'font-size:1.35rem;line-height:1;text-shadow:0 2px 6px rgba(0,0,0,0.55);';
    const bankLabel = el('span', 'ui-dim', t('char.bank'));
    bankLabel.style.cssText = 'font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;';
    bank.append(bankValue, bankLabel);

    head.append(
      el('h1', 'ui-heading', humanPids.length > 1 && seat
        ? t('char.seatPicks', { name: seat.name })
        : t('char.title')),
      bank,
    );
    wrap.appendChild(head);
    const tabs = seatTabs(lobby);
    if (tabs.childElementCount > 0) wrap.appendChild(tabs);

    const layout = div('char-layout');

    /* Left: the 16-grid with an owned/locked filter. */
    const left = div('ui-panel');
    const filterRow = div('ui-row');
    filterRow.style.cssText = 'justify-content:flex-start;gap:6px;margin-bottom:8px;';
    for (const f of FILTERS) {
      const chip = el('button', `preset-chip${gridFilter === f ? ' preset-chip--on' : ''}`, t(FILTER_LABEL_KEYS[f]));
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(gridFilter === f));
      chip.addEventListener('click', () => {
        if (gridFilter === f) return;
        playSfx('click');
        gridFilter = f;
        render();
      });
      filterRow.appendChild(chip);
    }
    left.appendChild(filterRow);
    const grid = div('char-grid');
    const defs = ctx.registries.characters.all().filter((def) => {
      if (gridFilter === 'owned') return charUnlocked(def);
      if (gridFilter === 'locked') return !charUnlocked(def);
      return true;
    });
    for (const def of defs) grid.appendChild(charCell(def, lobby));
    if (defs.length === 0) grid.appendChild(div('ui-dim', t('char.filterEmpty')));
    left.appendChild(grid);
    layout.appendChild(left);

    /* Right: live 3D preview + perk + cosmetics. */
    const right = div('ui-panel');
    right.style.display = 'flex';
    right.style.flexDirection = 'column';
    right.style.gap = '10px';
    const previewBox = div('char-preview');
    previewBox.appendChild(getPreviewRenderer().canvas);
    right.appendChild(previewBox);

    const p = pickOf(activePid);
    const def = p.charId ? ctx.registries.characters.get(p.charId) : null;
    if (def) {
      const perk = div('char-perk');
      perk.append(
        el('b', '', `${t('char.perk')}: ${def.perk?.id ?? '—'} `),
        el('div', '', localized(def.perk?.description)),
        el('div', 'ui-dim', localized(def.blurb)),
      );
      right.appendChild(perk);
    }

    right.appendChild(el('div', 'ui-section-label', t('char.cosmetics')));
    right.appendChild(cosmeticsDrawer());
    layout.appendChild(right);
    wrap.appendChild(layout);

    /* Bottom actions */
    const actions = div('ui-row');
    const idx = humanPids.indexOf(activePid);
    const allPicked = humanPids.every((pid) => pickOf(pid).charId);
    if (humanPids.length > 1 && idx < humanPids.length - 1) {
      const nextBtn = button(`${t('generic.continue')} ›`, 'ui-btn--wood', () => {
        activePid = humanPids[idx + 1];
        render();
        showPreview();
      });
      nextBtn.disabled = !pickOf(activePid).charId;
      actions.appendChild(nextBtn);
    }
    const doneBtn = button(t('char.done'), allPicked ? 'ui-btn--green ui-btn--big' : 'ui-btn--wood', () => {
      for (const pid of humanPids) commit(pid);
      ctx.router.go('lobby');
    });
    actions.appendChild(doneBtn);
    wrap.appendChild(actions);

    root.appendChild(wrap);
  }

  return {
    mount(elHost) {
      root = elHost;
      gridFilter = 'all';
      const s = session();
      const lobby = s?.getLobby();
      if (!s || !lobby) {
        ctx.router.go('mainMenu');
        return;
      }
      const locals = s.localSeats();
      humanPids = lobby.seats
        .filter((seat) => !seat.isBot && locals.has(seat.pid))
        .map((seat) => seat.pid);
      if (humanPids.length === 0) {
        humanPids = lobby.seats.filter((seat) => !seat.isBot).map((seat) => seat.pid);
      }
      activePid = humanPids[0] ?? null;
      // Seed picks from what the lobby already knows.
      picks = new Map();
      for (const seat of lobby.seats) {
        if (seat.characterId) {
          picks.set(seat.pid, {
            charId: seat.characterId,
            cosmetics: {
              hat: null, glasses: null, accessory: null, skin: null, ...(seat.cosmetics ?? {}),
            },
          });
        }
      }
      render();
      getPreviewRenderer().start();
      showPreview();
      unsubs.push(onLangChange(render));
      ctx.stage.menu(ctx.registries.characters.all().slice(0, 3));
      ctx.music.play('menu');
    },
    unmount() {
      for (const off of unsubs) {
        try {
          off();
        } catch { /* gone */ }
      }
      unsubs = [];
      getPreviewRenderer().stop();
      root = null;
    },
  };
}

export default createCharSelectScreen;

// Re-exported for other screens/tests that need the catalog.
export { COSMETICS };
