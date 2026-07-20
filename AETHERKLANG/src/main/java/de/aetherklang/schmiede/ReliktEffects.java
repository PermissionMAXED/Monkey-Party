package de.aetherklang.schmiede;

import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.server.network.ServerPlayerEntity;

/**
 * Shared relic effects used by loose relics and forged instrument sockets.
 */
public final class ReliktEffects {
    private ReliktEffects() {
    }

    public static void apply(ServerPlayerEntity player, ReliktTyp relic, int duration, int amplifier) {
        switch (relic) {
            case METRONOM ->
                    add(player, StatusEffects.HASTE, duration, amplifier);
            case ECHO ->
                    add(player, StatusEffects.ABSORPTION, duration, amplifier);
            case FERMATE ->
                    add(player, StatusEffects.SLOW_FALLING, duration, amplifier);
            case CRESCENDO ->
                    add(player, StatusEffects.STRENGTH, duration, amplifier);
            case OSTINATO ->
                    add(player, StatusEffects.REGENERATION, duration, amplifier);
            case CADENZ ->
                    add(player, StatusEffects.LUCK, duration, amplifier);
            case LEGATO ->
                    add(player, StatusEffects.HEALTH_BOOST, duration, amplifier);
            case STACCATO ->
                    add(player, StatusEffects.JUMP_BOOST, duration, amplifier);
            case FORTISSIMO ->
                    add(player, StatusEffects.FIRE_RESISTANCE, duration, amplifier);
            case PIANISSIMO ->
                    add(player, StatusEffects.INVISIBILITY, duration, amplifier);
            case HARMONIE ->
                    add(player, StatusEffects.RESISTANCE, duration, amplifier);
            case DISSONANZ -> {
                add(player, StatusEffects.NIGHT_VISION, duration, amplifier);
                player.removeStatusEffect(StatusEffects.DARKNESS);
            }
        }
    }

    private static void add(
            ServerPlayerEntity player,
            net.minecraft.registry.entry.RegistryEntry<net.minecraft.entity.effect.StatusEffect> effect,
            int duration,
            int amplifier
    ) {
        player.addStatusEffect(new StatusEffectInstance(effect, duration, amplifier));
    }
}
