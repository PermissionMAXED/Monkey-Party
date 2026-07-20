package de.aetherklang.resonance;

import com.mojang.serialization.Codec;
import java.util.BitSet;

/**
 * Compatibility name retained for code written against the WP1 scaffold.
 *
 * @deprecated Use {@link ResonancePlayerData}.
 */
@Deprecated(forRemoval = false)
public final class ResonanceState extends ResonancePlayerData {
    public static final Codec<ResonanceState> CODEC = ResonancePlayerData.CODEC.xmap(
            ResonanceState::new,
            state -> state
    );

    public ResonanceState() {
        super();
    }

    private ResonanceState(ResonancePlayerData data) {
        this(
                data.getMood(),
                data.getRp(),
                data.getBeatPhase(),
                data.getDissonanz(),
                data.getUnlockedCodexPages(),
                data.getRang(),
                data.getGesamtRp()
        );
    }

    public ResonanceState(
            Stimmung mood,
            int rp,
            float beatPhase,
            float dissonanz,
            BitSet unlockedCodexPages
    ) {
        super(mood, rp, beatPhase, dissonanz, unlockedCodexPages);
    }

    public ResonanceState(
            Stimmung mood,
            int rp,
            float beatPhase,
            float dissonanz,
            BitSet unlockedCodexPages,
            int rang,
            long gesamtRp
    ) {
        super(mood, rp, beatPhase, dissonanz, unlockedCodexPages, rang, gesamtRp);
    }

    public void setMood(ResonanceMood mood) {
        if (mood instanceof Stimmung stimmung) {
            setMood(stimmung);
        }
    }
}
