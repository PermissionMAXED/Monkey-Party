package de.aetherklang.item;

import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.Stimmung;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;

final class ResonanceItemUtil {
    private ResonanceItemUtil() {
    }

    static boolean isOnBeat(PlayerEntity player) {
        return player instanceof ServerPlayerEntity serverPlayer
                && BeatEngine.isOnBeat(serverPlayer, BeatEngine.GOOD_WINDOW);
    }

    static void gainRp(PlayerEntity player, int amount) {
        if (player instanceof ServerPlayerEntity serverPlayer) {
            ResonanceApi.addRp(serverPlayer, amount);
        }
    }

    static boolean spendRp(PlayerEntity player, int amount) {
        return player instanceof ServerPlayerEntity serverPlayer
                && ResonanceApi.spendRp(serverPlayer, amount);
    }

    static void setSilence(PlayerEntity player) {
        if (player instanceof ServerPlayerEntity serverPlayer) {
            ResonanceApi.setMood(serverPlayer, Stimmung.STILLE);
        }
    }

    static boolean hasFreude(PlayerEntity player) {
        return player instanceof ServerPlayerEntity serverPlayer
                && ResonanceApi.getMood(serverPlayer) == Stimmung.FREUDE;
    }

    static boolean hasZorn(PlayerEntity player) {
        return player instanceof ServerPlayerEntity serverPlayer
                && ResonanceApi.getMood(serverPlayer) == Stimmung.ZORN;
    }

    static DustParticleEffect moodDust(PlayerEntity player, float scale) {
        Stimmung mood = player instanceof ServerPlayerEntity serverPlayer
                ? ResonanceApi.getMood(serverPlayer)
                : Stimmung.STILLE;
        return new DustParticleEffect(moodColor(mood), scale);
    }

    static void playCast(ServerWorld world, PlayerEntity player, float pitch) {
        world.playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                ModSounds.RESONANCE_CAST,
                SoundCategory.PLAYERS,
                0.9F,
                pitch
        );
    }

    private static int moodColor(Stimmung mood) {
        return switch (mood) {
            case FREUDE -> 0xF5C95F;
            case ZORN -> 0xE03A8C;
            case TRAUER -> 0x4B71C8;
            case WUNDER -> 0x5FF5E0;
            case STILLE -> 0x8E82B8;
        };
    }
}
