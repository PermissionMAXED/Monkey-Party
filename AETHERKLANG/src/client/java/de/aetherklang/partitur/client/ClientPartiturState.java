package de.aetherklang.partitur.client;

import de.aetherklang.partitur.PartiturPayloads;
import java.util.List;

public final class ClientPartiturState {
    private static final long NANOS_PER_TICK = 50_000_000L;

    private static long rotation;
    private static int ticksRemaining;
    private static long lastUpdateNanos;
    private static List<PartiturPayloads.Entry> entries = List.of();

    private ClientPartiturState() {
    }

    public static void update(PartiturPayloads.SyncPayload payload) {
        rotation = payload.rotation();
        ticksRemaining = payload.ticksRemaining();
        lastUpdateNanos = System.nanoTime();
        entries = payload.entries();
    }

    public static long rotation() {
        return rotation;
    }

    public static int ticksRemaining() {
        if (lastUpdateNanos == 0L) {
            return ticksRemaining;
        }
        long elapsedTicks = Math.max(0L, System.nanoTime() - lastUpdateNanos) / NANOS_PER_TICK;
        return (int) Math.max(0L, ticksRemaining - elapsedTicks);
    }

    public static List<PartiturPayloads.Entry> entries() {
        return entries;
    }
}
