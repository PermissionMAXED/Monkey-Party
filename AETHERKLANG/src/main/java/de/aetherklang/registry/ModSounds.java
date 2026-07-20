package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.sound.SoundEvent;

public final class ModSounds {
    public static final String BEAT_TICK_ID = "beat_tick";
    public static final String RESONANCE_CAST_ID = "resonance_cast";
    public static final String DISSONANZ_HIT_ID = "dissonanz_hit";
    public static final String PORTAL_HUM_ID = "portal_hum";
    public static final String CHORAL_THEME_ID = "choral_theme";
    public static final String ORGELHORN_BLAST_ID = "orgelhorn_blast";
    public static final String FERMATE_CHIME_ID = "fermate_chime";
    public static final String AKKORD_COMPLETE_ID = "akkord_complete";
    public static final String ENSEMBLE_CHIME_ID = "ensemble_chime";
    public static final String SIRENE_SONG_ID = "sirene_song";
    public static final String TAKTLING_CHIRP_ID = "taktling_chirp";
    public static final String ARCHIV_UNLOCK_ID = "archiv_unlock";
    public static final String BRUECKE_TOGGLE_ID = "bruecke_toggle";
    public static final String PAUKE_HIT_ID = "pauke_hit";
    public static final String FLOETE_TONE_ID = "floete_tone";
    public static final String KONTRABASS_NOTE_ID = "kontrabass_note";
    public static final String TRIANGEL_CHIME_ID = "triangel_chime";
    public static final String RELIKT_ACTIVATE_ID = "relikt_activate";
    public static final String BOSS_TREMOLO_ID = "boss_tremolo";
    public static final String BOSS_GLISSANDA_ID = "boss_glissanda";
    public static final String BOSS_KAKOPHON_ID = "boss_kakophon";
    public static final String BOSS_GENERALPAUSE_ID = "boss_generalpause";
    public static final String BOSS_OSTINATO_ID = "boss_ostinato";
    public static final String BOSS_RITARDANDO_ID = "boss_ritardando";
    public static final String BOSS_NOVA_ID = "boss_nova";
    public static final String ARENA_FANFARE_ID = "arena_fanfare";
    public static final String REGION_ENTER_ID = "region_enter";

    public static final SoundEvent BEAT_TICK = register(BEAT_TICK_ID);
    public static final SoundEvent RESONANCE_CAST = register(RESONANCE_CAST_ID);
    public static final SoundEvent DISSONANZ_HIT = register(DISSONANZ_HIT_ID);
    public static final SoundEvent PORTAL_HUM = register(PORTAL_HUM_ID);
    public static final SoundEvent CHORAL_THEME = register(CHORAL_THEME_ID);
    public static final SoundEvent ORGELHORN_BLAST = register(ORGELHORN_BLAST_ID);
    public static final SoundEvent FERMATE_CHIME = register(FERMATE_CHIME_ID);
    public static final SoundEvent AKKORD_COMPLETE = register(AKKORD_COMPLETE_ID);
    public static final SoundEvent ENSEMBLE_CHIME = register(ENSEMBLE_CHIME_ID);
    public static final SoundEvent SIRENE_SONG = register(SIRENE_SONG_ID);
    public static final SoundEvent TAKTLING_CHIRP = register(TAKTLING_CHIRP_ID);
    public static final SoundEvent ARCHIV_UNLOCK = register(ARCHIV_UNLOCK_ID);
    public static final SoundEvent BRUECKE_TOGGLE = register(BRUECKE_TOGGLE_ID);
    public static final SoundEvent PAUKE_HIT = register(PAUKE_HIT_ID);
    public static final SoundEvent FLOETE_TONE = register(FLOETE_TONE_ID);
    public static final SoundEvent KONTRABASS_NOTE = register(KONTRABASS_NOTE_ID);
    public static final SoundEvent TRIANGEL_CHIME = register(TRIANGEL_CHIME_ID);
    public static final SoundEvent RELIKT_ACTIVATE = register(RELIKT_ACTIVATE_ID);
    public static final SoundEvent BOSS_TREMOLO = register(BOSS_TREMOLO_ID);
    public static final SoundEvent BOSS_GLISSANDA = register(BOSS_GLISSANDA_ID);
    public static final SoundEvent BOSS_KAKOPHON = register(BOSS_KAKOPHON_ID);
    public static final SoundEvent BOSS_GENERALPAUSE = register(BOSS_GENERALPAUSE_ID);
    public static final SoundEvent BOSS_OSTINATO = register(BOSS_OSTINATO_ID);
    public static final SoundEvent BOSS_RITARDANDO = register(BOSS_RITARDANDO_ID);
    public static final SoundEvent BOSS_NOVA = register(BOSS_NOVA_ID);
    public static final SoundEvent ARENA_FANFARE = register(ARENA_FANFARE_ID);
    public static final SoundEvent REGION_ENTER = register(REGION_ENTER_ID);

    private ModSounds() {
    }

    private static SoundEvent register(String path) {
        var id = Aetherklang.id(path);
        return Registry.register(Registries.SOUND_EVENT, id, SoundEvent.of(id));
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered {} Aetherklang sound events", 27);
    }
}
