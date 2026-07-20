package de.aetherklang.schmiede;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import net.minecraft.component.type.TooltipDisplayComponent;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.tooltip.TooltipType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Formatting;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * A relic can be activated directly or socketed into an instrument at a Klangamboss.
 */
public final class ReliktItem extends Item {
    private static final int EFFECT_TICKS = 20 * 15;
    private static final int COOLDOWN_TICKS = 20 * 30;

    private final ReliktTyp relic;

    public ReliktItem(Settings settings, ReliktTyp relic) {
        super(settings);
        this.relic = relic;
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

        ReliktEffects.apply(serverPlayer, relic, EFFECT_TICKS, 0);
        serverWorld.spawnParticles(
                ModParticles.RELIKT_AURA,
                player.getX(),
                player.getBodyY(0.6D),
                player.getZ(),
                24,
                0.75D,
                0.8D,
                0.75D,
                0.04D
        );
        serverWorld.playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                ModSounds.RELIKT_ACTIVATE,
                SoundCategory.PLAYERS,
                1.0F,
                0.9F + relic.ordinal() * 0.035F
        );
        serverPlayer.sendMessage(
                Text.translatable("message.aetherklang.relikt.activated", Text.translatable(relic.translationKey())),
                true
        );
        player.getItemCooldownManager().set(stack, COOLDOWN_TICKS);
        return ActionResult.SUCCESS_SERVER;
    }

    @Override
    public void appendTooltip(
            ItemStack stack,
            TooltipContext context,
            TooltipDisplayComponent displayComponent,
            java.util.function.Consumer<Text> textConsumer,
            TooltipType type
    ) {
        textConsumer.accept(
                Text.translatable("tooltip.aetherklang.schmiede.bonus." + relic.id())
                        .formatted(Formatting.DARK_PURPLE)
        );
        textConsumer.accept(Text.translatable("tooltip.aetherklang.relikt.use").formatted(Formatting.GRAY));
    }

    @Override
    public boolean hasGlint(ItemStack stack) {
        return true;
    }
}
