package de.aetherklang.block;

import de.aetherklang.registry.ModBlockEntities;
import java.util.Locale;
import net.minecraft.block.BlockState;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.network.listener.ClientPlayPacketListener;
import net.minecraft.network.packet.Packet;
import net.minecraft.network.packet.s2c.play.BlockEntityUpdateS2CPacket;
import net.minecraft.registry.RegistryWrapper;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;
import org.jetbrains.annotations.Nullable;

/**
 * Stores the live readout displayed by a crystal resonator's hologram.
 */
public final class KristallresonatorBlockEntity extends BlockEntity {
    private static final String MODE_KEY = "hologram_mode";
    private static final String CRYSTALS_KEY = "nearby_crystals";
    private static final String RECHARGE_END_KEY = "recharge_end_tick";
    private static final int SCAN_INTERVAL_TICKS = 20;

    private HologramMode hologramMode = HologramMode.STATUS;
    private int nearbyCrystals;
    private long rechargeEndTick;

    public KristallresonatorBlockEntity(BlockPos pos, BlockState state) {
        super(ModBlockEntities.KRISTALLRESONATOR, pos, state);
    }

    public HologramMode getHologramMode() {
        return hologramMode;
    }

    public int getNearbyCrystals() {
        return nearbyCrystals;
    }

    public int getProjectedReward() {
        return KristallresonatorBlock.rewardFor(nearbyCrystals);
    }

    public int getRechargeTicks() {
        if (world == null || rechargeEndTick <= 0L) {
            return 0;
        }
        return (int) Math.min(Integer.MAX_VALUE, Math.max(0L, rechargeEndTick - world.getTime()));
    }

    public HologramMode cycleHologramMode() {
        hologramMode = hologramMode.next();
        sync();
        return hologramMode;
    }

    public void beginRecharge(long endTick) {
        rechargeEndTick = endTick;
        sync();
    }

    public void finishRecharge() {
        rechargeEndTick = 0L;
        sync();
    }

    public int refreshCrystalCount(World world) {
        setNearbyCrystals(KristallresonatorBlock.countCrystals(world, pos));
        return nearbyCrystals;
    }

    public static void tick(
            World world,
            BlockPos pos,
            BlockState state,
            KristallresonatorBlockEntity resonator
    ) {
        if (world.isClient()
                || Math.floorMod(world.getTime() + pos.asLong(), SCAN_INTERVAL_TICKS) != 0L) {
            return;
        }
        resonator.refreshCrystalCount(world);
    }

    private void setNearbyCrystals(int crystals) {
        if (nearbyCrystals == crystals) {
            return;
        }
        nearbyCrystals = crystals;
        sync();
    }

    private void sync() {
        markDirty();
        if (world instanceof ServerWorld serverWorld) {
            serverWorld.getChunkManager().markForUpdate(pos);
        }
    }

    @Override
    protected void readData(ReadView view) {
        super.readData(view);
        hologramMode = HologramMode.fromId(view.getString(MODE_KEY, HologramMode.STATUS.asString()));
        nearbyCrystals = Math.max(0, view.getInt(CRYSTALS_KEY, 0));
        rechargeEndTick = Math.max(0L, view.getLong(RECHARGE_END_KEY, 0L));
    }

    @Override
    protected void writeData(WriteView view) {
        super.writeData(view);
        view.putString(MODE_KEY, hologramMode.asString());
        view.putInt(CRYSTALS_KEY, nearbyCrystals);
        view.putLong(RECHARGE_END_KEY, rechargeEndTick);
    }

    @Override
    public NbtCompound toInitialChunkDataNbt(RegistryWrapper.WrapperLookup registries) {
        return createNbt(registries);
    }

    @Nullable
    @Override
    public Packet<ClientPlayPacketListener> toUpdatePacket() {
        return BlockEntityUpdateS2CPacket.create(this);
    }

    public enum HologramMode {
        STATUS,
        CRYSTALS,
        YIELD;

        public String asString() {
            return name().toLowerCase(Locale.ROOT);
        }

        public String getTranslationKey() {
            return "hologram.aetherklang.kristallresonator.mode." + asString();
        }

        private HologramMode next() {
            HologramMode[] modes = values();
            return modes[(ordinal() + 1) % modes.length];
        }

        private static HologramMode fromId(String id) {
            if (id == null) {
                return STATUS;
            }
            try {
                return valueOf(id.toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
                return STATUS;
            }
        }
    }
}
