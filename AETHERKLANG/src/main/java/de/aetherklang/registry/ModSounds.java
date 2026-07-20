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

    private ModSounds() {
    }

    private static SoundEvent register(String path) {
        var id = Aetherklang.id(path);
        return Registry.register(Registries.SOUND_EVENT, id, SoundEvent.of(id));
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered {} Aetherklang sound events", 13);
    }
}
