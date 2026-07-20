package de.aetherklang.crescendo;

import de.aetherklang.Aetherklang;
import de.aetherklang.network.ModNetworking;
import de.aetherklang.registry.ModItems;
import de.aetherklang.resonance.AkkordEngine;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.resonance.EnsembleEngine;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.Stimmung;
import java.lang.reflect.InvocationTargetException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import net.fabricmc.api.EnvType;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;

/**
 * Bridges successful rhythm interactions into the ensemble and chord engines.
 */
public final class EnsembleAkkordHooks {
    private static final String CLIENT_HUD = "de.aetherklang.client.AkkordHud";
    private static final Map<UUID, Long> LAST_ACTION_TICKS = new HashMap<>();
    private static boolean registered;

    private EnsembleAkkordHooks() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;

        EnsembleEngine.register();
        registerPlayerActions();
        registerLifecycle();
        registerClientHud();
    }

    /**
     * Minimal public hook for future instruments that already validated an on-beat action.
     */
    public static boolean notifyOnBeatAction(ServerPlayerEntity player, Stimmung mood) {
        if (!player.isAlive()
                || player.isSpectator()
                || !BeatEngine.isOnBeat(player, BeatEngine.GOOD_WINDOW)) {
            return false;
        }

        long tick = player.getEntityWorld().getTime();
        Long previousTick = LAST_ACTION_TICKS.put(player.getUuid(), tick);
        if (previousTick != null && previousTick == tick) {
            return false;
        }

        EnsembleEngine.onOnBeatAction(player);
        AkkordEngine.onOnBeatAction(player, mood);
        return true;
    }

    private static void registerPlayerActions() {
        AttackEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> {
            if (player instanceof ServerPlayerEntity serverPlayer && world instanceof ServerWorld) {
                notifyOnBeatAction(serverPlayer, ResonanceApi.getMood(serverPlayer));
            }
            return ActionResult.PASS;
        });

        UseItemCallback.EVENT.register((player, world, hand) -> {
            ItemStack stack = player.getStackInHand(hand);
            if (player instanceof ServerPlayerEntity serverPlayer
                    && world instanceof ServerWorld
                    && isImmediateResonanceInstrument(stack)
                    && !player.getItemCooldownManager().isCoolingDown(stack)) {
                notifyOnBeatAction(serverPlayer, ResonanceApi.getMood(serverPlayer));
            }
            return ActionResult.PASS;
        });
    }

    private static boolean isImmediateResonanceInstrument(ItemStack stack) {
        return stack.isOf(ModItems.STIMMGABEL)
                || stack.isOf(ModItems.RESONANZKLINGE)
                || stack.isOf(ModItems.BASSHAMMER);
    }

    private static void registerLifecycle() {
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayerEntity player = handler.getPlayer();
            ModNetworking.sendEnsembleSync(player, 0);
            ModNetworking.sendAkkordFx(player, AkkordEngine.encodeSequence(List.of()));
        });
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            UUID playerId = handler.getPlayer().getUuid();
            LAST_ACTION_TICKS.remove(playerId);
            AkkordEngine.removePlayer(playerId);
            EnsembleEngine.removePlayer(server, playerId);
        });
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
            LAST_ACTION_TICKS.clear();
            AkkordEngine.clear();
            EnsembleEngine.clear();
        });
    }

    private static void registerClientHud() {
        if (FabricLoader.getInstance().getEnvironmentType() != EnvType.CLIENT) {
            return;
        }
        try {
            Class.forName(CLIENT_HUD).getMethod("register").invoke(null);
        } catch (ClassNotFoundException | NoSuchMethodException | IllegalAccessException exception) {
            Aetherklang.LOGGER.error("Could not load the Akkord HUD", exception);
        } catch (InvocationTargetException exception) {
            Aetherklang.LOGGER.error("Could not initialize the Akkord HUD", exception.getCause());
        }
    }
}
