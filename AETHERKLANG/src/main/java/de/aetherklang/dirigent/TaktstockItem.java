package de.aetherklang.dirigent;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * Baton used by a conductor to announce an ensemble's next chord.
 */
public final class TaktstockItem extends Item {
    private static final int COOLDOWN_TICKS = 20 * 5;

    public TaktstockItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity player, Hand hand) {
        ItemStack stack = player.getStackInHand(hand);
        if (player.getItemCooldownManager().isCoolingDown(stack)) {
            return ActionResult.FAIL;
        }
        if (!(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }
        if (!DirigentService.callNextChord(serverPlayer)) {
            return ActionResult.FAIL;
        }

        player.getItemCooldownManager().set(stack, COOLDOWN_TICKS);
        return ActionResult.SUCCESS_SERVER;
    }
}
