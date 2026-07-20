package de.aetherklang.bosswerk.client;

import de.aetherklang.bosswerk.BossOperation;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.util.math.Vec3d;

/**
 * Client-side accent for server-authored attack telegraphs.
 */
public final class BossFxClient {
    private static boolean registered;

    private BossFxClient() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.BossFxPayload.ID,
                (payload, context) -> context.client().execute(
                        () -> show(payload.phase(), payload.operation())
                )
        );
    }

    private static void show(int phase, int operationId) {
        MinecraftClient client = MinecraftClient.getInstance();
        ClientWorld world = client.world;
        ClientPlayerEntity player = client.player;
        if (world == null || player == null) {
            return;
        }

        boolean phaseTransition = operationId >= BossOperation.values().length;
        BossOperation operation = BossOperation.fromNetworkId(operationId);
        ParticleEffect particle = phaseTransition
                ? ModParticles.KLANGOPERATION_RING
                : particle(operation);
        Vec3d center = player.getEntityPos().add(0.0D, 0.15D, 0.0D);
        int rings = phaseTransition ? 3 : 1;
        for (int ring = 0; ring < rings; ring++) {
            int points = 20 + phase * 4;
            double radius = 0.75D + ring * 0.42D;
            for (int point = 0; point < points; point++) {
                double angle = Math.PI * 2.0D * point / points + world.getTime() * 0.08D;
                world.addParticleClient(
                        particle,
                        center.x + Math.cos(angle) * radius,
                        center.y + ring * 0.16D,
                        center.z + Math.sin(angle) * radius,
                        Math.cos(angle) * 0.025D,
                        phaseTransition ? 0.045D : 0.018D,
                        Math.sin(angle) * 0.025D
                );
            }
        }
        player.playSound(
                phaseTransition ? ModSounds.RESONANCE_CAST : ModSounds.DISSONANZ_HIT,
                phaseTransition ? 0.9F : 0.55F,
                0.72F + Math.max(0, phase) * 0.16F
        );
    }

    private static ParticleEffect particle(BossOperation operation) {
        return switch (operation) {
            case SCHOCKWELLE -> ModParticles.BEAT_RING;
            case NOTENRING -> ModParticles.TREMOLO_SPLITTER;
            case STRAHL_LINIE -> ModParticles.BEAM_MOTE;
            case STILLE_ZONE -> ModParticles.GENERALPAUSE_NEBEL;
            case BESCHWOERE_MOTIV -> ModParticles.LEITMOTIV_NOTE;
            case KAKOPHONIE -> ModParticles.KAKOPHON_FUNKE;
            case GLEITSTOSS -> ModParticles.GLISSANDO_SPUR;
            case FERMATE -> ModParticles.FERMATE_GLIMMER;
        };
    }
}
