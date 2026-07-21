package de.aetherklang.echographie;

import de.aetherklang.resonance.Stimmung;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.entity.Entity;
import net.minecraft.registry.RegistryKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * Captures player phrases and turns completed recordings into short-lived echoes.
 */
public final class EchoCylinderService {
    public static final int RECORDING_BEATS = 8;
    public static final int TICKS_PER_BEAT = 10;
    public static final int RECORDING_TICKS = RECORDING_BEATS * TICKS_PER_BEAT;

    private static final Map<UUID, ActiveRecording> ACTIVE_RECORDINGS = new HashMap<>();
    private static final Map<UUID, EchoRecording> RECORDINGS = new HashMap<>();
    private static final Map<UUID, UUID> ACTIVE_ECHOES = new HashMap<>();
    private static boolean registered;

    private EchoCylinderService() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerTickEvents.END_SERVER_TICK.register(EchoCylinderService::tick);
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) ->
                clearPlayer(server, handler.getPlayer().getUuid())
        );
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
            ACTIVE_RECORDINGS.clear();
            RECORDINGS.clear();
            ACTIVE_ECHOES.clear();
        });
    }

    public static UseResult use(ServerPlayerEntity player, boolean replaceRecording) {
        UUID playerId = player.getUuid();
        ActiveRecording active = ACTIVE_RECORDINGS.get(playerId);
        if (active != null) {
            int elapsed = Math.max(0, player.getEntityWorld().getServer().getTicks() - active.startedAtTick);
            int beatsRemaining = Math.max(1, (RECORDING_TICKS - elapsed + TICKS_PER_BEAT - 1) / TICKS_PER_BEAT);
            player.sendMessage(
                    Text.translatable("message.aetherklang.echozylinder.recording", beatsRemaining),
                    true
            );
            return UseResult.BUSY;
        }

        if (replaceRecording || !RECORDINGS.containsKey(playerId)) {
            startRecording(player);
            return UseResult.RECORDING;
        }

        replay(player, RECORDINGS.get(playerId));
        return UseResult.REPLAYING;
    }

    /**
     * Called only after the common rhythm hook has accepted and de-duplicated an action.
     */
    public static void recordOnBeatAction(ServerPlayerEntity player, Stimmung mood) {
        ActiveRecording active = ACTIVE_RECORDINGS.get(player.getUuid());
        if (active == null || !active.worldKey.equals(player.getEntityWorld().getRegistryKey())) {
            return;
        }
        int tick = player.getEntityWorld().getServer().getTicks() - active.startedAtTick;
        if (tick >= 0 && tick < RECORDING_TICKS) {
            active.actions.add(new EchoRecording.Action(tick, mood));
        }
    }

    static void onEchoFinished(UUID ownerId, UUID echoId) {
        ACTIVE_ECHOES.remove(ownerId, echoId);
    }

    private static void startRecording(ServerPlayerEntity player) {
        discardActiveEcho(player.getEntityWorld().getServer(), player.getUuid());
        Vec3d origin = player.getEntityPos();
        ActiveRecording recording = new ActiveRecording(
                player.getEntityWorld().getRegistryKey(),
                player.getEntityWorld().getServer().getTicks(),
                origin
        );
        recording.sample(player);
        ACTIVE_RECORDINGS.put(player.getUuid(), recording);
        RECORDINGS.remove(player.getUuid());
        player.sendMessage(
                Text.translatable("message.aetherklang.echozylinder.started", RECORDING_BEATS),
                true
        );
    }

    private static void replay(ServerPlayerEntity player, EchoRecording recording) {
        MinecraftServer server = player.getEntityWorld().getServer();
        discardActiveEcho(server, player.getUuid());

        EchoEntity echo = new EchoEntity(Echographie.ECHO, player.getEntityWorld());
        echo.configure(player, recording);
        echo.setPosition(player.getX(), player.getY(), player.getZ());
        echo.setYaw(player.getYaw());
        echo.setPitch(player.getPitch());
        player.getEntityWorld().spawnEntity(echo);
        ACTIVE_ECHOES.put(player.getUuid(), echo.getUuid());
        player.sendMessage(
                Text.translatable("message.aetherklang.echozylinder.replaying", recording.actions().size()),
                true
        );
    }

    private static void tick(MinecraftServer server) {
        if (ACTIVE_RECORDINGS.isEmpty()) {
            return;
        }
        for (Map.Entry<UUID, ActiveRecording> entry : List.copyOf(ACTIVE_RECORDINGS.entrySet())) {
            UUID playerId = entry.getKey();
            ActiveRecording active = entry.getValue();
            ServerPlayerEntity player = server.getPlayerManager().getPlayer(playerId);
            if (player == null
                    || !player.isAlive()
                    || player.isSpectator()
                    || !active.worldKey.equals(player.getEntityWorld().getRegistryKey())) {
                ACTIVE_RECORDINGS.remove(playerId, active);
                if (player != null) {
                    player.sendMessage(
                            Text.translatable("message.aetherklang.echozylinder.cancelled"),
                            true
                    );
                }
                continue;
            }

            int elapsed = server.getTicks() - active.startedAtTick;
            if (elapsed >= RECORDING_TICKS) {
                finishRecording(player, active);
            } else {
                active.sample(player);
            }
        }
    }

    private static void finishRecording(ServerPlayerEntity player, ActiveRecording active) {
        if (!ACTIVE_RECORDINGS.remove(player.getUuid(), active)) {
            return;
        }
        EchoRecording recording = new EchoRecording(active.frames, active.actions, RECORDING_TICKS);
        RECORDINGS.put(player.getUuid(), recording);
        player.sendMessage(
                Text.translatable(
                        recording.actions().isEmpty()
                                ? "message.aetherklang.echozylinder.ready_empty"
                                : "message.aetherklang.echozylinder.ready",
                        recording.actions().size()
                ),
                true
        );
    }

    private static void clearPlayer(MinecraftServer server, UUID playerId) {
        ACTIVE_RECORDINGS.remove(playerId);
        RECORDINGS.remove(playerId);
        discardActiveEcho(server, playerId);
    }

    private static void discardActiveEcho(MinecraftServer server, UUID playerId) {
        UUID echoId = ACTIVE_ECHOES.remove(playerId);
        if (echoId == null) {
            return;
        }
        for (ServerWorld world : server.getWorlds()) {
            Entity entity = world.getEntity(echoId);
            if (entity != null) {
                if (entity instanceof EchoEntity echo) {
                    echo.dismiss();
                } else {
                    entity.discard();
                }
                return;
            }
        }
    }

    public enum UseResult {
        RECORDING,
        REPLAYING,
        BUSY
    }

    private static final class ActiveRecording {
        private final RegistryKey<World> worldKey;
        private final int startedAtTick;
        private final Vec3d origin;
        private final List<EchoRecording.Frame> frames = new ArrayList<>(RECORDING_TICKS);
        private final List<EchoRecording.Action> actions = new ArrayList<>();

        private ActiveRecording(RegistryKey<World> worldKey, int startedAtTick, Vec3d origin) {
            this.worldKey = worldKey;
            this.startedAtTick = startedAtTick;
            this.origin = origin;
        }

        private void sample(ServerPlayerEntity player) {
            int tick = player.getEntityWorld().getServer().getTicks() - startedAtTick;
            if (tick < 0 || tick >= RECORDING_TICKS || frames.size() > tick) {
                return;
            }
            Vec3d offset = player.getEntityPos().subtract(origin);
            frames.add(new EchoRecording.Frame(
                    offset.x,
                    offset.y,
                    offset.z,
                    player.getYaw(),
                    player.getPitch()
            ));
        }
    }
}
