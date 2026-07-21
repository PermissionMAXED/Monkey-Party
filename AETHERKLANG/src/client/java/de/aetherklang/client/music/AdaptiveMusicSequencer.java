package de.aetherklang.client.music;

import de.aetherklang.Aetherklang;
import de.aetherklang.bosswerk.BosswerkBossEntity;
import de.aetherklang.entity.ChoralEntity;
import de.aetherklang.insel.client.ClientRegionState;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.Stimmung;
import de.aetherklang.resonance.client.ClientResonanceCache;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.entity.mob.HostileEntity;
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
    private static final double COMBAT_MUSIC_RADIUS = 20.0D;
    private static final int MAX_ENSEMBLE_VOICES = 4;
    private static final int MAX_SOUNDS_PER_SECOND = 10;
    private static final long SOUND_WINDOW_NANOS = 1_000_000_000L;

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
    private static final ArrayDeque<Long> recentSoundTimes = new ArrayDeque<>();

    private static KeyBinding toggleMusic;
    private static boolean registered;
    private static boolean enabled = true;
    private static int observedBeat;
    private static boolean hasObservedBeat;
    private static int ensembleSize;
    private static String bossFxId;
    private static int bossFxPhase = 1;
    private static int bossFxTicks;
    private static int silenceTicks;

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

    public static void onBossFx(String bossId, int phase) {
        bossFxId = bossId;
        bossFxPhase = Math.clamp(phase, 1, 3);
        bossFxTicks = 180;
    }

    public static void silenceFor(int ticks) {
        silenceTicks = Math.max(silenceTicks, ticks);
        scheduledNotes.clear();
    }

    private static void tick(MinecraftClient client) {
        if (bossFxTicks > 0) {
            bossFxTicks--;
        }
        if (silenceTicks > 0) {
            silenceTicks--;
        }
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
        String region = ClientRegionState.regionId();
        int combatants = nearbyCombatants(client);
        BossLayer bossLayer = nearbyBossLayer(client);

        play(client, motif.instrument(), 0.28F, pitch(semitones));
        if ((step & 1) == 0) {
            playBassLayer(client, motif.root(), step);
        } else {
            playSparkleLayer(client, beat, mood, motif.root());
        }
        if (bossLayer != null) {
            playBossLayer(client, beat, motif.root(), bossLayer);
        }

        boolean combatTurn = (step & 1) == 0;
        if (combatants > 0 && (region == null || combatTurn)) {
            playCombatLayer(client, beat, motif.root(), combatants);
        }
        if (region != null && (combatants == 0 || !combatTurn)) {
            playRegionLayer(client, beat, motif.root(), region);
        }

        if (ClientResonanceCache.getDissonanz() >= 0.15F && (step & 2) != 0) {
            playDissonanceAccent(client, beat, semitones);
        } else {
            playEnsembleHarmony(client, mood, motif, step, semitones);
        }
    }

    private static void playBassLayer(MinecraftClient client, int root, int step) {
        int[] bass = {0, -5, -2, -7};
        play(
                client,
                SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                0.18F,
                pitch(root + bass[Math.floorMod(step / 2, bass.length)])
        );
    }

    private static void playSparkleLayer(MinecraftClient client, int beat, Stimmung mood, int root) {
        int[] scale = {12, 14, 16, 19, 21};
        int chunkX = client.player.getBlockX() >> 4;
        int chunkZ = client.player.getBlockZ() >> 4;
        int generated = beat * 31 + mood.ordinal() * 17 + chunkX * 13 + chunkZ * 7;
        int index = Math.floorMod(generated ^ generated >>> 16, scale.length);
        SoundEvent instrument = (beat & 2) == 0
                ? SoundEvents.BLOCK_NOTE_BLOCK_CHIME.value()
                : SoundEvents.BLOCK_NOTE_BLOCK_BELL.value();
        play(client, instrument, 0.11F, pitch(root + scale[index]));
    }

    private static void playCombatLayer(MinecraftClient client, int beat, int root, int combatants) {
        int[] rhythm = {0, 3, 0, 5, 0, 6, 3, 5};
        int step = Math.floorMod(beat, rhythm.length);
        SoundEvent instrument = (step & 1) == 0
                ? SoundEvents.BLOCK_NOTE_BLOCK_DIDGERIDOO.value()
                : SoundEvents.BLOCK_NOTE_BLOCK_BIT.value();
        float pressure = Math.min(combatants, 4) / 4.0F;
        play(client, instrument, 0.14F + pressure * 0.08F, pitch(root - 5 + rhythm[step]));
    }

    private static void playRegionLayer(MinecraftClient client, int beat, int root, String region) {
        int step = Math.floorMod(beat, STEPS_PER_MOTIF);
        switch (region) {
            case "bassgewoelbe" -> {
                int[] bass = {0, -5, -2, -7};
                play(
                        client,
                        SoundEvents.BLOCK_NOTE_BLOCK_DIDGERIDOO.value(),
                        0.16F,
                        pitch(root - 5 + bass[step / 2])
                );
            }
            case "arpeggienmeer" -> {
                int[] arpeggio = {0, 4, 7, 12, 7, 4, 9, 7};
                play(
                        client,
                        step % 3 == 0
                                ? SoundEvents.BLOCK_NOTE_BLOCK_BELL.value()
                                : SoundEvents.BLOCK_NOTE_BLOCK_PLING.value(),
                        0.13F,
                        pitch(root + arpeggio[step])
                );
            }
            case "kakophonie_riff" -> {
                int[] broken = {0, 6, 1, 10, 3, 8, -1, 5};
                play(
                        client,
                        (step & 1) == 0
                                ? SoundEvents.BLOCK_NOTE_BLOCK_BIT.value()
                                : SoundEvents.BLOCK_NOTE_BLOCK_DIDGERIDOO.value(),
                        0.14F,
                        pitch(root - 3 + broken[step])
                );
            }
            case "generalpause_oede" -> play(
                    client,
                    SoundEvents.BLOCK_NOTE_BLOCK_FLUTE.value(),
                    step == 0 || step == 5 ? 0.11F : 0.07F,
                    pitch(root - 7 + (step < 4 ? 0 : 3))
            );
            default -> {
            }
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
        int voice = Math.floorMod(step, ensembleSize - 1);
        if (voice == 0) {
            play(client, SoundEvents.BLOCK_NOTE_BLOCK_HARP.value(), 0.19F, pitch(motif.root() + motif.notes()[harmonyStep]));
        } else if (voice == 1) {
            int interval = mood == Stimmung.FREUDE || mood == Stimmung.WUNDER ? 7 : 5;
            play(client, SoundEvents.BLOCK_NOTE_BLOCK_PLING.value(), 0.16F, pitch(leadSemitones + interval));
        } else {
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
        SoundEvent instrument = phase == 1
                ? SoundEvents.BLOCK_NOTE_BLOCK_BASS.value()
                : phase == 2
                        ? SoundEvents.BLOCK_NOTE_BLOCK_FLUTE.value()
                        : (beat & 1) == 0
                                ? SoundEvents.BLOCK_NOTE_BLOCK_CHIME.value()
                                : SoundEvents.BLOCK_NOTE_BLOCK_IRON_XYLOPHONE.value();
        int octave = phase == 1 ? -5 : phase == 2 ? 3 : 7;
        play(client, instrument, 0.22F + phase * 0.025F, pitch(root + octave + phraseNote));
    }

    private static void playBossLayer(MinecraftClient client, int beat, int root, BossLayer layer) {
        if ("choral".equals(layer.id())) {
            playChoralLayer(client, beat, root, layer.phase());
            return;
        }

        int phase = layer.phase();
        int step = Math.floorMod(beat, STEPS_PER_MOTIF);
        switch (layer.id()) {
            case "boss_tremolo" -> {
                play(
                        client,
                        (step & 1) == 0
                                ? SoundEvents.BLOCK_NOTE_BLOCK_PLING.value()
                                : SoundEvents.BLOCK_NOTE_BLOCK_BIT.value(),
                        0.15F + phase * 0.035F,
                        pitch(root + (step & 1) * (phase + 1))
                );
            }
            case "boss_glissanda" -> {
                int[] sweep = {-5, -2, 0, 3, 7, 10, 12, 7};
                play(
                        client,
                        phase >= 2 && (step & 1) == 0
                                ? SoundEvents.BLOCK_NOTE_BLOCK_CHIME.value()
                                : SoundEvents.BLOCK_NOTE_BLOCK_FLUTE.value(),
                        0.14F + phase * 0.03F,
                        pitch(root + sweep[step] + (phase >= 2 && (step & 1) == 0 ? 7 : 0))
                );
            }
            case "boss_kakophon" -> {
                int[] clash = {0, 6, -1, 8};
                int note = clash[Math.floorMod(beat, clash.length)];
                play(
                        client,
                        phase >= 2 && (step & 1) != 0
                                ? SoundEvents.BLOCK_NOTE_BLOCK_BIT.value()
                                : SoundEvents.BLOCK_NOTE_BLOCK_DIDGERIDOO.value(),
                        0.18F + phase * 0.035F,
                        pitch(root - 9 + note + (phase >= 2 && (step & 1) != 0 ? 15 : 0))
                );
            }
            case "boss_generalpause" -> play(
                    client,
                    phase >= 3 && step % 3 == 0
                            ? SoundEvents.BLOCK_NOTE_BLOCK_IRON_XYLOPHONE.value()
                            : SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                    step % Math.max(2, 5 - phase) == 0 ? 0.19F + phase * 0.025F : 0.09F,
                    pitch(root - 12 + phase * 2)
            );
            case "boss_ostinato" -> {
                int[] figure = {0, 3, 7, 3};
                int note = figure[Math.floorMod(beat, figure.length)];
                boolean bassVoice = (step & 1) == 0;
                play(
                        client,
                        bassVoice
                                ? SoundEvents.BLOCK_NOTE_BLOCK_BASS.value()
                                : SoundEvents.BLOCK_NOTE_BLOCK_PLING.value(),
                        0.15F + phase * 0.03F,
                        pitch(root + note + (bassVoice ? -12 : 0))
                );
            }
            case "boss_ritardando" -> {
                int spacing = Math.max(2, 5 - phase);
                boolean accent = Math.floorMod(beat, spacing) == 0;
                play(
                        client,
                        accent
                                ? SoundEvents.BLOCK_NOTE_BLOCK_CHIME.value()
                                : SoundEvents.BLOCK_NOTE_BLOCK_FLUTE.value(),
                        accent ? 0.19F : 0.10F,
                        pitch(root + (accent ? -5 + phase * 2 : 7 - phase))
                );
            }
            default -> {
            }
        }
    }

    private static BossLayer nearbyBossLayer(MinecraftClient client) {
        Box searchArea = client.player.getBoundingBox().expand(CHORAL_MUSIC_RADIUS);
        ChoralEntity choral = client.world.getEntitiesByClass(
                        ChoralEntity.class,
                        searchArea,
                        ChoralEntity::isAlive
                ).stream()
                .min(Comparator.comparingDouble(client.player::squaredDistanceTo))
                .orElse(null);
        BosswerkBossEntity bosswerk = client.world.getEntitiesByClass(
                        BosswerkBossEntity.class,
                        searchArea,
                        BosswerkBossEntity::isAlive
                ).stream()
                .min(Comparator.comparingDouble(client.player::squaredDistanceTo))
                .orElse(null);
        if (choral != null && (bosswerk == null
                || client.player.squaredDistanceTo(choral) <= client.player.squaredDistanceTo(bosswerk))) {
            return new BossLayer("choral", Math.clamp(choral.getPhase(), 1, 3));
        }
        if (bosswerk == null) {
            return null;
        }

        String id = bosswerk.getBossId();
        int phase = bossFxTicks > 0 && id.equals(bossFxId) ? bossFxPhase : 1;
        return new BossLayer(id, phase);
    }

    private static int nearbyCombatants(MinecraftClient client) {
        Box searchArea = client.player.getBoundingBox().expand(COMBAT_MUSIC_RADIUS);
        return Math.min(
                4,
                client.world.getEntitiesByClass(
                        HostileEntity.class,
                        searchArea,
                        hostile -> hostile.isAlive() && !hostile.isSilent()
                ).size()
        );
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
        if (client.player != null && reserveSoundSlot()) {
            client.player.playSound(sound, volume, notePitch);
        }
    }

    private static boolean reserveSoundSlot() {
        long now = System.nanoTime();
        long cutoff = now - SOUND_WINDOW_NANOS;
        while (!recentSoundTimes.isEmpty() && recentSoundTimes.peekFirst() <= cutoff) {
            recentSoundTimes.removeFirst();
        }
        if (recentSoundTimes.size() >= MAX_SOUNDS_PER_SECOND) {
            return false;
        }
        recentSoundTimes.addLast(now);
        return true;
    }

    private static boolean isAudible(MinecraftClient client) {
        return enabled
                && client.player != null
                && client.world != null
                && silenceTicks <= 0
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

    private record BossLayer(String id, int phase) {
    }
}
