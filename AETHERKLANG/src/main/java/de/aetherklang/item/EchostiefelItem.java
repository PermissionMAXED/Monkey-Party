package de.aetherklang.item;

import de.aetherklang.leitmotiv.LeitmotivEffects;
import de.aetherklang.registry.ModParticles;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class EchostiefelItem extends Item {
    private static final int DASH_COST = 8;
    private static final int DASH_COOLDOWN_TICKS = 60;

    public EchostiefelItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity player, Hand hand) {
        if (!player.isSneaking()) {
            return super.use(world, player, hand);
        }
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        ItemStack stack = player.getStackInHand(hand);
        if (player.getItemCooldownManager().isCoolingDown(stack)) {
            return ActionResult.FAIL;
        }
        int dashCost = player instanceof ServerPlayerEntity serverPlayer
                ? LeitmotivEffects.adjustDashCost(serverPlayer, DASH_COST)
                : DASH_COST;
        if (!ResonanceItemUtil.spendRp(player, dashCost)) {
            player.sendMessage(Text.translatable("message.aetherklang.rp.missing", dashCost), true);
            return ActionResult.FAIL;
        }

        Vec3d look = player.getRotationVector().multiply(1.0, 0.0, 1.0);
        if (look.lengthSquared() < 0.01) {
            look = Vec3d.of(player.getHorizontalFacing().getVector());
        }
        Vec3d dash = look.normalize().multiply(1.65);
        double vertical = player.isOnGround() ? 0.28 : Math.max(player.getVelocity().y, 0.05);
        player.setVelocity(dash.x, vertical, dash.z);
        player.velocityModified = true;

        Vec3d start = player.getEntityPos().add(0.0, 0.35, 0.0);
        for (int step = 0; step < 9; step++) {
            Vec3d trail = start.subtract(dash.normalize().multiply(step * 0.32));
            serverWorld.spawnParticles(
                    ModParticles.NOTE_SPARK,
                    trail.x,
                    trail.y,
                    trail.z,
                    3,
                    0.12,
                    0.14,
                    0.12,
                    0.03
            );
            serverWorld.spawnParticles(
                    ResonanceItemUtil.moodDust(player, 0.85F),
                    trail.x,
                    trail.y,
                    trail.z,
                    1,
                    0.05,
                    0.05,
                    0.05,
                    0.0
            );
        }

        ResonanceItemUtil.playCast(serverWorld, player, 1.8F);
        stack.damage(1, player);
        player.getItemCooldownManager().set(stack, DASH_COOLDOWN_TICKS);
        return ActionResult.SUCCESS_SERVER;
    }
}
