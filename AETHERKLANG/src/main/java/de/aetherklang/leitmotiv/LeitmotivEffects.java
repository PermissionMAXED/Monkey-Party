package de.aetherklang.leitmotiv;

import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.ResonancePlayerData;
import net.minecraft.server.network.ServerPlayerEntity;

/**
 * Centralized, server-authoritative evaluation of unlocked node modifiers.
 */
public final class LeitmotivEffects {
    private LeitmotivEffects() {
    }

    public static int getRpCapBonus(ServerPlayerEntity player) {
        return Math.round(sum(player, LeitmotivEffect.RP_CAP));
    }

    public static float getGoodWindow(ServerPlayerEntity player, float baseWindow) {
        return Math.min(0.5F, baseWindow + sum(player, LeitmotivEffect.GOOD_WINDOW));
    }

    public static float getPerfectWindow(ServerPlayerEntity player, float baseWindow) {
        return Math.min(0.5F, baseWindow + sum(player, LeitmotivEffect.PERFECT_WINDOW));
    }

    public static float getDamageMultiplier(ServerPlayerEntity player) {
        return 1.0F + sum(player, LeitmotivEffect.DAMAGE_MULTIPLIER);
    }

    public static float getHealingMultiplier(ServerPlayerEntity player) {
        return 1.0F + sum(player, LeitmotivEffect.HEALING_MULTIPLIER);
    }

    public static float getDissonanceDecayMultiplier(ServerPlayerEntity player) {
        return 1.0F + sum(player, LeitmotivEffect.DISSONANCE_DECAY_MULTIPLIER);
    }

    public static int adjustDashCost(ServerPlayerEntity player, int baseCost) {
        int reduction = Math.round(sum(player, LeitmotivEffect.DASH_COST_REDUCTION));
        return Math.max(1, baseCost - reduction);
    }

    public static int adjustRpGain(ServerPlayerEntity player, int amount) {
        if (amount <= 0) {
            return amount;
        }
        return Math.addExact(amount, Math.round(sum(player, LeitmotivEffect.RP_GAIN)));
    }

    private static float sum(ServerPlayerEntity player, LeitmotivEffect effect) {
        return sum(ResonanceApi.getData(player), effect);
    }

    static float sum(ResonancePlayerData data, LeitmotivEffect effect) {
        float total = 0.0F;
        for (LeitmotivNode node : LeitmotivTree.all()) {
            if (node.effect() == effect && data.isLeitmotivNodeUnlocked(node.id())) {
                total += node.amount();
            }
        }
        return total;
    }
}
