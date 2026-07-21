package de.aetherklang.kanon;

import de.aetherklang.Aetherklang;
import java.util.ArrayList;
import java.util.List;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;

public final class KanonPayloads {
    public static final int PHRASE_LENGTH = 4;
    private static boolean registered;

    private KanonPayloads() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        PayloadTypeRegistry.playS2C().register(KanonSyncPayload.ID, KanonSyncPayload.CODEC);
    }

    public record KanonSyncPayload(
            List<Integer> notes,
            int phase,
            int progress,
            int revealed,
            int ticksUntilNote,
            boolean duel,
            String counterpart
    ) implements CustomPayload {
        public static final Id<KanonSyncPayload> ID =
                new Id<>(Aetherklang.id("kanon_sync"));
        public static final PacketCodec<RegistryByteBuf, KanonSyncPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeVarInt(payload.notes().size());
                    payload.notes().forEach(buffer::writeVarInt);
                    buffer.writeVarInt(payload.phase());
                    buffer.writeVarInt(payload.progress());
                    buffer.writeVarInt(payload.revealed());
                    buffer.writeVarInt(payload.ticksUntilNote());
                    buffer.writeBoolean(payload.duel());
                    buffer.writeString(payload.counterpart());
                },
                buffer -> new KanonSyncPayload(
                        readNotes(buffer),
                        buffer.readVarInt(),
                        buffer.readVarInt(),
                        buffer.readVarInt(),
                        buffer.readVarInt(),
                        buffer.readBoolean(),
                        buffer.readString(64)
                )
        );

        public KanonSyncPayload {
            notes = List.copyOf(notes);
            if (phase < 0 || phase > 4) {
                throw new IllegalArgumentException("Invalid Kanon phase: " + phase);
            }
            if (phase == 0 && !notes.isEmpty()) {
                throw new IllegalArgumentException("An idle Kanon payload must not contain notes");
            }
            if (phase != 0 && notes.size() != PHRASE_LENGTH) {
                throw new IllegalArgumentException("An active Kanon phrase must contain four notes");
            }
            for (int note : notes) {
                KanonNote.fromNetworkCode(note);
            }
            progress = Math.clamp(progress, 0, PHRASE_LENGTH);
            revealed = Math.clamp(revealed, 0, PHRASE_LENGTH);
            ticksUntilNote = Math.clamp(ticksUntilNote, 0, 200);
            if (counterpart.length() > 64) {
                throw new IllegalArgumentException("Kanon counterpart name is too long");
            }
        }

        public List<KanonNote> decodedNotes() {
            return notes.stream().map(KanonNote::fromNetworkCode).toList();
        }

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }

        private static List<Integer> readNotes(RegistryByteBuf buffer) {
            int size = buffer.readVarInt();
            if (size != 0 && size != PHRASE_LENGTH) {
                throw new IllegalArgumentException("Invalid Kanon phrase length: " + size);
            }
            List<Integer> notes = new ArrayList<>(size);
            for (int index = 0; index < size; index++) {
                notes.add(buffer.readVarInt());
            }
            return notes;
        }
    }
}
