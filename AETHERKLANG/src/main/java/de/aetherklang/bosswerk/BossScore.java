package de.aetherklang.bosswerk;

import java.util.List;

/**
 * Immutable, validated score used by one Bosswerk encounter.
 */
public record BossScore(
        String id,
        double health,
        List<Phase> phases
) {
    public BossScore {
        phases = List.copyOf(phases);
    }

    public Phase phaseFor(float healthPercent) {
        for (Phase phase : phases) {
            if (healthPercent >= phase.minHealthPercent()) {
                return phase;
            }
        }
        return phases.getLast();
    }

    public int phaseIndex(float healthPercent) {
        Phase phase = phaseFor(healthPercent);
        return phases.indexOf(phase);
    }

    public record Phase(
            float minHealthPercent,
            int beatInterval,
            List<Attack> attacks
    ) {
        public Phase {
            attacks = List.copyOf(attacks);
        }
    }

    public record Attack(
            BossOperation operation,
            int telegraphBeats,
            float power,
            float radius
    ) {
    }
}
