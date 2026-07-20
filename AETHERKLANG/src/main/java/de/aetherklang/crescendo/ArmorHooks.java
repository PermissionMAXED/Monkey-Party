package de.aetherklang.crescendo;

import de.aetherklang.Aetherklang;
import de.aetherklang.item.EchostiefelItem;
import de.aetherklang.item.KlangweberBeineItem;
import de.aetherklang.item.KlangweberBrustItem;
import de.aetherklang.item.KlangweberHelmItem;
import de.aetherklang.item.KlangweberStiefelItem;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.ResonancePlayerData;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;

/**
 * Shared gameplay hooks for the Klangweber armor set.
 */
public final class ArmorHooks {
    public static final float NACHHALL_STRENGTH = 0.5F;
    public static final int NACHHALL_DELAY_TICKS = 10;
    public static final int DEFAULT_DASH_COST = 8;

    private static final Map<UUID, List<ScheduledEcho>> SCHEDULED_ECHOES = new HashMap<>();
    private static boolean registered;

    private ArmorHooks() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerTickEvents.END_SERVER_TICK.register(ArmorHooks::tick);
        ServerPlayConnectionEvents.DISCONNECT.register(
                (handler, server) -> SCHEDULED_ECHOES.remove(handler.getPlayer().getUuid())
        );
    }

    public static int countKlangweberPieces(LivingEntity wearer) {
        int pieces = 0;
        pieces += isEquipped(wearer, EquipmentSlot.HEAD, KlangweberHelmItem.class) ? 1 : 0;
        pieces += isEquipped(wearer, EquipmentSlot.CHEST, KlangweberBrustItem.class) ? 1 : 0;
        pieces += isEquipped(wearer, EquipmentSlot.LEGS, KlangweberBeineItem.class) ? 1 : 0;
        pieces += isEquipped(wearer, EquipmentSlot.FEET, KlangweberStiefelItem.class) ? 1 : 0;
        return pieces;
    }

    public static boolean hasHelm(LivingEntity wearer) {
        return isEquipped(wearer, EquipmentSlot.HEAD, KlangweberHelmItem.class);
    }

    public static boolean hasFullSet(LivingEntity wearer) {
        return countKlangweberPieces(wearer) == 4;
    }

    public static int getRpCap(LivingEntity wearer) {
        return ResonancePlayerData.MAX_RP
                + (isEquipped(wearer, EquipmentSlot.CHEST, KlangweberBrustItem.class)
                ? KlangweberBrustItem.RP_CAP_BONUS
                : 0);
    }

    public static float getGoodWindow(LivingEntity wearer, float baseWindow) {
        return baseWindow
                + (isEquipped(wearer, EquipmentSlot.LEGS, KlangweberBeineItem.class)
                ? KlangweberBeineItem.GOOD_WINDOW_BONUS
                : 0.0F);
    }

    public static boolean canDash(ItemStack boots) {
        Item item = boots.getItem();
        return item instanceof EchostiefelItem || item instanceof KlangweberStiefelItem;
    }

    public static int getDashCost(ItemStack boots) {
        return boots.getItem() instanceof KlangweberStiefelItem
                ? KlangweberStiefelItem.DASH_COST
                : DEFAULT_DASH_COST;
    }

    /**
     * Queues a half-strength replay for the next beat when the player wears all four pieces.
     */
    public static boolean scheduleNachhall(ServerPlayerEntity player, Consumer<Float> echoAction) {
        if (!hasFullSet(player)) {
            return false;
        }

        int executeTick = player.getEntityWorld().getServer().getTicks() + NACHHALL_DELAY_TICKS;
        SCHEDULED_ECHOES.computeIfAbsent(player.getUuid(), ignored -> new ArrayList<>())
                .add(new ScheduledEcho(executeTick, echoAction));
        return true;
    }

    private static void tick(MinecraftServer server) {
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            clampRpToActiveCap(player);
        }

        int currentTick = server.getTicks();
        List<PendingEcho> pending = new ArrayList<>();
        Iterator<Map.Entry<UUID, List<ScheduledEcho>>> players = SCHEDULED_ECHOES.entrySet().iterator();
        while (players.hasNext()) {
            Map.Entry<UUID, List<ScheduledEcho>> entry = players.next();
            Iterator<ScheduledEcho> echoes = entry.getValue().iterator();
            while (echoes.hasNext()) {
                ScheduledEcho echo = echoes.next();
                if (echo.executeTick() <= currentTick) {
                    pending.add(new PendingEcho(entry.getKey(), echo.action()));
                    echoes.remove();
                }
            }
            if (entry.getValue().isEmpty()) {
                players.remove();
            }
        }

        for (PendingEcho echo : pending) {
            ServerPlayerEntity player = server.getPlayerManager().getPlayer(echo.playerId());
            if (player == null || !player.isAlive() || !hasFullSet(player)) {
                continue;
            }
            playNachhallFx(player);
            try {
                echo.action().accept(NACHHALL_STRENGTH);
            } catch (RuntimeException exception) {
                Aetherklang.LOGGER.error("Klangweber Nachhall action failed for {}", player.getName().getString(), exception);
            }
        }
    }

    private static void clampRpToActiveCap(ServerPlayerEntity player) {
        ResonancePlayerData data = ResonanceApi.getData(player);
        int cap = getRpCap(player);
        if (data.getRp() > cap) {
            data.setRp(cap);
            ResonanceApi.sync(player);
        }
    }

    private static void playNachhallFx(ServerPlayerEntity player) {
        ServerWorld world = player.getEntityWorld();
        world.spawnParticles(
                ModParticles.BEAT_RING,
                player.getX(),
                player.getBodyY(0.5D),
                player.getZ(),
                18,
                0.75D,
                0.55D,
                0.75D,
                0.035D
        );
        world.spawnParticles(
                ModParticles.NOTE_SPARK,
                player.getX(),
                player.getBodyY(0.6D),
                player.getZ(),
                10,
                0.55D,
                0.75D,
                0.55D,
                0.045D
        );
        world.playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                ModSounds.RESONANCE_CAST,
                SoundCategory.PLAYERS,
                0.55F,
                1.65F
        );
    }

    private static boolean isEquipped(
            LivingEntity wearer,
            EquipmentSlot slot,
            Class<? extends Item> itemType
    ) {
        return itemType.isInstance(wearer.getEquippedStack(slot).getItem());
    }

    private record ScheduledEcho(int executeTick, Consumer<Float> action) {
    }

    private record PendingEcho(UUID playerId, Consumer<Float> action) {
    }
}
