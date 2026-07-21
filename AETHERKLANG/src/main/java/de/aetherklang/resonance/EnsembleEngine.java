package de.aetherklang.resonance;

import de.aetherklang.network.ModNetworking;
import de.aetherklang.registry.ModCriteria;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.entity.Entity;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;

/**
 * Forms short-lived ensembles when nearby players act on the same server beat.
 */
public final class EnsembleEngine {
    public static final double LINK_RADIUS = 12.0D;
    public static final int LINK_DURATION_TICKS = 20 * 10;
    public static final int RP_BONUS = 1;

    private static final double LINK_RADIUS_SQUARED = LINK_RADIUS * LINK_RADIUS;
    private static final Map<UUID, RecentAction> RECENT_ACTIONS = new HashMap<>();
    private static final Map<UUID, RecentEchoAction> RECENT_ECHO_ACTIONS = new HashMap<>();
    private static final Map<UUID, LinkState> LINKS = new HashMap<>();
    private static final Map<UUID, Integer> LAST_BONUS_BEATS = new HashMap<>();
    private static boolean registered;

    private EnsembleEngine() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerTickEvents.END_SERVER_TICK.register(EnsembleEngine::tick);
    }

    /**
     * Records one validated on-beat action and applies any resulting ensemble bonus.
     */
    public static void onOnBeatAction(ServerPlayerEntity player) {
        int beat = currentBeat(player);
        int tick = player.getEntityWorld().getServer().getTicks();
        RecentAction action = new RecentAction(beat, tick);
        RECENT_ACTIONS.put(player.getUuid(), action);

        Set<UUID> sameBeatPlayers = findNearbySameBeatPlayers(player, beat);
        LinkState currentLink = activeLink(player.getUuid(), tick);
        if (!sameBeatPlayers.isEmpty()) {
            sameBeatPlayers.add(player.getUuid());
            LinkState linked = linkOrRefresh(player, sameBeatPlayers, tick);
            awardEstablishingBeatBonuses(player.getEntityWorld().getServer(), linked, beat);
        } else if (currentLink != null) {
            awardBonus(player, beat);
        }
        linkRecentEchoAction(player, beat, tick);
    }

    /**
     * Pairs a replayed Echographie action with its owner's action on the same beat.
     */
    public static void onEchoAction(ServerPlayerEntity owner, Entity echo) {
        int beat = currentBeat(owner);
        int tick = owner.getEntityWorld().getServer().getTicks();
        if (echo.getEntityWorld() != owner.getEntityWorld()
                || echo.squaredDistanceTo(owner) > LINK_RADIUS_SQUARED) {
            return;
        }
        RECENT_ECHO_ACTIONS.put(
                echo.getUuid(),
                new RecentEchoAction(owner.getUuid(), beat, tick, echo)
        );
        RecentAction ownerAction = RECENT_ACTIONS.get(owner.getUuid());
        if (ownerAction == null || ownerAction.beat() != beat) {
            return;
        }
        linkEcho(owner, echo, beat, tick);
    }

    private static void linkEcho(ServerPlayerEntity owner, Entity echo, int beat, int tick) {
        LinkState existing = activeLink(owner.getUuid(), tick);
        Set<UUID> members = new LinkedHashSet<>();
        if (existing != null) {
            members.addAll(existing.members());
        }
        boolean newlyLinked = !members.contains(echo.getUuid());
        members.add(owner.getUuid());
        members.add(echo.getUuid());

        LinkState linked = new LinkState(Set.copyOf(members), tick + LINK_DURATION_TICKS);
        MinecraftServer server = owner.getEntityWorld().getServer();
        for (UUID memberId : members) {
            LINKS.put(memberId, linked);
            sync(server, memberId, linked.members());
        }
        awardBonus(owner, beat);
        if (newlyLinked) {
            playLinkFeedback(owner);
            ModCriteria.FIRST_ENSEMBLE.trigger(owner);
        }
    }

    private static void linkRecentEchoAction(ServerPlayerEntity owner, int beat, int tick) {
        for (RecentEchoAction action : RECENT_ECHO_ACTIONS.values()) {
            Entity echo = action.echo();
            if (!action.ownerId().equals(owner.getUuid())
                    || action.beat() != beat
                    || !echo.isAlive()
                    || echo.getEntityWorld() != owner.getEntityWorld()
                    || echo.squaredDistanceTo(owner) > LINK_RADIUS_SQUARED) {
                continue;
            }
            linkEcho(owner, echo, beat, tick);
        }
    }

    public static int getEnsembleSize(ServerPlayerEntity player) {
        LinkState link = activeLink(
                player.getUuid(),
                player.getEntityWorld().getServer().getTicks()
        );
        return link == null ? 0 : link.members().size();
    }

    public static Set<UUID> getEnsembleMembers(ServerPlayerEntity player) {
        LinkState link = activeLink(
                player.getUuid(),
                player.getEntityWorld().getServer().getTicks()
        );
        return link == null ? Set.of(player.getUuid()) : link.members();
    }

    public static void removePlayer(MinecraftServer server, UUID playerId) {
        RECENT_ACTIONS.remove(playerId);
        LAST_BONUS_BEATS.remove(playerId);
        removeMember(server, playerId);
    }

    /**
     * Removes a synthetic Echographie voice as soon as its replay ends.
     */
    public static void removeEcho(MinecraftServer server, UUID echoId) {
        RECENT_ECHO_ACTIONS.remove(echoId);
        removeMember(server, echoId);
    }

    private static void removeMember(MinecraftServer server, UUID memberId) {
        LinkState link = LINKS.remove(memberId);
        if (link == null) {
            return;
        }

        Set<UUID> remaining = new LinkedHashSet<>(link.members());
        remaining.remove(memberId);
        if (remaining.size() < 2) {
            for (UUID remainingId : remaining) {
                LINKS.remove(remainingId);
                sync(server, remainingId, Set.of());
            }
            return;
        }

        LinkState reduced = new LinkState(Set.copyOf(remaining), link.expiresAtTick());
        for (UUID remainingId : remaining) {
            LINKS.put(remainingId, reduced);
            sync(server, remainingId, reduced.members());
        }
    }

    public static void clear() {
        RECENT_ACTIONS.clear();
        RECENT_ECHO_ACTIONS.clear();
        LINKS.clear();
        LAST_BONUS_BEATS.clear();
    }

    private static Set<UUID> findNearbySameBeatPlayers(ServerPlayerEntity player, int beat) {
        Set<UUID> nearby = new LinkedHashSet<>();
        MinecraftServer server = player.getEntityWorld().getServer();
        for (Map.Entry<UUID, RecentAction> entry : RECENT_ACTIONS.entrySet()) {
            if (entry.getKey().equals(player.getUuid()) || entry.getValue().beat() != beat) {
                continue;
            }

            ServerPlayerEntity candidate = server.getPlayerManager().getPlayer(entry.getKey());
            if (candidate == null
                    || !candidate.isAlive()
                    || candidate.getEntityWorld() != player.getEntityWorld()
                    || candidate.squaredDistanceTo(player) > LINK_RADIUS_SQUARED) {
                continue;
            }
            nearby.add(candidate.getUuid());
        }
        return nearby;
    }

    private static LinkState linkOrRefresh(
            ServerPlayerEntity source,
            Set<UUID> sameBeatPlayers,
            int currentTick
    ) {
        Set<UUID> members = new LinkedHashSet<>(sameBeatPlayers);
        for (UUID playerId : List.copyOf(members)) {
            LinkState existing = activeLink(playerId, currentTick);
            if (existing != null) {
                members.addAll(existing.members());
            }
        }

        LinkState link = new LinkState(Set.copyOf(members), currentTick + LINK_DURATION_TICKS);
        boolean newlyLinked = getEnsembleSize(source) < 2;
        MinecraftServer server = source.getEntityWorld().getServer();
        for (UUID memberId : members) {
            LINKS.put(memberId, link);
            sync(server, memberId, link.members());
        }
        if (newlyLinked) {
            playLinkFeedback(source);
            for (UUID memberId : members) {
                ServerPlayerEntity member = server.getPlayerManager().getPlayer(memberId);
                if (member != null) {
                    ModCriteria.FIRST_ENSEMBLE.trigger(member);
                }
            }
        }
        return link;
    }

    private static void awardEstablishingBeatBonuses(
            MinecraftServer server,
            LinkState link,
            int beat
    ) {
        for (UUID memberId : link.members()) {
            RecentAction action = RECENT_ACTIONS.get(memberId);
            ServerPlayerEntity member = server.getPlayerManager().getPlayer(memberId);
            if (action != null && action.beat() == beat && member != null) {
                awardBonus(member, beat);
            }
        }
    }

    private static void awardBonus(ServerPlayerEntity player, int beat) {
        Integer lastBonusBeat = LAST_BONUS_BEATS.put(player.getUuid(), beat);
        if (lastBonusBeat != null && lastBonusBeat == beat) {
            return;
        }
        ResonanceApi.addRp(player, RP_BONUS);
    }

    private static void playLinkFeedback(ServerPlayerEntity source) {
        ServerWorld world = source.getEntityWorld();
        world.spawnParticles(
                ModParticles.ENSEMBLE_FUNKE,
                source.getX(),
                source.getBodyY(0.65D),
                source.getZ(),
                24,
                1.0D,
                0.75D,
                1.0D,
                0.05D
        );
        world.playSound(
                null,
                source.getX(),
                source.getY(),
                source.getZ(),
                ModSounds.ENSEMBLE_CHIME,
                SoundCategory.PLAYERS,
                0.9F,
                1.15F
        );
    }

    private static void tick(MinecraftServer server) {
        int currentTick = server.getTicks();
        Set<LinkState> uniqueLinks = java.util.Collections.newSetFromMap(new IdentityHashMap<>());
        uniqueLinks.addAll(LINKS.values());
        for (LinkState link : uniqueLinks) {
            if (currentTick < link.expiresAtTick()) {
                continue;
            }
            for (UUID memberId : link.members()) {
                if (LINKS.get(memberId) == link) {
                    LINKS.remove(memberId);
                    sync(server, memberId, Set.of());
                }
            }
        }

        if (currentTick % 20 == 0) {
            int oldestRelevantTick = currentTick - 20;
            RECENT_ACTIONS.entrySet().removeIf(entry -> entry.getValue().tick() < oldestRelevantTick);
            RECENT_ECHO_ACTIONS.entrySet().removeIf(entry ->
                    entry.getValue().tick() < oldestRelevantTick || !entry.getValue().echo().isAlive()
            );
            Set<UUID> trackedPlayers = new HashSet<>(server.getPlayerManager().getPlayerList()
                    .stream()
                    .map(ServerPlayerEntity::getUuid)
                    .toList());
            LAST_BONUS_BEATS.keySet().retainAll(trackedPlayers);
        }
    }

    private static LinkState activeLink(UUID playerId, int currentTick) {
        LinkState link = LINKS.get(playerId);
        if (link != null && currentTick < link.expiresAtTick()) {
            return link;
        }
        return null;
    }

    private static void sync(MinecraftServer server, UUID playerId, Set<UUID> members) {
        ServerPlayerEntity player = server.getPlayerManager().getPlayer(playerId);
        if (player != null) {
            ModNetworking.sendEnsembleSync(player, members.size());
            ModNetworking.sendEnsembleMembers(player, members);
        }
    }

    private static int currentBeat(ServerPlayerEntity player) {
        float ticksPerBeat = 20.0F / (BeatEngine.TEMPO_BPM / 60.0F);
        return (int) (player.getEntityWorld().getTime() / ticksPerBeat);
    }

    private record RecentAction(int beat, int tick) {
    }

    private record RecentEchoAction(UUID ownerId, int beat, int tick, Entity echo) {
    }

    private record LinkState(Set<UUID> members, int expiresAtTick) {
    }
}
