package de.aetherklang.client.fx;

import de.aetherklang.Aetherklang;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;

/**
 * Shared per-tick and per-frame work budget for client-only visual effects.
 *
 * <p>Ambient work cannot consume the capacity reserved for normal and critical
 * cues. Critical effects, such as an authoritative beat confirmation, can use
 * the complete remaining budget.</p>
 */
public final class FxBudget {
    private static final int PARTICLES_PER_TICK = 384;
    private static final int PARTICLE_CRITICAL_RESERVE = 96;
    private static final int PARTICLE_NORMAL_RESERVE = 144;
    private static final int SCREEN_PRIMITIVES_PER_FRAME = 512;
    private static final int SCREEN_CRITICAL_RESERVE = 320;
    private static final int SCREEN_NORMAL_RESERVE = 112;

    private static boolean registered;
    private static int particlesRemaining = PARTICLES_PER_TICK;
    private static int screenPrimitivesRemaining = SCREEN_PRIMITIVES_PER_FRAME;

    private FxBudget() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientTickEvents.START_CLIENT_TICK.register(client -> particlesRemaining = PARTICLES_PER_TICK);
        HudElementRegistry.addFirst(
                Aetherklang.id("fx_budget"),
                (context, tickCounter) -> screenPrimitivesRemaining = SCREEN_PRIMITIVES_PER_FRAME
        );
    }

    /**
     * Claims up to {@code requested} particle emissions for the current client tick.
     */
    public static int claimParticles(int requested, Priority priority) {
        return scale(Effect.PARTICLE, requested, priority);
    }

    /**
     * Atomically claims a particle batch that cannot be rendered partially.
     */
    public static boolean tryClaimParticles(int requested, Priority priority) {
        return tryEmitBatch(Effect.PARTICLE, requested, priority);
    }

    /**
     * Claims up to {@code requested} HUD fill operations for the current frame.
     */
    public static int claimScreen(int requested, Priority priority) {
        return scale(Effect.OVERLAY, requested, priority);
    }

    /**
     * Atomically claims a screen batch that cannot be rendered partially.
     */
    public static boolean tryClaimScreen(int requested, Priority priority) {
        return tryEmitBatch(Effect.OVERLAY, requested, priority);
    }

    /**
     * Reserves one emission from the selected budget.
     *
     * <p>Callers outside the shared FX package should guard individual particle
     * or overlay primitives with this method instead of bypassing the global
     * budget.</p>
     */
    public static boolean tryEmit(Effect effect, Priority priority) {
        return tryEmitBatch(effect, 1, priority);
    }

    /**
     * Atomically reserves a group of primitives that cannot be rendered partially.
     */
    public static boolean tryEmit(Effect effect, int requested, Priority priority) {
        return tryEmitBatch(effect, requested, priority);
    }

    /**
     * Scales a repeatable effect down to the amount that fits its current budget.
     *
     * <p>The returned amount is already reserved and may be emitted without
     * further claims.</p>
     */
    public static int scale(Effect effect, int requested, Priority priority) {
        int remaining = remaining(effect);
        int granted = claim(
                requested,
                priority,
                remaining,
                effect == Effect.PARTICLE ? PARTICLE_CRITICAL_RESERVE : SCREEN_CRITICAL_RESERVE,
                effect == Effect.PARTICLE ? PARTICLE_NORMAL_RESERVE : SCREEN_NORMAL_RESERVE
        );
        consume(effect, granted);
        return granted;
    }

    private static boolean tryEmitBatch(Effect effect, int requested, Priority priority) {
        if (requested <= 0) {
            return true;
        }
        int remaining = remaining(effect);
        int granted = claim(
                requested,
                priority,
                remaining,
                effect == Effect.PARTICLE ? PARTICLE_CRITICAL_RESERVE : SCREEN_CRITICAL_RESERVE,
                effect == Effect.PARTICLE ? PARTICLE_NORMAL_RESERVE : SCREEN_NORMAL_RESERVE
        );
        if (granted != requested) {
            return false;
        }
        consume(effect, granted);
        return true;
    }

    private static int remaining(Effect effect) {
        return effect == Effect.PARTICLE ? particlesRemaining : screenPrimitivesRemaining;
    }

    private static void consume(Effect effect, int amount) {
        if (effect == Effect.PARTICLE) {
            particlesRemaining -= amount;
        } else {
            screenPrimitivesRemaining -= amount;
        }
    }

    private static int claim(
            int requested,
            Priority priority,
            int remaining,
            int criticalReserve,
            int normalReserve
    ) {
        if (requested <= 0) {
            return 0;
        }
        int reserved = switch (priority) {
            case CRITICAL -> 0;
            case NORMAL -> criticalReserve;
            case AMBIENT -> criticalReserve + normalReserve;
        };
        return Math.min(requested, Math.max(0, remaining - reserved));
    }

    public enum Priority {
        AMBIENT,
        NORMAL,
        CRITICAL
    }

    public enum Effect {
        PARTICLE,
        OVERLAY
    }
}
