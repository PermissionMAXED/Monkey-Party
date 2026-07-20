package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import net.fabricmc.fabric.api.particle.v1.FabricParticleTypes;
import net.minecraft.particle.SimpleParticleType;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;

public final class ModParticles {
    public static final String NOTE_SPARK_ID = "note_spark";
    public static final String BEAT_RING_ID = "beat_ring";
    public static final String DISSONANZ_SMOKE_ID = "dissonanz_smoke";
    public static final String BEAM_MOTE_ID = "beam_mote";
    public static final String AURORA_WISP_ID = "aurora_wisp";
    public static final String AKKORD_GLYPH_ID = "akkord_glyph";
    public static final String FERMATE_GLIMMER_ID = "fermate_glimmer";
    public static final String ENSEMBLE_FUNKE_ID = "ensemble_funke";
    public static final String SIRENEN_SCHLEIER_ID = "sirenen_schleier";
    public static final String TREMOLO_SPLITTER_ID = "tremolo_splitter";
    public static final String GLISSANDO_SPUR_ID = "glissando_spur";
    public static final String KAKOPHON_FUNKE_ID = "kakophon_funke";
    public static final String GENERALPAUSE_NEBEL_ID = "generalpause_nebel";
    public static final String RELIKT_AURA_ID = "relikt_aura";
    public static final String INSEL_RESONANZ_ID = "insel_resonanz";
    public static final String LEITMOTIV_NOTE_ID = "leitmotiv_note";
    public static final String KLANGOPERATION_RING_ID = "klangoperation_ring";

    public static final SimpleParticleType NOTE_SPARK = register(NOTE_SPARK_ID);
    public static final SimpleParticleType BEAT_RING = register(BEAT_RING_ID);
    public static final SimpleParticleType DISSONANZ_SMOKE = register(DISSONANZ_SMOKE_ID);
    public static final SimpleParticleType BEAM_MOTE = register(BEAM_MOTE_ID);
    public static final SimpleParticleType AURORA_WISP = register(AURORA_WISP_ID);
    public static final SimpleParticleType AKKORD_GLYPH = register(AKKORD_GLYPH_ID);
    public static final SimpleParticleType FERMATE_GLIMMER = register(FERMATE_GLIMMER_ID);
    public static final SimpleParticleType ENSEMBLE_FUNKE = register(ENSEMBLE_FUNKE_ID);
    public static final SimpleParticleType SIRENEN_SCHLEIER = register(SIRENEN_SCHLEIER_ID);
    public static final SimpleParticleType TREMOLO_SPLITTER = register(TREMOLO_SPLITTER_ID);
    public static final SimpleParticleType GLISSANDO_SPUR = register(GLISSANDO_SPUR_ID);
    public static final SimpleParticleType KAKOPHON_FUNKE = register(KAKOPHON_FUNKE_ID);
    public static final SimpleParticleType GENERALPAUSE_NEBEL = register(GENERALPAUSE_NEBEL_ID);
    public static final SimpleParticleType RELIKT_AURA = register(RELIKT_AURA_ID);
    public static final SimpleParticleType INSEL_RESONANZ = register(INSEL_RESONANZ_ID);
    public static final SimpleParticleType LEITMOTIV_NOTE = register(LEITMOTIV_NOTE_ID);
    public static final SimpleParticleType KLANGOPERATION_RING = register(KLANGOPERATION_RING_ID);

    private ModParticles() {
    }

    private static SimpleParticleType register(String path) {
        return Registry.register(
                Registries.PARTICLE_TYPE,
                Aetherklang.id(path),
                FabricParticleTypes.simple()
        );
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered {} Aetherklang particle types", 17);
    }
}
