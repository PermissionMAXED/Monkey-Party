package de.aetherklang.resonance;

import java.util.HashSet;
import java.util.Set;

public final class ResonanceState {
    private ResonanceMood mood;
    private float beatPhase;
    private int rp;
    private float dissonanz;
    private final Set<String> unlockedCodexPages;

    public ResonanceState() {
        this(ResonanceMood.SILENCE, 0, 0.0F, 0.0F, Set.of());
    }

    public ResonanceState(
            ResonanceMood mood,
            int rp,
            float beatPhase,
            float dissonanz,
            Set<String> unlockedCodexPages
    ) {
        this.mood = mood;
        this.rp = rp;
        this.beatPhase = beatPhase;
        this.dissonanz = dissonanz;
        this.unlockedCodexPages = new HashSet<>(unlockedCodexPages);
    }

    public ResonanceMood getMood() {
        return mood;
    }

    public void setMood(ResonanceMood mood) {
        this.mood = mood;
    }

    public float getBeatPhase() {
        return beatPhase;
    }

    public void setBeatPhase(float beatPhase) {
        this.beatPhase = beatPhase;
    }

    public int getRp() {
        return rp;
    }

    public void setRp(int rp) {
        this.rp = Math.max(0, rp);
    }

    public float getDissonanz() {
        return dissonanz;
    }

    public void setDissonanz(float dissonanz) {
        this.dissonanz = Math.max(0.0F, dissonanz);
    }

    public Set<String> getUnlockedCodexPages() {
        return Set.copyOf(unlockedCodexPages);
    }

    public boolean unlockCodexPage(String pageId) {
        return unlockedCodexPages.add(pageId);
    }
}
