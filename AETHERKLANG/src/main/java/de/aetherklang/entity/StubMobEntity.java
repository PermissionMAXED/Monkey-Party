package de.aetherklang.entity;

import net.minecraft.entity.EntityType;
import net.minecraft.entity.mob.PathAwareEntity;
import net.minecraft.world.World;

/**
 * Deliberately behavior-free placeholder used to freeze the WP1 entity IDs.
 * Later work packages can replace each registration with a dedicated class.
 */
public class StubMobEntity extends PathAwareEntity {
    public StubMobEntity(EntityType<? extends StubMobEntity> type, World world) {
        super(type, world);
    }

    @Override
    protected void initGoals() {
        // AI is intentionally deferred to later work packages.
    }
}
