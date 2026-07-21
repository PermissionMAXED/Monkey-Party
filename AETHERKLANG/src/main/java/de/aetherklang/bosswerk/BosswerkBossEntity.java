package de.aetherklang.bosswerk;

import de.aetherklang.Aetherklang;
import de.aetherklang.kanon.KanonEngine;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.UUID;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.ai.goal.ActiveTargetGoal;
import net.minecraft.entity.ai.goal.LookAtEntityGoal;
import net.minecraft.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.entity.ai.goal.RevengeGoal;
import net.minecraft.entity.ai.goal.SwimGoal;
import net.minecraft.entity.ai.goal.WanderAroundFarGoal;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.boss.BossBar;
import net.minecraft.entity.boss.ServerBossBar;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundEvent;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class BosswerkBossEntity extends HostileEntity {
    private static final int TICKS_PER_BEAT = 10;
    private static final double MAX_TARGET_DISTANCE_SQUARED = 48.0D * 48.0D;

    private final ServerBossBar bossBar;
    private BossScore score;
    private int phase = -1;
    private int attackIndex;
    private long phaseStartBeat;
    private long lastProcessedBeat = Long.MIN_VALUE;
    private PendingAttack pendingAttack;
    private boolean engaged;

    public BosswerkBossEntity(EntityType<? extends BosswerkBossEntity> type, World world) {
        super(type, world);
        setPersistent();
        bossBar = new ServerBossBar(
                Text.translatable(type.getTranslationKey()),
                BossBar.Color.PURPLE,
                BossBar.Style.PROGRESS
        );
        bossBar.setDarkenSky(true);
        bossBar.setThickenFog(true);
    }

    public static DefaultAttributeContainer.Builder createAttributes() {
        return HostileEntity.createHostileAttributes()
                .add(EntityAttributes.MAX_HEALTH, 360.0D)
                .add(EntityAttributes.ARMOR, 9.0D)
                .add(EntityAttributes.ATTACK_DAMAGE, 9.0D)
                .add(EntityAttributes.ATTACK_KNOCKBACK, 1.0D)
                .add(EntityAttributes.MOVEMENT_SPEED, 0.28D)
                .add(EntityAttributes.FOLLOW_RANGE, 48.0D)
                .add(EntityAttributes.KNOCKBACK_RESISTANCE, 0.75D);
    }

    @Override
    protected void initGoals() {
        goalSelector.add(0, new SwimGoal(this));
        goalSelector.add(2, new MeleeAttackGoal(this, 1.05D, true));
        goalSelector.add(6, new WanderAroundFarGoal(this, 0.72D));
        goalSelector.add(7, new LookAtEntityGoal(this, PlayerEntity.class, 14.0F));
        targetSelector.add(1, new RevengeGoal(this));
        targetSelector.add(2, new ActiveTargetGoal<>(this, PlayerEntity.class, true));
    }

    @Override
    public void tick() {
        super.tick();
        if (!(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }
        configureFromScore();
        updateBossBar();
        if (!isAlive()) {
            return;
        }
        updatePhase(world);
        spawnAmbientFx(world);
        if (KanonEngine.isStaggered(this)) {
            pendingAttack = null;
            return;
        }

        if (pendingAttack != null && age % 3 == 0) {
            BossAttackExecutor.telegraph(world, this, pendingAttack.attack(), pendingAttack.targetPosition());
        }

        long worldTime = world.getTime();
        if (Math.floorMod(worldTime, TICKS_PER_BEAT) != 0) {
            return;
        }
        long beat = Math.floorDiv(worldTime, TICKS_PER_BEAT);
        if (beat == lastProcessedBeat) {
            return;
        }
        lastProcessedBeat = beat;
        processBeat(world, beat);
    }

    private void configureFromScore() {
        if (score != null) {
            return;
        }
        score = Bosswerk.scoreFor(getType());
        EntityAttributeInstance maxHealth = getAttributeInstance(EntityAttributes.MAX_HEALTH);
        if (maxHealth == null) {
            throw new IllegalStateException("Bosswerk entity is missing its max-health attribute");
        }
        double previousMax = maxHealth.getValue();
        float previousHealth = getHealth();
        maxHealth.setBaseValue(score.health());
        if (previousHealth >= previousMax - 0.01D) {
            setHealth(getMaxHealth());
        } else {
            setHealth(Math.min(previousHealth, getMaxHealth()));
        }
    }

    private void updatePhase(ServerWorld world) {
        int nextPhase = score.phaseIndex(getHealth() / getMaxHealth());
        if (nextPhase == phase) {
            return;
        }
        boolean initialPhase = phase < 0;
        phase = nextPhase;
        attackIndex = 0;
        pendingAttack = null;
        phaseStartBeat = Math.floorDiv(world.getTime(), TICKS_PER_BEAT);
        bossBar.setColor(phaseColor());
        if (!initialPhase) {
            BossAttackExecutor.phaseTransition(world, this);
        }
        Aetherklang.LOGGER.info(
                "Bosswerk {} entered phase {} at {}% health",
                getBossId(),
                phase + 1,
                Math.round(getHealth() * 100.0F / getMaxHealth())
        );
    }

    private void processBeat(ServerWorld world, long beat) {
        if (pendingAttack != null) {
            if (beat >= pendingAttack.executeBeat()) {
                Entity target = pendingAttack.targetUuid() == null
                        ? null
                        : world.getEntity(pendingAttack.targetUuid());
                BossAttackExecutor.execute(
                        world,
                        this,
                        pendingAttack.attack(),
                        pendingAttack.targetPosition(),
                        target
                );
                pendingAttack = null;
            }
            return;
        }

        Entity target = getTarget();
        if (target == null
                || !target.isAlive()
                || target.isSpectator()
                || squaredDistanceTo(target) > MAX_TARGET_DISTANCE_SQUARED) {
            return;
        }
        if (!engaged) {
            engaged = true;
            attackIndex = 0;
            pendingAttack = null;
            phaseStartBeat = beat + 4;
            BossAttackExecutor.intro(world, this);
            return;
        }

        BossScore.Phase currentPhase = score.phases().get(phase);
        if (Math.floorMod(beat - phaseStartBeat, currentPhase.beatInterval()) != 0) {
            return;
        }

        BossScore.Attack attack = currentPhase.attacks().get(attackIndex % currentPhase.attacks().size());
        attackIndex++;
        Vec3d targetPosition = target.getEntityPos();
        pendingAttack = new PendingAttack(
                attack,
                targetPosition,
                target.getUuid(),
                beat + attack.telegraphBeats()
        );
        BossAttackExecutor.telegraph(world, this, attack, targetPosition);
        BosswerkNetworking.sendAttack(this, phase, attack.operation());
    }

    private void updateBossBar() {
        bossBar.setPercent(Math.clamp(getHealth() / getMaxHealth(), 0.0F, 1.0F));
        bossBar.setName(getDisplayName());
    }

    private void spawnAmbientFx(ServerWorld world) {
        if (age % 5 != 0) {
            return;
        }
        world.spawnParticles(
                switch (getBossId()) {
                    case ModEntities.BOSS_TREMOLO_ID -> ModParticles.TREMOLO_SPLITTER;
                    case ModEntities.BOSS_GLISSANDA_ID -> ModParticles.GLISSANDO_SPUR;
                    case ModEntities.BOSS_KAKOPHON_ID -> ModParticles.KAKOPHON_FUNKE;
                    case ModEntities.BOSS_OSTINATO_ID -> ModParticles.LEITMOTIV_NOTE;
                    case ModEntities.BOSS_RITARDANDO_ID -> ModParticles.FERMATE_GLIMMER;
                    default -> ModParticles.GENERALPAUSE_NEBEL;
                },
                getX(),
                getBodyY(0.52D),
                getZ(),
                3 + phase,
                getWidth() * 0.4D,
                getHeight() * 0.35D,
                getWidth() * 0.4D,
                0.025D
        );
    }

    private BossBar.Color phaseColor() {
        if (phase >= 2) {
            return BossBar.Color.RED;
        }
        if (phase == 1) {
            return BossBar.Color.YELLOW;
        }
        return switch (getBossId()) {
            case ModEntities.BOSS_GLISSANDA_ID -> BossBar.Color.BLUE;
            case ModEntities.BOSS_GENERALPAUSE_ID -> BossBar.Color.WHITE;
            case ModEntities.BOSS_RITARDANDO_ID -> BossBar.Color.GREEN;
            default -> BossBar.Color.PURPLE;
        };
    }

    public String getBossId() {
        return score == null
                ? net.minecraft.registry.Registries.ENTITY_TYPE.getId(getType()).getPath()
                : score.id();
    }

    public int getPhase() {
        return Math.max(0, phase);
    }

    public SoundEvent getBossSound() {
        return switch (getBossId()) {
            case ModEntities.BOSS_TREMOLO_ID -> ModSounds.BOSS_TREMOLO;
            case ModEntities.BOSS_GLISSANDA_ID -> ModSounds.BOSS_GLISSANDA;
            case ModEntities.BOSS_KAKOPHON_ID -> ModSounds.BOSS_KAKOPHON;
            case ModEntities.BOSS_GENERALPAUSE_ID -> ModSounds.BOSS_GENERALPAUSE;
            case ModEntities.BOSS_OSTINATO_ID -> ModSounds.BOSS_OSTINATO;
            default -> ModSounds.BOSS_RITARDANDO;
        };
    }

    @Override
    public void onStartedTrackingBy(ServerPlayerEntity player) {
        super.onStartedTrackingBy(player);
        bossBar.addPlayer(player);
    }

    @Override
    public void onStoppedTrackingBy(ServerPlayerEntity player) {
        super.onStoppedTrackingBy(player);
        bossBar.removePlayer(player);
    }

    private record PendingAttack(
            BossScore.Attack attack,
            Vec3d targetPosition,
            UUID targetUuid,
            long executeBeat
    ) {
    }
}
