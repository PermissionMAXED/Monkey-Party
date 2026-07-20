package de.aetherklang.leitmotiv;

import de.aetherklang.Aetherklang;
import de.aetherklang.network.ModNetworking;
import de.aetherklang.registry.ModCriteria;
import de.aetherklang.registry.ModItems;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.ResonancePlayerData;
import java.util.Map;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

/**
 * Owns currency rewards, prerequisite checks, unlocks and client synchronization.
 */
public final class LeitmotivService {
    private static final Map<String, Integer> BOSS_KEY_REWARDS = Map.of(
            "choral", 3,
            "sirene", 2,
            "boss_tremolo", 2,
            "boss_glissanda", 2,
            "boss_kakophon", 2,
            "boss_generalpause", 3,
            "boss_ostinato", 2,
            "boss_ritardando", 2
    );

    private LeitmotivService() {
    }

    public static void register() {
        ServerLivingEntityEvents.AFTER_DEATH.register((entity, damageSource) -> {
            Integer reward = BOSS_KEY_REWARDS.get(Registries.ENTITY_TYPE.getId(entity.getType()).getPath());
            if (reward != null && damageSource.getAttacker() instanceof ServerPlayerEntity player) {
                grantBossKeys(player, reward);
            }
        });
        Aetherklang.LOGGER.info(
                "Leitmotiv skill tree ready: {} nodes across {} branches",
                LeitmotivTree.all().size(),
                LeitmotivBranch.values().length
        );
    }

    public static void unlock(ServerPlayerEntity player, String nodeId) {
        LeitmotivNode node = LeitmotivTree.byId(nodeId).orElse(null);
        if (node == null) {
            player.sendMessage(Text.translatable("message.aetherklang.leitmotiv.unknown"), true);
            sync(player);
            return;
        }

        ResonancePlayerData data = ResonanceApi.getData(player);
        if (data.isLeitmotivNodeUnlocked(node.id())) {
            player.sendMessage(
                    Text.translatable("message.aetherklang.leitmotiv.already_unlocked", Text.translatable(node.titleKey())),
                    true
            );
            sync(player);
            return;
        }
        if (!hasPrerequisites(data, node)) {
            player.sendMessage(Text.translatable("message.aetherklang.leitmotiv.prerequisite"), true);
            sync(player);
            return;
        }
        if (!consumeKeys(player, node.cost())) {
            player.sendMessage(Text.translatable("message.aetherklang.leitmotiv.keys_missing", node.cost()), true);
            sync(player);
            return;
        }

        data.unlockLeitmotivNode(node.id());
        player.sendMessage(
                Text.translatable("message.aetherklang.leitmotiv.unlocked", Text.translatable(node.titleKey())),
                false
        );
        ResonanceApi.sync(player);
        sync(player);
        ModCriteria.FIRST_LEITMOTIV.trigger(player);
        if (node.tier() == LeitmotivTree.NODES_PER_BRANCH - 1) {
            ModCriteria.LEITMOTIV_FINALE.trigger(player);
        }
    }

    public static void grantAdvancementKey(ServerPlayerEntity player, String rewardId) {
        ResonancePlayerData data = ResonanceApi.getData(player);
        if (!data.claimLeitmotivReward("advancement/" + rewardId)) {
            return;
        }
        grantKeys(player, 1, "message.aetherklang.leitmotiv.reward.advancement");
    }

    public static void grantBossKeys(ServerPlayerEntity player, int amount) {
        grantKeys(player, amount, "message.aetherklang.leitmotiv.reward.boss");
    }

    public static int countKeys(ServerPlayerEntity player) {
        int count = 0;
        for (int slot = 0; slot < player.getInventory().size(); slot++) {
            ItemStack stack = player.getInventory().getStack(slot);
            if (stack.isOf(ModItems.NOTENSCHLUESSEL)) {
                count += stack.getCount();
            }
        }
        return count;
    }

    public static boolean hasPrerequisites(ResonancePlayerData data, LeitmotivNode node) {
        return node.prerequisites().stream().allMatch(data::isLeitmotivNodeUnlocked);
    }

    public static void sync(ServerPlayerEntity player) {
        ModNetworking.sendLeitmotivSync(player, ResonanceApi.getData(player), countKeys(player));
    }

    private static void grantKeys(ServerPlayerEntity player, int amount, String messageKey) {
        if (amount <= 0) {
            return;
        }
        player.giveOrDropStack(new ItemStack(ModItems.NOTENSCHLUESSEL, amount));
        player.sendMessage(Text.translatable(messageKey, amount), false);
        sync(player);
    }

    private static boolean consumeKeys(ServerPlayerEntity player, int amount) {
        if (player.isCreative()) {
            return true;
        }
        if (countKeys(player) < amount) {
            return false;
        }

        int remaining = amount;
        for (int slot = 0; slot < player.getInventory().size() && remaining > 0; slot++) {
            ItemStack stack = player.getInventory().getStack(slot);
            if (!stack.isOf(ModItems.NOTENSCHLUESSEL)) {
                continue;
            }
            int consumed = Math.min(remaining, stack.getCount());
            stack.decrement(consumed);
            remaining -= consumed;
        }
        player.getInventory().markDirty();
        return true;
    }
}
