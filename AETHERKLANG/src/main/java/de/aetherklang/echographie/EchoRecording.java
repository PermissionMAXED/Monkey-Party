package de.aetherklang.echographie;

import de.aetherklang.resonance.Stimmung;
import java.util.List;

/**
 * Immutable eight-beat phrase captured by an Echo Cylinder.
 */
record EchoRecording(List<Frame> frames, List<Action> actions, int durationTicks) {
    EchoRecording {
        frames = List.copyOf(frames);
        actions = List.copyOf(actions);
        durationTicks = Math.max(1, durationTicks);
    }

    Frame frameAt(int tick) {
        if (frames.isEmpty()) {
            return Frame.ORIGIN;
        }
        return frames.get(Math.clamp(tick, 0, frames.size() - 1));
    }

    record Frame(double x, double y, double z, float yaw, float pitch) {
        private static final Frame ORIGIN = new Frame(0.0D, 0.0D, 0.0D, 0.0F, 0.0F);
    }

    record Action(int tick, Stimmung mood) {
    }
}
