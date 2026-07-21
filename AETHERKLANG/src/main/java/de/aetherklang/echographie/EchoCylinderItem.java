package de.aetherklang.echographie;

import java.util.function.Consumer;
import net.minecraft.component.type.TooltipDisplayComponent;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.tooltip.TooltipType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Formatting;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * Records one eight-beat phrase and replays it as an ensemble-capable echo.
 */
public final class EchoCylinderItem extends Item {
    public EchoCylinderItem(Settings settings) {
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

        EchoCylinderService.UseResult result =
                EchoCylinderService.use(serverPlayer, player.isSneaking());
        player.getItemCooldownManager().set(stack, result == EchoCylinderService.UseResult.REPLAYING ? 40 : 10);
        return result == EchoCylinderService.UseResult.BUSY
                ? ActionResult.FAIL
                : ActionResult.SUCCESS_SERVER;
    }

    @Override
    public void appendTooltip(
            ItemStack stack,
            TooltipContext context,
            TooltipDisplayComponent displayComponent,
            Consumer<Text> textConsumer,
            TooltipType type
    ) {
        textConsumer.accept(
                Text.translatable("tooltip.aetherklang.echozylinder.use")
                        .formatted(Formatting.AQUA)
        );
        textConsumer.accept(
                Text.translatable("tooltip.aetherklang.echozylinder.replace")
                        .formatted(Formatting.DARK_GRAY)
        );
    }
}
