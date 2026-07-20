package de.aetherklang.client.fx;

import de.aetherklang.Aetherklang;
import de.aetherklang.crescendo.AuroraHooks;
import de.aetherklang.entity.FermateFeldEntity;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.entity.Entity;
import net.minecraft.util.math.MathHelper;

/**
 * Chromatic perfect-streak ripples and the Fermata field's suspended-color wash.
 */
public final class ScreenRippleFx {
    private static final int RIPPLE_SEGMENTS = 96;

    private static boolean registered;
    private static int lastPerfectBeat = Integer.MIN_VALUE;
    private static int perfectStreak;
    private static float rippleLife;
    private static float rippleStrength;
    private static float fermateTint;

    private ScreenRippleFx() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        HudElementRegistry.addLast(Aetherklang.id("chromatic_ripple"), (context, tickCounter) -> render(context));
        ClientTickEvents.END_CLIENT_TICK.register(ScreenRippleFx::tick);
    }

    /**
     * Applies an authoritative perfect-timing confirmation from the server.
     */
    public static void onPerfect(int beat, int streak) {
        if (beat == lastPerfectBeat || streak <= 0) {
            return;
        }

        lastPerfectBeat = beat;
        perfectStreak = streak;
        if (perfectStreak >= AuroraHooks.MIN_RIPPLE_STREAK) {
            rippleLife = 1.0F;
            rippleStrength = MathHelper.clamp(0.72F + perfectStreak * 0.08F, 0.0F, 1.0F);
        }
    }

    private static void tick(MinecraftClient client) {
        rippleLife *= 0.86F;
        if (rippleLife < 0.008F) {
            rippleLife = 0.0F;
        }

        float targetTint = findFermateTint(client);
        fermateTint = MathHelper.lerp(targetTint > fermateTint ? 0.18F : 0.08F, fermateTint, targetTint);
        if (client.world == null) {
            lastPerfectBeat = Integer.MIN_VALUE;
            perfectStreak = 0;
        }
    }

    private static float findFermateTint(MinecraftClient client) {
        if (client.world == null || client.player == null) {
            return 0.0F;
        }

        double radius = AuroraHooks.FERMATE_TINT_RADIUS;
        double nearestSquared = radius * radius;
        for (Entity entity : client.world.getOtherEntities(
                client.player,
                client.player.getBoundingBox().expand(radius),
                candidate -> candidate instanceof FermateFeldEntity
        )) {
            nearestSquared = Math.min(nearestSquared, entity.squaredDistanceTo(client.player));
        }
        if (nearestSquared >= radius * radius) {
            return 0.0F;
        }
        return 1.0F - MathHelper.sqrt((float) nearestSquared) / (float) radius;
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.world == null || client.currentScreen != null) {
            return;
        }

        int width = client.getWindow().getScaledWidth();
        int height = client.getWindow().getScaledHeight();
        if (fermateTint > 0.01F) {
            drawFermateTint(context, width, height, fermateTint, client.world.getTime());
        }
        if (rippleLife > 0.01F) {
            drawRipple(context, width, height);
        }
    }

    private static void drawFermateTint(DrawContext context, int width, int height, float tint, long time) {
        int washAlpha = MathHelper.clamp(Math.round(tint * 56.0F), 0, 56);
        int indigoAlpha = MathHelper.clamp(Math.round(tint * 31.0F), 0, 31);
        context.fill(0, 0, width, height, FxPalette.withAlpha(0xB4B4C3, washAlpha));
        context.fill(0, 0, width, height, FxPalette.withAlpha(FxPalette.INDIGO, indigoAlpha));

        int scanAlpha = Math.max(1, washAlpha / 5);
        int offset = (int) (time & 3L);
        for (int y = offset; y < height; y += 4) {
            context.fill(0, y, width, y + 1, FxPalette.withAlpha(FxPalette.CYAN, scanAlpha));
        }
    }

    private static void drawRipple(DrawContext context, int width, int height) {
        float elapsed = 1.0F - rippleLife;
        float eased = 1.0F - (1.0F - elapsed) * (1.0F - elapsed);
        float maximum = MathHelper.sqrt(width * width + height * height) * 0.62F;
        float radius = MathHelper.lerp(eased, 8.0F, maximum);
        int alpha = MathHelper.clamp(Math.round(rippleLife * rippleStrength * 205.0F), 0, 205);
        int centerX = width / 2;
        int centerY = height / 2;

        drawRing(context, centerX - 2, centerY, radius + 4.0F, FxPalette.MAGENTA, alpha / 2);
        drawRing(context, centerX + 2, centerY - 1, radius, FxPalette.CYAN, alpha);
        drawRing(context, centerX, centerY + 2, radius - 4.0F, FxPalette.GOLD, alpha * 3 / 4);

        if (perfectStreak >= 4) {
            drawRing(
                    context,
                    centerX,
                    centerY,
                    radius * 0.62F,
                    perfectStreak % 2 == 0 ? FxPalette.CYAN : FxPalette.GOLD,
                    alpha / 2
            );
        }
    }

    private static void drawRing(
            DrawContext context,
            int centerX,
            int centerY,
            float radius,
            int color,
            int alpha
    ) {
        if (radius <= 0.0F || alpha <= 0) {
            return;
        }
        for (int segment = 0; segment < RIPPLE_SEGMENTS; segment++) {
            double angle = segment * Math.PI * 2.0D / RIPPLE_SEGMENTS;
            int x = centerX + Math.round((float) Math.cos(angle) * radius);
            int y = centerY + Math.round((float) Math.sin(angle) * radius);
            int size = segment % 6 == 0 ? 3 : 2;
            context.fill(x, y, x + size, y + size, FxPalette.withAlpha(color, alpha));
        }
    }
}
