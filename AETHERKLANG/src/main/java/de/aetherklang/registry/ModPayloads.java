package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.resonance.ResonancePlayerData;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

public final class ModPayloads {
    public static final Identifier DASH_ID = Aetherklang.id("dash");
    public static final Identifier RESONANCE_SYNC_ID = Aetherklang.id("resonance_sync");
    public static final Identifier BEAT_FX_ID = Aetherklang.id("beat_fx");

    private ModPayloads() {
    }

    public static void register() {
        PayloadTypeRegistry.playC2S().register(DashPayload.ID, DashPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(ResonanceSyncPayload.ID, ResonanceSyncPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(BeatFxPayload.ID, BeatFxPayload.CODEC);
        Aetherklang.LOGGER.debug("Registered {} Aetherklang play payloads", 3);
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

    public record ResonanceSyncPayload(
            String mood,
            int rp,
            float beatPhase,
            float dissonanz
    ) implements CustomPayload {
        public static final CustomPayload.Id<ResonanceSyncPayload> ID =
                new CustomPayload.Id<>(RESONANCE_SYNC_ID);
        public static final PacketCodec<RegistryByteBuf, ResonanceSyncPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeString(payload.mood());
                    buffer.writeVarInt(payload.rp());
                    buffer.writeFloat(payload.beatPhase());
                    buffer.writeFloat(payload.dissonanz());
                },
                buffer -> new ResonanceSyncPayload(
                        buffer.readString(),
                        buffer.readVarInt(),
                        buffer.readFloat(),
                        buffer.readFloat()
                )
        );

        public static ResonanceSyncPayload from(ResonancePlayerData data) {
            return new ResonanceSyncPayload(
                    data.getMood().asString(),
                    data.getRp(),
                    data.getBeatPhase(),
                    data.getDissonanz()
            );
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
