package de.aetherklang.kaskade;

import de.aetherklang.Aetherklang;
import de.aetherklang.motiv.MotivEntity;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.block.Block;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.Heightmap;

/**
 * Runs periodic or explicitly triggered Dissonance Rift storms near players.
 */
public final class KaskadeEventEngine {
    public static final int START_FX = 0;
    public static final int COMPLETE_FX = 4;

    private static final int PERIODIC_CHECK_TICKS = 20 * 30;
    private static final int INITIAL_COOLDOWN_TICKS = 20 * 60 * 8;
    private static final int RETRY_TICKS = 20 * 60;
    private static final int EVENT_COOLDOWN_TICKS = 20 * 60 * 12;
    private static final int WAVE_DELAY_TICKS = 20 * 3;
    private static final int START_DELAY_TICKS = 20 * 2;
    private static final double PARTICIPATION_RADIUS_SQUARED = 48.0D * 48.0D;

    private static final Map<ServerWorld, ActiveKaskade> ACTIVE = new IdentityHashMap<>();
    private static final Map<ServerWorld, Integer> NEXT_PERIODIC_TICK = new IdentityHashMap<>();
    private static boolean registered;

    private KaskadeEventEngine() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerTickEvents.END_WORLD_TICK.register(KaskadeEventEngine::tick);
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> clear());
    }

    /**
     * Starts a storm at the surface nearest the supplied position.
     */
    public static boolean trigger(ServerWorld world, Vec3d position) {
        if (ACTIVE.containsKey(world)) {
            return false;
        }
        BlockPos anchor = findAnchor(world, BlockPos.ofFloored(position));
        if (anchor == null) {
            return false;
        }

        world.setBlockState(anchor, ModBlocks.DISSONANZRISS.getDefaultState(), Block.NOTIFY_ALL);
        int tick = world.getServer().getTicks();
        ActiveKaskade event = new ActiveKaskade(anchor.toImmutable(), tick + START_DELAY_TICKS);
        collectParticipants(world, event);
        ACTIVE.put(world, event);
        NEXT_PERIODIC_TICK.put(world, tick + EVENT_COOLDOWN_TICKS);
        announce(world, event, "message.aetherklang.kaskade.started");
        KaskadeNetworking.broadcastKaskade(world, anchor, START_FX);
        world.spawnParticles(
                ModParticles.DISSONANZ_SMOKE,
                anchor.getX() + 0.5D,
                anchor.getY() + 0.65D,
                anchor.getZ() + 0.5D,
                72,
                2.5D,
                1.4D,
                2.5D,
                0.08D
        );
        world.playSound(null, anchor, ModSounds.DISSONANZ_HIT, SoundCategory.HOSTILE, 1.4F, 0.55F);
        Aetherklang.LOGGER.info(
                "Kaskade started in {} at {} {} {}",
                world.getRegistryKey().getValue(),
                anchor.getX(),
                anchor.getY(),
                anchor.getZ()
        );
        return true;
    }

    private static BlockPos findAnchor(ServerWorld world, BlockPos origin) {
        for (int attempt = 0; attempt < 24; attempt++) {
            double angle = attempt * 2.399963229728653D;
            double radius = attempt == 0 ? 0.0D : 3.0D + attempt * 1.25D;
            BlockPos horizontal = origin.add(
                    (int) Math.round(Math.cos(angle) * radius),
                    0,
                    (int) Math.round(Math.sin(angle) * radius)
            );
            BlockPos top = world.getTopPosition(Heightmap.Type.MOTION_BLOCKING_NO_LEAVES, horizontal);
            BlockPos candidate = world.getBlockState(top).isAir() ? top : top.up();
            if (world.getWorldBorder().contains(candidate)
                    && world.getBlockState(candidate).isAir()) {
                return candidate.toImmutable();
            }
        }
        return null;
    }

    public static boolean hasActiveEvent(ServerWorld world) {
        return ACTIVE.containsKey(world);
    }

    static void clear() {
        ACTIVE.clear();
        NEXT_PERIODIC_TICK.clear();
    }

    private static void tick(ServerWorld world) {
        int tick = world.getServer().getTicks();
        ActiveKaskade event = ACTIVE.get(world);
        if (event == null) {
            tryPeriodicStart(world, tick);
            return;
        }

        collectParticipants(world, event);
        event.spawnedMobs.removeIf(id -> {
            Entity entity = world.getEntity(id);
            return entity == null || !entity.isAlive();
        });
        if (!event.spawnedMobs.isEmpty() || tick < event.nextActionTick) {
            pulseRift(world, event, tick);
            return;
        }

        if (event.nextWave < 3) {
            spawnWave(world, event);
            event.nextWave++;
            event.nextActionTick = tick + WAVE_DELAY_TICKS;
            return;
        }
        complete(world, event);
    }

    private static void tryPeriodicStart(ServerWorld world, int tick) {
        if (tick % PERIODIC_CHECK_TICKS != 0) {
            return;
        }
        int nextTick = NEXT_PERIODIC_TICK.computeIfAbsent(
                world,
                ignored -> tick + INITIAL_COOLDOWN_TICKS
        );
        if (tick < nextTick) {
            return;
        }

        List<ServerPlayerEntity> candidates = world.getPlayers(
                player -> player.isAlive() && !player.isSpectator()
        );
        if (candidates.isEmpty() || world.getRandom().nextInt(3) != 0) {
            NEXT_PERIODIC_TICK.put(world, tick + RETRY_TICKS);
            return;
        }

        ServerPlayerEntity target = candidates.get(world.getRandom().nextInt(candidates.size()));
        double angle = world.getRandom().nextDouble() * Math.PI * 2.0D;
        double distance = 18.0D + world.getRandom().nextDouble() * 14.0D;
        Vec3d position = target.getEntityPos().add(
                Math.cos(angle) * distance,
                0.0D,
                Math.sin(angle) * distance
        );
        if (!trigger(world, position)) {
            NEXT_PERIODIC_TICK.put(world, tick + RETRY_TICKS);
        }
    }

    private static void spawnWave(ServerWorld world, ActiveKaskade event) {
        int wave = event.nextWave;
        if (wave == 0) {
            spawnMany(world, event, ModEntities.MOTIV_LAEUFER, 3, false);
            spawnMany(world, event, ModEntities.MOTIV_PULSER, 1, false);
        } else if (wave == 1) {
            spawnMany(world, event, ModEntities.MOTIV_LAEUFER, 2, false);
            spawnMany(world, event, ModEntities.MOTIV_SCHWINGE, 2, false);
            spawnMany(world, event, ModEntities.MOTIV_PULSER, 1, false);
        } else {
            spawnMany(world, event, ModEntities.MOTIV_SCHWINGE, 2, false);
            spawnMany(world, event, ModEntities.MOTIV_PULSER, 1, true);
        }

        int displayWave = wave + 1;
        announce(world, event, "message.aetherklang.kaskade.wave", displayWave);
        KaskadeNetworking.broadcastKaskade(world, event.anchor, displayWave);
        world.playSound(
                null,
                event.anchor,
                wave == 2 ? ModSounds.AKKORD_COMPLETE : ModSounds.DISSONANZ_HIT,
                SoundCategory.HOSTILE,
                1.2F,
                wave == 2 ? 0.65F : 0.8F + wave * 0.1F
        );
        Aetherklang.LOGGER.info(
                "Kaskade wave {} spawned {} tracked mobs at {}",
                displayWave,
                event.spawnedMobs.size(),
                event.anchor.toShortString()
        );
    }

    private static void spawnMany(
            ServerWorld world,
            ActiveKaskade event,
            EntityType<? extends MobEntity> type,
            int count,
            boolean herald
    ) {
        for (int index = 0; index < count; index++) {
            MobEntity mob = type.create(world, SpawnReason.EVENT);
            if (mob == null) {
                continue;
            }
            BlockPos spawn = findSpawnPosition(world, event.anchor, index);
            mob.refreshPositionAndAngles(
                    spawn.getX() + 0.5D,
                    spawn.getY(),
                    spawn.getZ() + 0.5D,
                    world.getRandom().nextFloat() * 360.0F,
                    0.0F
            );
            mob.setPersistent();
            if (mob instanceof MotivEntity motiv) {
                motiv.applyRandomAffix(true);
            }
            if (herald) {
                empowerHerald(mob);
            }
            if (world.spawnEntity(mob)) {
                event.spawnedMobs.add(mob.getUuid());
            }
        }
    }

    private static void empowerHerald(MobEntity herald) {
        herald.setCustomName(Text.translatable("entity.aetherklang.dissonanzherold"));
        herald.setCustomNameVisible(true);
        herald.setGlowing(true);
        EntityAttributeInstance health = herald.getAttributeInstance(EntityAttributes.MAX_HEALTH);
        if (health != null) {
            health.setBaseValue(90.0D);
            herald.setHealth(90.0F);
        }
        EntityAttributeInstance attack = herald.getAttributeInstance(EntityAttributes.ATTACK_DAMAGE);
        if (attack != null) {
            attack.setBaseValue(10.0D);
        }
        EntityAttributeInstance armor = herald.getAttributeInstance(EntityAttributes.ARMOR);
        if (armor != null) {
            armor.setBaseValue(8.0D);
        }
    }

    private static BlockPos findSpawnPosition(ServerWorld world, BlockPos anchor, int salt) {
        for (int attempt = 0; attempt < 8; attempt++) {
            double angle = (salt * 1.9D + attempt * 0.83D) + world.getRandom().nextDouble();
            double radius = 5.0D + world.getRandom().nextDouble() * 5.0D;
            BlockPos horizontal = anchor.add(
                    (int) Math.round(Math.cos(angle) * radius),
                    0,
                    (int) Math.round(Math.sin(angle) * radius)
            );
            BlockPos surface = world.getTopPosition(Heightmap.Type.MOTION_BLOCKING_NO_LEAVES, horizontal);
            if (world.getWorldBorder().contains(surface)
                    && world.getBlockState(surface).isAir()
                    && !world.getBlockState(surface.down()).isAir()) {
                return surface;
            }
        }
        return anchor.up();
    }

    private static void pulseRift(ServerWorld world, ActiveKaskade event, int tick) {
        if (tick % 20 != 0 || !world.getBlockState(event.anchor).isOf(ModBlocks.DISSONANZRISS)) {
            return;
        }
        world.spawnParticles(
                ModParticles.DISSONANZ_SMOKE,
                event.anchor.getX() + 0.5D,
                event.anchor.getY() + 0.5D,
                event.anchor.getZ() + 0.5D,
                9,
                0.8D,
                0.6D,
                0.8D,
                0.025D
        );
    }

    private static void collectParticipants(ServerWorld world, ActiveKaskade event) {
        Vec3d center = Vec3d.ofCenter(event.anchor);
        for (ServerPlayerEntity player : world.getPlayers()) {
            if (player.isAlive() && !player.isSpectator()
                    && player.squaredDistanceTo(center) <= PARTICIPATION_RADIUS_SQUARED) {
                event.participants.add(player.getUuid());
            }
        }
    }

    private static void complete(ServerWorld world, ActiveKaskade event) {
        ACTIVE.remove(world);
        if (world.getBlockState(event.anchor).isOf(ModBlocks.DISSONANZRISS)) {
            world.removeBlock(event.anchor, false);
        }

        List<ServerPlayerEntity> rewarded = new ArrayList<>();
        for (UUID playerId : event.participants) {
            ServerPlayerEntity player = world.getServer().getPlayerManager().getPlayer(playerId);
            if (player == null || player.getEntityWorld() != world) {
                continue;
            }
            rewarded.add(player);
        }
        int rewardCount = rewarded.size() >= 3 ? 2 : 1;
        for (ServerPlayerEntity player : rewarded) {
            ItemStack reward = new ItemStack(ModItems.KASKADENKERN, rewardCount);
            if (!player.getInventory().insertStack(reward)) {
                player.dropItem(reward, false);
            }
            player.sendMessage(
                    Text.translatable("message.aetherklang.kaskade.complete", rewardCount),
                    false
            );
        }
        if (rewarded.isEmpty()) {
            ItemStack reward = new ItemStack(ModItems.KASKADENKERN);
            Block.dropStack(world, event.anchor, reward);
        }

        world.spawnParticles(
                ParticleTypes.END_ROD,
                event.anchor.getX() + 0.5D,
                event.anchor.getY() + 0.8D,
                event.anchor.getZ() + 0.5D,
                96,
                3.0D,
                2.0D,
                3.0D,
                0.12D
        );
        world.spawnParticles(
                ModParticles.ENSEMBLE_FUNKE,
                event.anchor.getX() + 0.5D,
                event.anchor.getY() + 0.8D,
                event.anchor.getZ() + 0.5D,
                72,
                2.4D,
                1.6D,
                2.4D,
                0.09D
        );
        world.playSound(null, event.anchor, ModSounds.AKKORD_COMPLETE, SoundCategory.PLAYERS, 1.5F, 1.35F);
        KaskadeNetworking.broadcastKaskade(world, event.anchor, COMPLETE_FX);
        Aetherklang.LOGGER.info(
                "Kaskade completed at {}; rewarded {} players with {} Kaskadenkern",
                event.anchor.toShortString(),
                rewarded.size(),
                rewardCount
        );
    }

    private static void announce(
            ServerWorld world,
            ActiveKaskade event,
            String translationKey,
            Object... args
    ) {
        Vec3d center = Vec3d.ofCenter(event.anchor);
        for (ServerPlayerEntity player : world.getPlayers()) {
            if (player.squaredDistanceTo(center) <= PARTICIPATION_RADIUS_SQUARED) {
                player.sendMessage(Text.translatable(translationKey, args), false);
            }
        }
    }

    private static final class ActiveKaskade {
        private final BlockPos anchor;
        private final Set<UUID> spawnedMobs = new HashSet<>();
        private final Set<UUID> participants = new HashSet<>();
        private int nextWave;
        private int nextActionTick;

        private ActiveKaskade(BlockPos anchor, int nextActionTick) {
            this.anchor = anchor;
            this.nextActionTick = nextActionTick;
        }
    }
}
