package de.aetherklang.resonance;

import de.aetherklang.network.ModNetworking;
import de.aetherklang.registry.ModCriteria;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.networking.v1.PlayerLookup;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec3d;

/**
 * Resolves the last three on-beat moods into named chord abilities.
 */
public final class AkkordEngine {
    public static final int SEQUENCE_PAYLOAD_FLAG = 1 << 30;
    private static final int SLOT_BITS = 3;
    private static final int SLOT_MASK = (1 << SLOT_BITS) - 1;
    private static final int SEQUENCE_LENGTH = 3;
    private static final double ABILITY_RADIUS = 8.0D;
    private static final Map<UUID, Deque<Stimmung>> SEQUENCES = new HashMap<>();

    private AkkordEngine() {
    }

    public static void onOnBeatAction(ServerPlayerEntity player, Stimmung mood) {
        Deque<Stimmung> sequence = SEQUENCES.computeIfAbsent(
                player.getUuid(),
                ignored -> new ArrayDeque<>(SEQUENCE_LENGTH)
        );
        if (sequence.size() == SEQUENCE_LENGTH) {
            sequence.removeFirst();
        }
        sequence.addLast(mood);

        List<Stimmung> snapshot = List.copyOf(sequence);
        ModNetworking.sendAkkordFx(player, encodeSequence(snapshot));
        Optional<Akkord> match = Akkord.match(snapshot);
        if (match.isEmpty()) {
            return;
        }

        fire(player, match.get());
        sequence.clear();
    }

    public static int encodeSequence(List<Stimmung> sequence) {
        int encoded = SEQUENCE_PAYLOAD_FLAG;
        int count = Math.min(sequence.size(), SEQUENCE_LENGTH);
        for (int index = 0; index < count; index++) {
            int moodCode = sequence.get(index).ordinal() + 1;
            encoded |= (moodCode & SLOT_MASK) << (index * SLOT_BITS);
        }
        return encoded;
    }

    public static List<Stimmung> decodeSequence(int encoded) {
        if ((encoded & SEQUENCE_PAYLOAD_FLAG) == 0) {
            return List.of();
        }

        List<Stimmung> sequence = new ArrayList<>(SEQUENCE_LENGTH);
        Stimmung[] moods = Stimmung.values();
        for (int index = 0; index < SEQUENCE_LENGTH; index++) {
            int moodCode = (encoded >> (index * SLOT_BITS)) & SLOT_MASK;
            if (moodCode == 0) {
                break;
            }
            int ordinal = moodCode - 1;
            if (ordinal < moods.length) {
                sequence.add(moods[ordinal]);
            }
        }
        return List.copyOf(sequence);
    }

    public static void removePlayer(UUID playerId) {
        SEQUENCES.remove(playerId);
    }

    public static void clear() {
        SEQUENCES.clear();
    }

    private static void fire(ServerPlayerEntity player, Akkord akkord) {
        switch (akkord) {
            case HEILENDER_DREIKLANG -> healGroup(player, 6.0F);
            case STURZKADENZ -> damageAndSlow(player);
            case SANFTE_AUFLOESUNG -> sootheGroup(player);
            case STERNENFORTISSIMO -> launchEnemies(player);
        }

        ServerWorld world = player.getEntityWorld();
        spawnCompletionGlyphs(world, player, akkord);
        world.playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                ModSounds.AKKORD_COMPLETE,
                SoundCategory.PLAYERS,
                1.0F,
                akkord.pitch()
        );
        player.sendMessage(Text.literal(akkord.displayName()), true);
        ModCriteria.FIRST_AKKORD.trigger(player);
        ModNetworking.broadcastAkkordFx(player, akkord.networkId());
    }

    private static void healGroup(ServerPlayerEntity source, float amount) {
        Set<ServerPlayerEntity> players = playersAround(source);
        for (ServerPlayerEntity player : players) {
            if (!player.isAlive()) {
                continue;
            }
            player.heal(amount);
            source.getEntityWorld().spawnParticles(
                    net.minecraft.particle.ParticleTypes.HEART,
                    player.getX(),
                    player.getBodyY(0.75D),
                    player.getZ(),
                    6,
                    0.45D,
                    0.4D,
                    0.45D,
                    0.03D
            );
        }
    }

    private static void damageAndSlow(ServerPlayerEntity source) {
        ServerWorld world = source.getEntityWorld();
        for (LivingEntity target : hostileTargets(source)) {
            target.damage(world, source.getDamageSources().magic(), 6.0F);
            target.addStatusEffect(new StatusEffectInstance(StatusEffects.SLOWNESS, 120, 1));
        }
    }

    private static void sootheGroup(ServerPlayerEntity source) {
        for (ServerPlayerEntity player : playersAround(source)) {
            if (!player.isAlive()) {
                continue;
            }
            player.heal(2.0F);
            player.removeStatusEffect(StatusEffects.SLOWNESS);
            player.addStatusEffect(new StatusEffectInstance(StatusEffects.REGENERATION, 160, 0));
        }
    }

    private static void launchEnemies(ServerPlayerEntity source) {
        ServerWorld world = source.getEntityWorld();
        for (LivingEntity target : hostileTargets(source)) {
            target.damage(world, source.getDamageSources().magic(), 4.0F);
            Vec3d force = target.getEntityPos()
                    .subtract(source.getEntityPos())
                    .multiply(1.0D, 0.0D, 1.0D);
            if (force.lengthSquared() < 0.01D) {
                force = source.getRotationVector().multiply(1.0D, 0.0D, 1.0D);
            }
            target.addVelocity(force.normalize().multiply(0.9D).add(0.0D, 0.65D, 0.0D));
            target.velocityModified = true;
            target.addStatusEffect(new StatusEffectInstance(StatusEffects.GLOWING, 160, 0));
        }
    }

    private static Set<ServerPlayerEntity> playersAround(ServerPlayerEntity source) {
        Set<ServerPlayerEntity> players = new HashSet<>(
                PlayerLookup.around(source.getEntityWorld(), source.getEntityPos(), ABILITY_RADIUS)
        );
        players.add(source);
        return players;
    }

    private static List<LivingEntity> hostileTargets(ServerPlayerEntity source) {
        return source.getEntityWorld().getEntitiesByClass(
                LivingEntity.class,
                source.getBoundingBox().expand(ABILITY_RADIUS),
                target -> target != source && target.isAlive() && !source.isTeammate(target)
        );
    }

    private static void spawnCompletionGlyphs(
            ServerWorld world,
            ServerPlayerEntity source,
            Akkord akkord
    ) {
        double rotation = akkord.networkId() * Math.PI * 0.35D;
        for (int ring = 0; ring < 3; ring++) {
            double radius = 0.8D + ring * 0.65D;
            int points = 10 + ring * 4;
            for (int point = 0; point < points; point++) {
                double angle = rotation + point * Math.PI * 2.0D / points;
                world.spawnParticles(
                        ModParticles.AKKORD_GLYPH,
                        source.getX() + Math.cos(angle) * radius,
                        source.getY() + 0.2D + ring * 0.38D,
                        source.getZ() + Math.sin(angle) * radius,
                        1,
                        0.03D,
                        0.05D,
                        0.03D,
                        0.025D
                );
            }
        }
    }

    public enum Akkord {
        HEILENDER_DREIKLANG(
                1,
                "Heilender Dreiklang",
                1.25F,
                List.of(Stimmung.STILLE, Stimmung.FREUDE, Stimmung.WUNDER)
        ),
        STURZKADENZ(
                2,
                "Sturzkadenz",
                0.72F,
                List.of(Stimmung.ZORN, Stimmung.ZORN, Stimmung.TRAUER)
        ),
        SANFTE_AUFLOESUNG(
                3,
                "Sanfte Auflösung",
                1.5F,
                List.of(Stimmung.TRAUER, Stimmung.STILLE, Stimmung.FREUDE)
        ),
        STERNENFORTISSIMO(
                4,
                "Sternenfortissimo",
                1.85F,
                List.of(Stimmung.WUNDER, Stimmung.ZORN, Stimmung.WUNDER)
        );

        private final int networkId;
        private final String displayName;
        private final float pitch;
        private final List<Stimmung> sequence;

        Akkord(int networkId, String displayName, float pitch, List<Stimmung> sequence) {
            this.networkId = networkId;
            this.displayName = displayName;
            this.pitch = pitch;
            this.sequence = sequence;
        }

        public int networkId() {
            return networkId;
        }

        public String displayName() {
            return displayName;
        }

        public float pitch() {
            return pitch;
        }

        public List<Stimmung> sequence() {
            return sequence;
        }

        public static Optional<Akkord> fromNetworkId(int networkId) {
            for (Akkord akkord : values()) {
                if (akkord.networkId == networkId) {
                    return Optional.of(akkord);
                }
            }
            return Optional.empty();
        }

        private static Optional<Akkord> match(List<Stimmung> sequence) {
            for (Akkord akkord : values()) {
                if (akkord.sequence.equals(sequence)) {
                    return Optional.of(akkord);
                }
            }
            return Optional.empty();
        }
    }
}
