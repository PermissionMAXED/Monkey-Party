package de.aetherklang.schmiede;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import net.minecraft.component.type.TooltipDisplayComponent;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.tooltip.TooltipType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvent;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Formatting;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * Playable base instrument whose potency follows its forged tier and socket.
 */
public final class KlanginstrumentItem extends Item {
    private final String instrumentId;

    public KlanginstrumentItem(Settings settings, String instrumentId) {
        super(settings);
        this.instrumentId = instrumentId;
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

        Klangstufe tier = SchmiedeComponents.getTier(stack);
        int amplifier = tier == Klangstufe.VIRTUOS ? 1 : 0;
        int duration = 100 + tier.ordinal() * 40;
        applyInstrumentEffect(serverPlayer, duration, amplifier);

        ReliktTyp relic = stack.get(SchmiedeComponents.RELIKT);
        if (relic != null) {
            applyRelicEffect(serverPlayer, relic, 180 + tier.ordinal() * 40, amplifier);
        }

        serverWorld.spawnParticles(
                relic == null ? ModParticles.LEITMOTIV_NOTE : ModParticles.RELIKT_AURA,
                player.getX(),
                player.getBodyY(0.65D),
                player.getZ(),
                18 + tier.ordinal() * 8,
                0.7D,
                0.8D,
                0.7D,
                0.04D
        );
        serverWorld.playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                sound(),
                SoundCategory.PLAYERS,
                0.9F + tier.ordinal() * 0.15F,
                0.95F + tier.ordinal() * 0.1F
        );
        player.getItemCooldownManager().set(stack, 180 - tier.ordinal() * 35);
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
        Klangstufe tier = SchmiedeComponents.getTier(stack);
        Formatting color = switch (tier) {
            case BASIS -> Formatting.GRAY;
            case MEISTER -> Formatting.AQUA;
            case VIRTUOS -> Formatting.GOLD;
        };
        textConsumer.accept(
                Text.translatable(
                        "tooltip.aetherklang.schmiede.tier",
                        Text.translatable(tier.translationKey()).formatted(color)
                ).formatted(Formatting.DARK_GRAY)
        );

        ReliktTyp relic = stack.get(SchmiedeComponents.RELIKT);
        if (relic == null) {
            textConsumer.accept(
                    Text.translatable("tooltip.aetherklang.schmiede.socket_empty")
                            .formatted(Formatting.DARK_GRAY)
            );
        } else {
            textConsumer.accept(
                    Text.translatable(
                            "tooltip.aetherklang.schmiede.socket",
                            Text.translatable(relic.translationKey()).formatted(Formatting.LIGHT_PURPLE)
                    ).formatted(Formatting.DARK_GRAY)
            );
            textConsumer.accept(
                    Text.translatable("tooltip.aetherklang.schmiede.bonus." + relic.id())
                            .formatted(Formatting.DARK_PURPLE)
            );
        }
    }

    @Override
    public boolean hasGlint(ItemStack stack) {
        return SchmiedeComponents.getTier(stack) != Klangstufe.BASIS
                || stack.get(SchmiedeComponents.RELIKT) != null
                || super.hasGlint(stack);
    }

    private void applyInstrumentEffect(ServerPlayerEntity player, int duration, int amplifier) {
        switch (instrumentId) {
            case "pauke" ->
                    player.addStatusEffect(new StatusEffectInstance(StatusEffects.STRENGTH, duration, amplifier));
            case "sopranfloete" ->
                    player.addStatusEffect(new StatusEffectInstance(StatusEffects.REGENERATION, duration, amplifier));
            case "kontrabass" ->
                    player.addStatusEffect(new StatusEffectInstance(StatusEffects.RESISTANCE, duration, amplifier));
            case "triangel" ->
                    player.addStatusEffect(new StatusEffectInstance(StatusEffects.SPEED, duration, amplifier));
            default -> throw new IllegalStateException("Unknown Klanginstrument '" + instrumentId + "'");
        }
    }

    private static void applyRelicEffect(
            ServerPlayerEntity player,
            ReliktTyp relic,
            int duration,
            int amplifier
    ) {
        switch (relic) {
            case METRONOM ->
                    player.addStatusEffect(new StatusEffectInstance(StatusEffects.HASTE, duration, amplifier));
            case ECHO ->
                    player.addStatusEffect(new StatusEffectInstance(StatusEffects.ABSORPTION, duration, amplifier));
            case FERMATE ->
                    player.addStatusEffect(new StatusEffectInstance(StatusEffects.SLOW_FALLING, duration, amplifier));
            case CRESCENDO ->
                    player.addStatusEffect(new StatusEffectInstance(StatusEffects.STRENGTH, duration, amplifier));
            case OSTINATO ->
                    player.addStatusEffect(new StatusEffectInstance(StatusEffects.REGENERATION, duration, amplifier));
            case CADENZ ->
                    player.addStatusEffect(new StatusEffectInstance(StatusEffects.LUCK, duration, amplifier));
        }
    }

    private SoundEvent sound() {
        return switch (instrumentId) {
            case "pauke" -> ModSounds.PAUKE_HIT;
            case "sopranfloete" -> ModSounds.FLOETE_TONE;
            case "kontrabass" -> ModSounds.KONTRABASS_NOTE;
            case "triangel" -> ModSounds.TRIANGEL_CHIME;
            default -> throw new IllegalStateException("Unknown Klanginstrument '" + instrumentId + "'");
        };
    }
}
