package de.aetherklang.resonance;

import de.aetherklang.crescendo.ArmorHooks;
import de.aetherklang.network.ModNetworking;
import de.aetherklang.registry.ModAttachments;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import net.fabricmc.fabric.api.networking.v1.PlayerLookup;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;

/**
 * Public entry point for items, blocks and other gameplay systems that use resonance.
 */
public final class ResonanceApi {
    private static final int MOOD_TICK_INTERVAL = 100;
    private static final double FREUDE_AURA_RADIUS = 6.0D;

    private ResonanceApi() {
    }

    public static ResonancePlayerData getData(ServerPlayerEntity player) {
        return player.getAttachedOrCreate(ModAttachments.RESONANCE);
    }

    public static int addRp(ServerPlayerEntity player, int amount) {
        ResonancePlayerData data = getData(player);
        int previousRp = data.getRp();
        long updated = (long) data.getRp() + amount;
        data.setRp((int) Math.clamp(updated, 0L, ArmorHooks.getRpCap(player)));
        RangService.recordRpGain(player, data.getRp() - previousRp);
        sync(player);
        return data.getRp();
    }

    public static void setRp(ServerPlayerEntity player, int amount) {
        getData(player).setRp(Math.clamp(amount, 0, ArmorHooks.getRpCap(player)));
        sync(player);
    }

    public static boolean spendRp(ServerPlayerEntity player, int amount) {
        if (amount < 0) {
            throw new IllegalArgumentException("RP cost must not be negative");
        }

        ResonancePlayerData data = getData(player);
        if (data.getRp() < amount) {
            return false;
        }

        data.setRp(data.getRp() - amount);
        sync(player);
        return true;
    }

    public static void setMood(ServerPlayerEntity player, Stimmung mood) {
        getData(player).setMood(Objects.requireNonNull(mood, "mood"));
        sync(player);
    }

    public static Stimmung getMood(ServerPlayerEntity player) {
        return getData(player).getMood();
    }

    public static int getRp(ServerPlayerEntity player) {
        return getData(player).getRp();
    }

    public static boolean castResonance(ServerPlayerEntity player, int cost, Runnable onSuccess) {
        Objects.requireNonNull(onSuccess, "onSuccess");
        if (!spendRp(player, cost)) {
            return false;
        }

        onSuccess.run();
        sync(player);
        world(player).playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                ModSounds.RESONANCE_CAST,
                SoundCategory.PLAYERS,
                0.8F,
                1.0F
        );
        ModNetworking.sendBeatFx(player, BeatEngine.currentBeat(player));
        return true;
    }

    /**
     * A small outgoing-damage multiplier for ZORN integrations.
     */
    public static float getDamageMultiplier(ServerPlayerEntity player) {
        return getMood(player) == Stimmung.ZORN ? 1.10F : 1.0F;
    }

    /**
     * TRAUER integrations may halve the duration or strength of slowing effects.
     */
    public static float getSlownessMultiplier(ServerPlayerEntity player) {
        return getMood(player) == Stimmung.TRAUER ? 0.5F : 1.0F;
    }

    /**
     * Mob targeting integrations may scale their notice radius by this value.
     */
    public static float getMobNoticeMultiplier(ServerPlayerEntity player) {
        return getMood(player) == Stimmung.STILLE ? 0.75F : 1.0F;
    }

    public static void sync(ServerPlayerEntity player) {
        ModNetworking.sendResonanceSync(player, getData(player));
        RangService.sync(player);
    }

    static void tickMoodModifier(ServerPlayerEntity player) {
        if (world(player).getTime() % MOOD_TICK_INTERVAL != 0L) {
            return;
        }

        switch (getMood(player)) {
            case FREUDE -> healFreudeAura(player);
            case WUNDER -> applyWunder(player);
            case STILLE, ZORN, TRAUER -> {
                // These moods expose integration multipliers above and need no recurring effect.
            }
        }
    }

    private static void healFreudeAura(ServerPlayerEntity source) {
        Set<ServerPlayerEntity> targets = new HashSet<>(
                PlayerLookup.around(world(source), source.getEntityPos(), FREUDE_AURA_RADIUS)
        );
        targets.add(source);
        for (ServerPlayerEntity target : targets) {
            if (target.isAlive() && target.getHealth() < target.getMaxHealth()) {
                target.heal(0.5F);
            }
        }
    }

    private static void applyWunder(ServerPlayerEntity player) {
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.LUCK, 120, 0, true, false));
        world(player).spawnParticles(
                ModParticles.NOTE_SPARK,
                player.getX(),
                player.getBodyY(0.5D),
                player.getZ(),
                4,
                0.4D,
                0.6D,
                0.4D,
                0.01D
        );
    }

    private static ServerWorld world(ServerPlayerEntity player) {
        return (ServerWorld) player.getEntityWorld();
    }
}
