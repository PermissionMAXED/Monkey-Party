package de.aetherklang.schmiede;

import de.aetherklang.crescendo.EnsembleAkkordHooks;
import de.aetherklang.data.ContentCatalog;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.resonance.ResonanceApi;
import java.util.List;
import net.minecraft.component.type.TooltipDisplayComponent;
import net.minecraft.entity.LivingEntity;
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
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
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

    public String instrumentId() {
        return instrumentId;
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
        int rpCost = getRpCost();
        if (!ResonanceApi.spendRp(serverPlayer, rpCost)) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.rp.missing", rpCost), true);
            return ActionResult.FAIL;
        }

        int amplifier = tier == Klangstufe.VIRTUOS ? 1 : 0;
        int duration = 100 + tier.ordinal() * 40;
        applyInstrumentEffect(serverWorld, serverPlayer, tier, duration, amplifier);
        EnsembleAkkordHooks.notifyOnBeatAction(serverPlayer, ResonanceApi.getMood(serverPlayer));
        BeatEngine.grantPerfectTimingRp(serverPlayer);

        ReliktTyp relic = stack.get(SchmiedeComponents.RELIKT);
        if (relic != null) {
            ReliktEffects.apply(serverPlayer, relic, 180 + tier.ordinal() * 40, amplifier);
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
        stack.damage(1, serverPlayer);
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
        textConsumer.accept(
                Text.translatable("tooltip.aetherklang.instrument." + instrumentId)
                        .formatted(Formatting.AQUA)
        );
    }

    @Override
    public boolean hasGlint(ItemStack stack) {
        return SchmiedeComponents.getTier(stack) != Klangstufe.BASIS
                || stack.get(SchmiedeComponents.RELIKT) != null
                || super.hasGlint(stack);
    }

    private void applyInstrumentEffect(
            ServerWorld world,
            ServerPlayerEntity player,
            Klangstufe tier,
            int duration,
            int amplifier
    ) {
        switch (instrumentId) {
            case "pauke" -> playPauke(world, player, tier, duration, amplifier);
            case "sopranfloete" -> playSopranfloete(world, player, tier, duration, amplifier);
            case "kontrabass" -> playKontrabass(world, player, tier, duration, amplifier);
            case "triangel" -> playTriangel(world, player, tier, duration, amplifier);
            default -> throw new IllegalStateException("Unknown Klanginstrument '" + instrumentId + "'");
        }
    }

    private static void playPauke(
            ServerWorld world,
            ServerPlayerEntity player,
            Klangstufe tier,
            int duration,
            int amplifier
    ) {
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.STRENGTH, duration, amplifier));
        float damage = 3.0F + tier.ordinal() * 1.5F;
        for (LivingEntity target : hostileTargets(world, player, 6.0D)) {
            Vec3d push = target.getEntityPos().subtract(player.getEntityPos()).normalize();
            target.damage(world, player.getDamageSources().magic(), damage * ResonanceApi.getDamageMultiplier(player));
            target.addVelocity(push.x * 1.2D, 0.35D, push.z * 1.2D);
            target.velocityModified = true;
        }
    }

    private static void playSopranfloete(
            ServerWorld world,
            ServerPlayerEntity player,
            Klangstufe tier,
            int duration,
            int amplifier
    ) {
        float healing = 3.0F + tier.ordinal() * 1.5F;
        for (LivingEntity ally : alliedTargets(world, player, 8.0D)) {
            ally.heal(healing);
            ally.addStatusEffect(new StatusEffectInstance(StatusEffects.REGENERATION, duration, amplifier));
            ally.removeStatusEffect(StatusEffects.POISON);
        }
    }

    private static void playKontrabass(
            ServerWorld world,
            ServerPlayerEntity player,
            Klangstufe tier,
            int duration,
            int amplifier
    ) {
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.RESISTANCE, duration, amplifier));
        int controlAmplifier = tier == Klangstufe.VIRTUOS ? 2 : 1;
        for (LivingEntity target : hostileTargets(world, player, 8.0D)) {
            target.addStatusEffect(new StatusEffectInstance(StatusEffects.SLOWNESS, duration, controlAmplifier));
            target.addStatusEffect(new StatusEffectInstance(StatusEffects.WEAKNESS, duration, amplifier));
        }
    }

    private static void playTriangel(
            ServerWorld world,
            ServerPlayerEntity player,
            Klangstufe tier,
            int duration,
            int amplifier
    ) {
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.SPEED, duration, amplifier));
        int revealTicks = duration + tier.ordinal() * 40;
        for (LivingEntity target : hostileTargets(world, player, 16.0D)) {
            target.addStatusEffect(new StatusEffectInstance(StatusEffects.GLOWING, revealTicks, 0));
        }
    }

    private static List<LivingEntity> hostileTargets(ServerWorld world, ServerPlayerEntity player, double radius) {
        return world.getEntitiesByClass(
                LivingEntity.class,
                Box.of(player.getEntityPos(), radius * 2.0D, radius * 2.0D, radius * 2.0D),
                target -> target.isAlive() && target != player && !player.isTeammate(target)
        );
    }

    private static List<LivingEntity> alliedTargets(ServerWorld world, ServerPlayerEntity player, double radius) {
        return world.getEntitiesByClass(
                LivingEntity.class,
                Box.of(player.getEntityPos(), radius * 2.0D, radius * 2.0D, radius * 2.0D),
                target -> target.isAlive() && (target == player || player.isTeammate(target))
        );
    }

    private int getRpCost() {
        var definition = ContentCatalog.current().instruments().get(instrumentId);
        return definition == null ? 0 : definition.rpCost();
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
