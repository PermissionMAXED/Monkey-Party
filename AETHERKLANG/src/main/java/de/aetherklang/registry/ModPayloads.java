package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.resonance.ResonancePlayerData;
import java.util.ArrayList;
import java.util.List;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

public final class ModPayloads {
    public static final Identifier DASH_ID = Aetherklang.id("dash");
    public static final Identifier MOOD_CYCLE_ID = Aetherklang.id("mood_cycle");
    public static final Identifier KODEX_OPEN_ID = Aetherklang.id("kodex_open");
    public static final Identifier RESONANCE_SYNC_ID = Aetherklang.id("resonance_sync");
    public static final Identifier BEAT_FX_ID = Aetherklang.id("beat_fx");

    private ModPayloads() {
    }

    public static void register() {
        PayloadTypeRegistry.playC2S().register(DashPayload.ID, DashPayload.CODEC);
        PayloadTypeRegistry.playC2S().register(MoodCyclePayload.ID, MoodCyclePayload.CODEC);
        PayloadTypeRegistry.playC2S().register(KodexOpenPayload.ID, KodexOpenPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(ResonanceSyncPayload.ID, ResonanceSyncPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(BeatFxPayload.ID, BeatFxPayload.CODEC);
        Aetherklang.LOGGER.debug("Registered {} Aetherklang play payloads", 5);
    }

    public record DashPayload(float strength) implements CustomPayload {
        public static final CustomPayload.Id<DashPayload> ID = new CustomPayload.Id<>(DASH_ID);
        public static final PacketCodec<RegistryByteBuf, DashPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> buffer.writeFloat(payload.strength()),
                buffer -> new DashPayload(buffer.readFloat())
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record MoodCyclePayload(int direction) implements CustomPayload {
        public static final CustomPayload.Id<MoodCyclePayload> ID = new CustomPayload.Id<>(MOOD_CYCLE_ID);
        public static final PacketCodec<RegistryByteBuf, MoodCyclePayload> CODEC = PacketCodec.of(
                (payload, buffer) -> buffer.writeVarInt(payload.direction()),
                buffer -> new MoodCyclePayload(buffer.readVarInt())
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record KodexOpenPayload(boolean opened) implements CustomPayload {
        public static final CustomPayload.Id<KodexOpenPayload> ID = new CustomPayload.Id<>(KODEX_OPEN_ID);
        public static final PacketCodec<RegistryByteBuf, KodexOpenPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> buffer.writeBoolean(payload.opened()),
                buffer -> new KodexOpenPayload(buffer.readBoolean())
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record ResonanceSyncPayload(
            String mood,
            int rp,
            float beatPhase,
            float dissonanz,
            List<Integer> unlockedCodexPages
    ) implements CustomPayload {
        public static final CustomPayload.Id<ResonanceSyncPayload> ID =
                new CustomPayload.Id<>(RESONANCE_SYNC_ID);
        public static final PacketCodec<RegistryByteBuf, ResonanceSyncPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeString(payload.mood());
                    buffer.writeVarInt(payload.rp());
                    buffer.writeFloat(payload.beatPhase());
                    buffer.writeFloat(payload.dissonanz());
                    buffer.writeVarInt(payload.unlockedCodexPages().size());
                    payload.unlockedCodexPages().forEach(buffer::writeVarInt);
                },
                buffer -> new ResonanceSyncPayload(
                        buffer.readString(),
                        buffer.readVarInt(),
                        buffer.readFloat(),
                        buffer.readFloat(),
                        readCodexPages(buffer)
                )
        );

        public ResonanceSyncPayload {
            unlockedCodexPages = List.copyOf(unlockedCodexPages);
        }

        public static ResonanceSyncPayload from(ResonancePlayerData data) {
            return new ResonanceSyncPayload(
                    data.getMood().asString(),
                    data.getRp(),
                    data.getBeatPhase(),
                    data.getDissonanz(),
                    data.getUnlockedCodexPageIds()
            );
        }

        private static List<Integer> readCodexPages(RegistryByteBuf buffer) {
            int pageCount = buffer.readVarInt();
            if (pageCount < 0 || pageCount > ResonancePlayerData.MAX_CODEX_PAGE + 1) {
                throw new IllegalArgumentException("Invalid unlocked codex page count: " + pageCount);
            }

            List<Integer> pages = new ArrayList<>(pageCount);
            for (int index = 0; index < pageCount; index++) {
                int page = buffer.readVarInt();
                if (page < 0 || page > ResonancePlayerData.MAX_CODEX_PAGE) {
                    throw new IllegalArgumentException("Invalid unlocked codex page: " + page);
                }
                pages.add(page);
            }
            return pages;
        }

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record BeatFxPayload(int beat) implements CustomPayload {
        public static final CustomPayload.Id<BeatFxPayload> ID = new CustomPayload.Id<>(BEAT_FX_ID);
        public static final PacketCodec<RegistryByteBuf, BeatFxPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> buffer.writeVarInt(payload.beat()),
                buffer -> new BeatFxPayload(buffer.readVarInt())
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }
}
