package de.aetherklang.motiv;

import de.aetherklang.entity.ResonanceEntityEffects;
import de.aetherklang.insel.KlangmeerRegion;
import de.aetherklang.klangwerk.KlangwerkReloadDef;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.world.KammertonWorld;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityData;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.data.DataTracker;
import net.minecraft.entity.data.TrackedData;
import net.minecraft.entity.data.TrackedDataHandlerRegistry;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.ai.goal.ActiveTargetGoal;
import net.minecraft.entity.ai.goal.LookAroundGoal;
import net.minecraft.entity.ai.goal.LookAtEntityGoal;
import net.minecraft.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.entity.ai.goal.RevengeGoal;
import net.minecraft.entity.ai.goal.SwimGoal;
import net.minecraft.entity.ai.goal.WanderAroundFarGoal;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.LocalDifficulty;
import net.minecraft.world.ServerWorldAccess;
import net.minecraft.world.World;

/**
 * Shared runtime entity for all registered Motiv archetypes.
 */
public final class MotivEntity extends HostileEntity {
    private static final TrackedData<String> VARIANT =
            DataTracker.registerData(MotivEntity.class, TrackedDataHandlerRegistry.STRING);
    private static final TrackedData<String> AFFIX =
            DataTracker.registerData(MotivEntity.class, TrackedDataHandlerRegistry.STRING);

    private final String archetype;

    public MotivEntity(EntityType<? extends MotivEntity> type, World world, String archetype) {
        super(type, world);
        this.archetype = archetype;
    }

    public static DefaultAttributeContainer.Builder createAttributes() {
        return HostileEntity.createHostileAttributes()
                .add(EntityAttributes.MAX_HEALTH, 40.0)
                .add(EntityAttributes.ATTACK_DAMAGE, 5.0)
                .add(EntityAttributes.MOVEMENT_SPEED, 0.25)
                .add(EntityAttributes.FOLLOW_RANGE, 32.0);
    }

    public static boolean canSpawnInKammertonRegion(
            EntityType<? extends MotivEntity> type,
            ServerWorldAccess world,
            SpawnReason spawnReason,
            BlockPos pos,
            Random random
    ) {
        return KammertonWorld.isKammerton(world.toServerWorld())
                && KlangmeerRegion.allowsMotivSpawn(pos)
                && HostileEntity.canSpawnIgnoreLightLevel(type, world, spawnReason, pos, random);
    }

    @Override
    protected void initGoals() {
        goalSelector.add(1, new SwimGoal(this));
        if ("schuetze".equals(archetype)) {
            goalSelector.add(2, new MotivSchuetzeGoal(this));
            goalSelector.add(7, new WanderAroundFarGoal(this, 0.85D));
        } else {
            double speed = "koloss".equals(archetype) ? 0.82D : 1.0D;
            boolean pause = "koloss".equals(archetype);
            goalSelector.add(2, new MeleeAttackGoal(this, speed, pause));
            goalSelector.add(7, new WanderAroundFarGoal(this, "koloss".equals(archetype) ? 0.65D : 0.9D));
        }
        goalSelector.add(8, new LookAtEntityGoal(this, PlayerEntity.class, 8.0F));
        goalSelector.add(9, new LookAroundGoal(this));
        targetSelector.add(1, new RevengeGoal(this));
        targetSelector.add(2, new ActiveTargetGoal<>(this, PlayerEntity.class, true));
    }

    @Override
    protected void initDataTracker(DataTracker.Builder builder) {
        super.initDataTracker(builder);
        builder.add(VARIANT, "");
        builder.add(AFFIX, "");
    }

    @Override
    public EntityData initialize(
            ServerWorldAccess world,
            LocalDifficulty difficulty,
            SpawnReason spawnReason,
            EntityData entityData
    ) {
        EntityData initialized = super.initialize(world, difficulty, spawnReason, entityData);
        setVariant(MotivEngine.randomVariant(archetype, getRandom()).id(), true);
        applyRandomAffix(false);
        return initialized;
    }

    @Override
    public void tick() {
        if (!getEntityWorld().isClient() && getVariantId().isEmpty()) {
            setVariant(MotivEngine.randomVariant(archetype, getRandom()).id(), true);
        }
        super.tick();
        if (getEntityWorld() instanceof ServerWorld world) {
            if ("weber".equals(archetype)) {
                tickWeberCombat(world);
            }
        }
        if (getEntityWorld() instanceof ServerWorld world && age % 20 == 0) {
            MotivAffixEngine.get(getAffixId())
                    .flatMap(MotivAffixEngine::particle)
                    .ifPresent(particle -> world.spawnParticles(
                            particle,
                            getX(),
                            getBodyY(0.55D),
                            getZ(),
                            4,
                            0.42D,
                            0.55D,
                            0.42D,
                            0.02D
                    ));
        }
    }

    public String getArchetype() {
        return archetype;
    }

    public String getVariantId() {
        return dataTracker.get(VARIANT);
    }

    public MotivVariantDef getVariant() {
        return MotivEngine.variant(archetype, getVariantId());
    }

    public String getAffixId() {
        return dataTracker.get(AFFIX);
    }

    public void setVariant(String variantId) {
        setVariant(variantId, false);
    }

    public void applyRandomAffix(boolean guaranteed) {
        setAffix(MotivAffixEngine.roll(getRandom(), guaranteed), true);
    }

    private void setVariant(String variantId, boolean healToFull) {
        MotivVariantDef variant = MotivEngine.variant(archetype, variantId);
        dataTracker.set(VARIANT, variant.id());
        if (!getEntityWorld().isClient()) {
            applyStats(variant, healToFull);
        }
        updateCustomName();
    }

    private void setAffix(String affixId, boolean healToFull) {
        dataTracker.set(AFFIX, MotivAffixEngine.get(affixId).isPresent() ? affixId : "");
        if (!getEntityWorld().isClient()) {
            applyStats(getVariant(), healToFull);
        }
        updateCustomName();
    }

    private void updateCustomName() {
        MotivVariantDef variant = getVariant();
        if (getAffixId().isEmpty()) {
            setCustomName(Text.translatable(variant.name()));
            return;
        }
        setCustomName(
                Text.translatable("affix.aetherklang." + getAffixId())
                        .append(" ")
                        .append(Text.translatable(variant.name()))
        );
    }

    private void applyStats(MotivVariantDef variant, boolean healToFull) {
        setBaseValue(EntityAttributes.MAX_HEALTH, variant.health());
        setBaseValue(EntityAttributes.ATTACK_DAMAGE, variant.attack());
        setBaseValue(EntityAttributes.MOVEMENT_SPEED, variant.movementSpeed());
        double armor = switch (archetype) {
            case "koloss" -> 8.0D + variant.scale();
            case "weber" -> 2.0D;
            default -> 0.0D;
        };
        setBaseValue(EntityAttributes.ARMOR, armor);
        MotivAffixEngine.get(getAffixId()).ifPresent(affix -> applyAffixStats(variant, affix));
        if (healToFull) {
            setHealth(getMaxHealth());
        } else {
            setHealth(Math.min(getHealth(), getMaxHealth()));
        }
    }

    private void applyAffixStats(MotivVariantDef variant, KlangwerkReloadDef affix) {
        double modifier = MotivAffixEngine.modifier(affix);
        switch (MotivAffixEngine.attribute(affix)) {
            case "armor" -> setBaseValue(EntityAttributes.ARMOR, modifier);
            case "movement_speed" ->
                    setBaseValue(EntityAttributes.MOVEMENT_SPEED, variant.movementSpeed() * (1.0D + modifier));
            case "attack_damage" ->
                    setBaseValue(EntityAttributes.ATTACK_DAMAGE, variant.attack() * (1.0D + modifier));
            default -> {
                // Behavioral affixes are applied from tryAttack.
            }
        }
    }

    private void setBaseValue(
            net.minecraft.registry.entry.RegistryEntry<net.minecraft.entity.attribute.EntityAttribute> attribute,
            double value
    ) {
        EntityAttributeInstance instance = getAttributeInstance(attribute);
        if (instance != null) {
            instance.setBaseValue(value);
        }
    }

    @Override
    public boolean damage(ServerWorld world, DamageSource source, float amount) {
        if (source.getAttacker() instanceof PlayerEntity player && ResonanceEntityEffects.isOnBeat(player)) {
            amount *= 1.75F;
            world.spawnParticles(
                    ModParticles.BEAT_RING,
                    getX(),
                    getBodyY(0.5),
                    getZ(),
                    14,
                    0.55,
                    0.65,
                    0.55,
                    0.04
            );
            playSound(ModSounds.BEAT_TICK, 0.9F, 1.8F);
        }
        return super.damage(world, source, amount);
    }

    @Override
    public boolean tryAttack(ServerWorld world, Entity target) {
        boolean attacked = super.tryAttack(world, target);
        if (!attacked) {
            return false;
        }

        if ("koloss".equals(archetype)) {
            performKolossSmash(world, target);
        } else if ("weber".equals(archetype) && target instanceof LivingEntity living) {
            living.addStatusEffect(new StatusEffectInstance(StatusEffects.SLOWNESS, 80, 2));
            world.spawnParticles(
                    ModParticles.SIRENEN_SCHLEIER,
                    living.getX(),
                    living.getBodyY(0.5D),
                    living.getZ(),
                    16,
                    0.55D,
                    0.35D,
                    0.55D,
                    0.02D
            );
        }

        MotivAffixEngine.get(getAffixId()).ifPresent(affix -> {
            double modifier = MotivAffixEngine.modifier(affix);
            switch (MotivAffixEngine.attribute(affix)) {
                case "life_steal" ->
                        heal((float) Math.max(1.0D, getAttributeValue(EntityAttributes.ATTACK_DAMAGE) * modifier));
                case "echo_chance" -> {
                    if (getRandom().nextDouble() < modifier) {
                        target.damage(
                                world,
                                world.getDamageSources().magic(),
                                (float) Math.max(1.0D, getAttributeValue(EntityAttributes.ATTACK_DAMAGE) * 0.5D)
                        );
                    }
                }
                default -> {
                    // Attribute affixes were already installed into the base stats.
                }
            }
        });
        return true;
    }

    private void performKolossSmash(ServerWorld world, Entity primaryTarget) {
        double radius = 3.5D;
        float smashDamage = (float) Math.max(2.0D, getAttributeValue(EntityAttributes.ATTACK_DAMAGE) * 0.65D);
        world.spawnParticles(
                ModParticles.BEAT_RING,
                getX(),
                getBodyY(0.2D),
                getZ(),
                24,
                radius * 0.45D,
                0.25D,
                radius * 0.45D,
                0.05D
        );
        playSound(ModSounds.BEAT_TICK, 1.1F, 0.55F);
        for (LivingEntity nearby : world.getEntitiesByClass(
                LivingEntity.class,
                getBoundingBox().expand(radius),
                candidate -> candidate != this && candidate.isAlive()
        )) {
            nearby.damage(world, world.getDamageSources().mobAttack(this), smashDamage);
            nearby.takeKnockback(0.85D, getX() - nearby.getX(), getZ() - nearby.getZ());
        }
        if (primaryTarget instanceof LivingEntity living && living.isAlive()) {
            living.takeKnockback(1.1D, getX() - living.getX(), getZ() - living.getZ());
        }
    }

    private void tickWeberCombat(ServerWorld world) {
        if (age % 120 != 0 || getTarget() == null) {
            return;
        }
        MotivEntity spawn = ModEntities.MOTIV_LAEUFER.create(world, SpawnReason.MOB_SUMMONED);
        if (spawn == null) {
            return;
        }
        spawn.refreshPositionAndAngles(
                getX() + getRandom().nextTriangular(0.0D, 1.8D),
                getY(),
                getZ() + getRandom().nextTriangular(0.0D, 1.8D),
                getRandom().nextFloat() * 360.0F,
                0.0F
        );
        spawn.initialize(world, world.getLocalDifficulty(spawn.getBlockPos()), SpawnReason.MOB_SUMMONED, null);
        spawn.setTarget(getTarget());
        world.spawnEntity(spawn);
        world.spawnParticles(
                ModParticles.SIRENEN_SCHLEIER,
                getX(),
                getBodyY(0.55D),
                getZ(),
                10,
                0.35D,
                0.25D,
                0.35D,
                0.015D
        );
    }

    @Override
    protected void dropLoot(ServerWorld world, DamageSource damageSource, boolean causedByPlayer) {
        super.dropLoot(world, damageSource, causedByPlayer);
        MotivVariantDef variant = getVariant();
        int count = variant.lootMin();
        if (variant.lootMax() > variant.lootMin()) {
            count += getRandom().nextInt(variant.lootMax() - variant.lootMin() + 1);
        }
        if (count == 0) {
            return;
        }
        Identifier lootId = Identifier.of(variant.loot());
        int dropCount = count;
        Registries.ITEM.getOptionalValue(lootId)
                .ifPresent(item -> dropStack(world, new ItemStack(item, dropCount)));
    }

    @Override
    protected void writeCustomData(WriteView view) {
        super.writeCustomData(view);
        view.putString("Variant", getVariantId());
        view.putString("Affix", getAffixId());
    }

    @Override
    protected void readCustomData(ReadView view) {
        super.readCustomData(view);
        setVariant(view.getString("Variant", ""));
        setAffix(view.getString("Affix", ""), false);
    }
}
