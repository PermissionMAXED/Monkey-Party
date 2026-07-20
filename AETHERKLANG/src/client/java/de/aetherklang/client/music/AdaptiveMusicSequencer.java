package de.aetherklang.client.music;

import de.aetherklang.Aetherklang;
import de.aetherklang.entity.ChoralEntity;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.Stimmung;
import de.aetherklang.resonance.client.ClientResonanceCache;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.sound.SoundEvent;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.math.Box;
import org.lwjgl.glfw.GLFW;

/**
 * Turns the authoritative beat FX stream into lightweight, local note-block music.
 */
public final class AdaptiveMusicSequencer {
    private static final int STEPS_PER_MOTIF = 8;
    private static final double CHORAL_MUSIC_RADIUS = 64.0D;
    private static final int MAX_ENSEMBLE_VOICES = 4;

    private static final Motif STILLE = new Motif(
            new int[]{0, 3, 5, 7, 10, 7, 5, 3},
            SoundEvents.BLOCK_NOTE_BLOCK_FLUTE.value(),
            -5
    );
    private static final Motif FREUDE = new Motif(
            new int[]{0, 2, 4, 7, 9, 7, 4, 2},
            SoundEvents.BLOCK_NOTE_BLOCK_BELL.value(),
            -3
    );
    private static final Motif ZORN = new Motif(
            new int[]{0, 3, 5, 7, 10, 12, 10, 7},
            SoundEvents.BLOCK_NOTE_BLOCK_DIDGERIDOO.value(),
            -7
    );
    private static final Motif TRAUER = new Motif(
            new int[]{0, 3, 5, 7, 10, 5, 3, -2},
            SoundEvents.BLOCK_NOTE_BLOCK_GUITAR.value(),
            -5
    );
    private static final Motif WUNDER = new Motif(
            new int[]{0, 2, 5, 7, 9, 12, 9, 5},
            SoundEvents.BLOCK_NOTE_BLOCK_CHIME.value(),
            -4
    );

    private static final List<ScheduledNote> scheduledNotes = new ArrayList<>();

    private static KeyBinding toggleMusic;
    private static boolean registered;
    private static boolean enabled = true;
    private static int observedBeat;
    private static boolean hasObservedBeat;
    private static int ensembleSize;

    private AdaptiveMusicSequencer() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;

        toggleMusic = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.aetherklang.toggle_music",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_N,
                KeyBinding.Category.MISC
        ));
        ClientTickEvents.END_CLIENT_TICK.register(AdaptiveMusicSequencer::tick);
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.AkkordFxPayload.ID,
                (payload, context) -> context.client().execute(() -> playAkkordComplete(payload.akkord()))
        );
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.EnsembleSyncPayload.ID,
                (payload, context) -> context.client().execute(() -> updateEnsemble(payload.ensembleSize()))
        );
        Aetherklang.LOGGER.info("Adaptive music sequencer ready (toggle: N)");
    }

    private static void tick(MinecraftClient client) {
        while (toggleMusic.wasPressed()) {
            enabled = !enabled;
            scheduledNotes.clear();
            if (client.player != null) {
                client.player.sendMessage(
                        Text.literal(enabled ? "Adaptive Musik: an" : "Adaptive Musik: aus"),
                        true
                );
            }
        }

        if (client.player == null || client.world == null) {
            hasObservedBeat = false;
            scheduledNotes.clear();
            ensembleSize = 0;
            return;
        }

        tickScheduledNotes(client);

        int beat = ClientResonanceCache.getLastBeat();
        if (!hasObservedBeat) {
            observedBeat = beat;
            hasObservedBeat = true;
            return;
        }
        if (beat == observedBeat) {
            return;
        }
        observedBeat = beat;

        if (isAudible(client)) {
            playBeat(client, beat);
        }
    }

    private static void playBeat(MinecraftClient client, int beat) {
        Stimmung mood = ClientResonanceCache.getMood();
        Motif motif = motif(mood);
        int step = Math.floorMod(beat, STEPS_PER_MOTIF);
        int note = motif.notes()[step];
        int semitones = motif.root() + note;

        play(client, motif.instrument(), 0.28F, pitch(semitones));
        playEnsembleHarmony(client, mood, motif, step, semitones);
        playDissonanceAccent(client, beat, semitones);

        int choralPhase = nearbyChoralPhase(client);
        if (choralPhase > 0) {
            playChoralLayer(client, beat, motif.root(), choralPhase);
        }
    }

    private static void playEnsembleHarmony(
            MinecraftClient client,
            Stimmung mood,
            Motif motif,
            int step,
            int leadSemitones
    ) {
        if (ensembleSize < 2) {
            return;
        }

        int harmonyStep = (step + 2) % STEPS_PER_MOTIF;
        play(client, SoundEvents.BLOCK_NOTE_BLOCK_HARP.value(), 0.19F, pitch(motif.root() + motif.notes()[harmonyStep]));
        if (ensembleSize >= 3) {
            int interval = mood == Stimmung.FREUDE || mood == Stimmung.WUNDER ? 7 : 5;
            play(client, SoundEvents.BLOCK_NOTE_BLOCK_PLING.value(), 0.16F, pitch(leadSemitones + interval));
        }
        if (ensembleSize >= MAX_ENSEMBLE_VOICES) {
            play(client, SoundEvents.BLOCK_NOTE_BLOCK_XYLOPHONE.value(), 0.12F, pitch(leadSemitones + 12));
        }
    }

    private static void playDissonanceAccent(MinecraftClient client, int beat, int leadSemitones) {
        float dissonance = ClientResonanceCache.getDissonanz();
        if (dissonance < 0.15F || (dissonance < 0.55F && Math.floorMod(beat, 2) == 0)) {
            return;
        }

        float detune = Math.floorMod(beat, 2) == 0 ? 0.982F : 1.018F;
        float volume = 0.08F + dissonance * 0.17F;
        play(
                client,
                SoundEvents.BLOCK_NOTE_BLOCK_BIT.value(),
                volume,
                clampPitch(pitch(leadSemitones + 6) * detune)
        );
    }

    private static void playChoralLayer(MinecraftClient client, int beat, int root, int phase) {
        int[] minorPhrase = {0, 3, 7, 10};
        int phraseNote = minorPhrase[Math.floorMod(beat, minorPhrase.length)];
        if (phase == 1) {
            if (Math.floorMod(beat, 2) == 0) {
                play(client, SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(), 0.25F, pitch(root - 5 + phraseNote));
            }
            return;
        }

        play(client, SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(), 0.27F, pitch(root - 7 + phraseNote));
        play(client, SoundEvents.BLOCK_NOTE_BLOCK_FLUTE.value(), 0.17F, pitch(root + 3 + phraseNote));
        if (phase >= 3) {
            play(client, SoundEvents.BLOCK_NOTE_BLOCK_CHIME.value(), 0.17F, pitch(root + 7 + phraseNote));
            play(client, SoundEvents.BLOCK_NOTE_BLOCK_IRON_XYLOPHONE.value(), 0.13F, pitch(root + 10 + phraseNote));
        }
    }

    private static int nearbyChoralPhase(MinecraftClient client) {
        Box searchArea = client.player.getBoundingBox().expand(CHORAL_MUSIC_RADIUS);
        return client.world.getEntitiesByClass(
                        ChoralEntity.class,
                        searchArea,
                        ChoralEntity::isAlive
                ).stream()
                .min(Comparator.comparingDouble(client.player::squaredDistanceTo))
                .map(ChoralEntity::getPhase)
                .orElse(0);
    }

    private static void playAkkordComplete(int chord) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (!isAudible(client)) {
            return;
        }

        play(client, ModSounds.AKKORD_COMPLETE, 0.65F, 1.0F);
        int root = Math.floorMod(chord, 12) - 6;
        int third = Math.floorMod(chord, 2) == 0 ? 4 : 3;
        schedule(SoundEvents.BLOCK_NOTE_BLOCK_HARP.value(), 0.25F, pitch(root), 0);
        schedule(SoundEvents.BLOCK_NOTE_BLOCK_HARP.value(), 0.23F, pitch(root + third), 2);
        schedule(SoundEvents.BLOCK_NOTE_BLOCK_PLING.value(), 0.22F, pitch(root + 7), 4);
        schedule(SoundEvents.BLOCK_NOTE_BLOCK_CHIME.value(), 0.20F, pitch(root + 12), 6);
    }

    private static void updateEnsemble(int newSize) {
        int previousSize = ensembleSize;
        ensembleSize = Math.clamp(newSize, 0, MAX_ENSEMBLE_VOICES);
        if (ensembleSize < 2 || ensembleSize <= previousSize) {
            return;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (!isAudible(client)) {
            return;
        }

        play(client, ModSounds.ENSEMBLE_CHIME, 0.65F, 1.0F + ensembleSize * 0.035F);
        schedule(SoundEvents.BLOCK_NOTE_BLOCK_CHIME.value(), 0.20F, pitch(0), 0);
        schedule(SoundEvents.BLOCK_NOTE_BLOCK_PLING.value(), 0.18F, pitch(4), 2);
        if (ensembleSize >= 3) {
            schedule(SoundEvents.BLOCK_NOTE_BLOCK_BELL.value(), 0.17F, pitch(7), 4);
        }
        if (ensembleSize >= MAX_ENSEMBLE_VOICES) {
            schedule(SoundEvents.BLOCK_NOTE_BLOCK_CHIME.value(), 0.15F, pitch(12), 6);
        }
    }

    private static void tickScheduledNotes(MinecraftClient client) {
        for (int index = scheduledNotes.size() - 1; index >= 0; index--) {
            ScheduledNote note = scheduledNotes.get(index);
            if (note.delayTicks() <= 0) {
                if (isAudible(client)) {
                    play(client, note.sound(), note.volume(), note.pitch());
                }
                scheduledNotes.remove(index);
            } else {
                scheduledNotes.set(index, note.withDelay(note.delayTicks() - 1));
            }
        }
    }

    private static void schedule(SoundEvent sound, float volume, float notePitch, int delayTicks) {
        scheduledNotes.add(new ScheduledNote(sound, volume, notePitch, delayTicks));
    }

    private static void play(MinecraftClient client, SoundEvent sound, float volume, float notePitch) {
        if (client.player != null) {
            client.player.playSound(sound, volume, notePitch);
        }
    }

    private static boolean isAudible(MinecraftClient client) {
        return enabled
                && client.player != null
                && client.world != null
                && !client.options.hudHidden;
    }

    private static Motif motif(Stimmung mood) {
        return switch (mood) {
            case STILLE -> STILLE;
            case FREUDE -> FREUDE;
            case ZORN -> ZORN;
            case TRAUER -> TRAUER;
            case WUNDER -> WUNDER;
        };
    }

    private static float pitch(int semitones) {
        return clampPitch((float) Math.pow(2.0D, semitones / 12.0D));
    }

    private static float clampPitch(float value) {
        return Math.clamp(value, 0.5F, 2.0F);
    }

    private record Motif(int[] notes, SoundEvent instrument, int root) {
    }

    private record ScheduledNote(SoundEvent sound, float volume, float pitch, int delayTicks) {
        private ScheduledNote withDelay(int delay) {
            return new ScheduledNote(sound, volume, pitch, delay);
        }
    }
}
