package de.aetherklang.bosswerk.client;

import de.aetherklang.bosswerk.BossOperation;
import de.aetherklang.bosswerk.BosswerkBossEntity;
import de.aetherklang.client.fx.FxPalette;
import de.aetherklang.client.music.AdaptiveMusicSequencer;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import java.util.Comparator;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/**
 * Client-side accent for server-authored attack telegraphs.
 */
public final class BossFxClient {
    private static final int PHASE_TRANSITION_OPERATION = BossOperation.values().length;
    private static final int INTRO_OPERATION = PHASE_TRANSITION_OPERATION + 1;
    private static final int SILENCE_DURATION = 70;
    private static final double BOSS_SEARCH_RADIUS = 64.0D;

    private static boolean registered;
    private static int silenceTicks;

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
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (silenceTicks > 0) {
                silenceTicks--;
            }
        });
        HudElementRegistry.addLast(
                de.aetherklang.Aetherklang.id("generalpause_silence"),
                (context, tickCounter) -> renderSilence(context)
        );
    }

    private static void show(int phase, int operationId) {
        MinecraftClient client = MinecraftClient.getInstance();
        ClientWorld world = client.world;
        ClientPlayerEntity player = client.player;
        if (world == null || player == null) {
            return;
        }

        boolean intro = operationId == INTRO_OPERATION;
        boolean phaseTransition = operationId == PHASE_TRANSITION_OPERATION;
        BossOperation operation = intro || phaseTransition
                ? null
                : BossOperation.fromNetworkId(operationId);
        BosswerkBossEntity boss = nearestBoss(world, player);
        String bossId = boss == null ? "" : boss.getBossId();
        AdaptiveMusicSequencer.onBossFx(bossId, phase + 1);
        if (operation == BossOperation.STILLE_ZONE) {
            silenceTicks = SILENCE_DURATION;
            AdaptiveMusicSequencer.silenceFor(SILENCE_DURATION);
        }

        ParticleEffect particle = intro
                ? signatureParticle(bossId)
                : phaseTransition ? ModParticles.KLANGOPERATION_RING : particle(operation);
        Vec3d center = boss == null
                ? player.getEntityPos().add(0.0D, 0.15D, 0.0D)
                : boss.getEntityPos().add(0.0D, boss.getHeight() * 0.48D, 0.0D);
        int rings = intro ? 6 : phaseTransition ? 4 : 2;
        for (int ring = 0; ring < rings; ring++) {
            int points = 32 + phase * 8 + (intro ? ring * 4 : 0);
            double radius = (intro ? 1.4D : 0.75D) + ring * (intro ? 0.58D : 0.42D);
            for (int point = 0; point < points; point++) {
                double angle = Math.PI * 2.0D * point / points + world.getTime() * 0.08D;
                world.addParticleClient(
                        intro && (ring & 1) == 1 ? ModParticles.KLANGOPERATION_RING : particle,
                        center.x + Math.cos(angle) * radius,
                        center.y + (ring - rings / 2.0D) * (intro ? 0.34D : 0.16D),
                        center.z + Math.sin(angle) * radius,
                        Math.cos(angle) * (intro ? 0.055D : 0.032D),
                        intro || phaseTransition ? 0.045D : 0.018D,
                        Math.sin(angle) * (intro ? 0.055D : 0.032D)
                );
            }
        }
        if (intro) {
            showIntroTitle(client, boss);
        }
        player.playSound(
                intro || phaseTransition ? ModSounds.RESONANCE_CAST : ModSounds.DISSONANZ_HIT,
                intro ? 1.35F : phaseTransition ? 0.9F : 0.55F,
                0.72F + Math.max(0, phase) * 0.16F
        );
    }

    private static void showIntroTitle(MinecraftClient client, BosswerkBossEntity boss) {
        Text title = boss == null
                ? Text.translatable("boss.aetherklang.unknown")
                : boss.getDisplayName();
        client.inGameHud.setTitleTicks(8, 52, 18);
        client.inGameHud.setSubtitle(Text.translatable("boss.aetherklang.intro").formatted(Formatting.GOLD));
        client.inGameHud.setTitle(title.copy().formatted(Formatting.BOLD));
    }

    private static BosswerkBossEntity nearestBoss(ClientWorld world, ClientPlayerEntity player) {
        Box searchArea = player.getBoundingBox().expand(BOSS_SEARCH_RADIUS);
        return world.getEntitiesByClass(
                        BosswerkBossEntity.class,
                        searchArea,
                        BosswerkBossEntity::isAlive
                ).stream()
                .min(Comparator.comparingDouble(player::squaredDistanceTo))
                .orElse(null);
    }

    private static ParticleEffect signatureParticle(String bossId) {
        return switch (bossId) {
            case ModEntities.BOSS_TREMOLO_ID -> ModParticles.TREMOLO_SPLITTER;
            case ModEntities.BOSS_GLISSANDA_ID -> ModParticles.GLISSANDO_SPUR;
            case ModEntities.BOSS_KAKOPHON_ID -> ModParticles.KAKOPHON_FUNKE;
            case ModEntities.BOSS_GENERALPAUSE_ID -> ModParticles.GENERALPAUSE_NEBEL;
            case ModEntities.BOSS_OSTINATO_ID -> ModParticles.LEITMOTIV_NOTE;
            case ModEntities.BOSS_RITARDANDO_ID -> ModParticles.FERMATE_GLIMMER;
            default -> ModParticles.KLANGOPERATION_RING;
        };
    }

    private static void renderSilence(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (silenceTicks <= 0
                || client.player == null
                || client.currentScreen != null
                || client.options.hudHidden) {
            return;
        }

        int width = context.getScaledWindowWidth();
        int height = context.getScaledWindowHeight();
        int elapsed = SILENCE_DURATION - silenceTicks;
        float envelope = Math.min(
                MathHelper.clamp(elapsed / 8.0F, 0.0F, 1.0F),
                MathHelper.clamp(silenceTicks / 15.0F, 0.0F, 1.0F)
        );
        int baseAlpha = Math.round(envelope * 142.0F);
        for (int layer = 0; layer < 8; layer++) {
            int inset = layer * 6;
            int thickness = 7;
            int alpha = baseAlpha * (8 - layer) / 8;
            int color = FxPalette.withAlpha(layer % 3 == 0 ? 0x05050A : FxPalette.INDIGO, alpha);
            context.fill(inset, inset, width - inset, inset + thickness, color);
            context.fill(inset, height - inset - thickness, width - inset, height - inset, color);
            context.fill(inset, inset + thickness, inset + thickness, height - inset - thickness, color);
            context.fill(width - inset - thickness, inset + thickness, width - inset, height - inset - thickness, color);
        }

        int scanAlpha = Math.max(1, Math.round(envelope * 16.0F));
        int offset = Math.floorMod(client.inGameHud.getTicks(), 6);
        for (int y = offset; y < height; y += 6) {
            context.fill(0, y, width, y + 1, FxPalette.withAlpha(0xC8C7DA, scanAlpha));
        }
        context.drawCenteredTextWithShadow(
                client.textRenderer,
                Text.translatable("boss.aetherklang.generalpause.silence"),
                width / 2,
                height * 3 / 4,
                FxPalette.withAlpha(0xE4E2EF, Math.round(envelope * 255.0F))
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
