package de.aetherklang.item;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModParticles;
import java.util.Locale;
import net.minecraft.block.Block;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

public final class StimmgabelItem extends Item {
    private static final int SCAN_RADIUS = 8;

    public StimmgabelItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity player, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        ItemStack stack = player.getStackInHand(hand);
        BlockPos origin = player.getBlockPos();
        int sourceCount = 0;
        double nearestDistance = Double.MAX_VALUE;
        Text nearestName = null;

        for (int x = -SCAN_RADIUS; x <= SCAN_RADIUS; x++) {
            for (int y = -4; y <= 4; y++) {
                for (int z = -SCAN_RADIUS; z <= SCAN_RADIUS; z++) {
                    BlockPos pos = origin.add(x, y, z);
                    Block block = serverWorld.getBlockState(pos).getBlock();
                    if (!isResonanceSource(block)) {
                        continue;
                    }

                    sourceCount++;
                    double distance = Math.sqrt(origin.getSquaredDistance(pos));
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestName = block.getName();
                    }
                    if (sourceCount <= 24) {
                        serverWorld.spawnParticles(
                                ModParticles.NOTE_SPARK,
                                pos.getX() + 0.5,
                                pos.getY() + 1.1,
                                pos.getZ() + 0.5,
                                3,
                                0.2,
                                0.2,
                                0.2,
                                0.02
                        );
                    }
                }
            }
        }

        ResonanceItemUtil.setSilence(player);
        if (ResonanceItemUtil.isOnBeat(player)) {
            ResonanceItemUtil.gainRp(player, 3);
        }

        if (sourceCount == 0) {
            player.sendMessage(Text.translatable("message.aetherklang.stimmgabel.empty"), true);
        } else {
            player.sendMessage(
                    Text.translatable(
                            "message.aetherklang.stimmgabel.scan",
                            sourceCount,
                            nearestName,
                            String.format(Locale.ROOT, "%.1f", nearestDistance)
                    ),
                    true
            );
        }

        ResonanceItemUtil.playCast(serverWorld, player, 1.35F);
        player.getItemCooldownManager().set(stack, 20);
        return ActionResult.SUCCESS_SERVER;
    }

    private static boolean isResonanceSource(Block block) {
        Identifier id = Registries.BLOCK.getId(block);
        if (!id.getNamespace().equals(Aetherklang.MOD_ID)) {
            return false;
        }
        String path = id.getPath();
        return path.startsWith("resonanzkristall")
                || path.equals("stimmaltar")
                || path.equals("dissonanzriss")
                || path.equals("glockenspiel_portal");
    }
}
