package de.aetherklang.bosswerk.client;

import de.aetherklang.bosswerk.BossOperation;
import de.aetherklang.bosswerk.BosswerkBossEntity;
import de.aetherklang.client.fx.FxBudget;
import de.aetherklang.client.fx.FxPalette;
import de.aetherklang.client.music.AdaptiveMusicSequencer;
import de.aetherklang.entity.ChoralEntity;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import java.util.Comparator;
import java.util.UUID;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.entity.Entity;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;
import net.minecraft.util.math.random.Random;

/**
 * Boss-specific world particles, screen-space cinematics, and audio accents.
 */
public final class BossFxClient {
    private static final int PHASE_TRANSITION_OPERATION = BossOperation.values().length;
    private static final int INTRO_OPERATION = PHASE_TRANSITION_OPERATION + 1;
    private static final int SILENCE_DURATION = 70;
    private static final int INTRO_DURATION = 72;
    private static final int PHASE_DURATION = 44;
    private static final int ATTACK_DURATION = 20;
    private static final int CINEMATIC_INTRO = 2;
    private static final int CINEMATIC_PHASE = 1;
    private static final int CINEMATIC_ATTACK = 0;
    private static final double BOSS_SEARCH_RADIUS = 64.0D;

    private static boolean registered;
    private static int silenceTicks;
    private static int cinematicTicks;
    private static int cinematicDuration;
    private static int cinematicMode;
    private static int cinematicPhase;
    private static int cinematicEntityId = -1;
    private static String cinematicBossId = "";
    private static Vec3d cinematicCenter = Vec3d.ZERO;
    private static UUID observedChoral;
    private static int observedChoralPhase;

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
        ClientTickEvents.END_CLIENT_TICK.register(BossFxClient::tick);
        HudElementRegistry.addLast(
                de.aetherklang.Aetherklang.id("boss_cinematic"),
                (context, tickCounter) -> renderCinematic(context)
        );
        HudElementRegistry.addLast(
                de.aetherklang.Aetherklang.id("generalpause_silence"),
                (context, tickCounter) -> renderSilence(context)
        );
    }

    private static void tick(MinecraftClient client) {
        if (silenceTicks > 0) {
            silenceTicks--;
        }
        if (client.world == null || client.player == null) {
            cinematicTicks = 0;
            observedChoral = null;
            observedChoralPhase = 0;
            return;
        }

        observeChoral(client);
        if (cinematicTicks <= 0) {
            return;
        }
        cinematicTicks--;
        Entity entity = cinematicEntityId < 0 ? null : client.world.getEntityById(cinematicEntityId);
        if (entity != null && entity.isAlive()) {
            cinematicCenter = entity.getEntityPos().add(0.0D, entity.getHeight() * 0.5D, 0.0D);
        }
        if ((cinematicTicks & 1) == 0) {
            spawnCinematicParticles(client.world);
        }
    }

    private static void observeChoral(MinecraftClient client) {
        ChoralEntity choral = nearestChoral(client.world, client.player);
        if (choral == null) {
            observedChoral = null;
            observedChoralPhase = 0;
            return;
        }

        int phase = choral.getPhase();
        if (!choral.getUuid().equals(observedChoral)) {
            observedChoral = choral.getUuid();
            observedChoralPhase = phase;
            AdaptiveMusicSequencer.onBossFx(ModEntities.CHORAL_ID, phase);
            Vec3d center = choral.getEntityPos().add(0.0D, choral.getHeight() * 0.5D, 0.0D);
            spawnNova(client.world, center, ModEntities.CHORAL_ID, phase - 1, true);
            beginCinematic(ModEntities.CHORAL_ID, choral, center, phase - 1, CINEMATIC_INTRO);
            showIntroTitle(client, choral.getDisplayName());
            client.player.playSound(ModSounds.ARENA_FANFARE, 1.7F, choral.isReprise() ? 0.76F : 0.92F);
            return;
        }
        if (phase <= observedChoralPhase) {
            return;
        }

        observedChoralPhase = phase;
        AdaptiveMusicSequencer.onBossFx(ModEntities.CHORAL_ID, phase);
        Vec3d center = choral.getEntityPos().add(0.0D, choral.getHeight() * 0.5D, 0.0D);
        spawnNova(client.world, center, ModEntities.CHORAL_ID, phase - 1, false);
        beginCinematic(ModEntities.CHORAL_ID, choral, center, phase - 1, CINEMATIC_PHASE);
        client.player.playSound(ModSounds.BOSS_NOVA, 1.3F, 0.86F + phase * 0.09F);
    }

    private static void beginCinematic(
            String bossId,
            Entity boss,
            Vec3d center,
            int phase,
            int mode
    ) {
        cinematicMode = mode;
        cinematicDuration = mode == CINEMATIC_INTRO
                ? INTRO_DURATION : mode == CINEMATIC_PHASE ? PHASE_DURATION : ATTACK_DURATION;
        cinematicTicks = cinematicDuration;
        cinematicPhase = Math.clamp(phase, 0, 2);
        cinematicBossId = bossId;
        cinematicEntityId = boss == null ? -1 : boss.getId();
        cinematicCenter = center;
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
            int points = FxBudget.scale(
                    FxBudget.Effect.PARTICLE,
                    32 + phase * 8 + (intro ? ring * 4 : 0),
                    FxBudget.Priority.CRITICAL
            );
            double radius = (intro ? 1.4D : 0.75D) + ring * (intro ? 0.58D : 0.42D);
            for (int point = 0; point < points; point++) {
                double angle = Math.PI * 2.0D * point / Math.max(1, points) + world.getTime() * 0.08D;
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
        if (intro || phaseTransition) {
            spawnNova(world, center, bossId, phase, intro);
        }
        beginCinematic(
                bossId,
                boss,
                center,
                Math.max(0, phase),
                intro ? CINEMATIC_INTRO : phaseTransition ? CINEMATIC_PHASE : CINEMATIC_ATTACK
        );
        if (intro) {
            showIntroTitle(client, boss == null ? null : boss.getDisplayName());
        }
        player.playSound(
                intro ? ModSounds.ARENA_FANFARE
                        : phaseTransition ? ModSounds.BOSS_NOVA : ModSounds.DISSONANZ_HIT,
                intro ? 1.7F : phaseTransition ? 1.25F : 0.55F,
                intro ? 0.88F : 0.76F + Math.max(0, phase) * 0.14F
        );
    }

    private static void showIntroTitle(MinecraftClient client, Text bossName) {
        Text title = bossName == null
                ? Text.translatable("boss.aetherklang.unknown")
                : bossName;
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

    private static ChoralEntity nearestChoral(ClientWorld world, ClientPlayerEntity player) {
        Box searchArea = player.getBoundingBox().expand(BOSS_SEARCH_RADIUS);
        return world.getEntitiesByClass(
                        ChoralEntity.class,
                        searchArea,
                        ChoralEntity::isAlive
                ).stream()
                .min(Comparator.comparingDouble(player::squaredDistanceTo))
                .orElse(null);
    }

    private static ParticleEffect signatureParticle(String bossId) {
        return switch (bossId) {
            case ModEntities.CHORAL_ID -> ModParticles.AKKORD_GLYPH;
            case ModEntities.BOSS_TREMOLO_ID -> ModParticles.TREMOLO_SPLITTER;
            case ModEntities.BOSS_GLISSANDA_ID -> ModParticles.GLISSANDO_SPUR;
            case ModEntities.BOSS_KAKOPHON_ID -> ModParticles.KAKOPHON_FUNKE;
            case ModEntities.BOSS_GENERALPAUSE_ID -> ModParticles.GENERALPAUSE_NEBEL;
            case ModEntities.BOSS_OSTINATO_ID -> ModParticles.LEITMOTIV_NOTE;
            case ModEntities.BOSS_RITARDANDO_ID -> ModParticles.FERMATE_GLIMMER;
            default -> ModParticles.KLANGOPERATION_RING;
        };
    }

    private static void spawnNova(
            ClientWorld world,
            Vec3d center,
            String bossId,
            int phase,
            boolean intro
    ) {
        ParticleEffect signature = signatureParticle(bossId);
        Random random = world.getRandom();
        int rings = intro ? 6 : 4;
        for (int ring = 0; ring < rings; ring++) {
            int points = FxBudget.scale(
                    FxBudget.Effect.PARTICLE,
                    40 + ring * 8 + phase * 6,
                    FxBudget.Priority.CRITICAL
            );
            double radius = 0.8D + ring * (intro ? 0.78D : 0.58D);
            double rise = (ring - (rings - 1) * 0.5D) * 0.34D;
            for (int point = 0; point < points; point++) {
                double angle = point * Math.PI * 2.0D / points + ring * 0.19D;
                double cos = Math.cos(angle);
                double sin = Math.sin(angle);
                world.addParticleClient(
                        (ring & 1) == 0 ? signature : ModParticles.KLANGOPERATION_RING,
                        center.x + cos * radius,
                        center.y + rise,
                        center.z + sin * radius,
                        cos * (0.045D + ring * 0.006D),
                        0.028D + random.nextDouble() * 0.035D,
                        sin * (0.045D + ring * 0.006D)
                );
            }
        }

        int burst = FxBudget.scale(
                FxBudget.Effect.PARTICLE,
                intro ? 96 : 64,
                FxBudget.Priority.CRITICAL
        );
        for (int spark = 0; spark < burst; spark++) {
            double angle = random.nextDouble() * Math.PI * 2.0D;
            double elevation = random.nextDouble() * 2.0D - 1.0D;
            double horizontal = Math.sqrt(1.0D - elevation * elevation);
            double speed = (intro ? 0.09D : 0.065D) + random.nextDouble() * 0.13D;
            world.addParticleClient(
                    spark % 3 == 0
                            ? new DustParticleEffect(
                                    spark % 2 == 0 ? primaryColor(bossId) : secondaryColor(bossId),
                                    intro ? 1.35F : 1.05F
                            )
                            : signature,
                    center.x,
                    center.y,
                    center.z,
                    Math.cos(angle) * horizontal * speed,
                    elevation * speed,
                    Math.sin(angle) * horizontal * speed
            );
        }
    }

    private static void spawnCinematicParticles(ClientWorld world) {
        double progress = 1.0D - cinematicTicks / (double) Math.max(1, cinematicDuration);
        double intensity = cinematicMode == CINEMATIC_INTRO ? 1.0D : cinematicMode == CINEMATIC_PHASE ? 0.78D : 0.48D;
        double rotation = world.getTime() * 0.11D + progress * Math.PI * 2.0D;
        switch (cinematicBossId) {
            case ModEntities.CHORAL_ID -> spawnChoralCrown(world, rotation, intensity);
            case ModEntities.BOSS_TREMOLO_ID -> spawnTremoloPulse(world, rotation, intensity);
            case ModEntities.BOSS_GLISSANDA_ID -> spawnGlissandaRibbon(world, rotation, intensity);
            case ModEntities.BOSS_KAKOPHON_ID -> spawnKakophonShards(world, intensity);
            case ModEntities.BOSS_GENERALPAUSE_ID -> spawnGeneralpauseVoid(world, rotation, intensity);
            case ModEntities.BOSS_OSTINATO_ID -> spawnOstinatoFigure(world, rotation, intensity);
            case ModEntities.BOSS_RITARDANDO_ID -> spawnRitardandoClock(world, rotation, intensity);
            default -> spawnTremoloPulse(world, rotation, intensity);
        }
    }

    private static void spawnChoralCrown(ClientWorld world, double rotation, double intensity) {
        int notes = 12 + cinematicPhase * 2;
        for (int note = 0; note < notes; note++) {
            double angle = rotation + note * Math.PI * 2.0D / notes;
            double radius = 2.4D + Math.sin(rotation * 0.7D + note) * 0.28D;
            double y = cinematicCenter.y + 1.45D + Math.sin(angle * 3.0D) * 0.32D;
            addParticle(
                    world,
                    note % 3 == 0 ? ModParticles.AKKORD_GLYPH : ModParticles.BEAM_MOTE,
                    angle,
                    radius,
                    y,
                    intensity * 0.035D,
                    0.045D
            );
        }
        if (FxBudget.tryEmit(FxBudget.Effect.PARTICLE, FxBudget.Priority.NORMAL)) {
            world.addParticleClient(
                    new DustParticleEffect(cinematicPhase >= 2 ? FxPalette.MAGENTA : FxPalette.GOLD, 1.35F),
                    cinematicCenter.x,
                    cinematicCenter.y + 2.0D,
                    cinematicCenter.z,
                    0.0D,
                    0.08D,
                    0.0D
            );
        }
    }

    private static void spawnTremoloPulse(ClientWorld world, double rotation, double intensity) {
        for (int echo = 0; echo < 3; echo++) {
            double pulse = 1.7D + echo * 0.78D + Math.sin(rotation * 3.0D + echo) * 0.24D;
            int points = 8 + echo * 2;
            for (int point = 0; point < points; point++) {
                double angle = rotation * (echo % 2 == 0 ? 1.0D : -1.0D)
                        + point * Math.PI * 2.0D / points;
                addParticle(
                        world,
                        echo == 1 ? ModParticles.BEAT_RING : ModParticles.TREMOLO_SPLITTER,
                        angle,
                        pulse,
                        cinematicCenter.y + (echo - 1) * 0.55D,
                        intensity * 0.055D,
                        0.025D
                );
            }
        }
    }

    private static void spawnGlissandaRibbon(ClientWorld world, double rotation, double intensity) {
        for (int step = 0; step < 18; step++) {
            double lift = step / 17.0D;
            double angle = rotation + lift * Math.PI * 3.4D;
            double radius = 1.35D + lift * 1.8D;
            addParticle(
                    world,
                    step % 4 == 0 ? ModParticles.BEAM_MOTE : ModParticles.GLISSANDO_SPUR,
                    angle,
                    radius,
                    cinematicCenter.y - 1.2D + lift * 3.4D,
                    intensity * 0.042D,
                    0.055D
            );
        }
    }

    private static void spawnKakophonShards(ClientWorld world, double intensity) {
        Random random = world.getRandom();
        int shards = FxBudget.scale(
                FxBudget.Effect.PARTICLE,
                12 + cinematicPhase * 3,
                FxBudget.Priority.NORMAL
        );
        for (int shard = 0; shard < shards; shard++) {
            double angle = random.nextDouble() * Math.PI * 2.0D;
            double radius = 0.8D + random.nextDouble() * 3.4D;
            double speed = intensity * (0.04D + random.nextDouble() * 0.09D);
            world.addParticleClient(
                    shard % 3 == 0
                            ? new DustParticleEffect(shard % 2 == 0 ? FxPalette.MAGENTA : FxPalette.GOLD, 1.2F)
                            : ModParticles.KAKOPHON_FUNKE,
                    cinematicCenter.x + Math.cos(angle) * radius,
                    cinematicCenter.y - 1.0D + random.nextDouble() * 3.2D,
                    cinematicCenter.z + Math.sin(angle) * radius,
                    Math.cos(angle) * speed,
                    (random.nextDouble() - 0.25D) * speed,
                    Math.sin(angle) * speed
            );
        }
    }

    private static void spawnGeneralpauseVoid(ClientWorld world, double rotation, double intensity) {
        int motes = FxBudget.scale(
                FxBudget.Effect.PARTICLE,
                14 + cinematicPhase * 3,
                FxBudget.Priority.NORMAL
        );
        for (int mote = 0; mote < motes; mote++) {
            double angle = rotation * 0.28D + mote * Math.PI * 2.0D / motes;
            double radius = 4.6D - mote % 3 * 0.48D;
            double cos = Math.cos(angle);
            double sin = Math.sin(angle);
            world.addParticleClient(
                    mote % 4 == 0 ? ModParticles.KLANGOPERATION_RING : ModParticles.GENERALPAUSE_NEBEL,
                    cinematicCenter.x + cos * radius,
                    cinematicCenter.y - 1.0D + (mote % 7) * 0.48D,
                    cinematicCenter.z + sin * radius,
                    -cos * intensity * 0.065D,
                    -0.006D,
                    -sin * intensity * 0.065D
            );
        }
    }

    private static void spawnOstinatoFigure(ClientWorld world, double rotation, double intensity) {
        for (int voice = 0; voice < 4; voice++) {
            double voiceRotation = rotation + voice * Math.PI * 0.5D;
            for (int repeat = 0; repeat < 3; repeat++) {
                double radius = 1.45D + repeat * 0.72D;
                addParticle(
                        world,
                        repeat == 1 ? ModParticles.KLANGOPERATION_RING : ModParticles.LEITMOTIV_NOTE,
                        voiceRotation,
                        radius,
                        cinematicCenter.y - 0.65D + voice * 0.48D,
                        intensity * (0.025D + repeat * 0.012D),
                        0.04D
                );
            }
        }
    }

    private static void spawnRitardandoClock(ClientWorld world, double rotation, double intensity) {
        int marks = 12;
        for (int mark = 0; mark < marks; mark++) {
            double angle = mark * Math.PI * 2.0D / marks;
            addParticle(
                    world,
                    mark % 3 == 0 ? ModParticles.FERMATE_GLIMMER : ModParticles.KLANGOPERATION_RING,
                    angle,
                    3.25D,
                    cinematicCenter.y + Math.sin(angle) * 0.32D,
                    intensity * 0.012D,
                    0.012D
            );
        }
        double hand = rotation * 0.22D;
        for (int segment = 1; segment <= 8; segment++) {
            addParticle(
                    world,
                    ModParticles.FERMATE_GLIMMER,
                    hand,
                    segment * 0.37D,
                    cinematicCenter.y + 0.12D,
                    intensity * 0.018D,
                    0.018D
            );
        }
    }

    private static void addParticle(
            ClientWorld world,
            ParticleEffect particle,
            double angle,
            double radius,
            double y,
            double radialSpeed,
            double lift
    ) {
        if (!FxBudget.tryEmit(FxBudget.Effect.PARTICLE, FxBudget.Priority.NORMAL)) {
            return;
        }
        double cos = Math.cos(angle);
        double sin = Math.sin(angle);
        world.addParticleClient(
                particle,
                cinematicCenter.x + cos * radius,
                y,
                cinematicCenter.z + sin * radius,
                cos * radialSpeed,
                lift,
                sin * radialSpeed
        );
    }

    private static void renderCinematic(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (cinematicTicks <= 0
                || client.player == null
                || client.currentScreen != null
                || client.options.hudHidden) {
            return;
        }

        int width = context.getScaledWindowWidth();
        int height = context.getScaledWindowHeight();
        int elapsed = cinematicDuration - cinematicTicks;
        float envelope = Math.min(
                MathHelper.clamp(elapsed / 7.0F, 0.0F, 1.0F),
                MathHelper.clamp(cinematicTicks / 12.0F, 0.0F, 1.0F)
        );
        float strength = cinematicMode == CINEMATIC_INTRO
                ? 1.0F : cinematicMode == CINEMATIC_PHASE ? 0.76F : 0.38F;
        int primary = primaryColor(cinematicBossId);
        int secondary = secondaryColor(cinematicBossId);
        int washAlpha = Math.round(envelope * strength * 27.0F);
        fillOverlay(
                context,
                0,
                0,
                width,
                height,
                FxPalette.withAlpha(primary, washAlpha),
                FxBudget.Priority.CRITICAL
        );

        int edgeAlpha = Math.round(envelope * strength * 110.0F);
        int edge = cinematicMode == CINEMATIC_INTRO ? 8 : 5;
        fillOverlay(
                context,
                0,
                0,
                width,
                edge,
                FxPalette.withAlpha(primary, edgeAlpha),
                FxBudget.Priority.CRITICAL
        );
        fillOverlay(
                context,
                0,
                height - edge,
                width,
                height,
                FxPalette.withAlpha(secondary, edgeAlpha),
                FxBudget.Priority.CRITICAL
        );
        fillOverlay(
                context,
                0,
                edge,
                edge,
                height - edge,
                FxPalette.withAlpha(secondary, edgeAlpha / 2),
                FxBudget.Priority.CRITICAL
        );
        fillOverlay(
                context,
                width - edge,
                edge,
                width,
                height - edge,
                FxPalette.withAlpha(primary, edgeAlpha / 2),
                FxBudget.Priority.CRITICAL
        );

        float progress = MathHelper.clamp(elapsed / (float) Math.max(1, cinematicDuration), 0.0F, 1.0F);
        float maximum = MathHelper.sqrt(width * width + height * height) * 0.55F;
        float radius = MathHelper.lerp(1.0F - (1.0F - progress) * (1.0F - progress), 12.0F, maximum);
        drawScreenRing(context, width / 2, height / 2, radius, primary, edgeAlpha);
        drawScreenRing(context, width / 2, height / 2, Math.max(6.0F, radius - 7.0F), secondary, edgeAlpha * 2 / 3);

        if (cinematicMode == CINEMATIC_INTRO) {
            int barHeight = Math.round(Math.min(height * 0.105F, elapsed * 2.2F) * envelope);
            int barColor = FxPalette.withAlpha(0x020208, Math.round(envelope * 220.0F));
            fillOverlay(context, 0, 0, width, barHeight, barColor, FxBudget.Priority.CRITICAL);
            fillOverlay(
                    context,
                    0,
                    height - barHeight,
                    width,
                    height,
                    barColor,
                    FxBudget.Priority.CRITICAL
            );
        }
    }

    private static void drawScreenRing(
            DrawContext context,
            int centerX,
            int centerY,
            float radius,
            int color,
            int alpha
    ) {
        if (alpha <= 0) {
            return;
        }
        for (int segment = 0; segment < 88; segment++) {
            double angle = segment * Math.PI * 2.0D / 88.0D;
            int x = centerX + Math.round((float) Math.cos(angle) * radius);
            int y = centerY + Math.round((float) Math.sin(angle) * radius);
            int size = segment % 8 == 0 ? 3 : 2;
            fillOverlay(
                    context,
                    x,
                    y,
                    x + size,
                    y + size,
                    FxPalette.withAlpha(color, alpha),
                    FxBudget.Priority.CRITICAL
            );
        }
    }

    private static int primaryColor(String bossId) {
        return switch (bossId) {
            case ModEntities.CHORAL_ID, ModEntities.BOSS_OSTINATO_ID -> FxPalette.GOLD;
            case ModEntities.BOSS_GLISSANDA_ID, ModEntities.BOSS_RITARDANDO_ID -> FxPalette.CYAN;
            case ModEntities.BOSS_TREMOLO_ID, ModEntities.BOSS_KAKOPHON_ID -> FxPalette.MAGENTA;
            default -> FxPalette.INDIGO;
        };
    }

    private static int secondaryColor(String bossId) {
        return switch (bossId) {
            case ModEntities.CHORAL_ID, ModEntities.BOSS_TREMOLO_ID -> FxPalette.CYAN;
            case ModEntities.BOSS_GLISSANDA_ID, ModEntities.BOSS_OSTINATO_ID -> FxPalette.MAGENTA;
            case ModEntities.BOSS_KAKOPHON_ID -> FxPalette.GOLD;
            case ModEntities.BOSS_RITARDANDO_ID -> FxPalette.INDIGO;
            default -> 0xD8D4E8;
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
            fillOverlay(
                    context,
                    inset,
                    inset,
                    width - inset,
                    inset + thickness,
                    color,
                    FxBudget.Priority.CRITICAL
            );
            fillOverlay(
                    context,
                    inset,
                    height - inset - thickness,
                    width - inset,
                    height - inset,
                    color,
                    FxBudget.Priority.CRITICAL
            );
            fillOverlay(
                    context,
                    inset,
                    inset + thickness,
                    inset + thickness,
                    height - inset - thickness,
                    color,
                    FxBudget.Priority.CRITICAL
            );
            fillOverlay(
                    context,
                    width - inset - thickness,
                    inset + thickness,
                    width - inset,
                    height - inset - thickness,
                    color,
                    FxBudget.Priority.CRITICAL
            );
        }

        int scanAlpha = Math.max(1, Math.round(envelope * 16.0F));
        int offset = Math.floorMod(client.inGameHud.getTicks(), 6);
        int scanLines = FxBudget.scale(
                FxBudget.Effect.OVERLAY,
                Math.max(0, (height - offset + 5) / 6),
                FxBudget.Priority.CRITICAL
        );
        for (int line = 0, y = offset; line < scanLines; line++, y += 6) {
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

    private static boolean fillOverlay(
            DrawContext context,
            int x1,
            int y1,
            int x2,
            int y2,
            int color,
            FxBudget.Priority priority
    ) {
        if (!FxBudget.tryEmit(FxBudget.Effect.OVERLAY, priority)) {
            return false;
        }
        context.fill(x1, y1, x2, y2, color);
        return true;
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
