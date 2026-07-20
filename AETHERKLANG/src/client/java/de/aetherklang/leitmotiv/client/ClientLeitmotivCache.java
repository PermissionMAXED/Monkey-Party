package de.aetherklang.leitmotiv.client;

import de.aetherklang.registry.ModPayloads;
import java.util.Set;

/**
 * Read-only client snapshot populated by the authoritative leitmotiv_sync payload.
 */
public final class ClientLeitmotivCache {
    private static volatile int keys;
    private static volatile Set<String> unlockedNodes = Set.of();

    private ClientLeitmotivCache() {
    }

    public static void update(ModPayloads.LeitmotivSyncPayload payload) {
        keys = Math.max(0, payload.keys());
        unlockedNodes = Set.copyOf(payload.unlockedNodes());
    }

    public static int getKeys() {
        return keys;
    }

    public static boolean isUnlocked(String nodeId) {
        return unlockedNodes.contains(nodeId);
    }

    public static Set<String> getUnlockedNodes() {
        return unlockedNodes;
    }
}
