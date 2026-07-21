package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.resonance.ResonancePlayerData;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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
    public static final Identifier ENSEMBLE_MEMBERS_ID = Aetherklang.id("ensemble_members");
    public static final Identifier DIRIGENT_SYNC_ID = Aetherklang.id("dirigent_sync");
    public static final Identifier RANG_SYNC_ID = Aetherklang.id("rang_sync");
    public static final Identifier BOSS_FX_ID = Aetherklang.id("boss_fx");
    public static final Identifier REGION_SYNC_ID = Aetherklang.id("region_sync");
    public static final Identifier LEITMOTIV_SYNC_ID = Aetherklang.id("leitmotiv_sync");
    public static final Identifier LEITMOTIV_UNLOCK_ID = Aetherklang.id("leitmotiv_unlock");
    public static final Identifier KASKADE_FX_ID = Aetherklang.id("kaskade_fx");
    public static final Identifier WELTAKKORD_FX_ID = Aetherklang.id("weltakkord_fx");
    public static final Identifier STURMFRONT_SYNC_ID = Aetherklang.id("sturmfront_sync");

    private ModPayloads() {
    }

    public static void register() {
        PayloadTypeRegistry.playC2S().register(DashPayload.ID, DashPayload.CODEC);
        PayloadTypeRegistry.playC2S().register(MoodCyclePayload.ID, MoodCyclePayload.CODEC);
        PayloadTypeRegistry.playC2S().register(KodexOpenPayload.ID, KodexOpenPayload.CODEC);
        PayloadTypeRegistry.playC2S().register(LeitmotivUnlockPayload.ID, LeitmotivUnlockPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(ResonanceSyncPayload.ID, ResonanceSyncPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(BeatFxPayload.ID, BeatFxPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(PerfectFxPayload.ID, PerfectFxPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(AkkordFxPayload.ID, AkkordFxPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(EnsembleSyncPayload.ID, EnsembleSyncPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(EnsembleMembersPayload.ID, EnsembleMembersPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(RangSyncPayload.ID, RangSyncPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(DirigentSyncPayload.ID, DirigentSyncPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(BossFxPayload.ID, BossFxPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(RegionSyncPayload.ID, RegionSyncPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(LeitmotivSyncPayload.ID, LeitmotivSyncPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(KaskadeFxPayload.ID, KaskadeFxPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(WeltakkordFxPayload.ID, WeltakkordFxPayload.CODEC);
        PayloadTypeRegistry.playS2C().register(SturmfrontSyncPayload.ID, SturmfrontSyncPayload.CODEC);
        Aetherklang.LOGGER.debug("Registered {} Aetherklang play payloads", 18);
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

    public record LeitmotivUnlockPayload(String nodeId) implements CustomPayload {
        public static final CustomPayload.Id<LeitmotivUnlockPayload> ID =
                new CustomPayload.Id<>(LEITMOTIV_UNLOCK_ID);
        public static final PacketCodec<RegistryByteBuf, LeitmotivUnlockPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> buffer.writeString(payload.nodeId()),
                buffer -> new LeitmotivUnlockPayload(buffer.readString(64))
        );

        public LeitmotivUnlockPayload {
            if (nodeId.length() > 64) {
                throw new IllegalArgumentException("Leitmotiv node id is too long");
            }
        }

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

    public record EnsembleMembersPayload(List<UUID> members) implements CustomPayload {
        private static final int MAX_MEMBERS = 1024;

        public static final CustomPayload.Id<EnsembleMembersPayload> ID =
                new CustomPayload.Id<>(ENSEMBLE_MEMBERS_ID);
        public static final PacketCodec<RegistryByteBuf, EnsembleMembersPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeVarInt(payload.members().size());
                    payload.members().forEach(buffer::writeUuid);
                },
                buffer -> new EnsembleMembersPayload(readMembers(buffer))
        );

        public EnsembleMembersPayload {
            members = List.copyOf(members);
            if (members.size() > MAX_MEMBERS) {
                throw new IllegalArgumentException("Too many ensemble members: " + members.size());
            }
        }

        private static List<UUID> readMembers(RegistryByteBuf buffer) {
            int memberCount = buffer.readVarInt();
            if (memberCount < 0 || memberCount > MAX_MEMBERS) {
                throw new IllegalArgumentException("Invalid ensemble member count: " + memberCount);
            }

            List<UUID> members = new ArrayList<>(memberCount);
            for (int index = 0; index < memberCount; index++) {
                members.add(buffer.readUuid());
            }
            return members;
        }

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record DirigentSyncPayload(
            int akkord,
            int ensembleSize,
            int amplificationPercent,
            int remainingTicks,
            boolean resolved
    ) implements CustomPayload {
        public static final CustomPayload.Id<DirigentSyncPayload> ID =
                new CustomPayload.Id<>(DIRIGENT_SYNC_ID);
        public static final PacketCodec<RegistryByteBuf, DirigentSyncPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeVarInt(payload.akkord());
                    buffer.writeVarInt(payload.ensembleSize());
                    buffer.writeVarInt(payload.amplificationPercent());
                    buffer.writeVarInt(payload.remainingTicks());
                    buffer.writeBoolean(payload.resolved());
                },
                buffer -> new DirigentSyncPayload(
                        buffer.readVarInt(),
                        buffer.readVarInt(),
                        buffer.readVarInt(),
                        buffer.readVarInt(),
                        buffer.readBoolean()
                )
        );

        public DirigentSyncPayload {
            akkord = Math.clamp(akkord, 0, 4);
            ensembleSize = Math.clamp(ensembleSize, 0, 1024);
            amplificationPercent = Math.clamp(amplificationPercent, 100, 200);
            remainingTicks = Math.clamp(remainingTicks, 0, 20 * 60);
        }

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

    public record BossFxPayload(int phase, int operation) implements CustomPayload {
        public static final CustomPayload.Id<BossFxPayload> ID = new CustomPayload.Id<>(BOSS_FX_ID);
        public static final PacketCodec<RegistryByteBuf, BossFxPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeVarInt(payload.phase());
                    buffer.writeVarInt(payload.operation());
                },
                buffer -> new BossFxPayload(buffer.readVarInt(), buffer.readVarInt())
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record KaskadeFxPayload(int stage, int x, int y, int z) implements CustomPayload {
        public static final CustomPayload.Id<KaskadeFxPayload> ID =
                new CustomPayload.Id<>(KASKADE_FX_ID);
        public static final PacketCodec<RegistryByteBuf, KaskadeFxPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeVarInt(payload.stage());
                    buffer.writeInt(payload.x());
                    buffer.writeInt(payload.y());
                    buffer.writeInt(payload.z());
                },
                buffer -> new KaskadeFxPayload(
                        buffer.readVarInt(),
                        buffer.readInt(),
                        buffer.readInt(),
                        buffer.readInt()
                )
        );

        public KaskadeFxPayload {
            stage = Math.clamp(stage, 0, 4);
        }

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record WeltakkordFxPayload(double x, double y, double z, int power, boolean reduced)
            implements CustomPayload {
        public static final CustomPayload.Id<WeltakkordFxPayload> ID =
                new CustomPayload.Id<>(WELTAKKORD_FX_ID);
        public static final PacketCodec<RegistryByteBuf, WeltakkordFxPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeDouble(payload.x());
                    buffer.writeDouble(payload.y());
                    buffer.writeDouble(payload.z());
                    buffer.writeVarInt(payload.power());
                    buffer.writeBoolean(payload.reduced());
                },
                buffer -> new WeltakkordFxPayload(
                        buffer.readDouble(),
                        buffer.readDouble(),
                        buffer.readDouble(),
                        buffer.readVarInt(),
                        buffer.readBoolean()
                )
        );

        public WeltakkordFxPayload {
            if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(z)) {
                throw new IllegalArgumentException("Weltakkord FX position must be finite");
            }
            power = Math.clamp(power, 1, 8);
        }

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record SturmfrontSyncPayload(
            boolean active,
            double centerX,
            double centerZ,
            float radius,
            float directionX,
            float directionZ,
            float intensity,
            long revision
    ) implements CustomPayload {
        public static final CustomPayload.Id<SturmfrontSyncPayload> ID =
                new CustomPayload.Id<>(STURMFRONT_SYNC_ID);
        public static final PacketCodec<RegistryByteBuf, SturmfrontSyncPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeBoolean(payload.active());
                    buffer.writeDouble(payload.centerX());
                    buffer.writeDouble(payload.centerZ());
                    buffer.writeFloat(payload.radius());
                    buffer.writeFloat(payload.directionX());
                    buffer.writeFloat(payload.directionZ());
                    buffer.writeFloat(payload.intensity());
                    buffer.writeVarLong(payload.revision());
                },
                buffer -> new SturmfrontSyncPayload(
                        buffer.readBoolean(),
                        buffer.readDouble(),
                        buffer.readDouble(),
                        buffer.readFloat(),
                        buffer.readFloat(),
                        buffer.readFloat(),
                        buffer.readFloat(),
                        buffer.readVarLong()
                )
        );

        public SturmfrontSyncPayload {
            if (!Double.isFinite(centerX)
                    || !Double.isFinite(centerZ)
                    || !Float.isFinite(radius)
                    || !Float.isFinite(directionX)
                    || !Float.isFinite(directionZ)
                    || !Float.isFinite(intensity)) {
                throw new IllegalArgumentException("Sturmfront sync values must be finite");
            }
            radius = Math.clamp(radius, 0.0F, 512.0F);
            intensity = Math.clamp(intensity, 0.0F, 1.0F);
            revision = Math.max(0L, revision);
        }

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record RegionSyncPayload(String region, int anchorX, int anchorY, int anchorZ)
            implements CustomPayload {
        public static final CustomPayload.Id<RegionSyncPayload> ID = new CustomPayload.Id<>(REGION_SYNC_ID);
        public static final PacketCodec<RegistryByteBuf, RegionSyncPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeString(payload.region());
                    buffer.writeVarInt(payload.anchorX());
                    buffer.writeVarInt(payload.anchorY());
                    buffer.writeVarInt(payload.anchorZ());
                },
                buffer -> new RegionSyncPayload(
                        buffer.readString(),
                        buffer.readVarInt(),
                        buffer.readVarInt(),
                        buffer.readVarInt()
                )
        );

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    public record LeitmotivSyncPayload(int keys, List<String> unlockedNodes) implements CustomPayload {
        private static final int MAX_NODES = 24;

        public static final CustomPayload.Id<LeitmotivSyncPayload> ID =
                new CustomPayload.Id<>(LEITMOTIV_SYNC_ID);
        public static final PacketCodec<RegistryByteBuf, LeitmotivSyncPayload> CODEC = PacketCodec.of(
                (payload, buffer) -> {
                    buffer.writeVarInt(payload.keys());
                    buffer.writeVarInt(payload.unlockedNodes().size());
                    payload.unlockedNodes().forEach(buffer::writeString);
                },
                buffer -> new LeitmotivSyncPayload(buffer.readVarInt(), readLeitmotivNodes(buffer))
        );

        public LeitmotivSyncPayload {
            keys = Math.max(0, keys);
            unlockedNodes = List.copyOf(unlockedNodes);
            if (unlockedNodes.size() > MAX_NODES) {
                throw new IllegalArgumentException("Too many unlocked Leitmotiv nodes: " + unlockedNodes.size());
            }
        }

        private static List<String> readLeitmotivNodes(RegistryByteBuf buffer) {
            int nodeCount = buffer.readVarInt();
            if (nodeCount < 0 || nodeCount > MAX_NODES) {
                throw new IllegalArgumentException("Invalid unlocked Leitmotiv node count: " + nodeCount);
            }

            List<String> nodes = new ArrayList<>(nodeCount);
            for (int index = 0; index < nodeCount; index++) {
                nodes.add(buffer.readString(64));
            }
            return nodes;
        }

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }
}
