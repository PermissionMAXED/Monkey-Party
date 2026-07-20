package de.aetherklang.motiv;

import de.aetherklang.entity.EchonoteEntity;
import de.aetherklang.registry.ModSounds;
import java.util.EnumSet;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.ai.goal.Goal;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.Vec3d;

/**
 * Keeps distance and fires echonotes at the current target.
 */
public final class MotivSchuetzeGoal extends Goal {
    private static final int ATTACK_INTERVAL = 28;
    private static final double MIN_RANGE = 6.0D;
    private static final double MAX_RANGE = 18.0D;

    private final MotivEntity motiv;
    private int cooldown;

    public MotivSchuetzeGoal(MotivEntity motiv) {
        this.motiv = motiv;
        setControls(EnumSet.of(Control.MOVE, Control.LOOK));
    }

    @Override
    public boolean canStart() {
        LivingEntity target = motiv.getTarget();
        return target != null
                && target.isAlive()
                && motiv.squaredDistanceTo(target) <= MAX_RANGE * MAX_RANGE;
    }

    @Override
    public boolean shouldContinue() {
        return canStart();
    }

    @Override
    public void stop() {
        cooldown = 0;
    }

    @Override
    public void tick() {
        LivingEntity target = motiv.getTarget();
        if (target == null) {
            return;
        }

        motiv.getLookControl().lookAt(target, 30.0F, 30.0F);
        double distance = motiv.squaredDistanceTo(target);
        if (distance < MIN_RANGE * MIN_RANGE) {
            Vec3d away = motiv.getEntityPos().subtract(target.getEntityPos()).normalize();
            motiv.getNavigation().startMovingTo(
                    motiv.getX() + away.x * 2.0D,
                    motiv.getY(),
                    motiv.getZ() + away.z * 2.0D,
                    1.05D
            );
        } else if (distance > (MAX_RANGE - 2.0D) * (MAX_RANGE - 2.0D)) {
            motiv.getNavigation().startMovingTo(target, 1.0D);
        } else {
            motiv.getNavigation().stop();
        }

        if (--cooldown > 0) {
            return;
        }
        cooldown = ATTACK_INTERVAL;
        if (!(motiv.getEntityWorld() instanceof ServerWorld world)) {
            return;
        }
        EchonoteEntity note = EchonoteEntity.create(world, motiv, target, false);
        world.spawnEntity(note);
        motiv.playSound(ModSounds.RESONANCE_CAST, 0.85F, 0.95F);
    }
}
