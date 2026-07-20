package de.aetherklang.partitur;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModAttachments;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.AkkordEngine;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.world.KammertonWorld;
import java.util.List;
import java.util.Locale;
import net.fabricmc.fabric.api.entity.event.v1.ServerEntityCombatEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/**
 * Server-authoritative rotation, progress, and reward handling for Partitur.
 */
public final class PartiturService {
    public static final long ROTATION_TICKS = 24_000L;
    private static final int REGION_CHECK_INTERVAL = 20;
    private static final int GARDEN_CENTER_Z = 272;
    private static final int GARDEN_RADIUS = 88;
    private static boolean registered;

    private PartiturService() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerEntityCombatEvents.AFTER_KILLED_OTHER_ENTITY.register(PartiturService::onKill);
        ServerTickEvents.END_SERVER_TICK.register(PartiturService::tick);
        ServerPlayConnectionEvents.JOIN.register(
                (handler, sender, server) -> sync(handler.getPlayer(), false)
        );
        Aetherklang.LOGGER.debug("Registered Partitur progress hooks");
    }

    public static PartiturPlayerData getData(ServerPlayerEntity player) {
        return player.getAttachedOrCreate(ModAttachments.PARTITUR);
    }

    public static void open(ServerPlayerEntity player) {
        if (player.isAlive() && !player.isSpectator()) {
            sync(player, true);
        }
    }

    public static void onAkkord(ServerPlayerEntity player, AkkordEngine.Akkord akkord) {
        record(player, AuftragObjective.PLAY_AKKORD, akkord.name().toLowerCase(Locale.ROOT));
    }

    public static void onRiftSealed(ServerPlayerEntity player) {
        record(player, AuftragObjective.SEAL_RIFT, "any");
    }

    public static void record(ServerPlayerEntity player, AuftragObjective objective, String target) {
        record(player, objective, target, 1);
    }

    public static void record(ServerPlayerEntity player, AuftragObjective objective, String target, int amount) {
        if (amount <= 0) {
            return;
        }
        PartiturPlayerData data = prepare(player);
        boolean changed = false;
        for (String id : data.activeIds()) {
            AuftragDef definition = PartiturCatalog.get(id);
            if (definition == null || !definition.matches(objective, target)) {
                continue;
            }
            int previous = data.progress(id);
            if (data.advance(definition, amount)) {
                changed = true;
                if (previous < definition.amount() && data.progress(id) >= definition.amount()) {
                    player.sendMessage(
                            Text.translatable(
                                    "message.aetherklang.partitur.complete",
                                    Text.translatable(definition.titleKey())
                            ),
                            true
                    );
                }
            }
        }
        if (changed) {
            PartiturNetworking.send(player, false);
        }
    }

    public static void claim(ServerPlayerEntity player, String contractId) {
        PartiturPlayerData data = prepare(player);
        AuftragDef definition = PartiturCatalog.get(contractId);
        if (definition == null || !data.claim(definition)) {
            PartiturNetworking.send(player, false);
            return;
        }

        if (definition.rewardRp() > 0) {
            ResonanceApi.addRp(player, definition.rewardRp());
        }
        give(player, new ItemStack(ModItems.NOTENSCHLUESSEL, definition.rewardNotenschluessel()));
        if (definition.rewardMaterial() != null && definition.rewardMaterialCount() > 0) {
            give(
                    player,
                    new ItemStack(
                            Registries.ITEM.get(definition.rewardMaterial()),
                            definition.rewardMaterialCount()
                    )
            );
        }
        player.getEntityWorld().playSound(
                null,
                player.getBlockPos(),
                ModSounds.ARCHIV_UNLOCK,
                SoundCategory.PLAYERS,
                0.8F,
                1.25F
        );
        player.sendMessage(
                Text.translatable(
                        "message.aetherklang.partitur.claimed",
                        Text.translatable(definition.titleKey())
                ),
                false
        );
        PartiturNetworking.send(player, false);
    }

    public static PartiturPayloads.SyncPayload snapshot(ServerPlayerEntity player, boolean openScreen) {
        PartiturPlayerData data = prepare(player);
        List<PartiturPayloads.Entry> entries = data.activeIds().stream()
                .map(PartiturCatalog::get)
                .filter(definition -> definition != null)
                .map(definition -> new PartiturPayloads.Entry(
                        definition.id(),
                        definition.titleKey(),
                        definition.descriptionKey(),
                        definition.objective().asString(),
                        data.progress(definition.id()),
                        definition.amount(),
                        definition.rewardRp(),
                        definition.rewardNotenschluessel(),
                        definition.rewardMaterial() == null ? "" : definition.rewardMaterial().toString(),
                        definition.rewardMaterialCount(),
                        data.isClaimed(definition.id())
                ))
                .toList();
        return new PartiturPayloads.SyncPayload(
                openScreen,
                data.rotation(),
                ticksRemaining(player.getEntityWorld().getServer()),
                entries
        );
    }

    private static void onKill(
            ServerWorld world,
            Entity killer,
            LivingEntity killed,
            net.minecraft.entity.damage.DamageSource damageSource
    ) {
        if (!(killer instanceof ServerPlayerEntity player)) {
            return;
        }
        Identifier id = Registries.ENTITY_TYPE.getId(killed.getType());
        if (id != null
                && id.getNamespace().equals(Aetherklang.MOD_ID)
                && id.getPath().startsWith("motiv_")) {
            record(player, AuftragObjective.KILL_MOTIV, id.getPath());
        }
    }

    private static void tick(MinecraftServer server) {
        if (server.getTicks() % REGION_CHECK_INTERVAL != 0) {
            return;
        }
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            PartiturPlayerData data = getData(player);
            boolean rotated = data.ensureRotation(currentRotation(server), currentContracts(server));
            if (rotated) {
                PartiturNetworking.send(player, false);
            }
            recordVisitedRegions(player);
        }
    }

    private static void recordVisitedRegions(ServerPlayerEntity player) {
        if (!KammertonWorld.isKammerton(player.getEntityWorld())) {
            return;
        }
        record(player, AuftragObjective.VISIT_REGION, "kammerton");
        if (Math.abs(player.getX()) <= GARDEN_RADIUS
                && Math.abs(player.getZ() - GARDEN_CENTER_Z) <= GARDEN_RADIUS) {
            record(player, AuftragObjective.VISIT_REGION, "resonanzgarten");
        }
    }

    private static PartiturPlayerData prepare(ServerPlayerEntity player) {
        PartiturPlayerData data = getData(player);
        MinecraftServer server = player.getEntityWorld().getServer();
        data.ensureRotation(currentRotation(server), currentContracts(server));
        return data;
    }

    private static List<AuftragDef> currentContracts(MinecraftServer server) {
        return PartiturCatalog.rotation(currentRotation(server));
    }

    private static long currentRotation(MinecraftServer server) {
        return Math.floorDiv(server.getOverworld().getTimeOfDay(), ROTATION_TICKS);
    }

    private static int ticksRemaining(MinecraftServer server) {
        long elapsed = Math.floorMod(server.getOverworld().getTimeOfDay(), ROTATION_TICKS);
        return (int) (ROTATION_TICKS - elapsed);
    }

    private static void sync(ServerPlayerEntity player, boolean openScreen) {
        PartiturNetworking.send(player, openScreen);
    }

    private static void give(ServerPlayerEntity player, ItemStack stack) {
        if (stack.isEmpty()) {
            return;
        }
        player.getInventory().insertStack(stack);
        if (!stack.isEmpty()) {
            player.dropItem(stack, false);
        }
    }
}
