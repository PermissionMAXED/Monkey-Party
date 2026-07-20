package de.aetherklang.client;

import de.aetherklang.registry.ModParticles;
import net.fabricmc.fabric.api.client.particle.v1.ParticleFactoryRegistry;
import net.minecraft.client.particle.EndRodParticle;

public final class ModParticleFactories {
    private ModParticleFactories() {
    }

    public static void register() {
        ParticleFactoryRegistry registry = ParticleFactoryRegistry.getInstance();
        registry.register(ModParticles.NOTE_SPARK, EndRodParticle.Factory::new);
        registry.register(ModParticles.BEAT_RING, EndRodParticle.Factory::new);
        registry.register(ModParticles.DISSONANZ_SMOKE, EndRodParticle.Factory::new);
        registry.register(ModParticles.BEAM_MOTE, EndRodParticle.Factory::new);
    }
}
