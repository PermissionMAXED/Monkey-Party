package de.aetherklang.item;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.Stimmung;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.item.consume.UseAction;
import net.minecraft.particle.SimpleParticleType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * A drinkable mood attunement with a small resonance reward.
 */
public final class MoodElixirItem extends Item {
    private static final int RP_GAIN = 4;

    private final Stimmung mood;

    public MoodElixirItem(Settings settings, Stimmung mood) {
        super(settings);
        this.mood = mood;
    }

    @Override
    public ActionResult use(World world, net.minecraft.entity.player.PlayerEntity player, Hand hand) {
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
            ResonanceApi.setMood(player, mood);
            ResonanceApi.addRp(player, RP_GAIN);
            serverWorld.spawnParticles(
                    particle(),
                    player.getX(),
                    player.getBodyY(0.55D),
                    player.getZ(),
                    30,
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
                    0.75F,
                    pitch()
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

    private SimpleParticleType particle() {
        return switch (mood) {
            case FREUDE -> ModParticles.NOTE_SPARK;
            case ZORN -> ModParticles.KAKOPHON_FUNKE;
            case STILLE -> ModParticles.GENERALPAUSE_NEBEL;
            case TRAUER -> ModParticles.DISSONANZ_SMOKE;
            case WUNDER -> ModParticles.AKKORD_GLYPH;
        };
    }

    private float pitch() {
        return switch (mood) {
            case FREUDE -> 1.55F;
            case ZORN -> 0.75F;
            case STILLE -> 1.05F;
            case TRAUER -> 0.65F;
            case WUNDER -> 1.8F;
        };
    }
}
