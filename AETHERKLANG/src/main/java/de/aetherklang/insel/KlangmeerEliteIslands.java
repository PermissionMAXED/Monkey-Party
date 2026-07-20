package de.aetherklang.insel;

import de.aetherklang.Aetherklang;
import de.aetherklang.bosswerk.BosswerkBossEntity;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.world.KammertonWorld;
import java.util.List;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;

/**
 * Two compact endgame islands carrying optional elite Bosswerk encounters.
 */
public final class KlangmeerEliteIslands {
    public static final BlockPos OSTINATO_ARENA = new BlockPos(-360, 129, 2000);
    public static final BlockPos RITARDANDO_ARENA = new BlockPos(360, 129, 2000);

    private static final int UPDATE_FLAGS = Block.NOTIFY_LISTENERS | Block.FORCE_STATE;
    private static final double TRIGGER_RADIUS_SQUARED = 20.0D * 20.0D;

    private KlangmeerEliteIslands() {
    }

    public static void ensureGenerated(ServerWorld world) {
        if (!KammertonWorld.isKammerton(world)) {
            return;
        }
        for (EliteArena arena : EliteArena.values()) {
            if (world.getBlockState(generationMarker(arena)).isOf(Blocks.LODESTONE)) {
                ensureNotenpult(world, arena);
                continue;
            }
            composeIsland(world, arena);
            ensureNotenpult(world, arena);
            set(world, encounterMarker(arena), Blocks.REINFORCED_DEEPSLATE);
            set(world, generationMarker(arena), Blocks.LODESTONE);
            Aetherklang.LOGGER.info(
                    "Elite Bosswerk island '{}' generated at [{}, {}, {}]",
                    arena.id,
                    arena.center.getX(),
                    arena.center.getY(),
                    arena.center.getZ()
            );
        }
    }

    public static void tick(ServerWorld world) {
        if (!KammertonWorld.isKammerton(world) || world.getTime() % 10L != 0L) {
            return;
        }
        for (EliteArena arena : EliteArena.values()) {
            tryStartEncounter(world, arena);
        }
    }

    private static void tryStartEncounter(ServerWorld world, EliteArena arena) {
        BlockPos marker = encounterMarker(arena);
        if (!world.getBlockState(marker).isOf(Blocks.REINFORCED_DEEPSLATE)) {
            return;
        }

        Vec3d center = Vec3d.ofBottomCenter(arena.center);
        List<ServerPlayerEntity> challengers = world.getPlayers(
                player -> !player.isSpectator() && player.squaredDistanceTo(center) <= TRIGGER_RADIUS_SQUARED
        );
        if (challengers.isEmpty()) {
            return;
        }

        EntityType<BosswerkBossEntity> bossType = arena.bossType();
        boolean bossAlreadyPresent = !world.getEntitiesByClass(
                BosswerkBossEntity.class,
                new Box(arena.center).expand(32.0D, 24.0D, 32.0D),
                boss -> boss.isAlive() && boss.getType() == bossType
        ).isEmpty();
        if (bossAlreadyPresent) {
            set(world, marker, Blocks.CRYING_OBSIDIAN);
            return;
        }

        BosswerkBossEntity boss = bossType.create(world, SpawnReason.EVENT);
        if (boss == null) {
            Aetherklang.LOGGER.error("Could not create elite Bosswerk entity '{}'", arena.id);
            return;
        }
        boss.refreshPositionAndAngles(
                arena.center.getX() + 0.5D,
                arena.center.getY() + 4.0D,
                arena.center.getZ() + 0.5D,
                180.0F,
                0.0F
        );
        if (!world.spawnEntity(boss)) {
            Aetherklang.LOGGER.error("Could not spawn elite Bosswerk entity '{}'", arena.id);
            return;
        }

        set(world, marker, Blocks.CRYING_OBSIDIAN);
        world.spawnParticles(
                arena.particle(),
                boss.getX(),
                boss.getY() + 1.0D,
                boss.getZ(),
                80,
                4.0D,
                2.0D,
                4.0D,
                0.07D
        );
        world.playSound(null, arena.center, boss.getBossSound(), SoundCategory.HOSTILE, 1.8F, 1.0F);
        Text announcement = Text.translatable("message.aetherklang." + arena.id + ".awakens");
        challengers.forEach(player -> player.sendMessage(announcement, false));
        Aetherklang.LOGGER.info("{} awakened on its elite island", arena.id);
    }

    private static void composeIsland(ServerWorld world, EliteArena arena) {
        BlockPos floor = arena.center.down();
        int radius = 17;
        for (int x = -radius; x <= radius; x++) {
            for (int z = -radius; z <= radius; z++) {
                if (x * x + z * z > radius * radius) {
                    continue;
                }
                for (int y = 0; y <= 10; y++) {
                    set(world, arena.center.add(x, y, z), Blocks.AIR);
                }
            }
        }
        for (int depth = 0; depth <= 7; depth++) {
            int layerRadius = Math.max(3, radius - depth * 2);
            int radiusSquared = layerRadius * layerRadius;
            for (int x = -layerRadius; x <= layerRadius; x++) {
                for (int z = -layerRadius; z <= layerRadius; z++) {
                    if (x * x + z * z > radiusSquared - Math.floorMod(x * 7 + z * 11 + depth * 5, 6)) {
                        continue;
                    }
                    Block material = depth == 0
                            ? arena.floorBlock(x, z)
                            : depth % 2 == 0 ? Blocks.OBSIDIAN : Blocks.END_STONE_BRICKS;
                    set(world, floor.add(x, -depth, z), material);
                }
            }
        }

        placeRing(world, floor, 15, arena.ringBlock());
        placeRing(world, floor.up(), 10, arena.accentBlock());
        for (int index = 0; index < 8; index++) {
            double angle = Math.PI * 2.0D * index / 8.0D;
            BlockPos pylon = floor.add(
                    (int) Math.round(Math.cos(angle) * 14.0D),
                    1,
                    (int) Math.round(Math.sin(angle) * 14.0D)
            );
            for (int y = 0; y < 4; y++) {
                set(world, pylon.up(y), y == 3 ? ModBlocks.KLANGLATERNE : arena.pillarBlock());
            }
        }
    }

    private static void ensureNotenpult(ServerWorld world, EliteArena arena) {
        set(world, arena.center.add(5, 0, -9), ModBlocks.NOTENPULT);
    }

    private static void placeRing(ServerWorld world, BlockPos center, int radius, Block block) {
        int samples = radius * 10;
        for (int index = 0; index < samples; index++) {
            double angle = Math.PI * 2.0D * index / samples;
            set(
                    world,
                    center.add(
                            (int) Math.round(Math.cos(angle) * radius),
                            0,
                            (int) Math.round(Math.sin(angle) * radius)
                    ),
                    block
            );
        }
    }

    private static BlockPos generationMarker(EliteArena arena) {
        return arena.center.down(16);
    }

    private static BlockPos encounterMarker(EliteArena arena) {
        return arena.center.down(15);
    }

    private static void set(ServerWorld world, BlockPos position, Block block) {
        world.setBlockState(position, block.getDefaultState(), UPDATE_FLAGS);
    }

    private enum EliteArena {
        OSTINATO("boss_ostinato", OSTINATO_ARENA) {
            @Override
            EntityType<BosswerkBossEntity> bossType() {
                return ModEntities.BOSS_OSTINATO;
            }

            @Override
            ParticleEffect particle() {
                return ModParticles.LEITMOTIV_NOTE;
            }

            @Override
            Block floorBlock(int x, int z) {
                return Math.floorMod(x + z, 5) == 0 ? Blocks.AMETHYST_BLOCK : ModBlocks.BASSSCHIEFER_POLIERT;
            }

            @Override
            Block ringBlock() {
                return Blocks.PURPUR_BLOCK;
            }

            @Override
            Block accentBlock() {
                return ModBlocks.RESONANZKRISTALL_INDIGO;
            }

            @Override
            Block pillarBlock() {
                return Blocks.PURPUR_PILLAR;
            }
        },
        RITARDANDO("boss_ritardando", RITARDANDO_ARENA) {
            @Override
            EntityType<BosswerkBossEntity> bossType() {
                return ModEntities.BOSS_RITARDANDO;
            }

            @Override
            ParticleEffect particle() {
                return ModParticles.FERMATE_GLIMMER;
            }

            @Override
            Block floorBlock(int x, int z) {
                return Math.floorMod(x * 3 + z, 6) == 0 ? Blocks.SEA_LANTERN : Blocks.SMOOTH_QUARTZ;
            }

            @Override
            Block ringBlock() {
                return Blocks.CALCITE;
            }

            @Override
            Block accentBlock() {
                return ModBlocks.RESONANZKRISTALL_CYAN;
            }

            @Override
            Block pillarBlock() {
                return Blocks.QUARTZ_PILLAR;
            }
        };

        private final String id;
        private final BlockPos center;

        EliteArena(String id, BlockPos center) {
            this.id = id;
            this.center = center;
        }

        abstract EntityType<BosswerkBossEntity> bossType();

        abstract ParticleEffect particle();

        abstract Block floorBlock(int x, int z);

        abstract Block ringBlock();

        abstract Block accentBlock();

        abstract Block pillarBlock();
    }
}
