package de.aetherklang.kaskade;

import de.aetherklang.registry.ModItems;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.minecraft.item.ItemStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

/**
 * Assigns an ensemble register from the instrument each member is playing.
 */
public final class StimmlagenService {
    private static final Map<UUID, Stimmlage> ASSIGNMENTS = new HashMap<>();

    private StimmlagenService() {
    }

    public static Map<UUID, Stimmlage> assign(MinecraftServer server, Set<UUID> memberIds) {
        List<ServerPlayerEntity> members = memberIds.stream()
                .map(server.getPlayerManager()::getPlayer)
                .filter(java.util.Objects::nonNull)
                .filter(ServerPlayerEntity::isAlive)
                .sorted(Comparator.comparing(ServerPlayerEntity::getUuid))
                .toList();
        Map<UUID, Stimmlage> result = new HashMap<>();
        Map<Stimmlage, Integer> counts = new EnumMap<>(Stimmlage.class);
        for (Stimmlage voice : Stimmlage.values()) {
            counts.put(voice, 0);
        }

        List<ServerPlayerEntity> unvoiced = new ArrayList<>();
        for (ServerPlayerEntity member : members) {
            Stimmlage preferred = preferredVoice(member);
            if (preferred == null) {
                unvoiced.add(member);
                continue;
            }
            result.put(member.getUuid(), preferred);
            counts.compute(preferred, (ignored, count) -> count + 1);
        }
        for (ServerPlayerEntity member : unvoiced) {
            Stimmlage balanced = counts.entrySet().stream()
                    .min(Map.Entry.<Stimmlage, Integer>comparingByValue()
                            .thenComparing(entry -> entry.getKey().ordinal()))
                    .orElseThrow()
                    .getKey();
            result.put(member.getUuid(), balanced);
            counts.compute(balanced, (ignored, count) -> count + 1);
        }

        for (ServerPlayerEntity member : members) {
            Stimmlage voice = result.get(member.getUuid());
            Stimmlage previous = ASSIGNMENTS.put(member.getUuid(), voice);
            if (voice != previous) {
                member.sendMessage(
                        Text.translatable(
                                "message.aetherklang.stimmlage.assigned",
                                Text.translatable(voice.getTranslationKey())
                        ),
                        true
                );
            }
        }
        ASSIGNMENTS.keySet().removeIf(id -> !memberIds.contains(id)
                && server.getPlayerManager().getPlayer(id) == null);
        return Map.copyOf(result);
    }

    public static Stimmlage get(UUID playerId) {
        return ASSIGNMENTS.get(playerId);
    }

    public static void removePlayer(UUID playerId) {
        ASSIGNMENTS.remove(playerId);
    }

    public static void clear() {
        ASSIGNMENTS.clear();
    }

    private static Stimmlage preferredVoice(ServerPlayerEntity player) {
        Stimmlage mainHand = voiceFor(player.getMainHandStack());
        return mainHand != null ? mainHand : voiceFor(player.getOffHandStack());
    }

    static Stimmlage voiceFor(ItemStack stack) {
        if (stack.isOf(ModItems.SOPRANFLOETE)
                || stack.isOf(ModItems.TRIANGEL)
                || stack.isOf(ModItems.STIMMGABEL)) {
            return Stimmlage.SOPRAN;
        }
        if (stack.isOf(ModItems.HALLHARFE)
                || stack.isOf(ModItems.FERMATENGLOCKE)) {
            return Stimmlage.ALT;
        }
        if (stack.isOf(ModItems.RESONANZKLINGE)
                || stack.isOf(ModItems.ORGELHORN)) {
            return Stimmlage.TENOR;
        }
        if (stack.isOf(ModItems.BASSHAMMER)
                || stack.isOf(ModItems.KONTRABASS)
                || stack.isOf(ModItems.PAUKE)) {
            return Stimmlage.BASS;
        }
        return null;
    }
}
