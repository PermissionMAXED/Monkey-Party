package de.aetherklang.client.fx.sky;

import de.aetherklang.client.fx.FxPalette;
import net.minecraft.client.particle.BillboardParticle;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleFactory;
import net.minecraft.client.particle.SpriteProvider;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.SimpleParticleType;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.random.Random;

/**
 * A crisp cyan-gold spark travelling along active ensemble links.
 */
public final class EnsembleFunkeParticle extends BillboardParticle {
    private final float spin;

    private EnsembleFunkeParticle(
            ClientWorld world,
            double x,
            double y,
            double z,
            double velocityX,
            double velocityY,
            double velocityZ,
            SpriteProvider sprites,
            Random random
    ) {
        super(world, x, y, z, velocityX, velocityY, velocityZ, sprites.getSprite(random));
        collidesWithWorld = false;
        maxAge = 15 + random.nextInt(10);
        scale = 0.055F + random.nextFloat() * 0.065F;
        spin = (random.nextBoolean() ? 1.0F : -1.0F) * (0.16F + random.nextFloat() * 0.18F);
        int color = random.nextBoolean() ? FxPalette.CYAN : FxPalette.GOLD;
        setColor(
                (color >> 16 & 0xFF) / 255.0F,
                (color >> 8 & 0xFF) / 255.0F,
                (color & 0xFF) / 255.0F
        );
        setAlpha(1.0F);
    }

    @Override
    protected RenderType getRenderType() {
        return RenderType.PARTICLE_ATLAS_TRANSLUCENT;
    }

    @Override
    protected int getBrightness(float tint) {
        return 0x00F000F0;
    }

    @Override
    public void tick() {
        super.tick();
        velocityX *= 0.88D;
        velocityY = velocityY * 0.9D + 0.002D;
        velocityZ *= 0.88D;
        lastZRotation = zRotation;
        zRotation += spin;
        float progress = age / (float) maxAge;
        setAlpha(MathHelper.clamp((1.0F - progress) * 1.45F, 0.0F, 1.0F));
    }

    @Override
    public float getSize(float tickDelta) {
        float progress = MathHelper.clamp((age + tickDelta) / (float) maxAge, 0.0F, 1.0F);
        return scale * (0.55F + MathHelper.sin((float) Math.PI * progress) * 0.9F);
    }

    public static final class Factory implements ParticleFactory<SimpleParticleType> {
        private final SpriteProvider sprites;

        public Factory(SpriteProvider sprites) {
            this.sprites = sprites;
        }

        @Override
        public Particle createParticle(
                SimpleParticleType effect,
                ClientWorld world,
                double x,
                double y,
                double z,
                double velocityX,
                double velocityY,
                double velocityZ,
                Random random
        ) {
            return new EnsembleFunkeParticle(
                    world,
                    x,
                    y,
                    z,
                    velocityX,
                    velocityY,
                    velocityZ,
                    sprites,
                    random
            );
        }
    }
}
