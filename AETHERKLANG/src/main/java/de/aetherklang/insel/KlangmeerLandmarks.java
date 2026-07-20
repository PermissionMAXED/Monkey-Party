package de.aetherklang.insel;

import de.aetherklang.Aetherklang;
import de.aetherklang.bosswerk.BosswerkBossEntity;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModParticles;
import java.util.List;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.block.FenceGateBlock;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.Vec3d;

/**
 * Authored arena landmarks at the four fixed Klangmeer region anchors.
 *
 * <p>Each arena has an independent lodestone generation marker and a separate
 * reinforced-deepslate encounter marker. Approaching an armed arena summons
 * its boss once, then turns only the encounter marker into crying obsidian.</p>
 */
public final class KlangmeerLandmarks {
    private static final int UPDATE_FLAGS = Block.NOTIFY_LISTENERS | Block.FORCE_STATE;
    private static final double TRIGGER_RADIUS_SQUARED = 24.0D * 24.0D;

    private KlangmeerLandmarks() {
    }

    public static void ensureGenerated(ServerWorld world) {
        if (!de.aetherklang.world.KammertonWorld.isKammerton(world)) {
            return;
        }

        for (KlangmeerRegion region : KlangmeerRegion.values()) {
            BlockPos marker = generationMarker(region);
            if (world.getBlockState(marker).isOf(Blocks.LODESTONE)) {
                continue;
            }

            switch (region) {
                case BASSGEWOELBE -> placeGrossePauke(world, region.anker());
                case ARPEGGIENMEER -> placeSaitenbruecken(world, region.anker());
                case KAKOPHONIE_RIFF -> placeSchwarmthron(world, region.anker());
                case GENERALPAUSE_OEDE -> placeLeeresPodium(world, region.anker());
            }
            set(world, encounterMarker(region), Blocks.REINFORCED_DEEPSLATE);
            set(world, marker, Blocks.LODESTONE);
            Aetherklang.LOGGER.info(
                    "Klangmeer landmark '{}' generated at [{}, {}, {}]",
                    landmarkName(region),
                    region.anker().getX(),
                    region.anker().getY(),
                    region.anker().getZ()
            );
        }
    }

    public static void tick(ServerWorld world) {
        if (!de.aetherklang.world.KammertonWorld.isKammerton(world) || world.getTime() % 10L != 0L) {
            return;
        }
        for (KlangmeerRegion region : KlangmeerRegion.values()) {
            tryStartEncounter(world, region);
        }
    }

    private static void tryStartEncounter(ServerWorld world, KlangmeerRegion region) {
        BlockPos marker = encounterMarker(region);
        if (!world.getBlockState(marker).isOf(Blocks.REINFORCED_DEEPSLATE)) {
            return;
        }

        BlockPos center = region.anker();
        Vec3d triggerCenter = Vec3d.ofBottomCenter(center);
        List<ServerPlayerEntity> challengers = world.getPlayers(player ->
                !player.isSpectator() && player.squaredDistanceTo(triggerCenter) <= TRIGGER_RADIUS_SQUARED
        );
        if (challengers.isEmpty()) {
            return;
        }

        EntityType<BosswerkBossEntity> bossType = bossType(region);
        Box arena = new Box(center).expand(42.0D, 28.0D, 42.0D);
        boolean bossAlreadyPresent = !world.getEntitiesByClass(
                BosswerkBossEntity.class,
                arena,
                boss -> boss.isAlive() && boss.getType() == bossType
        ).isEmpty();
        if (bossAlreadyPresent) {
            set(world, marker, Blocks.CRYING_OBSIDIAN);
            return;
        }

        BosswerkBossEntity boss = bossType.create(world, SpawnReason.EVENT);
        if (boss == null) {
            Aetherklang.LOGGER.error("Could not create {} for {}", bossType, landmarkName(region));
            return;
        }

        BlockPos spawn = bossSpawn(region);
        boss.refreshPositionAndAngles(
                spawn.getX() + 0.5D,
                spawn.getY(),
                spawn.getZ() + 0.5D,
                180.0F,
                0.0F
        );
        if (!world.spawnEntity(boss)) {
            Aetherklang.LOGGER.error("Could not add {} to {}", bossType, landmarkName(region));
            return;
        }
        set(world, marker, Blocks.CRYING_OBSIDIAN);

        world.spawnParticles(
                switch (region) {
                    case BASSGEWOELBE -> ModParticles.TREMOLO_SPLITTER;
                    case ARPEGGIENMEER -> ModParticles.GLISSANDO_SPUR;
                    case KAKOPHONIE_RIFF -> ModParticles.KAKOPHON_FUNKE;
                    case GENERALPAUSE_OEDE -> ModParticles.GENERALPAUSE_NEBEL;
                },
                spawn.getX() + 0.5D,
                spawn.getY() + 1.0D,
                spawn.getZ() + 0.5D,
                72,
                4.0D,
                2.0D,
                4.0D,
                0.06D
        );
        world.playSound(null, center, boss.getBossSound(), SoundCategory.HOSTILE, 1.8F, 1.0F);
        Text announcement = Text.translatable("message.aetherklang." + boss.getBossId() + ".awakens");
        for (ServerPlayerEntity challenger : challengers) {
            challenger.sendMessage(announcement, false);
        }
        Aetherklang.LOGGER.info("{} awakened at '{}'", boss.getBossId(), landmarkName(region));
    }

    private static void placeGrossePauke(ServerWorld world, BlockPos center) {
        clearArenaAir(world, center, 20, 14);
        BlockPos floor = center.down();
        placeDisc(world, floor, 18, ModBlocks.BASSSCHIEFER_POLIERT, ModBlocks.BASSSCHIEFER_ZIEGEL);
        placeRing(world, floor, 17, ModBlocks.BASSSCHIEFER_ZIEGEL);
        placeArenaWall(world, floor, 17, Blocks.POLISHED_DEEPSLATE_WALL, Blocks.DARK_OAK_FENCE_GATE);
        placeRing(world, floor.up(), 6, Blocks.GOLD_BLOCK);
        placeDisc(world, floor.up(), 5, Blocks.SMOOTH_QUARTZ, Blocks.BONE_BLOCK);

        for (int index = 0; index < 8; index++) {
            double angle = Math.PI * 2.0D * index / 8.0D;
            BlockPos pillar = offset(floor, angle, 15).up();
            column(world, pillar, ModBlocks.BASSSCHIEFER_ZIEGEL, 6);
            set(world, pillar.up(6), index % 2 == 0 ? Blocks.GOLD_BLOCK : Blocks.SEA_LANTERN);
        }
        placeStimmpfeiler(world, center.add(0, 0, -11), ModBlocks.RESONANZKRISTALL_INDIGO);
    }

    private static void placeSaitenbruecken(ServerWorld world, BlockPos center) {
        clearArenaAir(world, center, 20, 14);
        BlockPos floor = center.down();
        placeDisc(world, floor, 18, Blocks.CALCITE, Blocks.MOSS_BLOCK);
        placeRing(world, floor, 17, ModBlocks.RESONANZHOLZ_PLANKEN);
        placeArenaWall(world, floor, 17, Blocks.MOSSY_COBBLESTONE_WALL, Blocks.OAK_FENCE_GATE);

        for (int z = -13; z <= 13; z++) {
            int height = 3 + Math.floorMod(z, 4);
            for (int x : new int[]{-10, 10}) {
                column(world, floor.add(x, 1, z), z % 3 == 0 ? Blocks.CALCITE : ModBlocks.RESONANZHOLZ, height);
                if (z % 4 == 0) {
                    set(world, floor.add(x, height + 1, z), ModBlocks.KLANGLATERNE);
                }
            }
        }

        int bridge = 0;
        for (int z : new int[]{-9, 0, 9}) {
            int bridgeY = 5 + bridge++;
            for (int x = -9; x <= 9; x++) {
                set(world, floor.add(x, bridgeY, z), ModBlocks.TAKTBRUECKE);
                if (Math.abs(x) == 9) {
                    set(world, floor.add(x, bridgeY + 1, z), ModBlocks.RESONANZKRISTALL_CYAN);
                }
            }
        }
        placeStimmpfeiler(world, center.add(0, 0, -13), ModBlocks.RESONANZKRISTALL_CYAN);
    }

    private static void placeSchwarmthron(ServerWorld world, BlockPos center) {
        clearArenaAir(world, center, 20, 14);
        BlockPos floor = center.down();
        placeDisc(world, floor, 18, Blocks.POLISHED_BLACKSTONE, Blocks.MAGMA_BLOCK);
        placeRing(world, floor, 17, Blocks.CRYING_OBSIDIAN);
        placeArenaWall(world, floor, 17, Blocks.BLACKSTONE_WALL, Blocks.CRIMSON_FENCE_GATE);
        placeRing(world, floor.up(), 9, Blocks.GILDED_BLACKSTONE);

        for (int index = 0; index < 12; index++) {
            double angle = Math.PI * 2.0D * index / 12.0D;
            BlockPos spike = offset(floor, angle, index % 2 == 0 ? 15 : 13).up();
            int height = 3 + index % 5;
            column(world, spike, index % 2 == 0 ? Blocks.OBSIDIAN : Blocks.CRYING_OBSIDIAN, height);
            set(world, spike.up(height), Blocks.AMETHYST_CLUSTER);
        }

        BlockPos throne = center.add(0, 0, 6);
        placeDisc(world, throne, 3, Blocks.GILDED_BLACKSTONE, Blocks.POLISHED_BLACKSTONE_BRICKS);
        for (int y = 1; y <= 5; y++) {
            set(world, throne.add(0, y, 2), y == 5 ? ModBlocks.RESONANZKRISTALL_MAGENTA : Blocks.CRYING_OBSIDIAN);
        }
        set(world, throne.add(-2, 2, 2), Blocks.OBSIDIAN);
        set(world, throne.add(2, 2, 2), Blocks.OBSIDIAN);
        placeStimmpfeiler(world, center.add(0, 0, -11), ModBlocks.RESONANZKRISTALL_MAGENTA);
    }

    private static void placeLeeresPodium(ServerWorld world, BlockPos center) {
        clearArenaAir(world, center, 21, 14);
        BlockPos floor = center.down();
        placeDisc(world, floor, 19, Blocks.SMOOTH_BASALT, Blocks.WHITE_CONCRETE);
        placeRing(world, floor, 18, Blocks.CALCITE);
        placeArenaWall(world, floor, 18, Blocks.DIORITE_WALL, Blocks.BIRCH_FENCE_GATE);
        placeRing(world, floor.up(), 11, Blocks.WHITE_CONCRETE);
        placeDisc(world, floor.up(), 8, Blocks.SMOOTH_QUARTZ, Blocks.CALCITE);

        for (int index = 0; index < 4; index++) {
            double angle = Math.PI * 0.5D * index;
            BlockPos pillar = offset(floor, angle, 15).up();
            column(world, pillar, Blocks.QUARTZ_PILLAR, 5);
            set(world, pillar.up(5), ModBlocks.KLANGLATERNE);
        }
        placeStimmpfeiler(world, center.add(0, 0, -12), ModBlocks.RESONANZKRISTALL_GOLD);
    }

    private static void placeDisc(
            ServerWorld world,
            BlockPos center,
            int radius,
            Block primary,
            Block accent
    ) {
        int radiusSquared = radius * radius;
        for (int x = -radius; x <= radius; x++) {
            for (int z = -radius; z <= radius; z++) {
                if (x * x + z * z <= radiusSquared) {
                    set(world, center.add(x, 0, z), Math.floorMod(x * 7 + z * 11, 13) == 0 ? accent : primary);
                }
            }
        }
    }

    private static void clearArenaAir(ServerWorld world, BlockPos center, int radius, int height) {
        int radiusSquared = radius * radius;
        for (int x = -radius; x <= radius; x++) {
            for (int z = -radius; z <= radius; z++) {
                if (x * x + z * z > radiusSquared) {
                    continue;
                }
                for (int y = 0; y <= height; y++) {
                    set(world, center.add(x, y, z), Blocks.AIR);
                }
            }
        }
    }

    private static void placeRing(ServerWorld world, BlockPos center, int radius, Block block) {
        int samples = radius * 10;
        for (int index = 0; index < samples; index++) {
            double angle = Math.PI * 2.0D * index / samples;
            set(world, offset(center, angle, radius), block);
        }
    }

    private static void placeArenaWall(
            ServerWorld world,
            BlockPos floor,
            int radius,
            Block wall,
            Block gate
    ) {
        placeRing(world, floor.up(), radius, wall);
        placeRing(world, floor.up(2), radius, wall);
        placeGate(world, floor.add(0, 1, -radius), gate, Direction.NORTH);
        placeGate(world, floor.add(0, 1, radius), gate, Direction.SOUTH);
        placeGate(world, floor.add(-radius, 1, 0), gate, Direction.WEST);
        placeGate(world, floor.add(radius, 1, 0), gate, Direction.EAST);
    }

    private static void placeGate(ServerWorld world, BlockPos position, Block gate, Direction facing) {
        setState(world, position, gate.getDefaultState().with(FenceGateBlock.FACING, facing));
        set(world, position.up(), Blocks.AIR);
    }

    private static void placeStimmpfeiler(ServerWorld world, BlockPos base, Block crystal) {
        set(world, base.down(), ModBlocks.BASSSCHIEFER_POLIERT);
        set(world, base, ModBlocks.STIMMPFEILER);
        set(world, base.up(), ModBlocks.STIMMPFEILER);
        set(world, base.up(2), crystal);
    }

    private static void column(ServerWorld world, BlockPos base, Block block, int height) {
        for (int y = 0; y < height; y++) {
            set(world, base.up(y), block);
        }
    }

    private static BlockPos offset(BlockPos center, double angle, int radius) {
        return center.add(
                (int) Math.round(Math.cos(angle) * radius),
                0,
                (int) Math.round(Math.sin(angle) * radius)
        );
    }

    private static BlockPos generationMarker(KlangmeerRegion region) {
        return region.anker().down(17);
    }

    private static BlockPos encounterMarker(KlangmeerRegion region) {
        return region.anker().down(16);
    }

    private static BlockPos bossSpawn(KlangmeerRegion region) {
        return switch (region) {
            case ARPEGGIENMEER -> region.anker().add(0, 3, 4);
            case GENERALPAUSE_OEDE -> region.anker().up(4);
            default -> region.anker().up(6);
        };
    }

    private static EntityType<BosswerkBossEntity> bossType(KlangmeerRegion region) {
        return switch (region) {
            case BASSGEWOELBE -> ModEntities.BOSS_TREMOLO;
            case ARPEGGIENMEER -> ModEntities.BOSS_GLISSANDA;
            case KAKOPHONIE_RIFF -> ModEntities.BOSS_KAKOPHON;
            case GENERALPAUSE_OEDE -> ModEntities.BOSS_GENERALPAUSE;
        };
    }

    private static String landmarkName(KlangmeerRegion region) {
        return switch (region) {
            case BASSGEWOELBE -> "Die Große Pauke";
            case ARPEGGIENMEER -> "Saitenbrücken";
            case KAKOPHONIE_RIFF -> "Schwarmthron";
            case GENERALPAUSE_OEDE -> "Leeres Podium";
        };
    }

    private static void set(ServerWorld world, BlockPos position, Block block) {
        setState(world, position, block.getDefaultState());
    }

    private static void setState(ServerWorld world, BlockPos position, BlockState state) {
        world.setBlockState(position, state, UPDATE_FLAGS);
    }
}
