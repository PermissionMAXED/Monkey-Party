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

    public static final SoundEvent BEAT_TICK = register(BEAT_TICK_ID);
    public static final SoundEvent RESONANCE_CAST = register(RESONANCE_CAST_ID);
    public static final SoundEvent DISSONANZ_HIT = register(DISSONANZ_HIT_ID);
    public static final SoundEvent PORTAL_HUM = register(PORTAL_HUM_ID);
    public static final SoundEvent CHORAL_THEME = register(CHORAL_THEME_ID);

    private ModSounds() {
    }

    private static SoundEvent register(String path) {
        var id = Aetherklang.id(path);
        return Registry.register(Registries.SOUND_EVENT, id, SoundEvent.of(id));
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered {} Aetherklang sound events", 5);
    }
}
