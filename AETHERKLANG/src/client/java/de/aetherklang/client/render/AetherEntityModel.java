package de.aetherklang.client.render;

import net.minecraft.client.model.Dilation;
import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelPartData;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.model.TexturedModelData;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.model.Model;
import net.minecraft.util.math.MathHelper;

public final class AetherEntityModel extends Model<AetherEntityRenderState> {
    private final ModelPart geist;
    private final ModelPart geistLeftWing;
    private final ModelPart geistRightWing;
    private final ModelPart hallwaechter;
    private final ModelPart hallLeftArm;
    private final ModelPart hallRightArm;
    private final ModelPart hallShield;
    private final ModelPart echonote;
    private final ModelPart choral;
    private final ModelPart choralLeftWings;
    private final ModelPart choralRightWings;
    private final ModelPart choralPhaseHalo;
    private final ModelPart choralPhasePillar;
    private final ModelPart sirene;
    private final ModelPart sireneLeftVeil;
    private final ModelPart sireneRightVeil;
    private final ModelPart taktling;
    private final ModelPart taktlingLeftEar;
    private final ModelPart taktlingRightEar;

    public AetherEntityModel(ModelPart root) {
        super(root, RenderLayer::getEntityTranslucent);
        geist = root.getChild("geist");
        geistLeftWing = geist.getChild("left_wing");
        geistRightWing = geist.getChild("right_wing");
        hallwaechter = root.getChild("hallwaechter");
        hallLeftArm = hallwaechter.getChild("left_arm");
        hallRightArm = hallwaechter.getChild("right_arm");
        hallShield = hallwaechter.getChild("shield");
        echonote = root.getChild("echonote");
        choral = root.getChild("choral");
        choralLeftWings = choral.getChild("left_wings");
        choralRightWings = choral.getChild("right_wings");
        choralPhaseHalo = choral.getChild("phase_halo");
        choralPhasePillar = choral.getChild("phase_pillar");
        sirene = root.getChild("sirene");
        sireneLeftVeil = sirene.getChild("left_veil");
        sireneRightVeil = sirene.getChild("right_veil");
        taktling = root.getChild("taktling");
        taktlingLeftEar = taktling.getChild("left_ear");
        taktlingRightEar = taktling.getChild("right_ear");
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();
        buildGeist(root);
        buildHallwaechter(root);
        buildEchonote(root);
        buildChoral(root);
        buildSirene(root);
        buildTaktling(root);
        return TexturedModelData.of(data, 64, 64);
    }

    private static void buildGeist(ModelPartData root) {
        ModelPartData geist = root.addChild("geist", ModelPartBuilder.create(), ModelTransform.NONE);
        geist.addChild(
                "core",
                ModelPartBuilder.create()
                        .uv(0, 0).cuboid(-4.0F, -5.0F, -3.0F, 8.0F, 10.0F, 6.0F, new Dilation(0.25F))
                        .uv(0, 17).cuboid(-2.0F, -8.0F, -2.0F, 4.0F, 4.0F, 4.0F),
                ModelTransform.origin(0.0F, 12.0F, 0.0F)
        );
        geist.addChild(
                "mask",
                ModelPartBuilder.create()
                        .uv(24, 0).cuboid(-3.0F, -3.0F, -1.5F, 6.0F, 6.0F, 2.0F)
                        .uv(24, 9).cuboid(-2.0F, -1.0F, -2.2F, 1.0F, 1.0F, 1.0F)
                        .uv(30, 9).cuboid(1.0F, -1.0F, -2.2F, 1.0F, 1.0F, 1.0F),
                ModelTransform.origin(0.0F, 7.0F, -2.5F)
        );
        geist.addChild(
                "left_wing",
                ModelPartBuilder.create().uv(0, 28).cuboid(0.0F, -1.0F, -1.0F, 11.0F, 2.0F, 6.0F),
                ModelTransform.of(3.0F, 10.0F, 0.0F, 0.0F, 0.15F, -0.25F)
        );
        geist.addChild(
                "right_wing",
                ModelPartBuilder.create().uv(0, 28).mirrored().cuboid(-11.0F, -1.0F, -1.0F, 11.0F, 2.0F, 6.0F),
                ModelTransform.of(-3.0F, 10.0F, 0.0F, 0.0F, -0.15F, 0.25F)
        );
        geist.addChild(
                "tail",
                ModelPartBuilder.create()
                        .uv(0, 38).cuboid(-3.0F, 0.0F, -2.0F, 6.0F, 7.0F, 4.0F)
                        .uv(20, 38).cuboid(-1.5F, 7.0F, -1.0F, 3.0F, 5.0F, 2.0F),
                ModelTransform.origin(0.0F, 16.0F, 0.0F)
        );
    }

    private static void buildHallwaechter(ModelPartData root) {
        ModelPartData hall = root.addChild("hallwaechter", ModelPartBuilder.create(), ModelTransform.NONE);
        hall.addChild(
                "body",
                ModelPartBuilder.create()
                        .uv(0, 0).cuboid(-6.0F, -7.0F, -4.0F, 12.0F, 14.0F, 8.0F, new Dilation(0.3F))
                        .uv(0, 23).cuboid(-4.0F, -9.0F, -3.0F, 8.0F, 4.0F, 6.0F),
                ModelTransform.origin(0.0F, 13.0F, 0.0F)
        );
        hall.addChild(
                "visor",
                ModelPartBuilder.create()
                        .uv(34, 0).cuboid(-5.0F, -2.0F, -1.0F, 10.0F, 4.0F, 2.0F)
                        .uv(38, 7).cuboid(-7.0F, -1.0F, -0.5F, 2.0F, 2.0F, 1.0F)
                        .uv(46, 7).cuboid(5.0F, -1.0F, -0.5F, 2.0F, 2.0F, 1.0F),
                ModelTransform.origin(0.0F, 6.0F, -4.0F)
        );
        hall.addChild(
                "left_arm",
                ModelPartBuilder.create().uv(30, 14).cuboid(0.0F, -2.0F, -2.0F, 5.0F, 13.0F, 4.0F),
                ModelTransform.of(5.5F, 9.0F, 0.0F, 0.0F, 0.0F, -0.12F)
        );
        hall.addChild(
                "right_arm",
                ModelPartBuilder.create().uv(30, 14).mirrored().cuboid(-5.0F, -2.0F, -2.0F, 5.0F, 13.0F, 4.0F),
                ModelTransform.of(-5.5F, 9.0F, 0.0F, 0.0F, 0.0F, 0.12F)
        );
        hall.addChild(
                "shield",
                ModelPartBuilder.create()
                        .uv(30, 33).cuboid(-10.0F, -11.0F, -0.5F, 20.0F, 22.0F, 1.0F, new Dilation(0.2F))
                        .uv(0, 51).cuboid(-6.0F, -14.0F, -1.0F, 12.0F, 3.0F, 2.0F),
                ModelTransform.origin(0.0F, 13.0F, -5.2F)
        );
        hall.addChild(
                "halo",
                ModelPartBuilder.create()
                        .uv(0, 57).cuboid(-8.0F, -1.0F, -1.0F, 16.0F, 2.0F, 2.0F)
                        .uv(36, 57).cuboid(-1.0F, -8.0F, -1.0F, 2.0F, 16.0F, 2.0F),
                ModelTransform.of(0.0F, 4.0F, 1.0F, 0.75F, 0.0F, 0.0F)
        );
    }

    private static void buildEchonote(ModelPartData root) {
        ModelPartData note = root.addChild("echonote", ModelPartBuilder.create(), ModelTransform.NONE);
        note.addChild(
                "spark",
                ModelPartBuilder.create()
                        .uv(0, 0).cuboid(-2.5F, -2.5F, -2.5F, 5.0F, 5.0F, 5.0F, new Dilation(0.5F))
                        .uv(21, 0).cuboid(1.5F, -8.0F, -1.0F, 2.0F, 8.0F, 2.0F)
                        .uv(30, 0).cuboid(3.0F, -8.0F, -1.0F, 6.0F, 4.0F, 2.0F),
                ModelTransform.origin(0.0F, 13.0F, 0.0F)
        );
        note.addChild(
                "orbit",
                ModelPartBuilder.create()
                        .uv(0, 12).cuboid(-7.0F, -0.5F, -0.5F, 14.0F, 1.0F, 1.0F)
                        .uv(0, 15).cuboid(-0.5F, -7.0F, -0.5F, 1.0F, 14.0F, 1.0F),
                ModelTransform.origin(0.0F, 13.0F, 0.0F)
        );
    }

    private static void buildChoral(ModelPartData root) {
        ModelPartData choral = root.addChild("choral", ModelPartBuilder.create(), ModelTransform.NONE);
        choral.addChild(
                "body",
                ModelPartBuilder.create()
                        .uv(0, 0).cuboid(-7.0F, -9.0F, -4.0F, 14.0F, 18.0F, 8.0F, new Dilation(0.45F))
                        .uv(0, 28).cuboid(-4.0F, 9.0F, -3.0F, 8.0F, 8.0F, 6.0F),
                ModelTransform.origin(0.0F, 12.0F, 0.0F)
        );
        choral.addChild(
                "center_mask",
                ModelPartBuilder.create().uv(46, 0).cuboid(-4.0F, -4.0F, -2.0F, 8.0F, 8.0F, 3.0F),
                ModelTransform.origin(0.0F, 3.0F, -4.0F)
        );
        choral.addChild(
                "left_mask",
                ModelPartBuilder.create().uv(46, 12).cuboid(-3.0F, -3.0F, -1.5F, 6.0F, 6.0F, 2.0F),
                ModelTransform.of(7.0F, 6.0F, -3.0F, 0.0F, -0.35F, 0.15F)
        );
        choral.addChild(
                "right_mask",
                ModelPartBuilder.create().uv(46, 12).cuboid(-3.0F, -3.0F, -1.5F, 6.0F, 6.0F, 2.0F),
                ModelTransform.of(-7.0F, 6.0F, -3.0F, 0.0F, 0.35F, -0.15F)
        );
        choral.addChild(
                "left_wings",
                ModelPartBuilder.create()
                        .uv(0, 44).cuboid(0.0F, -2.0F, -1.0F, 17.0F, 3.0F, 5.0F)
                        .uv(0, 53).cuboid(1.0F, 3.0F, -1.0F, 14.0F, 3.0F, 4.0F),
                ModelTransform.of(6.0F, 8.0F, 1.0F, 0.0F, 0.2F, -0.35F)
        );
        choral.addChild(
                "right_wings",
                ModelPartBuilder.create()
                        .uv(0, 44).mirrored().cuboid(-17.0F, -2.0F, -1.0F, 17.0F, 3.0F, 5.0F)
                        .uv(0, 53).mirrored().cuboid(-15.0F, 3.0F, -1.0F, 14.0F, 3.0F, 4.0F),
                ModelTransform.of(-6.0F, 8.0F, 1.0F, 0.0F, -0.2F, 0.35F)
        );
        choral.addChild(
                "crown",
                ModelPartBuilder.create()
                        .uv(44, 25).cuboid(-1.0F, -10.0F, -1.0F, 2.0F, 10.0F, 2.0F)
                        .uv(53, 25).cuboid(-7.0F, -1.0F, -1.0F, 14.0F, 2.0F, 2.0F),
                ModelTransform.origin(0.0F, 0.0F, 0.0F)
        );
        choral.addChild(
                "phase_halo",
                ModelPartBuilder.create()
                        .uv(0, 61).cuboid(-12.0F, -0.55F, -0.55F, 24.0F, 1.1F, 1.1F)
                        .uv(0, 61).cuboid(-0.55F, -0.55F, -12.0F, 1.1F, 1.1F, 24.0F)
                        .uv(52, 40).cuboid(-1.4F, -1.4F, -13.4F, 2.8F, 2.8F, 2.8F)
                        .uv(52, 40).cuboid(-1.4F, -1.4F, 10.6F, 2.8F, 2.8F, 2.8F)
                        .uv(52, 40).cuboid(-13.4F, -1.4F, -1.4F, 2.8F, 2.8F, 2.8F)
                        .uv(52, 40).cuboid(10.6F, -1.4F, -1.4F, 2.8F, 2.8F, 2.8F),
                ModelTransform.of(0.0F, 0.0F, 1.0F, 0.18F, 0.0F, 0.08F)
        );
        choral.addChild(
                "phase_pillar",
                ModelPartBuilder.create()
                        .uv(58, 48).cuboid(-0.65F, -30.0F, -0.65F, 1.3F, 52.0F, 1.3F)
                        .uv(52, 48).cuboid(-1.8F, -18.0F, -1.8F, 3.6F, 28.0F, 3.6F),
                ModelTransform.origin(0.0F, 8.0F, 2.0F)
        );
    }

    private static void buildSirene(ModelPartData root) {
        ModelPartData sirene = root.addChild("sirene", ModelPartBuilder.create(), ModelTransform.NONE);
        sirene.addChild(
                "body",
                ModelPartBuilder.create()
                        .uv(0, 0).cuboid(-4.0F, -7.0F, -2.5F, 8.0F, 12.0F, 5.0F, new Dilation(0.25F))
                        .uv(0, 18).cuboid(-3.0F, 5.0F, -2.0F, 6.0F, 9.0F, 4.0F),
                ModelTransform.origin(0.0F, 10.0F, 0.0F)
        );
        sirene.addChild(
                "mask",
                ModelPartBuilder.create()
                        .uv(28, 0).cuboid(-3.5F, -3.5F, -1.0F, 7.0F, 7.0F, 2.0F)
                        .uv(28, 10).cuboid(-2.0F, -0.5F, -1.7F, 1.0F, 1.0F, 1.0F)
                        .uv(34, 10).cuboid(1.0F, -0.5F, -1.7F, 1.0F, 1.0F, 1.0F),
                ModelTransform.origin(0.0F, 3.0F, -2.5F)
        );
        sirene.addChild(
                "crown",
                ModelPartBuilder.create()
                        .uv(46, 0).cuboid(-1.0F, -7.0F, -1.0F, 2.0F, 7.0F, 2.0F)
                        .uv(40, 10).cuboid(-6.0F, -1.0F, -1.0F, 12.0F, 2.0F, 2.0F),
                ModelTransform.origin(0.0F, 0.0F, 0.0F)
        );
        sirene.addChild(
                "left_veil",
                ModelPartBuilder.create()
                        .uv(22, 18).cuboid(0.0F, -1.0F, -0.5F, 13.0F, 2.0F, 5.0F)
                        .uv(22, 26).cuboid(2.0F, 2.0F, 0.0F, 10.0F, 2.0F, 4.0F),
                ModelTransform.of(3.0F, 8.0F, 0.0F, 0.0F, 0.18F, -0.3F)
        );
        sirene.addChild(
                "right_veil",
                ModelPartBuilder.create()
                        .uv(22, 18).mirrored().cuboid(-13.0F, -1.0F, -0.5F, 13.0F, 2.0F, 5.0F)
                        .uv(22, 26).mirrored().cuboid(-12.0F, 2.0F, 0.0F, 10.0F, 2.0F, 4.0F),
                ModelTransform.of(-3.0F, 8.0F, 0.0F, 0.0F, -0.18F, 0.3F)
        );
    }

    private static void buildTaktling(ModelPartData root) {
        ModelPartData taktling = root.addChild("taktling", ModelPartBuilder.create(), ModelTransform.NONE);
        taktling.addChild(
                "body",
                ModelPartBuilder.create()
                        .uv(0, 34).cuboid(-4.0F, -4.0F, -3.0F, 8.0F, 8.0F, 6.0F, new Dilation(0.2F))
                        .uv(0, 49).cuboid(-3.0F, -8.0F, -3.0F, 6.0F, 5.0F, 5.0F),
                ModelTransform.origin(0.0F, 17.0F, 0.0F)
        );
        taktling.addChild(
                "muzzle",
                ModelPartBuilder.create()
                        .uv(29, 35).cuboid(-2.0F, -1.5F, -2.0F, 4.0F, 3.0F, 3.0F)
                        .uv(44, 35).cuboid(-1.5F, -0.5F, -2.6F, 1.0F, 1.0F, 1.0F)
                        .uv(49, 35).cuboid(0.5F, -0.5F, -2.6F, 1.0F, 1.0F, 1.0F),
                ModelTransform.origin(0.0F, 12.5F, -2.5F)
        );
        taktling.addChild(
                "left_ear",
                ModelPartBuilder.create().uv(25, 43).cuboid(-1.0F, -6.0F, -1.0F, 2.0F, 6.0F, 2.0F),
                ModelTransform.of(2.5F, 10.0F, 0.0F, 0.0F, 0.0F, 0.22F)
        );
        taktling.addChild(
                "right_ear",
                ModelPartBuilder.create().uv(25, 43).mirrored().cuboid(-1.0F, -6.0F, -1.0F, 2.0F, 6.0F, 2.0F),
                ModelTransform.of(-2.5F, 10.0F, 0.0F, 0.0F, 0.0F, -0.22F)
        );
        taktling.addChild(
                "tail",
                ModelPartBuilder.create()
                        .uv(35, 44).cuboid(-1.0F, -1.0F, 0.0F, 2.0F, 2.0F, 8.0F)
                        .uv(35, 55).cuboid(-1.0F, -5.0F, 7.0F, 2.0F, 5.0F, 2.0F),
                ModelTransform.of(0.0F, 17.0F, 2.5F, 0.45F, 0.0F, 0.0F)
        );
    }

    @Override
    public void setAngles(AetherEntityRenderState state) {
        geist.visible = state.style == AetherEntityStyle.DISSONANZGEIST;
        hallwaechter.visible = state.style == AetherEntityStyle.HALLWAECHTER;
        echonote.visible = state.style == AetherEntityStyle.ECHONOTE;
        choral.visible = state.style == AetherEntityStyle.CHORAL;
        sirene.visible = state.style == AetherEntityStyle.SIRENE;
        taktling.visible = state.style == AetherEntityStyle.TAKTLING;

        float pulse = MathHelper.sin(state.age * 0.16F);
        geist.originY = pulse * 1.2F;
        geistLeftWing.roll = -0.35F - pulse * 0.22F;
        geistRightWing.roll = 0.35F + pulse * 0.22F;

        hallwaechter.originY = MathHelper.sin(state.age * 0.08F) * 0.2F;
        hallLeftArm.pitch = 0.08F + pulse * 0.08F;
        hallRightArm.pitch = -0.08F - pulse * 0.08F;
        hallShield.visible = state.shielded;
        hallShield.yaw = state.age * 0.025F;

        echonote.originY = MathHelper.sin(state.age * 0.35F) * 1.0F;
        echonote.yaw = state.age * 0.22F;
        echonote.roll = state.age * 0.14F;

        float choralPulse = MathHelper.sin(state.age * (0.1F + state.phase * 0.025F));
        choral.originY = choralPulse * 0.75F;
        choralLeftWings.roll = -0.35F - choralPulse * 0.2F;
        choralRightWings.roll = 0.35F + choralPulse * 0.2F;
        choral.yaw = MathHelper.sin(state.age * 0.025F) * 0.08F;
        choralPhaseHalo.visible = state.phase >= 2;
        choralPhaseHalo.yaw = state.age * (state.phase >= 3 ? -0.075F : -0.045F);
        choralPhaseHalo.roll = MathHelper.sin(state.age * 0.055F) * 0.16F;
        choralPhasePillar.visible = state.phase >= 3;
        choralPhasePillar.yaw = state.age * 0.09F;
        choralPhasePillar.originY = 8.0F + MathHelper.sin(state.age * 0.18F) * 1.2F;

        float sirenePulse = MathHelper.sin(state.age * 0.14F);
        sirene.originY = sirenePulse * 0.85F;
        sireneLeftVeil.roll = -0.3F - sirenePulse * 0.24F;
        sireneRightVeil.roll = 0.3F + sirenePulse * 0.24F;
        sirene.yaw = MathHelper.sin(state.age * 0.035F) * 0.1F;

        float beatBob = (MathHelper.cos(state.age * MathHelper.PI / 5.0F) + 1.0F) * 0.5F;
        taktling.originY = -beatBob * 1.1F;
        taktlingLeftEar.roll = 0.22F + beatBob * 0.18F;
        taktlingRightEar.roll = -0.22F - beatBob * 0.18F;
        taktling.yaw = MathHelper.sin(state.age * 0.08F) * 0.08F;
    }
}
