package de.aetherklang.entity;

import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.world.KammertonWorld;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.ai.goal.EscapeDangerGoal;
import net.minecraft.entity.ai.goal.FollowOwnerGoal;
import net.minecraft.entity.ai.goal.LookAtEntityGoal;
import net.minecraft.entity.ai.goal.SitGoal;
import net.minecraft.entity.ai.goal.SwimGoal;
import net.minecraft.entity.ai.goal.TemptGoal;
import net.minecraft.entity.ai.goal.WanderAroundFarGoal;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.passive.AnimalEntity;
import net.minecraft.entity.passive.PassiveEntity;
import net.minecraft.entity.passive.TameableEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;
import net.minecraft.world.WorldAccess;

public final class TaktlingEntity extends TameableEntity {
    private static final int BEAT_PERIOD_TICKS = 10;

    public TaktlingEntity(EntityType<? extends TaktlingEntity> type, World world) {
        super(type, world);
    }

    public static DefaultAttributeContainer.Builder createAttributes() {
        return AnimalEntity.createAnimalAttributes()
                .add(EntityAttributes.MAX_HEALTH, 10.0)
                .add(EntityAttributes.FOLLOW_RANGE, 16.0)
                .add(EntityAttributes.MOVEMENT_SPEED, 0.32);
    }

    @Override
    protected void initGoals() {
        goalSelector.add(0, new SwimGoal(this));
        goalSelector.add(1, new SitGoal(this));
        goalSelector.add(2, new EscapeDangerGoal(this, 1.3D));
        goalSelector.add(3, new FollowOwnerGoal(this, 1.15D, 4.0F, 2.0F));
        goalSelector.add(4, new TemptGoal(this, 1.05D, stack -> stack.isOf(ModItems.RESONANZKRISTALL_GOLD), false));
        goalSelector.add(6, new WanderAroundFarGoal(this, 0.85D));
        goalSelector.add(7, new LookAtEntityGoal(this, PlayerEntity.class, 8.0F));
    }

    @Override
    public void tick() {
        super.tick();
        if (!(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }

        boolean beat = world.getTime() % BEAT_PERIOD_TICKS == 0L;
        if (beat && isOnGround() && !isSitting()) {
            addVelocity(0.0D, 0.16D, 0.0D);
            velocityModified = true;
        }
        if (beat && getRandom().nextInt(16) == 0) {
            playSound(ModSounds.TAKTLING_CHIRP, 0.65F, 1.2F + getRandom().nextFloat() * 0.35F);
        }
        if (isTamed() && age % 20 == 0) {
            world.spawnParticles(
                    ModParticles.NOTE_SPARK,
                    getX(),
                    getBodyY(0.7D),
                    getZ(),
                    2,
                    0.22D,
                    0.25D,
                    0.22D,
                    0.01D
            );
        }
    }

    @Override
    public ActionResult interactMob(PlayerEntity player, Hand hand) {
        ItemStack stack = player.getStackInHand(hand);
        if (!isTamed() && stack.isOf(ModItems.RESONANZKRISTALL_GOLD)) {
            if (getEntityWorld().isClient()) {
                return ActionResult.SUCCESS;
            }

            if (!player.isInCreativeMode()) {
                stack.decrement(1);
            }
            setTamedBy(player);
            setSitting(false);
            setInSittingPose(false);
            getNavigation().stop();
            playSound(ModSounds.TAKTLING_CHIRP, 1.0F, 1.55F);
            return ActionResult.SUCCESS_SERVER;
        }

        if (isTamed() && isOwner(player)) {
            if (!getEntityWorld().isClient()) {
                boolean sitting = !isSitting();
                setSitting(sitting);
                setInSittingPose(sitting);
                getNavigation().stop();
            }
            return getEntityWorld().isClient() ? ActionResult.SUCCESS : ActionResult.SUCCESS_SERVER;
        }
        return super.interactMob(player, hand);
    }

    @Override
    public boolean isBreedingItem(ItemStack stack) {
        return false;
    }

    @Override
    public PassiveEntity createChild(ServerWorld world, PassiveEntity mate) {
        return null;
    }

    @Override
    public boolean canSpawn(WorldAccess world, SpawnReason reason) {
        if (reason == SpawnReason.COMMAND || reason == SpawnReason.SPAWN_ITEM_USE) {
            return true;
        }
        return world instanceof World candidate
                && KammertonWorld.isKammerton(candidate)
                && super.canSpawn(world, reason);
    }
}
