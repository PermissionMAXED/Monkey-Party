package de.aetherklang.resonanzfeld;

import de.aetherklang.Aetherklang;
import de.aetherklang.kaskade.KaskadeEventEngine;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.Stimmung;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.block.Block;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

/**
 * Links loaded crystal resonators into mood-aligned territories.
 *
 * <p>Three resonators within linking distance form a field. Nearby resonance
 * crystals vote for its mood, players inside receive that mood's boon, and an
 * occupied field periodically attracts a normal Kaskade encounter.</p>
 */
public final class ResonanzfeldEngine {
    public static final int MIN_RESONATORS = 3;
    public static final int LINK_RADIUS = 32;

    private static final int LINK_HEIGHT = 12;
    private static final int CRYSTAL_SCAN_RADIUS = 5;
    private static final int PROFILE_REFRESH_TICKS = 20 * 5;
    private static final int NODE_EXPIRY_TICKS = 20 * 4;
    private static final int FIELD_TICK_INTERVAL = 20;
    private static final int BUFF_DURATION_TICKS = 20 * 3;
    private static final int INITIAL_SIEGE_DELAY_TICKS = 20 * 60 * 4;
    private static final int SIEGE_INTERVAL_TICKS = 20 * 60 * 10;
    private static final int SIEGE_RETRY_TICKS = 20 * 30;
    private static final double TERRITORY_MARGIN = 12.0D;
    private static final double MIN_TERRITORY_RADIUS = 16.0D;
    private static final double MAX_TERRITORY_RADIUS = 48.0D;

    private static final Map<ServerWorld, WorldState> STATES = new IdentityHashMap<>();
    private static boolean registered;

    private ResonanzfeldEngine() {
    }

    static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerTickEvents.END_WORLD_TICK.register(ResonanzfeldEngine::tick);
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> STATES.clear());
    }

    /**
     * Refreshes a resonator in the loaded-node index. Called by its block entity.
     */
    public static void observeResonator(ServerWorld world, BlockPos pos) {
        if (!world.getBlockState(pos).isOf(ModBlocks.KRISTALLRESONATOR)) {
            return;
        }

        long now = world.getTime();
        WorldState state = STATES.computeIfAbsent(world, ignored -> new WorldState());
        Node node = state.nodes.get(pos.asLong());
        if (node == null) {
            state.nodes.put(
                    pos.asLong(),
                    new Node(pos.toImmutable(), scanCrystalProfile(world, pos), now, now + PROFILE_REFRESH_TICKS)
            );
            return;
        }

        node.lastSeenTick = now;
        if (now >= node.nextProfileTick) {
            node.crystalProfile = scanCrystalProfile(world, pos);
            node.nextProfileTick = now + PROFILE_REFRESH_TICKS;
        }
    }

    public static List<ResonanzfeldSnapshot> snapshots(ServerWorld world) {
        WorldState state = STATES.get(world);
        if (state == null) {
            return List.of();
        }
        return state.fields.stream()
                .map(field -> field.snapshot(state.nextSiegeTicks.getOrDefault(field.id, world.getTime())))
                .toList();
    }

    public static Optional<ResonanzfeldSnapshot> nearestField(ServerWorld world, Vec3d position) {
        return snapshots(world).stream()
                .min(Comparator.comparingDouble(field -> horizontalDistanceSquared(field.center(), position)));
    }

    /**
     * Starts the Kaskade siege for the nearest loaded field, if one can start.
     */
    public static boolean forceSiege(ServerWorld world, Vec3d position) {
        WorldState state = STATES.get(world);
        if (state == null || state.fields.isEmpty()) {
            return false;
        }
        Field field = state.fields.stream()
                .min(Comparator.comparingDouble(candidate ->
                        horizontalDistanceSquared(candidate.center, position)))
                .orElseThrow();
        if (!KaskadeEventEngine.trigger(world, field.center)) {
            return false;
        }
        state.nextSiegeTicks.put(field.id, world.getTime() + SIEGE_INTERVAL_TICKS);
        announceSiege(world, field);
        return true;
    }

    private static void tick(ServerWorld world) {
        if (Math.floorMod(world.getTime(), FIELD_TICK_INTERVAL) != 0L) {
            return;
        }
        WorldState state = STATES.get(world);
        if (state == null) {
            return;
        }

        long now = world.getTime();
        state.nodes.values().removeIf(node ->
                now - node.lastSeenTick > NODE_EXPIRY_TICKS
                        || !world.getBlockState(node.pos).isOf(ModBlocks.KRISTALLRESONATOR)
        );
        List<Field> previous = state.fields;
        state.fields = composeFields(state.nodes.values());
        retainActiveSiegeTimers(state);
        logNewFields(world, previous, state.fields);
        affectPlayers(world, state);
        tryPeriodicSieges(world, state, now);
        if (Math.floorMod(now, FIELD_TICK_INTERVAL * 2L) == 0L) {
            spawnFieldFx(world, state.fields);
        }
    }

    private static List<Field> composeFields(Iterable<Node> nodeValues) {
        List<Node> nodes = new ArrayList<>();
        nodeValues.forEach(nodes::add);
        nodes.sort(Comparator.comparingLong(node -> node.pos.asLong()));

        Set<Long> visited = new HashSet<>();
        List<Field> fields = new ArrayList<>();
        for (Node seed : nodes) {
            if (!visited.add(seed.pos.asLong())) {
                continue;
            }

            List<Node> component = new ArrayList<>();
            ArrayDeque<Node> open = new ArrayDeque<>();
            open.add(seed);
            while (!open.isEmpty()) {
                Node current = open.removeFirst();
                component.add(current);
                for (Node candidate : nodes) {
                    if (!visited.contains(candidate.pos.asLong()) && linked(current.pos, candidate.pos)) {
                        visited.add(candidate.pos.asLong());
                        open.addLast(candidate);
                    }
                }
            }
            if (component.size() >= MIN_RESONATORS) {
                fields.add(toField(component));
            }
        }
        return List.copyOf(fields);
    }

    private static boolean linked(BlockPos first, BlockPos second) {
        if (Math.abs(first.getY() - second.getY()) > LINK_HEIGHT) {
            return false;
        }
        long deltaX = first.getX() - second.getX();
        long deltaZ = first.getZ() - second.getZ();
        return deltaX * deltaX + deltaZ * deltaZ <= (long) LINK_RADIUS * LINK_RADIUS;
    }

    private static Field toField(List<Node> component) {
        double centerX = component.stream().mapToDouble(node -> node.pos.getX() + 0.5D).average().orElse(0.0D);
        double centerY = component.stream().mapToDouble(node -> node.pos.getY() + 0.5D).average().orElse(0.0D);
        double centerZ = component.stream().mapToDouble(node -> node.pos.getZ() + 0.5D).average().orElse(0.0D);
        Vec3d center = new Vec3d(centerX, centerY, centerZ);

        double outermost = component.stream()
                .mapToDouble(node -> Math.sqrt(horizontalDistanceSquared(node.pos.toCenterPos(), center)))
                .max()
                .orElse(0.0D);
        double radius = Math.clamp(
                outermost + TERRITORY_MARGIN,
                MIN_TERRITORY_RADIUS,
                MAX_TERRITORY_RADIUS
        );
        Stimmung mood = dominantMood(component);
        long id = component.stream().mapToLong(node -> node.pos.asLong()).min().orElseThrow();
        return new Field(id, center, radius, mood, component.size());
    }

    private static Stimmung dominantMood(List<Node> component) {
        int[] totals = new int[Stimmung.values().length];
        for (Node node : component) {
            for (int index = 0; index < totals.length; index++) {
                totals[index] += node.crystalProfile[index];
            }
        }

        Stimmung winner = Stimmung.STILLE;
        int winningScore = 0;
        int tiedMoods = 0;
        for (Stimmung mood : Stimmung.values()) {
            if (mood == Stimmung.TRAUER) {
                continue;
            }
            int score = totals[mood.ordinal()];
            if (score > winningScore) {
                winner = mood;
                winningScore = score;
                tiedMoods = 1;
            } else if (score > 0 && score == winningScore) {
                tiedMoods++;
            }
        }
        return tiedMoods > 1 ? Stimmung.TRAUER : winner;
    }

    private static int[] scanCrystalProfile(ServerWorld world, BlockPos origin) {
        int[] profile = new int[Stimmung.values().length];
        for (BlockPos target : BlockPos.iterateOutwards(
                origin,
                CRYSTAL_SCAN_RADIUS,
                CRYSTAL_SCAN_RADIUS,
                CRYSTAL_SCAN_RADIUS
        )) {
            Block block = world.getBlockState(target).getBlock();
            Stimmung mood = crystalMood(block);
            if (mood != null) {
                profile[mood.ordinal()]++;
            }
        }
        return profile;
    }

    private static Stimmung crystalMood(Block block) {
        if (block == ModBlocks.RESONANZKRISTALL_CYAN) {
            return Stimmung.WUNDER;
        }
        if (block == ModBlocks.RESONANZKRISTALL_GOLD) {
            return Stimmung.FREUDE;
        }
        if (block == ModBlocks.RESONANZKRISTALL_MAGENTA) {
            return Stimmung.ZORN;
        }
        if (block == ModBlocks.RESONANZKRISTALL_INDIGO) {
            return Stimmung.STILLE;
        }
        return null;
    }

    private static void affectPlayers(ServerWorld world, WorldState state) {
        Set<UUID> present = new HashSet<>();
        for (ServerPlayerEntity player : world.getPlayers(candidate ->
                candidate.isAlive() && !candidate.isSpectator()
        )) {
            Field field = containingField(state.fields, player.getEntityPos());
            if (field == null) {
                continue;
            }
            present.add(player.getUuid());
            applyBuff(player, field);

            Long previousField = state.playerFields.put(player.getUuid(), field.id);
            if (previousField == null || previousField.longValue() != field.id) {
                player.sendMessage(
                        Text.translatable(
                                "message.aetherklang.resonanzfeld.enter",
                                Text.translatable(field.mood.getTranslationKey()),
                                field.resonators
                        ),
                        true
                );
            }
        }
        state.playerFields.keySet().retainAll(present);
    }

    private static Field containingField(List<Field> fields, Vec3d position) {
        Field nearest = null;
        double nearestDistance = Double.MAX_VALUE;
        for (Field field : fields) {
            ResonanzfeldSnapshot snapshot = field.snapshot(0L);
            if (!snapshot.contains(position)) {
                continue;
            }
            double distance = horizontalDistanceSquared(field.center, position);
            if (distance < nearestDistance) {
                nearest = field;
                nearestDistance = distance;
            }
        }
        return nearest;
    }

    private static void applyBuff(ServerPlayerEntity player, Field field) {
        int amplifier = field.resonators >= 6 ? 1 : 0;
        var effect = switch (field.mood) {
            case STILLE -> StatusEffects.RESISTANCE;
            case FREUDE -> StatusEffects.REGENERATION;
            case ZORN -> StatusEffects.STRENGTH;
            case TRAUER -> StatusEffects.ABSORPTION;
            case WUNDER -> StatusEffects.SPEED;
        };
        player.addStatusEffect(new StatusEffectInstance(
                effect,
                BUFF_DURATION_TICKS,
                amplifier,
                true,
                false
        ));
    }

    private static void tryPeriodicSieges(ServerWorld world, WorldState state, long now) {
        for (Field field : state.fields) {
            long nextSiege = state.nextSiegeTicks.computeIfAbsent(
                    field.id,
                    ignored -> now + INITIAL_SIEGE_DELAY_TICKS
            );
            if (now < nextSiege) {
                continue;
            }

            boolean occupied = world.getPlayers(player ->
                    player.isAlive()
                            && !player.isSpectator()
                            && field.snapshot(0L).contains(player.getEntityPos())
            ).stream().findAny().isPresent();
            if (!occupied || !KaskadeEventEngine.trigger(world, field.center)) {
                state.nextSiegeTicks.put(field.id, now + SIEGE_RETRY_TICKS);
                continue;
            }

            state.nextSiegeTicks.put(field.id, now + SIEGE_INTERVAL_TICKS);
            announceSiege(world, field);
        }
    }

    private static void announceSiege(ServerWorld world, Field field) {
        Aetherklang.LOGGER.info(
                "Resonanzfeld siege started at {} with {} linked resonators ({})",
                field.center,
                field.resonators,
                field.mood.asString()
        );
        ResonanzfeldSnapshot snapshot = field.snapshot(0L);
        for (ServerPlayerEntity player : world.getPlayers(candidate ->
                snapshot.contains(candidate.getEntityPos())
        )) {
            player.sendMessage(
                    Text.translatable("message.aetherklang.resonanzfeld.siege"),
                    false
            );
        }
    }

    private static void spawnFieldFx(ServerWorld world, List<Field> fields) {
        for (Field field : fields) {
            world.spawnParticles(
                    ModParticles.ENSEMBLE_FUNKE,
                    field.center.x,
                    field.center.y + 1.0D,
                    field.center.z,
                    4 + field.resonators,
                    Math.min(6.0D, field.radius * 0.25D),
                    1.2D,
                    Math.min(6.0D, field.radius * 0.25D),
                    0.025D
            );
        }
    }

    private static void retainActiveSiegeTimers(WorldState state) {
        Set<Long> activeIds = new HashSet<>();
        for (Field field : state.fields) {
            activeIds.add(field.id);
        }
        state.nextSiegeTicks.keySet().retainAll(activeIds);
    }

    private static void logNewFields(ServerWorld world, List<Field> previous, List<Field> current) {
        Set<Long> previousIds = new HashSet<>();
        for (Field field : previous) {
            previousIds.add(field.id);
        }
        for (Field field : current) {
            if (!previousIds.contains(field.id)) {
                Aetherklang.LOGGER.info(
                        "Resonanzfeld formed in {}: {} linked resonators, mood {}, radius {}",
                        world.getRegistryKey().getValue(),
                        field.resonators,
                        field.mood.asString(),
                        Math.round(field.radius)
                );
            }
        }
    }

    private static double horizontalDistanceSquared(Vec3d first, Vec3d second) {
        double deltaX = first.x - second.x;
        double deltaZ = first.z - second.z;
        return deltaX * deltaX + deltaZ * deltaZ;
    }

    private static final class Node {
        private final BlockPos pos;
        private int[] crystalProfile;
        private long lastSeenTick;
        private long nextProfileTick;

        private Node(BlockPos pos, int[] crystalProfile, long lastSeenTick, long nextProfileTick) {
            this.pos = pos;
            this.crystalProfile = crystalProfile;
            this.lastSeenTick = lastSeenTick;
            this.nextProfileTick = nextProfileTick;
        }
    }

    private record Field(
            long id,
            Vec3d center,
            double radius,
            Stimmung mood,
            int resonators
    ) {
        private ResonanzfeldSnapshot snapshot(long nextSiegeTick) {
            return new ResonanzfeldSnapshot(id, center, radius, mood, resonators, nextSiegeTick);
        }
    }

    private static final class WorldState {
        private final Map<Long, Node> nodes = new HashMap<>();
        private final Map<Long, Long> nextSiegeTicks = new HashMap<>();
        private final Map<UUID, Long> playerFields = new HashMap<>();
        private List<Field> fields = List.of();
    }
}
