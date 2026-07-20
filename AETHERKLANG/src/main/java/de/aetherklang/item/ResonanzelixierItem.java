package de.aetherklang.item;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.item.consume.UseAction;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * A bottled fragment of Choral's cadence that restores RP and briefly sharpens
 * the drinker's movement and sense of timing.
 */
public final class ResonanzelixierItem extends Item {
    private static final int RP_GAIN = 12;
    private static final int EFFECT_DURATION_TICKS = 20 * 30;

    public ResonanzelixierItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity player, Hand hand) {
        player.setCurrentHand(hand);
        return ActionResult.CONSUME;
    }

    @Override
    public int getMaxUseTime(ItemStack stack, LivingEntity user) {
        return 32;
    }

    @Override
    public UseAction getUseAction(ItemStack stack) {
        return UseAction.DRINK;
    }

    @Override
    public ItemStack finishUsing(ItemStack stack, World world, LivingEntity user) {
        if (world instanceof ServerWorld serverWorld && user instanceof ServerPlayerEntity player) {
            ResonanceApi.addRp(player, RP_GAIN);
            player.addStatusEffect(new StatusEffectInstance(
                    StatusEffects.SPEED,
                    EFFECT_DURATION_TICKS,
                    0,
                    false,
                    true
            ));
            player.addStatusEffect(new StatusEffectInstance(
                    StatusEffects.LUCK,
                    EFFECT_DURATION_TICKS,
                    0,
                    false,
                    true
            ));
            serverWorld.spawnParticles(
                    ModParticles.AKKORD_GLYPH,
                    player.getX(),
                    player.getBodyY(0.55D),
                    player.getZ(),
                    28,
                    0.65D,
                    0.9D,
                    0.65D,
                    0.045D
            );
            serverWorld.playSound(
                    null,
                    player.getX(),
                    player.getY(),
                    player.getZ(),
                    ModSounds.AKKORD_COMPLETE,
                    SoundCategory.PLAYERS,
                    0.85F,
                    1.6F
            );

            if (!player.isInCreativeMode()) {
                stack.decrement(1);
                if (stack.isEmpty()) {
                    return new ItemStack(Items.GLASS_BOTTLE);
                }
                player.giveOrDropStack(new ItemStack(Items.GLASS_BOTTLE));
            }
        }
        return stack;
    }
}
