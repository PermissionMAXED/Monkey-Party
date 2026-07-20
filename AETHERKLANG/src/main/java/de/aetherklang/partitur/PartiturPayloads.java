package de.aetherklang.partitur;

import de.aetherklang.Aetherklang;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;

public final class PartiturPayloads {
    public static final int MAX_SYNCED_CONTRACTS = 16;

    private PartiturPayloads() {
    }

    public record ClaimPayload(String contractId) implements CustomPayload {
        public static final Id<ClaimPayload> ID =
                new Id<>(Aetherklang.id("partitur_claim"));
        public static final PacketCodec<RegistryByteBuf, ClaimPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> buffer.writeString(payload.contractId()),
                buffer -> new ClaimPayload(buffer.readString())
        );

        public ClaimPayload {
            if (contractId == null || contractId.isBlank() || contractId.length() > 128) {
                throw new IllegalArgumentException("Invalid Partitur contract id");
            }
        }

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record SyncPayload(
            boolean openScreen,
            long rotation,
            int ticksRemaining,
            List<Entry> entries
    ) implements CustomPayload {
        public static final Id<SyncPayload> ID =
                new Id<>(Aetherklang.id("partitur_sync"));
        public static final PacketCodec<RegistryByteBuf, SyncPayload> CODEC = PacketCodec.of(
                SyncPayload::write,
                SyncPayload::read
        );

        public SyncPayload {
            entries = List.copyOf(entries);
            if (entries.size() > MAX_SYNCED_CONTRACTS) {
                throw new IllegalArgumentException("Too many Partitur contracts: " + entries.size());
            }
            ticksRemaining = Math.max(0, ticksRemaining);
        }

        private static void write(SyncPayload payload, RegistryByteBuf buffer) {
            buffer.writeBoolean(payload.openScreen());
            buffer.writeVarLong(payload.rotation());
            buffer.writeVarInt(payload.ticksRemaining());
            buffer.writeVarInt(payload.entries().size());
            payload.entries().forEach(entry -> entry.write(buffer));
        }

        private static SyncPayload read(RegistryByteBuf buffer) {
            boolean openScreen = buffer.readBoolean();
            long rotation = buffer.readVarLong();
            int ticksRemaining = buffer.readVarInt();
            int count = buffer.readVarInt();
            if (count < 0 || count > MAX_SYNCED_CONTRACTS) {
                throw new IllegalArgumentException("Invalid Partitur contract count: " + count);
            }
            List<Entry> entries = new ArrayList<>(count);
            for (int index = 0; index < count; index++) {
                entries.add(Entry.read(buffer));
            }
            return new SyncPayload(openScreen, rotation, ticksRemaining, entries);
        }

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record Entry(
            String id,
            String titleKey,
            String descriptionKey,
            String objective,
            int progress,
            int amount,
            int rewardRp,
            int rewardNotenschluessel,
            String rewardMaterial,
            int rewardMaterialCount,
            boolean claimed
    ) {
        public Entry {
            if (id == null || id.isBlank() || titleKey == null || descriptionKey == null || objective == null) {
                throw new IllegalArgumentException("Incomplete Partitur entry");
            }
            progress = Math.max(0, progress);
            amount = Math.max(1, amount);
            rewardRp = Math.max(0, rewardRp);
            rewardNotenschluessel = Math.max(0, rewardNotenschluessel);
            rewardMaterial = rewardMaterial == null ? "" : rewardMaterial;
            rewardMaterialCount = Math.max(0, rewardMaterialCount);
        }

        public boolean complete() {
            return progress >= amount;
        }

        private void write(RegistryByteBuf buffer) {
            buffer.writeString(id);
            buffer.writeString(titleKey);
            buffer.writeString(descriptionKey);
            buffer.writeString(objective);
            buffer.writeVarInt(progress);
            buffer.writeVarInt(amount);
            buffer.writeVarInt(rewardRp);
            buffer.writeVarInt(rewardNotenschluessel);
            buffer.writeString(rewardMaterial);
            buffer.writeVarInt(rewardMaterialCount);
            buffer.writeBoolean(claimed);
        }

        private static Entry read(RegistryByteBuf buffer) {
            return new Entry(
                    buffer.readString(),
                    buffer.readString(),
                    buffer.readString(),
                    buffer.readString(),
                    buffer.readVarInt(),
                    buffer.readVarInt(),
                    buffer.readVarInt(),
                    buffer.readVarInt(),
                    buffer.readString(),
                    buffer.readVarInt(),
                    buffer.readBoolean()
            );
        }
    }
}
