package de.aetherklang.client.fx.sky;

import de.aetherklang.client.fx.FxPalette;
import de.aetherklang.resonance.client.ClientResonanceCache;
import net.minecraft.client.particle.BillboardParticle;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleFactory;
import net.minecraft.client.particle.SpriteProvider;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.SimpleParticleType;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.random.Random;

/**
 * Long-lived, full-bright motes that drift through Kammerton's aurora ribbons.
 */
public final class AuroraWispParticle extends BillboardParticle {
    private final float spin;

    private AuroraWispParticle(
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
        maxAge = 44 + random.nextInt(33);
        scale = 0.22F + random.nextFloat() * 0.28F;
        spin = (random.nextBoolean() ? 1.0F : -1.0F) * (0.004F + random.nextFloat() * 0.012F);

        int mood = FxPalette.primary(ClientResonanceCache.getMood());
        float dissonanz = ClientResonanceCache.getDissonanz();
        int red = mix(mood >> 16 & 0xFF, FxPalette.MAGENTA >> 16 & 0xFF, dissonanz * 0.7F);
        int green = mix(mood >> 8 & 0xFF, FxPalette.MAGENTA >> 8 & 0xFF, dissonanz * 0.7F);
        int blue = mix(mood & 0xFF, FxPalette.MAGENTA & 0xFF, dissonanz * 0.7F);
        setColor(red / 255.0F, green / 255.0F, blue / 255.0F);
        setAlpha(0.0F);
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
        velocityX *= 0.985D;
        velocityY = velocityY * 0.97D + Math.sin((age + x) * 0.11D) * 0.0008D;
        velocityZ *= 0.985D;
        lastZRotation = zRotation;
        zRotation += spin;
        float progress = age / (float) maxAge;
        setAlpha(MathHelper.sin((float) Math.PI * progress) * 0.72F);
    }

    @Override
    public float getSize(float tickDelta) {
        float progress = MathHelper.clamp((age + tickDelta) / (float) maxAge, 0.0F, 1.0F);
        return scale * (0.72F + MathHelper.sin((float) Math.PI * progress) * 0.55F);
    }

    private static int mix(int from, int to, float amount) {
        return Math.round(MathHelper.lerp(MathHelper.clamp(amount, 0.0F, 1.0F), from, to));
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
            return new AuroraWispParticle(
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
