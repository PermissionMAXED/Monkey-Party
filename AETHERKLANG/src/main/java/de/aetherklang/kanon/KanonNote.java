package de.aetherklang.kanon;

import de.aetherklang.resonance.Stimmung;
import java.util.Objects;

/**
 * One call-and-response note: a resonance mood plus the action used to voice it.
 */
public record KanonNote(Stimmung mood, KanonAction action) {
    public KanonNote {
        Objects.requireNonNull(mood, "mood");
        Objects.requireNonNull(action, "action");
    }

    public boolean matches(Stimmung performedMood, KanonAction performedAction) {
        return mood == performedMood && action.accepts(performedAction);
    }

    public int networkCode() {
        return mood.ordinal() * KanonAction.values().length + action.ordinal();
    }

    public static KanonNote fromNetworkCode(int code) {
        int actionCount = KanonAction.values().length;
        int maximum = Stimmung.values().length * actionCount;
        if (code < 0 || code >= maximum) {
            throw new IllegalArgumentException("Invalid Kanon note code: " + code);
        }
        return new KanonNote(
                Stimmung.values()[code / actionCount],
                KanonAction.values()[code % actionCount]
        );
    }
}
