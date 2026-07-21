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
        int granted = claim(requested, priority, particlesRemaining, PARTICLE_CRITICAL_RESERVE,
                PARTICLE_NORMAL_RESERVE);
        particlesRemaining -= granted;
        return granted;
    }

    /**
     * Atomically claims a particle batch that cannot be rendered partially.
     */
    public static boolean tryClaimParticles(int requested, Priority priority) {
        if (requested <= 0) {
            return true;
        }
        int granted = claim(requested, priority, particlesRemaining, PARTICLE_CRITICAL_RESERVE,
                PARTICLE_NORMAL_RESERVE);
        if (granted != requested) {
            return false;
        }
        particlesRemaining -= granted;
        return true;
    }

    /**
     * Claims up to {@code requested} HUD fill operations for the current frame.
     */
    public static int claimScreen(int requested, Priority priority) {
        int granted = claim(requested, priority, screenPrimitivesRemaining, SCREEN_CRITICAL_RESERVE,
                SCREEN_NORMAL_RESERVE);
        screenPrimitivesRemaining -= granted;
        return granted;
    }

    /**
     * Atomically claims a screen batch that cannot be rendered partially.
     */
    public static boolean tryClaimScreen(int requested, Priority priority) {
        if (requested <= 0) {
            return true;
        }
        int granted = claim(requested, priority, screenPrimitivesRemaining, SCREEN_CRITICAL_RESERVE,
                SCREEN_NORMAL_RESERVE);
        if (granted != requested) {
            return false;
        }
        screenPrimitivesRemaining -= granted;
        return true;
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
}
