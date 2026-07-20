package de.aetherklang.schmiede;

import de.aetherklang.registry.ModCriteria;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.Map;
import java.util.Optional;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;

/**
 * Atomic upgrade and socket operations performed by the Klangamboss.
 */
public final class SchmiedeService {
    private SchmiedeService() {
    }

    public static boolean work(
            ServerWorld world,
            BlockPos pos,
            ServerPlayerEntity player,
            ItemStack instrument,
            ItemStack socketCandidate
    ) {
        Optional<ReliktTyp> relic = ReliktTyp.fromStack(socketCandidate);
        if (relic.isPresent()) {
            return socket(world, pos, player, instrument, socketCandidate, relic.get());
        }
        return upgrade(world, pos, player, instrument);
    }

    private static boolean socket(
            ServerWorld world,
            BlockPos pos,
            ServerPlayerEntity player,
            ItemStack instrument,
            ItemStack relicStack,
            ReliktTyp relic
    ) {
        ReliktTyp existing = instrument.get(SchmiedeComponents.RELIKT);
        if (existing != null) {
            player.sendMessage(
                    Text.translatable(
                            "message.aetherklang.schmiede.socket_occupied",
                            Text.translatable(existing.translationKey())
                    ),
                    true
            );
            return false;
        }

        instrument.set(SchmiedeComponents.RELIKT, relic);
        if (!player.isCreative()) {
            relicStack.decrement(1);
        }
        world.spawnParticles(
                ModParticles.RELIKT_AURA,
                pos.getX() + 0.5D,
                pos.getY() + 1.0D,
                pos.getZ() + 0.5D,
                32,
                0.55D,
                0.35D,
                0.55D,
                0.04D
        );
        world.playSound(null, pos, ModSounds.RELIKT_ACTIVATE, SoundCategory.BLOCKS, 1.0F, 1.15F);
        player.sendMessage(
                Text.translatable(
                        "message.aetherklang.schmiede.socketed",
                        instrument.getName(),
                        Text.translatable(relic.translationKey())
                ),
                false
        );
        ModCriteria.RELIC_SOCKETED.trigger(player);
        return true;
    }

    private static boolean upgrade(
            ServerWorld world,
            BlockPos pos,
            ServerPlayerEntity player,
            ItemStack instrument
    ) {
        Optional<Aufwertungsrezept> match = SchmiedeRezepte.find(instrument);
        if (match.isEmpty()) {
            Klangstufe tier = SchmiedeComponents.getTier(instrument);
            String message = tier == Klangstufe.VIRTUOS
                    ? "message.aetherklang.schmiede.max_tier"
                    : "message.aetherklang.schmiede.no_recipe";
            player.sendMessage(Text.translatable(message), true);
            return false;
        }

        Aufwertungsrezept recipe = match.get();
        if (!player.isCreative() && !hasIngredients(player.getInventory(), recipe.ingredients())) {
            player.sendMessage(
                    Text.translatable(
                            "message.aetherklang.schmiede.missing",
                            requirements(recipe.ingredients())
                    ),
                    true
            );
            return false;
        }

        if (!player.isCreative()) {
            consumeIngredients(player.getInventory(), recipe.ingredients());
        }
        instrument.set(SchmiedeComponents.KLANGSTUFE, recipe.to());
        world.spawnParticles(
                ModParticles.KLANGOPERATION_RING,
                pos.getX() + 0.5D,
                pos.getY() + 1.05D,
                pos.getZ() + 0.5D,
                28,
                0.7D,
                0.25D,
                0.7D,
                0.06D
        );
        world.playSound(
                null,
                pos,
                SoundEvents.BLOCK_ANVIL_USE,
                SoundCategory.BLOCKS,
                1.0F,
                recipe.to() == Klangstufe.VIRTUOS ? 1.35F : 1.1F
        );
        player.sendMessage(
                Text.translatable(
                        "message.aetherklang.schmiede.upgraded",
                        instrument.getName(),
                        Text.translatable(recipe.to().translationKey())
                ),
                false
        );
        ModCriteria.FIRST_UPGRADE.trigger(player);
        if (recipe.to() == Klangstufe.VIRTUOS) {
            ModCriteria.VIRTUOS_UPGRADE.trigger(player);
        }
        return true;
    }

    private static boolean hasIngredients(PlayerInventory inventory, Map<Item, Integer> ingredients) {
        for (Map.Entry<Item, Integer> ingredient : ingredients.entrySet()) {
            int available = 0;
            for (int slot = 0; slot < inventory.size(); slot++) {
                ItemStack stack = inventory.getStack(slot);
                if (stack.isOf(ingredient.getKey())) {
                    available += stack.getCount();
                }
            }
            if (available < ingredient.getValue()) {
                return false;
            }
        }
        return true;
    }

    private static void consumeIngredients(PlayerInventory inventory, Map<Item, Integer> ingredients) {
        for (Map.Entry<Item, Integer> ingredient : ingredients.entrySet()) {
            int remaining = ingredient.getValue();
            for (int slot = 0; slot < inventory.size() && remaining > 0; slot++) {
                ItemStack stack = inventory.getStack(slot);
                if (!stack.isOf(ingredient.getKey())) {
                    continue;
                }
                int consumed = Math.min(remaining, stack.getCount());
                stack.decrement(consumed);
                remaining -= consumed;
            }
        }
        inventory.markDirty();
    }

    private static Text requirements(Map<Item, Integer> ingredients) {
        MutableText text = Text.empty();
        boolean first = true;
        for (Map.Entry<Item, Integer> ingredient : ingredients.entrySet()) {
            if (!first) {
                text.append(Text.literal(" · "));
            }
            text.append(Text.literal(ingredient.getValue() + "× "))
                    .append(ingredient.getKey().getName());
            first = false;
        }
        return text;
    }
}
