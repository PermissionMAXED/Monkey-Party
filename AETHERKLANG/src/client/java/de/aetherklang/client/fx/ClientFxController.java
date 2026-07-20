package de.aetherklang.client.fx;

import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.client.ClientResonanceCache;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.entity.Entity;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;
import net.minecraft.util.math.random.Random;

/**
 * Coordinates payload bursts and lightweight client-tick effects.
 */
public final class ClientFxController {
    private static boolean registered;
    private static int clientTicks;
    private static float beatPulse;
    private static float dissonanzPulse;
    private static float previousDissonanz;

    private ClientFxController() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientTickEvents.END_CLIENT_TICK.register(ClientFxController::tick);
        MoodVignette.register();
    }

    public static void onBeat(int beat) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.world == null || client.player == null) {
            return;
        }

        beatPulse = 1.0F;
        spawnBeatBurst(client.world, client.player, beat);
    }

    static float beatPulse() {
        return beatPulse;
    }

    static float dissonanzPulse() {
        return dissonanzPulse;
    }

    private static void tick(MinecraftClient client) {
        clientTicks++;
        beatPulse *= 0.78F;
        dissonanzPulse *= 0.86F;

        if (client.world == null || client.player == null) {
            previousDissonanz = 0.0F;
            return;
        }

        float dissonanz = ClientResonanceCache.getDissonanz();
        float spike = dissonanz - previousDissonanz;
        if (spike > 0.045F) {
            dissonanzPulse = MathHelper.clamp(dissonanzPulse + spike * 2.8F, 0.0F, 1.0F);
            spawnDissonanzSpike(client.world, client.player, spike);
        }
        previousDissonanz = dissonanz;

        tickWeaponTrail(client);
        if ((clientTicks & 1) == 0) {
            tickTargetBeam(client);
        }
        if (clientTicks % 4 == 0) {
            tickPortalAuras(client.world, client.player);
        }
        if (dissonanz > 0.48F && clientTicks % Math.max(2, 7 - (int) (dissonanz * 5.0F)) == 0) {
            spawnAmbientDissonanz(client.world, client.player, dissonanz);
        }
    }

    private static void spawnBeatBurst(ClientWorld world, ClientPlayerEntity player, int beat) {
        Random random = world.getRandom();
        Vec3d center = player.getEntityPos().add(0.0D, 0.13D, 0.0D);
        double rotation = beat * 0.61803398875D;

        for (int ring = 0; ring < 2; ring++) {
            int points = 20 + ring * 8;
            double radius = 0.6D + ring * 0.42D;
            double speed = 0.055D + ring * 0.018D;
            for (int point = 0; point < points; point++) {
                double angle = rotation + point * Math.PI * 2.0D / points + ring * 0.21D;
                double cos = Math.cos(angle);
                double sin = Math.sin(angle);
                world.addParticleClient(
                        ModParticles.BEAT_RING,
                        center.x + cos * radius,
                        center.y + ring * 0.075D,
                        center.z + sin * radius,
                        cos * speed,
                        0.012D + ring * 0.004D,
                        sin * speed
                );
            }
        }

        for (int spark = 0; spark < 14; spark++) {
            double angle = rotation + spark * Math.PI * 2.0D / 14.0D;
            double radius = 0.65D + random.nextDouble() * 0.85D;
            double lift = 0.035D + random.nextDouble() * 0.08D;
            world.addParticleClient(
                    ModParticles.NOTE_SPARK,
                    center.x + Math.cos(angle) * radius,
                    center.y + 0.18D + random.nextDouble() * 0.85D,
                    center.z + Math.sin(angle) * radius,
                    Math.cos(angle) * 0.025D,
                    lift,
                    Math.sin(angle) * 0.025D
            );
        }
    }

    private static void tickTargetBeam(MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        ClientWorld world = client.world;
        if (player == null || world == null) {
            return;
        }

        ItemStack held = player.getMainHandStack();
        boolean resonantFocus = held.isOf(ModItems.HALLHARFE)
                || held.isOf(ModItems.STIMMGABEL)
                || held.isOf(ModItems.RESONANZKLINGE);
        boolean active = player.handSwinging || player.isUsingItem();
        if (!resonantFocus || !active) {
            return;
        }

        Vec3d target = beamTarget(client, player);
        if (target == null || target.squaredDistanceTo(player.getEyePos()) > 18.0D * 18.0D) {
            return;
        }

        Vec3d look = player.getRotationVector();
        Vec3d side = new Vec3d(-look.z, 0.0D, look.x);
        if (side.lengthSquared() > 0.001D) {
            side = side.normalize();
        }
        Vec3d origin = player.getEyePos()
                .add(look.multiply(0.32D))
                .add(side.multiply(0.24D))
                .add(0.0D, -0.18D, 0.0D);
        ResonanceBeamFx.draw(
                world,
                origin,
                target,
                ClientResonanceCache.getMood(),
                world.getTime()
        );
    }

    private static Vec3d beamTarget(MinecraftClient client, ClientPlayerEntity player) {
        Entity entity = client.targetedEntity;
        if (entity != null && entity != player) {
            return new Vec3d(entity.getX(), entity.getBodyY(0.62D), entity.getZ());
        }

        Vec3d eye = player.getEyePos();
        Vec3d look = player.getRotationVector().normalize();
        Entity nearest = null;
        double nearestDistance = Double.MAX_VALUE;
        for (Entity candidate : player.getEntityWorld().getOtherEntities(
                player,
                player.getBoundingBox().expand(12.0D),
                candidate -> candidate.isAlive() && !candidate.isSpectator()
        )) {
            Vec3d target = new Vec3d(candidate.getX(), candidate.getBodyY(0.62D), candidate.getZ());
            Vec3d toTarget = target.subtract(eye);
            double distance = toTarget.lengthSquared();
            if (distance > 0.01D
                    && distance < nearestDistance
                    && look.dotProduct(toTarget.normalize()) > 0.42D) {
                nearest = candidate;
                nearestDistance = distance;
            }
        }
        if (nearest != null) {
            return new Vec3d(nearest.getX(), nearest.getBodyY(0.62D), nearest.getZ());
        }

        HitResult hit = client.crosshairTarget;
        if (hit != null && hit.getType() != HitResult.Type.MISS) {
            return hit.getPos();
        }
        return null;
    }

    private static void tickWeaponTrail(MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        ClientWorld world = client.world;
        if (player == null || world == null) {
            return;
        }

        ItemStack held = player.getMainHandStack();
        boolean blade = held.isOf(ModItems.RESONANZKLINGE);
        boolean hammer = held.isOf(ModItems.BASSHAMMER);
        boolean fork = held.isOf(ModItems.STIMMGABEL);
        boolean harp = held.isOf(ModItems.HALLHARFE);
        if (!(blade || hammer || fork || harp)) {
            return;
        }

        if (player.handSwinging) {
            float swing = player.getHandSwingProgress(0.0F);
            Vec3d look = player.getRotationVector().normalize();
            Vec3d side = new Vec3d(-look.z, 0.0D, look.x).normalize();
            double sweep = (swing - 0.5F) * Math.PI * 1.45D;
            Vec3d center = player.getEyePos().add(look.multiply(0.7D)).add(0.0D, -0.35D, 0.0D);
            int primary = blade ? FxPalette.CYAN : hammer ? FxPalette.GOLD : FxPalette.MAGENTA;
            int secondary = blade ? FxPalette.MAGENTA : FxPalette.CYAN;

            for (int sample = -2; sample <= 2; sample++) {
                double angle = sweep + sample * 0.13D;
                Vec3d point = center
                        .add(side.multiply(Math.cos(angle) * (hammer ? 1.0D : 0.72D)))
                        .add(0.0D, Math.sin(angle) * 0.62D, 0.0D);
                world.addParticleClient(
                        new DustParticleEffect((sample & 1) == 0 ? primary : secondary, hammer ? 1.25F : 0.9F),
                        point.x,
                        point.y,
                        point.z,
                        0.0D,
                        0.01D,
                        0.0D
                );
                if (sample == 0 || sample == 2) {
                    world.addParticleClient(
                            ModParticles.NOTE_SPARK,
                            point.x,
                            point.y,
                            point.z,
                            side.x * 0.018D,
                            0.025D,
                            side.z * 0.018D
                    );
                }
            }
        }

        if (harp && player.isUsingItem()) {
            double phase = clientTicks * 0.28D;
            Vec3d center = player.getEntityPos().add(0.0D, 1.0D, 0.0D);
            for (int note = 0; note < 3; note++) {
                double angle = phase + note * Math.PI * 2.0D / 3.0D;
                world.addParticleClient(
                        ModParticles.NOTE_SPARK,
                        center.x + Math.cos(angle) * 0.72D,
                        center.y + note * 0.18D,
                        center.z + Math.sin(angle) * 0.72D,
                        -Math.sin(angle) * 0.025D,
                        0.035D,
                        Math.cos(angle) * 0.025D
                );
            }
        }
    }

    private static void tickPortalAuras(ClientWorld world, ClientPlayerEntity player) {
        int found = 0;
        for (BlockPos pos : BlockPos.iterateOutwards(player.getBlockPos(), 8, 5, 8)) {
            if (!world.getBlockState(pos).isOf(ModBlocks.GLOCKENSPIEL_PORTAL)) {
                continue;
            }
            spawnPortalAura(world, pos, world.getTime() + found * 11L);
            found++;
            if (found >= 6) {
                break;
            }
        }
    }

    private static void spawnPortalAura(ClientWorld world, BlockPos pos, long tick) {
        double phase = tick * 0.16D;
        for (int strand = 0; strand < 4; strand++) {
            double angle = phase + strand * Math.PI * 0.5D;
            double radius = 0.52D + Math.sin(phase * 0.7D + strand) * 0.11D;
            double y = pos.getY() + 0.12D + (tick + strand * 7L) % 24L / 24.0D * 0.95D;
            double x = pos.getX() + 0.5D + Math.cos(angle) * radius;
            double z = pos.getZ() + 0.5D + Math.sin(angle) * radius;
            int color = strand == 0
                    ? FxPalette.GOLD
                    : strand == 3 ? FxPalette.MAGENTA : FxPalette.CYAN;
            world.addParticleClient(
                    new DustParticleEffect(color, 0.92F),
                    x,
                    y,
                    z,
                    -Math.sin(angle) * 0.018D,
                    0.018D,
                    Math.cos(angle) * 0.018D
            );
            world.addParticleClient(
                    strand == 3 ? ModParticles.NOTE_SPARK : ModParticles.BEAM_MOTE,
                    x,
                    y,
                    z,
                    -Math.sin(angle) * 0.025D,
                    0.022D,
                    Math.cos(angle) * 0.025D
            );
        }
    }

    private static void spawnDissonanzSpike(ClientWorld world, ClientPlayerEntity player, float spike) {
        Random random = world.getRandom();
        int amount = 9 + Math.min(22, (int) (spike * 70.0F));
        for (int particle = 0; particle < amount; particle++) {
            double angle = random.nextDouble() * Math.PI * 2.0D;
            double radius = 0.35D + random.nextDouble() * 1.35D;
            world.addParticleClient(
                    ModParticles.DISSONANZ_SMOKE,
                    player.getX() + Math.cos(angle) * radius,
                    player.getY() + 0.2D + random.nextDouble() * 1.9D,
                    player.getZ() + Math.sin(angle) * radius,
                    -Math.sin(angle) * 0.018D,
                    0.012D + random.nextDouble() * 0.025D,
                    Math.cos(angle) * 0.018D
            );
        }
    }

    private static void spawnAmbientDissonanz(ClientWorld world, ClientPlayerEntity player, float dissonanz) {
        Random random = world.getRandom();
        double angle = random.nextDouble() * Math.PI * 2.0D;
        double radius = 0.7D + random.nextDouble() * (0.8D + dissonanz);
        world.addParticleClient(
                ModParticles.DISSONANZ_SMOKE,
                player.getX() + Math.cos(angle) * radius,
                player.getY() + random.nextDouble() * 1.8D,
                player.getZ() + Math.sin(angle) * radius,
                -Math.sin(angle) * 0.012D,
                0.012D,
                Math.cos(angle) * 0.012D
        );
    }
}
