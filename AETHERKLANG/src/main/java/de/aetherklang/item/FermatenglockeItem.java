package de.aetherklang.item;

import de.aetherklang.crescendo.InstrumentHooks;
import de.aetherklang.entity.FermateFeldEntity;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.resonance.BeatTiming;
import de.aetherklang.resonance.ResonanceApi;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.projectile.ProjectileEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * Throwable bell that unfolds a temporary Fermata field on impact.
 */
public final class FermatenglockeItem extends Item {
    private static final int RP_COST = 16;
    private static final int COOLDOWN_TICKS = 20 * 20;

    public FermatenglockeItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity player, Hand hand) {
        ItemStack stack = player.getStackInHand(hand);
        if (player.getItemCooldownManager().isCoolingDown(stack)) {
            return ActionResult.FAIL;
        }
        if (!(world instanceof ServerWorld serverWorld) || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }
        if (!InstrumentHooks.canUseFermatenglocke(serverPlayer)) {
            serverPlayer.sendMessage(
                    Text.translatable("rang.aetherklang.adept"),
                    true
            );
            return ActionResult.FAIL;
        }
        if (!ResonanceApi.spendRp(serverPlayer, RP_COST)) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.rp.missing", RP_COST), true);
            return ActionResult.FAIL;
        }

        BeatTiming timing = BeatEngine.getTiming(serverPlayer);
        FermateFeldEntity field = FermateFeldEntity.createThrown(serverWorld, serverPlayer);
        ProjectileEntity.spawn(field, serverWorld, stack);
        serverWorld.playSound(
                null,
                serverPlayer.getX(),
                serverPlayer.getY(),
                serverPlayer.getZ(),
                ModSounds.FERMATE_CHIME,
                SoundCategory.PLAYERS,
                0.9F,
                timing == BeatTiming.PERFECT ? 1.5F : timing == BeatTiming.GOOD ? 1.35F : 1.2F
        );

        BeatEngine.grantPerfectTimingRp(serverPlayer);
        stack.damage(1, serverPlayer);
        serverPlayer.getItemCooldownManager().set(stack, COOLDOWN_TICKS);
        return ActionResult.SUCCESS_SERVER;
    }
}
