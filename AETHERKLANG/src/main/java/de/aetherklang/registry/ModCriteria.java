package de.aetherklang.registry;

import com.mojang.serialization.Codec;
import de.aetherklang.Aetherklang;
import net.minecraft.advancement.criterion.AbstractCriterion;
import net.minecraft.advancement.criterion.TickCriterion;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.server.network.ServerPlayerEntity;

public final class ModCriteria {
    public static final ActionCriterion PERFECT_BEAT =
            register("perfect_beat", new ActionCriterion());
    public static final ActionCriterion KODEX_OPENED =
            register("kodex_opened", new ActionCriterion());

    private ModCriteria() {
    }

    private static <T extends ActionCriterion> T register(String path, T criterion) {
        return Registry.register(Registries.CRITERION, Aetherklang.id(path), criterion);
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered Aetherklang advancement criteria");
    }

    public static final class ActionCriterion extends AbstractCriterion<TickCriterion.Conditions> {
        @Override
        public Codec<TickCriterion.Conditions> getConditionsCodec() {
            return TickCriterion.Conditions.CODEC;
        }

        public void trigger(ServerPlayerEntity player) {
            trigger(player, conditions -> true);
        }
    }
}
