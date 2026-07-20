package de.aetherklang.client.fx;

import net.minecraft.client.particle.BillboardParticle;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleFactory;
import net.minecraft.client.particle.SpriteProvider;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.SimpleParticleType;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.random.Random;

/**
 * Bright, brand-colored particle implementations shared by all Aetherklang effects.
 */
public final class AetherParticles {
    private AetherParticles() {
    }

    private abstract static class AetherParticle extends BillboardParticle {
        protected AetherParticle(
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
        }

        @Override
        protected RenderType getRenderType() {
            return RenderType.PARTICLE_ATLAS_TRANSLUCENT;
        }

        @Override
        protected int getBrightness(float tint) {
            return 0x00F000F0;
        }

        protected void color(int rgb) {
            setColor(
                    ((rgb >> 16) & 0xFF) / 255.0F,
                    ((rgb >> 8) & 0xFF) / 255.0F,
                    (rgb & 0xFF) / 255.0F
            );
        }

        protected float life(float tickDelta) {
            return MathHelper.clamp((age + tickDelta) / (float) maxAge, 0.0F, 1.0F);
        }
    }

    private static final class NoteSparkParticle extends AetherParticle {
        private final float spin;

        private NoteSparkParticle(
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
            super(world, x, y, z, velocityX, velocityY, velocityZ, sprites, random);
            maxAge = 18 + random.nextInt(11);
            scale = 0.035F + random.nextFloat() * 0.04F;
            spin = (random.nextBoolean() ? 1.0F : -1.0F) * (0.18F + random.nextFloat() * 0.16F);
            color(random.nextInt(4) == 0 ? FxPalette.GOLD : FxPalette.CYAN);
            setAlpha(0.96F);
        }

        @Override
        public void tick() {
            super.tick();
            velocityX *= 0.91D;
            velocityY = velocityY * 0.92D + 0.0035D;
            velocityZ *= 0.91D;
            lastZRotation = zRotation;
            zRotation += spin;
            float progress = life(0.0F);
            setAlpha(MathHelper.clamp((1.0F - progress) * 1.35F, 0.0F, 1.0F));
        }

        @Override
        public float getSize(float tickDelta) {
            float progress = life(tickDelta);
            return scale * MathHelper.sin((float) Math.PI * MathHelper.clamp(progress * 1.4F, 0.0F, 1.0F));
        }
    }

    private static final class BeatRingParticle extends AetherParticle {
        private final float endScale;

        private BeatRingParticle(
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
            super(world, x, y, z, velocityX * 0.2D, velocityY * 0.2D, velocityZ * 0.2D, sprites, random);
            maxAge = 13 + random.nextInt(4);
            scale = 0.025F;
            endScale = 0.14F + random.nextFloat() * 0.08F;
            color(random.nextInt(3) == 0 ? FxPalette.GOLD : FxPalette.CYAN);
            setAlpha(0.9F);
        }

        @Override
        public void tick() {
            super.tick();
            velocityX *= 0.82D;
            velocityY *= 0.82D;
            velocityZ *= 0.82D;
            lastZRotation = zRotation;
            zRotation += 0.035F;
            float progress = life(0.0F);
            setAlpha((1.0F - progress) * 0.9F);
        }

        @Override
        public float getSize(float tickDelta) {
            float progress = life(tickDelta);
            float eased = 1.0F - (1.0F - progress) * (1.0F - progress);
            return MathHelper.lerp(eased, scale, endScale);
        }
    }

    private static final class BeamMoteParticle extends AetherParticle {
        private BeamMoteParticle(
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
            super(world, x, y, z, velocityX, velocityY, velocityZ, sprites, random);
            maxAge = 9 + random.nextInt(6);
            scale = 0.075F + random.nextFloat() * 0.075F;
            int roll = random.nextInt(7);
            color(roll < 4 ? FxPalette.CYAN : roll < 6 ? FxPalette.GOLD : FxPalette.MAGENTA);
            setAlpha(0.92F);
        }

        @Override
        public void tick() {
            super.tick();
            velocityX *= 0.7D;
            velocityY *= 0.7D;
            velocityZ *= 0.7D;
            float progress = life(0.0F);
            setAlpha((1.0F - progress) * 0.92F);
        }

        @Override
        public float getSize(float tickDelta) {
            return scale * (0.65F + MathHelper.sin((float) Math.PI * life(tickDelta)) * 0.7F);
        }
    }

    private static final class DissonanzSmokeParticle extends AetherParticle {
        private DissonanzSmokeParticle(
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
            super(world, x, y, z, velocityX, velocityY, velocityZ, sprites, random);
            maxAge = 28 + random.nextInt(17);
            scale = 0.08F + random.nextFloat() * 0.1F;
            color(random.nextBoolean() ? FxPalette.MAGENTA : FxPalette.INDIGO);
            setAlpha(0.62F);
        }

        @Override
        public void tick() {
            super.tick();
            velocityX *= 0.94D;
            velocityY = velocityY * 0.96D + 0.002D;
            velocityZ *= 0.94D;
            lastZRotation = zRotation;
            zRotation += 0.018F;
            float progress = life(0.0F);
            setAlpha(MathHelper.sin((float) Math.PI * progress) * 0.62F);
        }

        @Override
        public float getSize(float tickDelta) {
            return scale * (0.65F + life(tickDelta) * 1.25F);
        }
    }

    public static final class NoteSparkFactory implements ParticleFactory<SimpleParticleType> {
        private final SpriteProvider sprites;

        public NoteSparkFactory(SpriteProvider sprites) {
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
            return new NoteSparkParticle(world, x, y, z, velocityX, velocityY, velocityZ, sprites, random);
        }
    }

    public static final class BeatRingFactory implements ParticleFactory<SimpleParticleType> {
        private final SpriteProvider sprites;

        public BeatRingFactory(SpriteProvider sprites) {
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
            return new BeatRingParticle(world, x, y, z, velocityX, velocityY, velocityZ, sprites, random);
        }
    }

    public static final class BeamMoteFactory implements ParticleFactory<SimpleParticleType> {
        private final SpriteProvider sprites;

        public BeamMoteFactory(SpriteProvider sprites) {
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
            return new BeamMoteParticle(world, x, y, z, velocityX, velocityY, velocityZ, sprites, random);
        }
    }

    public static final class DissonanzSmokeFactory implements ParticleFactory<SimpleParticleType> {
        private final SpriteProvider sprites;

        public DissonanzSmokeFactory(SpriteProvider sprites) {
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
            return new DissonanzSmokeParticle(world, x, y, z, velocityX, velocityY, velocityZ, sprites, random);
        }
    }
}
