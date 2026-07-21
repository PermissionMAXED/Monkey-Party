package de.aetherklang.komposition;

import de.aetherklang.crescendo.EnsembleAkkordHooks;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.resonance.BeatTiming;
import de.aetherklang.resonance.ResonanceApi;
import java.util.function.Consumer;
import net.minecraft.component.type.TooltipDisplayComponent;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.tooltip.TooltipType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Formatting;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * An editable spell scroll containing a three-to-five operation Klangwerk phrase.
 */
public final class ZauberpartiturItem extends Item {
    private static final int BASE_COOLDOWN_TICKS = 30;
    private final Zauberpartitur preset;

    public ZauberpartiturItem(Settings settings, Zauberpartitur preset) {
        super(settings);
        this.preset = preset;
    }

    public Zauberpartitur score(ItemStack stack) {
        return stack.getOrDefault(KompositionComponents.ZAUBERPARTITUR, preset);
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

        if (player.isSneaking()) {
            KompositionNetworking.openEditor(serverPlayer, hand);
            return ActionResult.SUCCESS_SERVER;
        }

        Zauberpartitur score = score(stack);
        int cost = ZauberpartiturExecutor.rpCost(score);
        BeatTiming timing = BeatEngine.getTiming(serverPlayer);
        float timingMultiplier = switch (timing) {
            case PERFECT -> 1.5F;
            case GOOD -> 1.25F;
            case MISS -> 1.0F;
        };
        if (!ResonanceApi.castResonance(
                serverPlayer,
                cost,
                () -> ZauberpartiturExecutor.execute(serverWorld, serverPlayer, score, timingMultiplier)
        )) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.rp.missing", cost), true);
            return ActionResult.FAIL;
        }

        if (timing != BeatTiming.MISS) {
            EnsembleAkkordHooks.notifyOnBeatAction(serverPlayer, ResonanceApi.getMood(serverPlayer));
        }
        if (timing == BeatTiming.PERFECT) {
            BeatEngine.grantPerfectTimingRp(serverPlayer);
        }
        serverPlayer.sendMessage(
                Text.translatable(
                        "message.aetherklang.zauberpartitur.cast",
                        Text.translatable("komposition.aetherklang.timing." + timing.name().toLowerCase()),
                        cost
                ),
                true
        );
        player.getItemCooldownManager().set(stack, BASE_COOLDOWN_TICKS + score.operations().size() * 5);
        return ActionResult.SUCCESS_SERVER;
    }

    @Override
    public void appendTooltip(
            ItemStack stack,
            TooltipContext context,
            TooltipDisplayComponent displayComponent,
            Consumer<Text> textConsumer,
            TooltipType type
    ) {
        Zauberpartitur score = score(stack);
        textConsumer.accept(
                Text.translatable("tooltip.aetherklang.zauberpartitur.operations", score.operations().size())
                        .formatted(Formatting.GOLD)
        );
        for (int index = 0; index < score.operations().size(); index++) {
            textConsumer.accept(
                    Text.translatable(
                            "tooltip.aetherklang.zauberpartitur.operation",
                            index + 1,
                            Text.translatable(Zauberpartitur.operationTranslationKey(score.operations().get(index)))
                    ).formatted(Formatting.AQUA)
            );
        }
        textConsumer.accept(
                Text.translatable(
                        "tooltip.aetherklang.zauberpartitur.cost",
                        ZauberpartiturExecutor.rpCost(score)
                ).formatted(Formatting.LIGHT_PURPLE)
        );
        textConsumer.accept(
                Text.translatable("tooltip.aetherklang.zauberpartitur.edit")
                        .formatted(Formatting.DARK_GRAY)
        );
    }

    @Override
    public boolean hasGlint(ItemStack stack) {
        return true;
    }
}
