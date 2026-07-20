package de.aetherklang.client;

import de.aetherklang.client.fx.AetherParticles;
import de.aetherklang.registry.ModParticles;
import net.fabricmc.fabric.api.client.particle.v1.ParticleFactoryRegistry;

public final class ModParticleFactories {
    private ModParticleFactories() {
    }

    public static void register() {
        ParticleFactoryRegistry registry = ParticleFactoryRegistry.getInstance();
        registry.register(ModParticles.NOTE_SPARK, AetherParticles.NoteSparkFactory::new);
        registry.register(ModParticles.BEAT_RING, AetherParticles.BeatRingFactory::new);
        registry.register(ModParticles.DISSONANZ_SMOKE, AetherParticles.DissonanzSmokeFactory::new);
        registry.register(ModParticles.BEAM_MOTE, AetherParticles.BeamMoteFactory::new);
    }
}
