package de.aetherklang.dirigent;

import de.aetherklang.network.ModNetworking;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.AkkordEngine;
import de.aetherklang.resonance.EnsembleEngine;
import de.aetherklang.resonance.RangService;
import de.aetherklang.resonance.ResonanceApi;
import java.util.Collections;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;

/**
 * Owns the short-lived chord call shared by an active ensemble.
 */
public final class DirigentService {
    public static final int CALL_DURATION_TICKS = 20 * 30;
    public static final int MIN_ENSEMBLE_SIZE = 2;

    private static final Map<UUID, CallState> CALLS = new HashMap<>();
    private static final Map<UUID, Integer> LAST_CALLED_CHORDS = new HashMap<>();
    private static final Resolution NORMAL_RESOLUTION = new Resolution(1.0F, 1, false);
    private static boolean registered;

    private DirigentService() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;

        ServerTickEvents.END_SERVER_TICK.register(DirigentService::tick);
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) ->
                ModNetworking.sendDirigentSync(handler.getPlayer(), 0, 0, 100, 0, false)
        );
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) ->
                removePlayer(server, handler.getPlayer().getUuid())
        );
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> clear());
    }

    /**
     * Calls the next chord in score order for every member of the caller's ensemble.
     */
    public static boolean callNextChord(ServerPlayerEntity conductor) {
        if (!conductor.isAlive() || conductor.isSpectator()) {
            return false;
        }
        if (!conductor.isCreative()
                && RangService.getRang(ResonanceApi.getData(conductor)).ordinal()
                < RangService.Rang.DIRIGENT.ordinal()) {
            conductor.sendMessage(
                    Text.translatable("message.aetherklang.taktstock.rang_required"),
                    true
            );
            return false;
        }

        Set<UUID> members = new LinkedHashSet<>(EnsembleEngine.getEnsembleMembers(conductor));
        if (members.size() < MIN_ENSEMBLE_SIZE) {
            conductor.sendMessage(
                    Text.translatable("message.aetherklang.taktstock.ensemble_required"),
                    true
            );
            return false;
        }

        MinecraftServer server = conductor.getEntityWorld().getServer();
        Set<CallState> replacedCalls = Collections.newSetFromMap(new IdentityHashMap<>());
        for (UUID memberId : members) {
            CallState replaced = CALLS.get(memberId);
            if (replaced != null) {
                replacedCalls.add(replaced);
            }
        }
        replacedCalls.forEach(call -> clearCall(server, call, false));

        AkkordEngine.Akkord target = nextChord(conductor.getUuid());
        int currentTick = server.getTicks();
        CallState call = new CallState(
                conductor.getUuid(),
                target,
                Set.copyOf(members),
                currentTick + CALL_DURATION_TICKS
        );
        int amplification = amplificationPercent(members.size());
        for (UUID memberId : members) {
            CALLS.put(memberId, call);
            ServerPlayerEntity member = server.getPlayerManager().getPlayer(memberId);
            if (member == null) {
                continue;
            }
            ModNetworking.sendDirigentSync(
                    member,
                    target.networkId(),
                    members.size(),
                    amplification,
                    CALL_DURATION_TICKS,
                    false
            );
            member.sendMessage(
                    Text.translatable(
                            "message.aetherklang.taktstock.called",
                            conductor.getDisplayName(),
                            target.displayName(),
                            formatMultiplier(amplification)
                    ),
                    true
            );
        }
        playCallFeedback(conductor.getEntityWorld(), conductor);
        return true;
    }

    /**
     * Consumes a matching call and returns the strength for this chord resolution.
     */
    public static Resolution resolve(ServerPlayerEntity player, AkkordEngine.Akkord chord) {
        MinecraftServer server = player.getEntityWorld().getServer();
        CallState call = activeCall(server, player.getUuid());
        if (call == null || call.target() != chord) {
            return NORMAL_RESOLUTION;
        }

        Set<UUID> activeMembers = EnsembleEngine.getEnsembleMembers(player);
        int participatingMembers = (int) call.members().stream()
                .filter(activeMembers::contains)
                .count();
        if (participatingMembers < MIN_ENSEMBLE_SIZE) {
            clearCall(server, call, false);
            return NORMAL_RESOLUTION;
        }

        int amplification = amplificationPercent(participatingMembers);
        for (UUID memberId : call.members()) {
            if (CALLS.get(memberId) == call) {
                CALLS.remove(memberId);
            }
            ServerPlayerEntity member = server.getPlayerManager().getPlayer(memberId);
            if (member != null) {
                ModNetworking.sendDirigentSync(
                        member,
                        chord.networkId(),
                        participatingMembers,
                        amplification,
                        0,
                        true
                );
            }
        }

        player.sendMessage(
                Text.translatable(
                        "message.aetherklang.taktstock.resolved",
                        chord.displayName(),
                        formatMultiplier(amplification)
                ),
                true
        );
        playResolutionFeedback(player.getEntityWorld(), player, participatingMembers);
        return new Resolution(amplification / 100.0F, participatingMembers, true);
    }

    public static int amplificationPercent(int ensembleSize) {
        int extraMembers = Math.max(0, ensembleSize - 1);
        return Math.min(200, 100 + extraMembers * 25);
    }

    private static AkkordEngine.Akkord nextChord(UUID conductorId) {
        AkkordEngine.Akkord[] chords = AkkordEngine.Akkord.values();
        int previousNetworkId = LAST_CALLED_CHORDS.getOrDefault(conductorId, 0);
        int nextIndex = 0;
        for (int index = 0; index < chords.length; index++) {
            if (chords[index].networkId() == previousNetworkId) {
                nextIndex = (index + 1) % chords.length;
                break;
            }
        }
        AkkordEngine.Akkord next = chords[nextIndex];
        LAST_CALLED_CHORDS.put(conductorId, next.networkId());
        return next;
    }

    private static void tick(MinecraftServer server) {
        Set<CallState> uniqueCalls = Collections.newSetFromMap(new IdentityHashMap<>());
        uniqueCalls.addAll(CALLS.values());
        for (CallState call : uniqueCalls) {
            if (server.getTicks() >= call.expiresAtTick()) {
                clearCall(server, call, true);
            }
        }
    }

    private static CallState activeCall(MinecraftServer server, UUID memberId) {
        CallState call = CALLS.get(memberId);
        if (call == null) {
            return null;
        }
        if (server.getTicks() >= call.expiresAtTick()) {
            clearCall(server, call, true);
            return null;
        }
        return call;
    }

    private static void removePlayer(MinecraftServer server, UUID playerId) {
        LAST_CALLED_CHORDS.remove(playerId);
        CallState call = CALLS.get(playerId);
        if (call != null) {
            clearCall(server, call, false);
        }
    }

    private static void clearCall(MinecraftServer server, CallState call, boolean expired) {
        for (UUID memberId : call.members()) {
            if (CALLS.get(memberId) != call) {
                continue;
            }
            CALLS.remove(memberId);
            ServerPlayerEntity member = server.getPlayerManager().getPlayer(memberId);
            if (member != null) {
                ModNetworking.sendDirigentSync(member, 0, 0, 100, 0, false);
                if (expired) {
                    member.sendMessage(
                            Text.translatable("message.aetherklang.taktstock.expired"),
                            true
                    );
                }
            }
        }
    }

    private static void clear() {
        CALLS.clear();
        LAST_CALLED_CHORDS.clear();
    }

    private static void playCallFeedback(ServerWorld world, ServerPlayerEntity conductor) {
        world.spawnParticles(
                ModParticles.AKKORD_GLYPH,
                conductor.getX(),
                conductor.getBodyY(0.8D),
                conductor.getZ(),
                24,
                0.75D,
                0.9D,
                0.75D,
                0.04D
        );
        world.playSound(
                null,
                conductor.getX(),
                conductor.getY(),
                conductor.getZ(),
                ModSounds.ENSEMBLE_CHIME,
                SoundCategory.PLAYERS,
                1.0F,
                1.35F
        );
    }

    private static void playResolutionFeedback(
            ServerWorld world,
            ServerPlayerEntity player,
            int ensembleSize
    ) {
        world.spawnParticles(
                ModParticles.ENSEMBLE_FUNKE,
                player.getX(),
                player.getBodyY(0.6D),
                player.getZ(),
                20 + ensembleSize * 8,
                1.2D,
                0.9D,
                1.2D,
                0.08D
        );
        world.playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                ModSounds.AKKORD_COMPLETE,
                SoundCategory.PLAYERS,
                1.25F,
                1.45F
        );
    }

    private static String formatMultiplier(int amplification) {
        return String.format(java.util.Locale.ROOT, "%.2f", amplification / 100.0F);
    }

    public record Resolution(float multiplier, int ensembleSize, boolean amplified) {
    }

    private record CallState(
            UUID conductor,
            AkkordEngine.Akkord target,
            Set<UUID> members,
            int expiresAtTick
    ) {
    }
}
