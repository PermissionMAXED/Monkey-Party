package de.aetherklang.insel.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.crescendo.AuroraHooks;
import de.aetherklang.registry.ModPayloads;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.text.Text;
import net.minecraft.util.math.MathHelper;

/**
 * Client-owned view of the authoritative {@code region_sync} stream.
 */
public final class ClientRegionState {
    private static final double REGION_EXIT_RADIUS_SQUARED = 440.0D * 440.0D;

    private static String regionId;
    private static int anchorX;
    private static int anchorY;
    private static int anchorZ;
    private static int revealTicks;

    private ClientRegionState() {
    }

    public static void accept(ModPayloads.RegionSyncPayload payload) {
        regionId = payload.region();
        anchorX = payload.anchorX();
        anchorY = payload.anchorY();
        anchorZ = payload.anchorZ();
        revealTicks = 100;
    }

    public static void tick(MinecraftClient client) {
        if (revealTicks > 0) {
            revealTicks--;
        }
        if (regionId == null || client.player == null || client.world == null) {
            return;
        }
        if (!isKammerton(client.world)) {
            clear();
            return;
        }

        double deltaX = client.player.getX() - anchorX;
        double deltaZ = client.player.getZ() - anchorZ;
        if (deltaX * deltaX + deltaZ * deltaZ > REGION_EXIT_RADIUS_SQUARED) {
            clear();
        }
    }

    public static String regionId() {
        return regionId;
    }

    public static Text displayName() {
        return regionId == null
                ? Text.empty()
                : Text.translatable("region.aetherklang." + regionId);
    }

    public static Text sectorName() {
        return regionId == null
                ? Text.empty()
                : Text.translatable("region.aetherklang." + regionId + ".sector");
    }

    public static boolean isActive() {
        return regionId != null;
    }

    public static float reveal() {
        if (revealTicks <= 0) {
            return 0.0F;
        }
        float fadeIn = MathHelper.clamp((100 - revealTicks) / 12.0F, 0.0F, 1.0F);
        float fadeOut = MathHelper.clamp(revealTicks / 18.0F, 0.0F, 1.0F);
        return Math.min(fadeIn, fadeOut);
    }

    public static int anchorX() {
        return anchorX;
    }

    public static int anchorY() {
        return anchorY;
    }

    public static int anchorZ() {
        return anchorZ;
    }

    private static void clear() {
        regionId = null;
        revealTicks = 0;
    }

    private static boolean isKammerton(ClientWorld world) {
        return world.getRegistryKey().getValue().equals(Aetherklang.id(AuroraHooks.KAMMERTON_PATH));
    }
}
