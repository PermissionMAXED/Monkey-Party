package de.aetherklang.komposition;

import com.mojang.serialization.Codec;
import com.mojang.serialization.DataResult;
import de.aetherklang.klangwerk.Klangoperation;
import java.util.List;
import java.util.Locale;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;

/**
 * The immutable, persistent phrase written on a Zauberpartitur.
 */
public record Zauberpartitur(List<Klangoperation> operations) {
    public static final int MIN_OPERATIONS = 3;
    public static final int MAX_OPERATIONS = 5;

    public static final Codec<Zauberpartitur> CODEC = Klangoperation.CODEC.listOf().comapFlatMap(
            Zauberpartitur::decode,
            Zauberpartitur::operations
    );
    public static final PacketCodec<RegistryByteBuf, Zauberpartitur> PACKET_CODEC = PacketCodec.of(
            (score, buffer) -> {
                buffer.writeVarInt(score.operations().size());
                score.operations().forEach(operation -> buffer.writeVarInt(operation.ordinal()));
            },
            Zauberpartitur::read
    );

    public Zauberpartitur {
        operations = List.copyOf(operations);
        if (operations.size() < MIN_OPERATIONS || operations.size() > MAX_OPERATIONS) {
            throw new IllegalArgumentException(
                    "A Zauberpartitur must contain " + MIN_OPERATIONS + "-" + MAX_OPERATIONS + " operations"
            );
        }
    }

    public static Zauberpartitur of(Klangoperation... operations) {
        return new Zauberpartitur(List.of(operations));
    }

    public static String operationId(Klangoperation operation) {
        return operation.name().toLowerCase(Locale.ROOT);
    }

    public static String operationTranslationKey(Klangoperation operation) {
        return "komposition.aetherklang.operation." + operationId(operation);
    }

    private static DataResult<Zauberpartitur> decode(List<Klangoperation> operations) {
        try {
            return DataResult.success(new Zauberpartitur(operations));
        } catch (IllegalArgumentException exception) {
            return DataResult.error(exception::getMessage);
        }
    }

    private static Zauberpartitur read(RegistryByteBuf buffer) {
        int count = buffer.readVarInt();
        if (count < MIN_OPERATIONS || count > MAX_OPERATIONS) {
            throw new IllegalArgumentException("Invalid Zauberpartitur operation count: " + count);
        }
        Klangoperation[] available = Klangoperation.values();
        Klangoperation[] operations = new Klangoperation[count];
        for (int index = 0; index < count; index++) {
            int operationId = buffer.readVarInt();
            if (operationId < 0 || operationId >= available.length) {
                throw new IllegalArgumentException("Invalid Klangoperation id: " + operationId);
            }
            operations[index] = available[operationId];
        }
        return of(operations);
    }
}
