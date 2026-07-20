package de.aetherklang.entity;

import de.aetherklang.registry.ModAttachments;
import de.aetherklang.resonance.BeatTiming;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.ResonancePlayerData;
import de.aetherklang.resonance.Stimmung;
import net.fabricmc.fabric.api.attachment.v1.AttachmentTarget;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.network.ServerPlayerEntity;

/**
 * Small bridge between entity combat and the frozen resonance attachment.
 */
public final class ResonanceEntityEffects {
    private ResonanceEntityEffects() {
    }

    public static boolean isOnBeat(PlayerEntity player) {
        return BeatTiming.fromPhase(state(player).getBeatPhase()) != BeatTiming.MISS;
    }

    public static float getDissonanz(PlayerEntity player) {
        return state(player).getDissonanz();
    }

    public static void addDissonanz(PlayerEntity player, float amount) {
        ResonancePlayerData state = state(player);
        state.setDissonanz(state.getDissonanz() + amount);
        if (player instanceof ServerPlayerEntity serverPlayer) {
            ResonanceApi.sync(serverPlayer);
        }
    }

    public static boolean isHealingMood(PlayerEntity player) {
        Stimmung mood = state(player).getMood();
        return mood == Stimmung.FREUDE || mood == Stimmung.WUNDER;
    }

    private static ResonancePlayerData state(PlayerEntity player) {
        if (player instanceof ServerPlayerEntity serverPlayer) {
            return ResonanceApi.getData(serverPlayer);
        }
        return ((AttachmentTarget) player).getAttachedOrCreate(ModAttachments.RESONANCE);
    }
}
