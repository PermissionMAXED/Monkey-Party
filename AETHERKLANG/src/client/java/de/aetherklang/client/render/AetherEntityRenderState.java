package de.aetherklang.client.render;

import net.minecraft.client.render.entity.state.EntityRenderState;

public final class AetherEntityRenderState extends EntityRenderState {
    public AetherEntityStyle style;
    public float yaw;
    public float pitch;
    public boolean shielded;
    public boolean healing;
    public int phase = 1;
    public float motivScale = 1.0F;
    public int primaryColor = 0xFFFFFF;
    public int secondaryColor = 0xFFFFFF;
}
