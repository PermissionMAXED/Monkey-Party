package de.aetherklang.kaskade;

import java.util.Arrays;

/**
 * Pure sequence matcher shared by the multiplayer and solo Weltakkord paths.
 */
public final class WeltakkordPattern {
    private final int[] notes;

    public WeltakkordPattern(int... notes) {
        if (notes.length == 0) {
            throw new IllegalArgumentException("A Weltakkord needs at least one note");
        }
        this.notes = Arrays.copyOf(notes, notes.length);
    }

    public int advance(int progress, int note) {
        int safeProgress = progress >= 0 && progress < notes.length ? progress : 0;
        if (note == notes[safeProgress]) {
            return safeProgress + 1;
        }
        return note == notes[0] ? 1 : 0;
    }

    public boolean complete(int progress) {
        return progress >= notes.length;
    }

    public int length() {
        return notes.length;
    }
}
