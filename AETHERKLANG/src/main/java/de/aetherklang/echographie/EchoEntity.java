package de.aetherklang.echographie;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.EnsembleEngine;
import java.util.UUID;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.data.DataTracker;
import net.minecraft.entity.data.TrackedData;
import net.minecraft.entity.data.TrackedDataHandlerRegistry;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * Intangible, translucent performer that follows one captured player phrase.
 */
public final class EchoEntity extends Entity {
    private static final TrackedData<Integer> ACTION_PULSE =
            DataTracker.registerData(EchoEntity.class, TrackedDataHandlerRegistry.INTEGER);

    private UUID ownerId;
    private EchoRecording recording;
    private Vec3d replayOrigin = Vec3d.ZERO;
    private int replayTick;
    private int nextAction;
    private boolean finished;

    public EchoEntity(EntityType<? extends EchoEntity> type, World world) {
        super(type, world);
        noClip = true;
        setNoGravity(true);
    }

    public void configure(ServerPlayerEntity owner, EchoRecording recording) {
        ownerId = owner.getUuid();
        this.recording = recording;
        replayOrigin = owner.getEntityPos();
        replayTick = 0;
        nextAction = 0;
    }

    public int getActionPulse() {
        return dataTracker.get(ACTION_PULSE);
    }

    public void dismiss() {
        finishReplay();
    }

    @Override
    protected void initDataTracker(DataTracker.Builder builder) {
        builder.add(ACTION_PULSE, 0);
    }

    @Override
    public void tick() {
        super.tick();
        noClip = true;
        setNoGravity(true);
        setVelocity(Vec3d.ZERO);
        if (getEntityWorld().isClient()) {
            return;
        }
        if (!(getEntityWorld() instanceof ServerWorld world)
                || recording == null
                || replayTick >= recording.durationTicks()) {
            finishReplay();
            return;
        }

        EchoRecording.Frame frame = recording.frameAt(replayTick);
        setPosition(
                replayOrigin.x + frame.x(),
                replayOrigin.y + frame.y(),
                replayOrigin.z + frame.z()
        );
        setYaw(frame.yaw());
        setPitch(frame.pitch());

        while (nextAction < recording.actions().size()
                && recording.actions().get(nextAction).tick() <= replayTick) {
            EchoRecording.Action action = recording.actions().get(nextAction++);
            if (action.tick() == replayTick) {
                replayAction(world);
            }
        }
        if ((replayTick & 3) == 0) {
            world.spawnParticles(
                    ModParticles.ENSEMBLE_FUNKE,
                    getX(),
                    getBodyY(0.55D),
                    getZ(),
                    2,
                    0.22D,
                    0.45D,
                    0.22D,
                    0.015D
            );
        }
        replayTick++;
    }

    private void replayAction(ServerWorld world) {
        dataTracker.set(ACTION_PULSE, dataTracker.get(ACTION_PULSE) + 1);
        world.spawnParticles(
                ModParticles.BEAT_RING,
                getX(),
                getY() + 0.1D,
                getZ(),
                18,
                0.55D,
                0.08D,
                0.55D,
                0.035D
        );
        world.spawnParticles(
                ModParticles.ENSEMBLE_FUNKE,
                getX(),
                getBodyY(0.65D),
                getZ(),
                14,
                0.45D,
                0.7D,
                0.45D,
                0.04D
        );
        world.playSound(
                null,
                getX(),
                getY(),
                getZ(),
                ModSounds.ENSEMBLE_CHIME,
                SoundCategory.PLAYERS,
                0.55F,
                1.65F
        );

        ServerPlayerEntity owner = owner();
        if (owner != null) {
            EnsembleEngine.onEchoAction(owner, this);
        }
    }

    private ServerPlayerEntity owner() {
        if (ownerId == null || !(getEntityWorld() instanceof ServerWorld world)) {
            return null;
        }
        return world.getServer().getPlayerManager().getPlayer(ownerId);
    }

    private void finishReplay() {
        if (finished) {
            return;
        }
        finished = true;
        if (getEntityWorld() instanceof ServerWorld world) {
            EnsembleEngine.removeEcho(world.getServer(), getUuid());
        }
        if (ownerId != null) {
            EchoCylinderService.onEchoFinished(ownerId, getUuid());
        }
        discard();
    }

    @Override
    protected void writeCustomData(WriteView view) {
        if (ownerId != null) {
            view.putString("Owner", ownerId.toString());
        }
        view.putInt("ReplayTick", replayTick);
    }

    @Override
    protected void readCustomData(ReadView view) {
        String owner = view.getString("Owner", "");
        if (!owner.isEmpty()) {
            try {
                ownerId = UUID.fromString(owner);
            } catch (IllegalArgumentException ignored) {
                ownerId = null;
            }
        }
        replayTick = Math.max(0, view.getInt("ReplayTick", 0));
    }

    @Override
    public boolean damage(ServerWorld world, DamageSource source, float amount) {
        return false;
    }
}
