/**
 * Tiny en/de i18n for the UI package (P9).
 *
 * initI18n(settingsStore) binds the active language to the settings store
 * ('language' field). t(key, vars) resolves a key from the dictionary and
 * interpolates {placeholders}. localized(obj) picks .en/.de from content
 * LocalizedText objects. onLangChange(cb) re-renders language-sensitive UI.
 * extendDict(entries) lets optional UI packages (help, progression, ...)
 * merge their own {key: {en, de}} maps into the dictionary.
 */

const DICT = {
  /* ---------- generic ---------- */
  'app.title': { en: 'MONKEY PARTY', de: 'MONKEY PARTY' },
  'app.tagline': { en: 'Bananas. Boards. Mayhem.', de: 'Bananen. Bretter. Chaos.' },
  'generic.back': { en: 'Back', de: 'Zurück' },
  'generic.close': { en: 'Close', de: 'Schließen' },
  'generic.continue': { en: 'Continue', de: 'Weiter' },
  'generic.cancel': { en: 'Cancel', de: 'Abbrechen' },
  'generic.save': { en: 'Save', de: 'Speichern' },
  'generic.yes': { en: 'Yes', de: 'Ja' },
  'generic.no': { en: 'No', de: 'Nein' },
  'generic.on': { en: 'On', de: 'An' },
  'generic.off': { en: 'Off', de: 'Aus' },
  'generic.coins': { en: 'Coins', de: 'Münzen' },
  'generic.bananas': { en: 'Golden Bananas', de: 'Goldene Bananen' },
  'generic.round': { en: 'Round', de: 'Runde' },
  'generic.player': { en: 'Player', de: 'Spieler' },
  'generic.bot': { en: 'Bot', de: 'Bot' },
  'generic.locked': { en: 'Locked', de: 'Gesperrt' },
  'generic.unlock': { en: 'Unlock', de: 'Freischalten' },

  /* ---------- main menu ---------- */
  'menu.local': { en: 'Local Game', de: 'Lokales Spiel' },
  'menu.local.sub': { en: 'Couch party, 1-8 seats', de: 'Couch-Party, 1-8 Plätze' },
  'menu.online': { en: 'Online', de: 'Online' },
  'menu.online.sub': { en: 'Play over the internet', de: 'Übers Internet spielen' },
  'menu.stats': { en: 'Statistics', de: 'Statistiken' },
  'menu.settings': { en: 'Settings', de: 'Einstellungen' },
  'menu.quick': { en: 'Quick Match', de: 'Schnelles Spiel' },
  'menu.browser': { en: 'Lobby Browser', de: 'Lobby-Browser' },
  'menu.private': { en: 'Create Private Lobby', de: 'Private Lobby erstellen' },
  'menu.joinCode': { en: 'Join with Code', de: 'Code beitreten' },
  'menu.codePrompt': { en: 'Lobby code', de: 'Lobby-Code' },
  'menu.join': { en: 'Join', de: 'Beitreten' },
  'menu.connecting': { en: 'Connecting…', de: 'Verbinde…' },
  'menu.connectFail': { en: 'Could not reach the server. Is it running? (npm run server)', de: 'Server nicht erreichbar. Läuft er? (npm run server)' },

  /* ---------- local setup ---------- */
  'local.title': { en: 'Local Game', de: 'Lokales Spiel' },
  'local.players': { en: 'Local players', de: 'Lokale Spieler' },
  'local.seat': { en: 'Seat {n}', de: 'Platz {n}' },
  'local.name': { en: 'Name', de: 'Name' },
  'local.device': { en: 'Device', de: 'Gerät' },
  'local.noDevice': { en: 'No free device', de: 'Kein freies Gerät' },
  'local.hint': { en: 'Empty seats are filled with bots when the match starts.', de: 'Leere Plätze werden beim Start mit Bots gefüllt.' },
  'local.start': { en: 'To the Lobby', de: 'Zur Lobby' },

  /* ---------- lobby ---------- */
  'lobby.title': { en: 'Lobby', de: 'Lobby' },
  'lobby.offline': { en: 'Couch Lobby', de: 'Couch-Lobby' },
  'lobby.online': { en: 'Online Lobby', de: 'Online-Lobby' },
  'lobby.code': { en: 'Code', de: 'Code' },
  'lobby.seats': { en: 'Seats', de: 'Plätze' },
  'lobby.ready': { en: 'Ready', de: 'Bereit' },
  'lobby.notReady': { en: 'Not ready', de: 'Nicht bereit' },
  'lobby.addBot': { en: '+ Add Bot', de: '+ Bot hinzufügen' },
  'lobby.kick': { en: 'Kick', de: 'Kicken' },
  'lobby.board': { en: 'Board', de: 'Spielbrett' },
  'lobby.rules': { en: 'Rules', de: 'Regeln' },
  'lobby.editRules': { en: 'Edit Rules', de: 'Regeln bearbeiten' },
  'lobby.chooseChar': { en: 'Choose Characters', de: 'Charaktere wählen' },
  'lobby.start': { en: 'Start Game!', de: 'Spiel starten!' },
  'lobby.starting': { en: 'Starting…', de: 'Startet…' },
  'lobby.leave': { en: 'Leave Lobby', de: 'Lobby verlassen' },
  'lobby.chat': { en: 'Chat', de: 'Chat' },
  'lobby.chatSend': { en: 'Send', de: 'Senden' },
  'lobby.chatPlaceholder': { en: 'Say something…', de: 'Sag was…' },
  'lobby.emoteHint': { en: 'Hold Tab for the emote wheel', de: 'Tab halten für das Emote-Rad' },
  'lobby.difficulty.easy': { en: 'Easy', de: 'Leicht' },
  'lobby.difficulty.normal': { en: 'Normal', de: 'Normal' },
  'lobby.difficulty.hard': { en: 'Hard', de: 'Schwer' },
  'lobby.difficulty.wild': { en: 'Wild', de: 'Wild' },
  'lobby.rulesSummary': { en: '{rounds} rounds · star {star}c · minigame every {mg}', de: '{rounds} Runden · Stern {star}M · Minispiel alle {mg}' },

  /* ---------- lobby browser ---------- */
  'browser.title': { en: 'Public Lobbies', de: 'Öffentliche Lobbys' },
  'browser.refresh': { en: 'Refresh', de: 'Aktualisieren' },
  'browser.join': { en: 'Join', de: 'Beitreten' },
  'browser.empty': { en: 'No public lobbies right now. Create one!', de: 'Gerade keine öffentlichen Lobbys. Erstell doch eine!' },
  'browser.host': { en: 'Host', de: 'Host' },
  'browser.players': { en: 'Players', de: 'Spieler' },

  /* ---------- rules editor ---------- */
  'rules.title': { en: 'Match Rules', de: 'Spielregeln' },
  'rules.presets': { en: 'Presets', de: 'Vorlagen' },
  'rules.preset.party': { en: 'Party', de: 'Party' },
  'rules.preset.fast': { en: 'Fast', de: 'Schnell' },
  'rules.preset.chaos': { en: 'Chaos', de: 'Chaos' },
  'rules.preset.hardcore': { en: 'Hardcore', de: 'Hardcore' },
  'rules.preset.competitive': { en: 'Competitive', de: 'Kompetitiv' },
  'rules.rounds': { en: 'Rounds', de: 'Runden' },
  'rules.maxSeats': { en: 'Max seats', de: 'Max. Plätze' },
  'rules.botsFill': { en: 'Bots fill empty seats', de: 'Bots füllen leere Plätze' },
  'rules.botDifficulty': { en: 'Bot difficulty', de: 'Bot-Schwierigkeit' },
  'rules.minigameEvery': { en: 'Minigame every N rounds (0 = never)', de: 'Minispiel alle N Runden (0 = nie)' },
  'rules.minigameCategories': { en: 'Minigame categories', de: 'Minispiel-Kategorien' },
  'rules.items': { en: 'Item mode', de: 'Item-Modus' },
  'rules.items.normal': { en: 'Normal', de: 'Normal' },
  'rules.items.off': { en: 'Off', de: 'Aus' },
  'rules.items.infinite': { en: 'Infinite', de: 'Unendlich' },
  'rules.items.allSame': { en: 'All the same', de: 'Alle gleich' },
  'rules.bananaMultiplier': { en: 'Banana multiplier', de: 'Bananen-Multiplikator' },
  'rules.traps': { en: 'Traps', de: 'Fallen' },
  'rules.randomEvents': { en: 'Random events', de: 'Zufallsereignisse' },
  'rules.chaosMode': { en: 'Chaos mode', de: 'Chaos-Modus' },
  'rules.fastMode': { en: 'Fast mode', de: 'Schnell-Modus' },
  'rules.hardcore': { en: 'Hardcore', de: 'Hardcore' },
  'rules.competitive': { en: 'Competitive', de: 'Kompetitiv' },
  'rules.starPrice': { en: 'Star price', de: 'Sternpreis' },
  'rules.startCoins': { en: 'Starting coins', de: 'Startmünzen' },
  'rules.startItems': { en: 'Starting items', de: 'Start-Items' },
  'rules.lockedByCompetitive': { en: 'Locked by competitive mode', de: 'Durch Kompetitiv-Modus gesperrt' },
  'rules.allCategories': { en: 'All', de: 'Alle' },

  /* ---------- character select ---------- */
  'char.title': { en: 'Choose your Monkey', de: 'Wähle deinen Affen' },
  'char.perk': { en: 'Perk', de: 'Vorteil' },
  'char.cosmetics': { en: 'Cosmetics', de: 'Kosmetik' },
  'char.slot.hat': { en: 'Hats', de: 'Hüte' },
  'char.slot.glasses': { en: 'Glasses', de: 'Brillen' },
  'char.slot.accessory': { en: 'Accessories', de: 'Accessoires' },
  'char.slot.skin': { en: 'Skins', de: 'Skins' },
  'char.none': { en: 'None', de: 'Keins' },
  'char.confirm': { en: 'Pick {name}!', de: '{name} nehmen!' },
  'char.done': { en: 'Back to Lobby', de: 'Zurück zur Lobby' },
  'char.cost': { en: '{n} bananas', de: '{n} Bananen' },
  'char.unlocked': { en: 'Unlocked!', de: 'Freigeschaltet!' },
  'char.seatPicks': { en: '{name} picks…', de: '{name} wählt…' },

  /* ---------- HUD / match ---------- */
  'hud.turn': { en: "{name}'s turn", de: '{name} ist dran' },
  'hud.round': { en: 'Round {r}/{max}', de: 'Runde {r}/{max}' },
  'hud.items': { en: 'Items', de: 'Items' },
  'hud.you': { en: 'YOU', de: 'DU' },
  'hud.quit': { en: 'Quit match', de: 'Spiel verlassen' },
  'hud.quitConfirm': { en: 'Leave the match and return to the menu?', de: 'Spiel verlassen und zurück zum Menü?' },
  'hud.phase.turn_start': { en: 'Turn start', de: 'Zugbeginn' },
  'hud.phase.item': { en: 'Item phase', de: 'Item-Phase' },
  'hud.phase.roll': { en: 'Roll phase', de: 'Würfel-Phase' },
  'hud.phase.move': { en: 'Moving', de: 'Bewegung' },
  'hud.phase.field': { en: 'Field', de: 'Feld' },
  'hud.phase.shop': { en: 'Shop', de: 'Laden' },
  'hud.phase.minigame_select': { en: 'Minigame…', de: 'Minispiel…' },
  'hud.phase.minigame': { en: 'Minigame!', de: 'Minispiel!' },
  'hud.phase.round_end': { en: 'Round end', de: 'Rundenende' },
  'hud.phase.bonus': { en: 'Bonus', de: 'Bonus' },
  'hud.phase.game_over': { en: 'Game over', de: 'Spielende' },

  /* ---------- prompts ---------- */
  'prompt.roll': { en: 'Roll the dice!', de: 'Würfeln!' },
  'prompt.rollHint': { en: '…or use an item first', de: '…oder erst ein Item benutzen' },
  'prompt.junction': { en: 'Which way?', de: 'Wohin?' },
  'prompt.buyStar': { en: 'Buy a Golden Banana for {price} coins?', de: 'Goldene Banane für {price} Münzen kaufen?' },
  'prompt.buy': { en: 'Buy!', de: 'Kaufen!' },
  'prompt.decline': { en: 'No thanks', de: 'Nein danke' },
  'prompt.shop': { en: 'Monkey Shop', de: 'Affen-Laden' },
  'prompt.shopLeave': { en: 'Leave shop', de: 'Laden verlassen' },
  'prompt.itemTarget': { en: 'Choose a target', de: 'Ziel wählen' },
  'prompt.itemTargetCancel': { en: 'Cancel item', de: 'Item abbrechen' },
  'prompt.dicePick': { en: 'Pick your die', de: 'Wähl deinen Würfel' },
  'prompt.useItem': { en: 'Use item', de: 'Item benutzen' },

  /* ---------- minigame ---------- */
  'mg.incoming': { en: 'MINIGAME TIME!', de: 'MINISPIEL-ZEIT!' },
  'mg.spinning': { en: 'Picking a game…', de: 'Spiel wird gewählt…' },
  'mg.howto': { en: 'How to play', de: 'So geht’s' },
  'mg.controls': { en: 'Controls', de: 'Steuerung' },
  'mg.go': { en: "Let's go!", de: 'Los geht’s!' },
  'mg.results': { en: 'Minigame Results', de: 'Minispiel-Ergebnis' },
  'mg.standings': { en: 'Standings after round {r}', de: 'Stand nach Runde {r}' },
  'mg.place.1': { en: '1st', de: '1.' },
  'mg.place.2': { en: '2nd', de: '2.' },
  'mg.place.3': { en: '3rd', de: '3.' },
  'mg.place.n': { en: '{n}th', de: '{n}.' },

  /* ---------- victory / stats ---------- */
  'victory.bonusTitle': { en: 'Bonus Bananas!', de: 'Bonus-Bananen!' },
  'victory.winner': { en: '{name} wins the party!', de: '{name} gewinnt die Party!' },
  'victory.toStats': { en: 'Match Stats', de: 'Spiel-Statistik' },
  'stats.title': { en: 'Statistics', de: 'Statistiken' },
  'stats.match': { en: 'Match Results', de: 'Spielergebnis' },
  'stats.lifetime': { en: 'Lifetime Stats', de: 'Gesamtstatistik' },
  'stats.gamesPlayed': { en: 'Games played', de: 'Spiele gespielt' },
  'stats.gamesWon': { en: 'Games won', de: 'Spiele gewonnen' },
  'stats.minigamesPlayed': { en: 'Minigames played', de: 'Minispiele gespielt' },
  'stats.minigamesWon': { en: 'Minigames won', de: 'Minispiele gewonnen' },
  'stats.coinsEarned': { en: 'Coins earned', de: 'Münzen verdient' },
  'stats.starsCollected': { en: 'Golden bananas', de: 'Goldene Bananen' },
  'stats.bananaBank': { en: 'Banana bank (unlocks)', de: 'Bananen-Konto (Freischaltungen)' },
  'stats.toMenu': { en: 'Back to Menu', de: 'Zurück zum Menü' },
  'stats.col.player': { en: 'Player', de: 'Spieler' },
  'stats.col.bananas': { en: 'Bananas', de: 'Bananen' },
  'stats.col.coins': { en: 'Coins', de: 'Münzen' },
  'stats.col.mgWins': { en: 'MG wins', de: 'MS-Siege' },
  'stats.col.itemsUsed': { en: 'Items used', de: 'Items benutzt' },
  'stats.col.fields': { en: 'Fields moved', de: 'Felder gezogen' },

  /* ---------- settings ---------- */
  'settings.title': { en: 'Settings', de: 'Einstellungen' },
  'settings.masterVolume': { en: 'Master volume', de: 'Gesamtlautstärke' },
  'settings.musicVolume': { en: 'Music volume', de: 'Musiklautstärke' },
  'settings.sfxVolume': { en: 'SFX volume', de: 'Effektlautstärke' },
  'settings.quality': { en: 'Graphics quality', de: 'Grafikqualität' },
  'settings.quality.low': { en: 'Low', de: 'Niedrig' },
  'settings.quality.med': { en: 'Medium', de: 'Mittel' },
  'settings.quality.high': { en: 'High', de: 'Hoch' },
  'settings.language': { en: 'Language', de: 'Sprache' },
  'settings.colorblind': { en: 'Colorblind assist', de: 'Farbenblind-Hilfe' },
  'settings.controls': { en: 'Controls per seat', de: 'Steuerung pro Platz' },
  'settings.resetData': { en: 'Reset all data', de: 'Alle Daten zurücksetzen' },
  'settings.resetConfirm': { en: 'Really reset settings AND profile?', de: 'Wirklich Einstellungen UND Profil zurücksetzen?' },
  'settings.playerName': { en: 'Player name', de: 'Spielername' },
};

/**
 * Merge a {key: {en: string, de: string}} map into the dictionary. Used by
 * optional UI packages to register their strings at load time. Later
 * registrations win; overwriting an existing key logs a console.warn so
 * accidental collisions between packages are visible during dev.
 *
 * @param {Object<string, {en: string, de: string}>} entries
 */
export function extendDict(entries) {
  if (entries === null || typeof entries !== 'object') return;
  for (const [key, value] of Object.entries(entries)) {
    if (value === null || typeof value !== 'object') continue;
    if (Object.prototype.hasOwnProperty.call(DICT, key)) {
      console.warn(`[i18n] extendDict: key "${key}" already registered - later registration wins`);
    }
    DICT[key] = value;
  }
}

let lang = 'en';
let store = null;
const listeners = new Set();

/** Bind the language to the settings store and keep it in sync. */
export function initI18n(settingsStore) {
  store = settingsStore ?? null;
  const stored = store?.get?.()?.language;
  if (stored === 'en' || stored === 'de') lang = stored;
  store?.subscribe?.((s) => {
    if ((s.language === 'en' || s.language === 'de') && s.language !== lang) {
      lang = s.language;
      for (const cb of [...listeners]) {
        try {
          cb(lang);
        } catch (err) {
          console.error('[i18n] listener threw:', err);
        }
      }
    }
  });
}

/** @returns {'en'|'de'} */
export function getLang() {
  return lang;
}

/** Set the language (persists through the settings store when bound). */
export function setLang(next) {
  if (next !== 'en' && next !== 'de') return;
  if (store?.set) {
    store.set({ language: next }); // subscription above updates `lang` + notifies
  } else {
    lang = next;
    for (const cb of [...listeners]) cb(lang);
  }
}

/**
 * Subscribe to language changes.
 * @returns {() => void} unsubscribe
 */
export function onLangChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Translate a key with optional {var} interpolation.
 * Unknown keys return the key itself (visible during dev, never crashes).
 */
export function t(key, vars = null) {
  const entry = DICT[key];
  let text = entry ? (entry[lang] ?? entry.en) : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Pick the active language from a content LocalizedText ({en,de}). */
export function localized(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj.en ?? '';
}

export default t;
