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
    public static final Identifier PERFECT_FX_ID = Aetherklang.id("perfect_fx");
    public static final Identifier AKKORD_FX_ID = Aetherklang.id("akkord_fx");
    public static final Identifier ENSEMBLE_SYNC_ID = Aetherklang.id("ensemble_sync");
    public static final Identifier RANG_SYNC_ID = Aetherklang.id("rang_sync");

    private ModPayloads() {
    }

    public static void register() {
        PayloadTypeRegistry.playC2S().register(DashPayload.ID, DashPayload.CODEC);
        PayloadTypeRegistry.playC2S().register(MoodCyclePayload.ID, MoodCyclePayload.CODEC);
        PayloadTypeRegistry.playC2S().register(KodexOpenPayload.ID, KodexOpenPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(ResonanceSyncPayload.ID, ResonanceSyncPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(BeatFxPayload.ID, BeatFxPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(PerfectFxPayload.ID, PerfectFxPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(AkkordFxPayload.ID, AkkordFxPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(EnsembleSyncPayload.ID, EnsembleSyncPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(RangSyncPayload.ID, RangSyncPayload.CODEC);
        Aetherklang.LOGGER.debug("Registered {} Aetherklang play payloads", 9);
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

    public record PerfectFxPayload(int beat, int streak) implements CustomPayload {
        public static final CustomPayload.Id<PerfectFxPayload> ID = new CustomPayload.Id<>(PERFECT_FX_ID);
        public static final PacketCodec<RegistryByteBuf, PerfectFxPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeVarInt(payload.beat());
                    buffer.writeVarInt(payload.streak());
                },
                buffer -> new PerfectFxPayload(buffer.readVarInt(), buffer.readVarInt())
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record AkkordFxPayload(int akkord) implements CustomPayload {
        public static final CustomPayload.Id<AkkordFxPayload> ID = new CustomPayload.Id<>(AKKORD_FX_ID);
        public static final PacketCodec<RegistryByteBuf, AkkordFxPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> buffer.writeVarInt(payload.akkord()),
                buffer -> new AkkordFxPayload(buffer.readVarInt())
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record EnsembleSyncPayload(int ensembleSize) implements CustomPayload {
        public static final CustomPayload.Id<EnsembleSyncPayload> ID =
                new CustomPayload.Id<>(ENSEMBLE_SYNC_ID);
        public static final PacketCodec<RegistryByteBuf, EnsembleSyncPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> buffer.writeVarInt(payload.ensembleSize()),
                buffer -> new EnsembleSyncPayload(buffer.readVarInt())
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record RangSyncPayload(int rang, long gesamtRp) implements CustomPayload {
        public static final CustomPayload.Id<RangSyncPayload> ID = new CustomPayload.Id<>(RANG_SYNC_ID);
        public static final PacketCodec<RegistryByteBuf, RangSyncPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeVarInt(payload.rang());
                    buffer.writeVarLong(payload.gesamtRp());
                },
                buffer -> new RangSyncPayload(buffer.readVarInt(), buffer.readVarLong())
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }
}
