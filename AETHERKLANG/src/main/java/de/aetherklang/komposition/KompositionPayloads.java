package de.aetherklang.komposition;

import de.aetherklang.Aetherklang;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Hand;

public final class KompositionPayloads {
    private KompositionPayloads() {
    }

    public record OpenEditorPayload(Hand hand, Zauberpartitur score) implements CustomPayload {
        public static final Id<OpenEditorPayload> ID =
                new Id<>(Aetherklang.id("zauberpartitur_open"));
        public static final PacketCodec<RegistryByteBuf, OpenEditorPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeBoolean(payload.hand() == Hand.OFF_HAND);
                    Zauberpartitur.PACKET_CODEC.encode(buffer, payload.score());
                },
                buffer -> new OpenEditorPayload(
                        buffer.readBoolean() ? Hand.OFF_HAND : Hand.MAIN_HAND,
                        Zauberpartitur.PACKET_CODEC.decode(buffer)
                )
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record SavePayload(Hand hand, Zauberpartitur score) implements CustomPayload {
        public static final Id<SavePayload> ID =
                new Id<>(Aetherklang.id("zauberpartitur_save"));
        public static final PacketCodec<RegistryByteBuf, SavePayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeBoolean(payload.hand() == Hand.OFF_HAND);
                    Zauberpartitur.PACKET_CODEC.encode(buffer, payload.score());
                },
                buffer -> new SavePayload(
                        buffer.readBoolean() ? Hand.OFF_HAND : Hand.MAIN_HAND,
                        Zauberpartitur.PACKET_CODEC.decode(buffer)
                )
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }
}
