package de.aetherklang.insel;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModCriteria;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.world.KammertonWorld;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.network.ServerPlayerEntity;

/**
 * Sends the frozen region_sync contract once on every Klangmeer region entry.
 */
final class RegionSyncHooks {
    private static final Map<UUID, KlangmeerRegion> ACTIVE_REGIONS = new HashMap<>();
    private static int ticks;

    private RegionSyncHooks() {
    }

    static void register() {
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            if (++ticks % 10 != 0) {
                return;
            }
            for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
                update(player);
            }
        });
        ServerPlayConnectionEvents.DISCONNECT.register(
                (handler, server) -> ACTIVE_REGIONS.remove(handler.getPlayer().getUuid())
        );
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
            ACTIVE_REGIONS.clear();
            ticks = 0;
        });
    }

    private static void update(ServerPlayerEntity player) {
        UUID playerId = player.getUuid();
        if (!KammertonWorld.isKammerton(player.getEntityWorld())) {
            ACTIVE_REGIONS.remove(playerId);
            return;
        }

        KlangmeerRegion current = KlangmeerRegion.at(player.getBlockPos()).orElse(null);
        KlangmeerRegion previous = ACTIVE_REGIONS.get(playerId);
        if (current == null) {
            ACTIVE_REGIONS.remove(playerId);
            return;
        }
        if (current == previous) {
            return;
        }

        ACTIVE_REGIONS.put(playerId, current);
        switch (current) {
            case BASSGEWOELBE -> ModCriteria.REGION_BASSGEWOELBE.trigger(player);
            case ARPEGGIENMEER -> ModCriteria.REGION_ARPEGGIENMEER.trigger(player);
            case KAKOPHONIE_RIFF -> ModCriteria.REGION_KAKOPHONIE_RIFF.trigger(player);
            default -> {
            }
        }
        if (ServerPlayNetworking.canSend(player, ModPayloads.RegionSyncPayload.ID)) {
            ServerPlayNetworking.send(
                    player,
                    new ModPayloads.RegionSyncPayload(
                            current.id(),
                            current.anker().getX(),
                            current.anker().getY(),
                            current.anker().getZ()
                    )
            );
            Aetherklang.LOGGER.debug(
                    "region_sync sent to {} for {} at {}",
                    player.getName().getString(),
                    current.id(),
                    current.anker().toShortString()
            );
        }
    }
}
