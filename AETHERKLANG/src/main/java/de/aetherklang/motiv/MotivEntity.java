package de.aetherklang.motiv;

import de.aetherklang.entity.ResonanceEntityEffects;
import de.aetherklang.insel.KlangmeerRegion;
import de.aetherklang.klangwerk.KlangwerkReloadDef;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.world.KammertonWorld;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityData;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.damage.DamageSource;
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
                && KlangmeerRegion.at(pos).isPresent()
                && HostileEntity.canSpawnIgnoreLightLevel(type, world, spawnReason, pos, random);
    }

    @Override
    protected void initGoals() {
        goalSelector.add(1, new SwimGoal(this));
        goalSelector.add(2, new MeleeAttackGoal(this, 1.0D, false));
        goalSelector.add(7, new WanderAroundFarGoal(this, 0.9D));
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
        setBaseValue(EntityAttributes.ARMOR, 0.0D);
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
