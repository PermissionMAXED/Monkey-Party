package de.aetherklang.network;

import de.aetherklang.registry.ModCriteria;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.ResonancePlayerData;
import de.aetherklang.resonance.Stimmung;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.networking.v1.PlayerLookup;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec3d;

public final class ModNetworking {
    private static final int DASH_COST = 8;
    private static final int DASH_COOLDOWN_TICKS = 60;
    private static final int MOOD_CYCLE_COST = 2;
    private static final Map<UUID, Integer> LAST_DASH_TICKS = new HashMap<>();

    private ModNetworking() {
    }

    public static void register() {
        ServerPlayNetworking.registerGlobalReceiver(
                ModPayloads.DashPayload.ID,
                (payload, context) -> handleDash(payload, context.player())
        );
        ServerPlayNetworking.registerGlobalReceiver(
                ModPayloads.MoodCyclePayload.ID,
                (payload, context) -> handleMoodCycle(payload, context.player())
        );
        ServerPlayNetworking.registerGlobalReceiver(
                ModPayloads.KodexOpenPayload.ID,
                (payload, context) -> handleKodexOpen(payload, context.player())
        );
        ServerPlayConnectionEvents.JOIN.register(
                (handler, sender, server) -> ResonanceApi.sync(handler.getPlayer())
        );
        ServerPlayConnectionEvents.DISCONNECT.register(
                (handler, server) -> LAST_DASH_TICKS.remove(handler.getPlayer().getUuid())
        );
    }

    public static void handleDash(ModPayloads.DashPayload payload, ServerPlayerEntity player) {
        ItemStack boots = player.getEquippedStack(EquipmentSlot.FEET);
        float strength = Float.isFinite(payload.strength())
                ? Math.clamp(payload.strength(), 0.0F, 1.0F)
                : 0.0F;
        if (!player.isAlive()
                || player.isSpectator()
                || strength <= 0.0F
                || !boots.isOf(ModItems.ECHOSTIEFEL)) {
            return;
        }

        int currentTick = player.getEntityWorld().getServer().getTicks();
        Integer lastDashTick = LAST_DASH_TICKS.get(player.getUuid());
        if (lastDashTick != null && currentTick - lastDashTick < DASH_COOLDOWN_TICKS) {
            return;
        }
        if (!ResonanceApi.spendRp(player, DASH_COST)) {
            player.sendMessage(Text.translatable("message.aetherklang.rp.missing", DASH_COST), true);
            return;
        }
        LAST_DASH_TICKS.put(player.getUuid(), currentTick);

        ServerWorld world = player.getEntityWorld();
        Vec3d look = player.getRotationVector().multiply(1.0D, 0.0D, 1.0D);
        if (look.lengthSquared() < 0.01D) {
            look = Vec3d.of(player.getHorizontalFacing().getVector());
        }
        Vec3d dash = look.normalize().multiply(1.65D * strength);
        double vertical = player.isOnGround() ? 0.28D : Math.max(player.getVelocity().y, 0.05D);
        player.setVelocity(dash.x, vertical, dash.z);
        player.velocityModified = true;

        Vec3d start = player.getEntityPos().add(0.0D, 0.35D, 0.0D);
        Vec3d trailDirection = dash.normalize();
        for (int step = 0; step < 9; step++) {
            Vec3d trail = start.subtract(trailDirection.multiply(step * 0.32D));
            world.spawnParticles(
                    ModParticles.NOTE_SPARK,
                    trail.x,
                    trail.y,
                    trail.z,
                    3,
                    0.12D,
                    0.14D,
                    0.12D,
                    0.03D
            );
            world.spawnParticles(
                    moodDust(ResonanceApi.getMood(player)),
                    trail.x,
                    trail.y,
                    trail.z,
                    1,
                    0.05D,
                    0.05D,
                    0.05D,
                    0.0D
            );
        }

        world.playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                ModSounds.RESONANCE_CAST,
                SoundCategory.PLAYERS,
                0.9F,
                1.8F
        );
        boots.damage(1, player);
        player.getItemCooldownManager().set(boots, DASH_COOLDOWN_TICKS);
    }

    private static void handleMoodCycle(ModPayloads.MoodCyclePayload payload, ServerPlayerEntity player) {
        if (!player.isAlive() || player.isSpectator() || payload.direction() == 0) {
            return;
        }
        if (!player.isCreative() && !ResonanceApi.spendRp(player, MOOD_CYCLE_COST)) {
            player.sendMessage(Text.translatable("message.aetherklang.rp.missing", MOOD_CYCLE_COST), true);
            return;
        }

        Stimmung[] moods = Stimmung.values();
        int step = payload.direction() < 0 ? -1 : 1;
        Stimmung next = moods[Math.floorMod(ResonanceApi.getMood(player).ordinal() + step, moods.length)];
        ResonanceApi.setMood(player, next);
        player.sendMessage(
                Text.translatable("command.aetherklang.mood.set", Text.translatable(next.getTranslationKey())),
                true
        );
    }

    private static void handleKodexOpen(ModPayloads.KodexOpenPayload payload, ServerPlayerEntity player) {
        if (payload.opened() && player.isAlive() && !player.isSpectator()) {
            ModCriteria.KODEX_OPENED.trigger(player);
        }
    }

    public static void sendResonanceSync(ServerPlayerEntity player, ResonancePlayerData data) {
        if (ServerPlayNetworking.canSend(player, ModPayloads.ResonanceSyncPayload.ID)) {
            ServerPlayNetworking.send(player, ModPayloads.ResonanceSyncPayload.from(data));
        }
    }

    public static void sendBeatFx(ServerPlayerEntity player, int beat) {
        if (ServerPlayNetworking.canSend(player, ModPayloads.BeatFxPayload.ID)) {
            ServerPlayNetworking.send(player, new ModPayloads.BeatFxPayload(beat));
        }
    }

    public static void sendAkkordFx(ServerPlayerEntity player, int akkord) {
        if (ServerPlayNetworking.canSend(player, ModPayloads.AkkordFxPayload.ID)) {
            ServerPlayNetworking.send(player, new ModPayloads.AkkordFxPayload(akkord));
        }
    }

    public static void broadcastAkkordFx(ServerPlayerEntity source, int akkord) {
        Set<ServerPlayerEntity> recipients = new HashSet<>(
                PlayerLookup.around(source.getEntityWorld(), source.getEntityPos(), 32.0D)
        );
        recipients.add(source);
        for (ServerPlayerEntity recipient : recipients) {
            sendAkkordFx(recipient, akkord);
        }
    }

    public static void sendEnsembleSync(ServerPlayerEntity player, int ensembleSize) {
        if (ServerPlayNetworking.canSend(player, ModPayloads.EnsembleSyncPayload.ID)) {
            ServerPlayNetworking.send(
                    player,
                    new ModPayloads.EnsembleSyncPayload(Math.max(0, ensembleSize))
            );
        }
    }

    private static DustParticleEffect moodDust(Stimmung mood) {
        int color = switch (mood) {
            case FREUDE -> 0xF5C95F;
            case ZORN -> 0xE03A8C;
            case TRAUER -> 0x4B71C8;
            case WUNDER -> 0x5FF5E0;
            case STILLE -> 0x8E82B8;
        };
        return new DustParticleEffect(color, 0.85F);
    }
}
