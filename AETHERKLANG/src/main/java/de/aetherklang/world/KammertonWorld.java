package de.aetherklang.world;

import de.aetherklang.Aetherklang;
import de.aetherklang.block.GlockenspielPortalBlock;
import de.aetherklang.entity.ChoralEntity;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.List;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerWorldEvents;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.SpawnReason;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.Heightmap;
import net.minecraft.world.TeleportTarget;
import net.minecraft.world.World;

/**
 * Runtime staging for the Kammerton destination.
 *
 * <p>The datapack supplies the dimension, indigo biome, and floating-island
 * terrain. This class adds the authored arrival island and Choral arena so the
 * endgame landmarks are stable across world seeds.</p>
 */
public final class KammertonWorld {
    public static final RegistryKey<World> KAMMERTON_KEY =
            RegistryKey.of(RegistryKeys.WORLD, Aetherklang.id("kammerton"));

    public static final BlockPos ARRIVAL = new BlockPos(0, 129, 0);
    public static final BlockPos ARENA_CENTER = new BlockPos(0, 129, 96);
    public static final BlockPos BOSS_SPAWN = ARENA_CENTER.add(0, 11, 0);

    private static final BlockPos GENERATION_MARKER = new BlockPos(0, 122, 0);
    private static final BlockPos ENCOUNTER_MARKER = ARENA_CENTER.down(3);
    private static final int UPDATE_FLAGS = Block.NOTIFY_LISTENERS | Block.FORCE_STATE;
    private static final double ARENA_TRIGGER_RADIUS_SQUARED = 22.0D * 22.0D;

    private KammertonWorld() {
    }

    public static void register() {
        GlockenspielPortalBlock.setDestinationResolver(KammertonWorld::resolvePortalDestination);
        ServerWorldEvents.LOAD.register((server, world) -> {
            if (isKammerton(world)) {
                ensureDestination(world);
            }
        });
        ServerTickEvents.END_WORLD_TICK.register(KammertonWorld::tick);
    }

    public static boolean isKammerton(World world) {
        return world.getRegistryKey().equals(KAMMERTON_KEY);
    }

    private static TeleportTarget resolvePortalDestination(ServerPlayerEntity player) {
        ServerWorld source = (ServerWorld) player.getEntityWorld();
        MinecraftServer server = source.getServer();
        if (server == null) {
            return null;
        }

        if (isKammerton(source)) {
            ServerWorld overworld = server.getOverworld();
            BlockPos worldSpawn = overworld.getSpawnPoint().getPos();
            BlockPos safeSpawn = overworld.getTopPosition(Heightmap.Type.MOTION_BLOCKING_NO_LEAVES, worldSpawn);
            return target(overworld, safeSpawn, player);
        }

        ServerWorld kammerton = server.getWorld(KAMMERTON_KEY);
        if (kammerton == null) {
            Aetherklang.LOGGER.error(
                    "Kammerton dimension is unavailable; verify data/aetherklang/dimension/kammerton.json"
            );
            return null;
        }

        ensureDestination(kammerton);
        return target(kammerton, ARRIVAL, player);
    }

    private static TeleportTarget target(
            ServerWorld world,
            BlockPos position,
            ServerPlayerEntity player
    ) {
        return new TeleportTarget(
                world,
                Vec3d.ofBottomCenter(position),
                Vec3d.ZERO,
                player.getYaw(),
                player.getPitch(),
                TeleportTarget.NO_OP
        );
    }

    private static void tick(ServerWorld world) {
        if (!isKammerton(world)) {
            return;
        }

        long time = world.getTime();
        if (time % 10L == 0L) {
            for (ServerPlayerEntity player : world.getPlayers()) {
                world.spawnParticles(
                        ModParticles.NOTE_SPARK,
                        player.getX(),
                        player.getY() + 1.1D,
                        player.getZ(),
                        2,
                        6.0D,
                        2.0D,
                        6.0D,
                        0.015D
                );
            }
            tryStartEncounter(world);
        }

        if (time % 180L == 0L) {
            for (ServerPlayerEntity player : world.getPlayers()) {
                world.playSound(
                        null,
                        player.getBlockPos(),
                        ModSounds.PORTAL_HUM,
                        SoundCategory.AMBIENT,
                        0.22F,
                        0.72F
                );
            }
        }
    }

    private static void tryStartEncounter(ServerWorld world) {
        if (!world.getBlockState(ENCOUNTER_MARKER).isOf(Blocks.REINFORCED_DEEPSLATE)) {
            return;
        }

        Vec3d center = Vec3d.ofBottomCenter(ARENA_CENTER);
        List<ServerPlayerEntity> challengers = world.getPlayers(player ->
                !player.isSpectator() && player.squaredDistanceTo(center) <= ARENA_TRIGGER_RADIUS_SQUARED
        );
        if (challengers.isEmpty()) {
            return;
        }

        Box arena = new Box(ARENA_CENTER).expand(48.0D, 32.0D, 48.0D);
        boolean bossAlreadyPresent = !world.getEntitiesByClass(
                ChoralEntity.class,
                arena,
                ChoralEntity::isAlive
        ).isEmpty();
        if (bossAlreadyPresent) {
            world.setBlockState(ENCOUNTER_MARKER, Blocks.CRYING_OBSIDIAN.getDefaultState(), UPDATE_FLAGS);
            return;
        }

        ChoralEntity choral = ModEntities.CHORAL.create(world, SpawnReason.EVENT);
        if (choral == null) {
            Aetherklang.LOGGER.error("Could not create Choral for the Kammerton encounter");
            return;
        }
        choral.refreshPositionAndAngles(
                BOSS_SPAWN.getX() + 0.5D,
                BOSS_SPAWN.getY(),
                BOSS_SPAWN.getZ() + 0.5D,
                180.0F,
                0.0F
        );
        if (!world.spawnEntity(choral)) {
            Aetherklang.LOGGER.error("Could not add Choral to the Kammerton arena");
            return;
        }
        world.setBlockState(ENCOUNTER_MARKER, Blocks.CRYING_OBSIDIAN.getDefaultState(), UPDATE_FLAGS);

        world.spawnParticles(
                ModParticles.BEAT_RING,
                BOSS_SPAWN.getX() + 0.5D,
                BOSS_SPAWN.getY(),
                BOSS_SPAWN.getZ() + 0.5D,
                72,
                4.0D,
                2.0D,
                4.0D,
                0.06D
        );
        world.playSound(
                null,
                ARENA_CENTER,
                ModSounds.CHORAL_THEME,
                SoundCategory.HOSTILE,
                1.8F,
                1.0F
        );
        for (ServerPlayerEntity challenger : challengers) {
            challenger.sendMessage(Text.translatable("message.aetherklang.choral.awakens"), false);
        }
        Aetherklang.LOGGER.info("Choral awakened in the Kammerton arena");
    }

    private static void ensureDestination(ServerWorld world) {
        if (world.getBlockState(GENERATION_MARKER).isOf(Blocks.LODESTONE)) {
            return;
        }

        Aetherklang.LOGGER.info("Composing the Kammerton arrival islands and Choral arena");
        clearAuthoredVolume(world, BlockPos.ORIGIN, 22, 122, 151);
        clearAuthoredVolume(world, ARENA_CENTER, 31, 121, 162);
        clearBridgeVolume(world);

        placeIsland(world, new BlockPos(0, 128, 0), 17);
        placeIsland(world, new BlockPos(0, 128, 96), 27);
        placeIsland(world, new BlockPos(43, 134, 41), 10);
        placeIsland(world, new BlockPos(-46, 126, 43), 9);
        placeIsland(world, new BlockPos(50, 137, 97), 11);
        placeIsland(world, new BlockPos(-53, 132, 99), 10);
        placeIsland(world, new BlockPos(35, 125, 142), 8);
        placeIsland(world, new BlockPos(-39, 135, 144), 9);
        placeSatelliteCrown(world, new BlockPos(43, 135, 41), ModBlocks.RESONANZKRISTALL_CYAN);
        placeSatelliteCrown(world, new BlockPos(-46, 127, 43), ModBlocks.RESONANZKRISTALL_MAGENTA);
        placeSatelliteCrown(world, new BlockPos(50, 138, 97), ModBlocks.RESONANZKRISTALL_GOLD);
        placeSatelliteCrown(world, new BlockPos(-53, 133, 99), ModBlocks.RESONANZKRISTALL_INDIGO);
        placeSatelliteCrown(world, new BlockPos(35, 126, 142), ModBlocks.RESONANZKRISTALL_CYAN);
        placeSatelliteCrown(world, new BlockPos(-39, 136, 144), ModBlocks.RESONANZKRISTALL_MAGENTA);

        placeArrivalSanctum(world);
        placeBridge(world);
        placeArena(world);
        world.setBlockState(GENERATION_MARKER, Blocks.LODESTONE.getDefaultState(), UPDATE_FLAGS);
        Aetherklang.LOGGER.info("Kammerton destination ready at {}, {}, {}", ARRIVAL.getX(), ARRIVAL.getY(), ARRIVAL.getZ());
    }

    private static void clearAuthoredVolume(
            ServerWorld world,
            BlockPos center,
            int radius,
            int minY,
            int maxY
    ) {
        BlockPos.Mutable mutable = new BlockPos.Mutable();
        int radiusSquared = radius * radius;
        for (int x = -radius; x <= radius; x++) {
            for (int z = -radius; z <= radius; z++) {
                if (x * x + z * z > radiusSquared) {
                    continue;
                }
                for (int y = minY; y <= maxY; y++) {
                    mutable.set(center.getX() + x, y, center.getZ() + z);
                    world.setBlockState(mutable, Blocks.AIR.getDefaultState(), UPDATE_FLAGS);
                }
            }
        }
    }

    private static void clearBridgeVolume(ServerWorld world) {
        BlockPos.Mutable mutable = new BlockPos.Mutable();
        for (int x = -4; x <= 4; x++) {
            for (int z = 14; z <= 69; z++) {
                for (int y = 128; y <= 137; y++) {
                    mutable.set(x, y, z);
                    world.setBlockState(mutable, Blocks.AIR.getDefaultState(), UPDATE_FLAGS);
                }
            }
        }
    }

    private static void placeIsland(ServerWorld world, BlockPos topCenter, int radius) {
        BlockPos.Mutable mutable = new BlockPos.Mutable();
        int depth = Math.max(5, radius / 2);
        for (int layer = 0; layer <= depth; layer++) {
            int layerRadius = Math.max(2, radius - layer * 2);
            int radiusSquared = layerRadius * layerRadius;
            int y = topCenter.getY() - layer;
            for (int x = -layerRadius; x <= layerRadius; x++) {
                for (int z = -layerRadius; z <= layerRadius; z++) {
                    int edgeNoise = Math.floorMod(
                            (topCenter.getX() + x) * 31 + (topCenter.getZ() + z) * 17 + layer * 13,
                            7
                    );
                    if (x * x + z * z > radiusSquared - edgeNoise) {
                        continue;
                    }
                    mutable.set(topCenter.getX() + x, y, topCenter.getZ() + z);
                    world.setBlockState(mutable, islandState(x, z, layer), UPDATE_FLAGS);
                }
            }
        }
    }

    private static BlockState islandState(int x, int z, int layer) {
        if (layer == 0) {
            int tone = Math.floorMod(x * 7 + z * 11, 13);
            if (tone == 0) {
                return Blocks.AMETHYST_BLOCK.getDefaultState();
            }
            return tone <= 2
                    ? Blocks.PURPUR_BLOCK.getDefaultState()
                    : Blocks.POLISHED_BLACKSTONE_BRICKS.getDefaultState();
        }
        if (layer >= 5 && Math.floorMod(x + z + layer, 5) == 0) {
            return Blocks.CRYING_OBSIDIAN.getDefaultState();
        }
        return layer % 3 == 0
                ? Blocks.END_STONE_BRICKS.getDefaultState()
                : Blocks.OBSIDIAN.getDefaultState();
    }

    private static void placeArrivalSanctum(ServerWorld world) {
        BlockPos floor = ARRIVAL.down();
        for (int x = -4; x <= 4; x++) {
            for (int z = -4; z <= 4; z++) {
                if (x * x + z * z <= 18) {
                    set(world, floor.add(x, 0, z), ((x + z) & 1) == 0
                            ? Blocks.SMOOTH_QUARTZ
                            : Blocks.POLISHED_BLACKSTONE);
                }
            }
        }

        set(world, floor.add(0, 1, 8), ModBlocks.STIMMALTAR);
        placeCrystalPylon(world, floor.add(6, 1, 0), ModBlocks.RESONANZKRISTALL_CYAN);
        placeCrystalPylon(world, floor.add(-6, 1, 0), ModBlocks.RESONANZKRISTALL_MAGENTA);
        placeCrystalPylon(world, floor.add(0, 1, 6), ModBlocks.RESONANZKRISTALL_GOLD);
        placeCrystalPylon(world, floor.add(0, 1, -6), ModBlocks.RESONANZKRISTALL_INDIGO);

        BlockPos portalBase = floor.add(0, 1, -9);
        for (int y = 0; y <= 4; y++) {
            set(world, portalBase.add(-2, y, 0), Blocks.CRYING_OBSIDIAN);
            set(world, portalBase.add(2, y, 0), Blocks.CRYING_OBSIDIAN);
        }
        for (int x = -2; x <= 2; x++) {
            set(world, portalBase.add(x, 4, 0), Blocks.GILDED_BLACKSTONE);
        }
        for (int x = -1; x <= 1; x++) {
            for (int y = 0; y <= 3; y++) {
                set(world, portalBase.add(x, y, 0), ModBlocks.GLOCKENSPIEL_PORTAL);
            }
        }
    }

    private static void placeBridge(ServerWorld world) {
        for (int z = 14; z <= 69; z++) {
            for (int x = -2; x <= 2; x++) {
                Block bridgeBlock = (z % 8 == 0 || x == 0 && z % 4 == 0)
                        ? Blocks.GOLD_BLOCK
                        : Blocks.POLISHED_BLACKSTONE_BRICKS;
                set(world, new BlockPos(x, 128, z), bridgeBlock);
            }
            if (z % 8 == 0) {
                set(world, new BlockPos(-3, 129, z), Blocks.SEA_LANTERN);
                set(world, new BlockPos(3, 129, z), Blocks.SEA_LANTERN);
            }
        }
    }

    private static void placeArena(ServerWorld world) {
        BlockPos floor = ARENA_CENTER.down();
        for (int radius = 5; radius <= 23; radius += 6) {
            int samples = radius * 8;
            for (int i = 0; i < samples; i++) {
                double angle = Math.PI * 2.0D * i / samples;
                BlockPos ring = floor.add(
                        (int) Math.round(Math.cos(angle) * radius),
                        0,
                        (int) Math.round(Math.sin(angle) * radius)
                );
                set(world, ring, radius == 23 ? Blocks.GOLD_BLOCK : Blocks.AMETHYST_BLOCK);
            }
        }

        set(world, floor, ModBlocks.STIMMALTAR);
        world.setBlockState(ENCOUNTER_MARKER, Blocks.REINFORCED_DEEPSLATE.getDefaultState(), UPDATE_FLAGS);
        placeCrystalPylon(world, floor.add(18, 1, 0), ModBlocks.RESONANZKRISTALL_CYAN);
        placeCrystalPylon(world, floor.add(-18, 1, 0), ModBlocks.RESONANZKRISTALL_MAGENTA);
        placeCrystalPylon(world, floor.add(0, 1, 18), ModBlocks.RESONANZKRISTALL_GOLD);
        placeCrystalPylon(world, floor.add(0, 1, -18), ModBlocks.RESONANZKRISTALL_INDIGO);

        for (int i = 0; i < 12; i++) {
            double angle = Math.PI * 2.0D * i / 12.0D;
            BlockPos pillar = floor.add(
                    (int) Math.round(Math.cos(angle) * 25.0D),
                    1,
                    (int) Math.round(Math.sin(angle) * 25.0D)
            );
            for (int y = 0; y < 5; y++) {
                set(world, pillar.up(y), y == 4 ? Blocks.AMETHYST_CLUSTER : Blocks.PURPUR_PILLAR);
            }
        }
    }

    private static void placeCrystalPylon(ServerWorld world, BlockPos base, Block crystal) {
        set(world, base, Blocks.GOLD_BLOCK);
        set(world, base.up(), Blocks.SEA_LANTERN);
        set(world, base.up(2), crystal);
    }

    private static void placeSatelliteCrown(ServerWorld world, BlockPos base, Block crystal) {
        set(world, base, Blocks.SEA_LANTERN);
        set(world, base.up(), crystal);
        set(world, base.add(2, 0, 0), Blocks.AMETHYST_CLUSTER);
        set(world, base.add(-2, 0, 0), Blocks.AMETHYST_CLUSTER);
        set(world, base.add(0, 0, 2), Blocks.AMETHYST_CLUSTER);
        set(world, base.add(0, 0, -2), Blocks.AMETHYST_CLUSTER);
    }

    private static void set(ServerWorld world, BlockPos pos, Block block) {
        world.setBlockState(pos, block.getDefaultState(), UPDATE_FLAGS);
    }
}
