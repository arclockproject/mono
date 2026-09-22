//#region Imports
// for use loading screen, we need to import following module.
import "@babylonjs/core/Loading/loadingScreen.js";
// for cast shadow, we need to import following module.
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
// for use WebXR we need to import following two modules.
import "@babylonjs/core/Helpers/sceneHelpers.js";
import "@babylonjs/core/Materials/Node/Blocks/index.js";
// if your model has .tga texture, uncomment following line.
// import "@babylonjs/core/Materials/Textures/Loaders/tgaTextureLoader.js";
// for load .bpmx file, we need to import following module.
import "babylon-mmd/esm/Loader/Optimized/bpmxLoader.js"; // <-- commented due to using .pmx file instead
// if you want to use .pmx file, uncomment following line.
import "babylon-mmd/esm/Loader/pmxLoader.js";
// if you want to use .pmd file, uncomment following line.
import "babylon-mmd/esm/Loader/pmdLoader.js";
// for render outline, we need to import following module.
import "babylon-mmd/esm/Loader/mmdOutlineRenderer.js";
// for play `MmdAnimation` we need to import following two modules.
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation.js";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation.js";

import {
  ActionManager,
  ExecuteCodeAction,
} from "@babylonjs/core/Actions/index.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { FlyCamera } from "@babylonjs/core/Cameras/flyCamera.js";
import { Constants } from "@babylonjs/core/Engines/index.js";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import {
  type ISceneLoaderProgressEvent,
  SceneLoader,
} from "@babylonjs/core/Loading/sceneLoader.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin.js";
import { SSRRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/index.js";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js";
import { Scene } from "@babylonjs/core/scene.js";
import havokPhysics from "@babylonjs/havok";
import { ShadowOnlyMaterial } from "@babylonjs/materials/shadowOnly/shadowOnlyMaterial.js";
// import type { MmdStandardMaterialBuilder } from "babylon-mmd/esm/Loader/mmdStandardMaterialBuilder.js";
import type { BpmxLoader } from "babylon-mmd/esm/Loader/Optimized/bpmxLoader.js";
// import { BvmdLoader } from "babylon-mmd/esm/Loader/Optimized/bvmdLoader.js";
import { SdefInjector } from "babylon-mmd/esm/Loader/sdefInjector.js";
import { VmdLoader } from "babylon-mmd/esm/Loader/vmdLoader.js";
import { StreamAudioPlayer } from "babylon-mmd/esm/Runtime/Audio/streamAudioPlayer.js";
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera.js";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh.js";
// import { MorphTargetManager } from "@babylonjs/core/Morph.js";
import type { MmdMorphController } from "babylon-mmd/esm/Runtime/mmdMorphController.js";
import { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime.js";
// for use Ammo.js physics engine, uncomment following line.
import ammoPhysics from "babylon-mmd/esm/Runtime/Physics/External/ammo.wasm.js";
import { MmdAmmoJSPlugin } from "babylon-mmd/esm/Runtime/Physics/mmdAmmoJSPlugin.js";
import { MmdAmmoPhysics } from "babylon-mmd/esm/Runtime/Physics/mmdAmmoPhysics.js";
import { MmdPhysics } from "babylon-mmd/esm/Runtime/Physics/mmdPhysics.js";
import { MmdPlayerControl } from "babylon-mmd/esm/Runtime/Util/mmdPlayerControl.js";
import "@babylonjs/core/Rendering/depthRendererSceneComponent.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import type { MmdAnimation } from "babylon-mmd/esm/Loader/Animation/mmdAnimation.js";
import type { MmdModel } from "babylon-mmd/esm/Runtime/mmdModel.js";
import type { ISceneBuilder } from "./BaseRuntime";
import { MMDLoadDetails } from "./config";

// import { number } from "zod";
// import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
// import { Inspector } from "@babylonjs/inspector.js";
//#endregion

//#region SceneBuilderSplit.tsx
class SceneBuilderSplit implements ISceneBuilder {
  public async build(
    canvas: HTMLCanvasElement,
    engine: AbstractEngine,
  ): Promise<Scene> {
    // for apply SDEF on shadow, outline, depth rendering
    SdefInjector.OverrideEngineCreateEffect(engine);

    // get bpmx loader and set some configurations.
    const bpmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
    bpmxLoader.loggingEnabled = true;
    // const materialBuilder =
    //   bpmxLoader.materialBuilder as MmdStandardMaterialBuilder;
    // if you want override texture loading, uncomment following lines.
    // materialBuilder.loadDiffuseTexture = (): void => { /* do nothing */ };
    // materialBuilder.loadSphereTexture = (): void => { /* do nothing */ };
    // materialBuilder.loadToonTexture = (): void => { /* do nothing */ };

    // if you don't need outline rendering, comment out following line.
    // materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

    const scene = new Scene(engine);
    MMDLoadDetails.controller.scene = scene;
    scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
    scene.ambientColor = new Color3(0.5, 0.5, 0.5); // mmd scale material ambient color to 0.5. for same result, set ambient color to 0.5

    const mmdRoot = new TransformNode("mmdRoot", scene);
    mmdRoot.position.z = 20;

    // mmd camera for play mmd camera animation
    const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
    mmdCamera.maxZ = 1000;
    mmdCamera.minZ = 0.1;
    mmdCamera.parent = mmdRoot;

    //const camera = new ArcRotateCamera("arcRotateCamera", 0, 0, 45, new Vector3(0, 10, 1), scene);
    let cameraFly: FlyCamera;
    let cameraArc: ArcRotateCamera;
    let camera: FlyCamera | ArcRotateCamera;
    cameraFly = new FlyCamera("flyCamera", new Vector3(0, 20, -50), scene);
    cameraFly.maxZ = 1000;
    cameraFly.minZ = 0.1;
    //camera.setPosition(new Vector3(0, 10, -45));
    cameraFly.attachControl(true);
    cameraFly.inertia = 0.8;
    cameraFly.speed = 4;
    cameraFly.parent = mmdRoot;
    cameraFly.keysUp.push(32);
    cameraFly.keysDown.push(16);
    cameraArc = new ArcRotateCamera(
      "camera",
      Math.PI / 3,
      Math.PI / 3,
      10,
      Vector3.Zero(),
      scene,
    );
    cameraArc.lowerRadiusLimit = 0.1;
    // Targets the camera to a particular position. In this case the scene origin
    cameraArc.setTarget(Vector3.Zero());

    // Attach the camera to the canvas
    cameraArc.attachControl(true);
    cameraArc.maxZ = 1000;
    cameraArc.minZ = 0.1;
    cameraArc.inertia = 0.8;
    cameraArc.speed = 4;
    cameraArc.parent = mmdRoot;

    camera = MMDLoadDetails.startMode === "desktop" ? cameraFly : cameraArc;
    // for same result with mmd, we should use only directional light but if you want to use hemispheric light, uncomment following lines.
    const hemisphericLight = new HemisphericLight(
      "HemisphericLight",
      new Vector3(0, 1, 0),
      scene,
    );
    hemisphericLight.intensity = 0;
    hemisphericLight.specular = new Color3(0, 0, 0);
    hemisphericLight.groundColor = new Color3(1, 1, 1);
    MMDLoadDetails.controller.hemisphericLight = hemisphericLight;
    // const directionalLightPoint = new PointLight("PointLight", new Vector3(10, 10, 1), scene);
    // directionalLightPoint.intensity = 0.7;
    // directionalLightPoint.range = 100;
    // directionalLightPoint.shadowMaxZ = 10000;
    // directionalLightPoint.shadowMinZ = 0;

    const directionalLight = new DirectionalLight(
      "DirectionalLight",
      new Vector3(0.5, -1, 1),
      scene,
    );
    directionalLight.intensity = 1;
    // set frustum size manually for optimize shadow rendering
    directionalLight.autoCalcShadowZBounds = false;
    directionalLight.autoUpdateExtends = false;
    directionalLight.shadowMaxZ = 1000;
    directionalLight.shadowMinZ = -1000;
    directionalLight.orthoTop = 100;
    directionalLight.orthoBottom = -100;
    directionalLight.orthoLeft = -100;
    directionalLight.orthoRight = 100;
    directionalLight.shadowOrthoScale = 0;
    MMDLoadDetails.controller.directionalLight = directionalLight;

    const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
    shadowGenerator.transparencyShadow = true;
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.forceBackFacesOnly = true;
    shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    shadowGenerator.frustumEdgeFalloff = 0;
    shadowGenerator.darkness = 0;
    MMDLoadDetails.controller.shadowGenerator = shadowGenerator;

    if (MMDLoadDetails.stagePMX.length === 0) {
      const ground = CreateGround(
        "ground1",
        { width: 100, height: 100, subdivisions: 2, updatable: false },
        scene,
      );
      const shadowOnlyMaterial = new ShadowOnlyMaterial("shadowOnly", scene);
      ground.material = shadowOnlyMaterial;
      shadowOnlyMaterial.activeLight = directionalLight;
      shadowOnlyMaterial.alpha = 0.4;
      ground.receiveShadows = true;
      ground.parent = mmdRoot;
    }

    // create mmd runtime with physics
    //const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene)); // `MmdPhysics` use Havok physics engine for solve rigid body simulation
    const mmdRuntimeCamera = new MmdRuntime(scene);
    const mmdRuntimeMusic = new MmdRuntime(scene);
    //since Havok is not used by MMD, this may cause some weird behavior on physics simulation.

    // MMD use bullet physics engine for rigid body simulation. and Ammo.js is a port of bullet physics engine to JavaScript.

    const mmdRuntime = new MmdRuntime(
      scene,
      MMDLoadDetails.useBulletPhysics
        ? new MmdAmmoPhysics(scene)
        : new MmdPhysics(scene),
    ); // you can use Ammo.js physics engine for reproduce more similar behavior with MMD.

    mmdRuntime.register(scene);
    mmdRuntimeMusic.register(scene);
    mmdRuntimeCamera.register(scene);

    // set audio player
    const audioPlayer = new StreamAudioPlayer(scene);
    audioPlayer.preservesPitch = false;

    // you need to get this file by yourself from https://youtu.be/y__uZETTuL8
    audioPlayer.source = MMDLoadDetails.musicRaw; //"res/private_test/motion/melancholy_night/melancholy_night.mp3";

    mmdRuntimeMusic.setAudioPlayer(audioPlayer);

    // play before loading. this will cause the audio to play first before all assets are loaded.
    // playing the audio first can help ease the user's patience
    const tickDiv = document.querySelector<HTMLSpanElement>(
      ".auto-item-tick-time > span",
    );
    let tickSpaceI = 0;
    mmdRuntimeMusic.onAnimationTickObservable.add(() => {
      //   if (!mmdRuntime.isAnimationPlaying) {
      //     mmdRuntime.playAnimation();
      //   }
      if (mmdRuntime.isAnimationPlaying) {
        mmdRuntime.pauseAnimation();
      }
      // MMDLoadDetails.controller.mainRuntime.models[0].currentAnimation?.animate(0)
      let tickLog = ``;
      mmdRuntime.models.forEach((model, i) => {
        if (!model.currentAnimation) return;
        const frames =
          model.currentAnimation.animation.endFrame -
          model.currentAnimation.animation.startFrame;
        const tick =
          (mmdRuntimeMusic.currentFrameTime +
            MMDLoadDetails.controller.frameOffset.model) %
          frames;
        tickLog += `${i}: ${Math.floor(tick)}/${frames}\n`;
        model.currentAnimation.animate(tick);
      });
      if (tickDiv && tickSpaceI++ > 10) {
        tickDiv.innerText = tickLog;
        tickSpaceI = 0;
      }
      //   mmdRuntime.seekAnimation(
      //     (mmdRuntimeMusic.currentFrameTime + MMDLoadDetails.controller.frameOffset.model) %
      //       (mmdRuntime.animationDuration * 30)
      //   );
      mmdRuntimeCamera.seekAnimation(
        mmdRuntimeMusic.currentFrameTime +
          MMDLoadDetails.controller.frameOffset.camera,
      );
    });
    mmdRuntimeMusic.onPauseAnimationObservable.add(() => {
      mmdRuntimeCamera.pauseAnimation();
      mmdRuntime.pauseAnimation();
    });
    mmdRuntimeMusic.onPlayAnimationObservable.add(() => {
      mmdRuntimeCamera.playAnimation();
      //   mmdRuntime.playAnimation();
    });
    mmdRuntimeMusic.playAnimation();
    mmdRuntimeCamera.playAnimation();
    // mmdRuntime.playAnimation();
    MMDLoadDetails.controller.musicRuntime = mmdRuntimeMusic;
    MMDLoadDetails.controller.mainRuntime = mmdRuntime;
    MMDLoadDetails.controller.cameraRuntime = mmdRuntimeMusic;
    // create player control
    const mmdPlayerControl = new MmdPlayerControl(
      scene,
      mmdRuntimeMusic,
      audioPlayer,
    );
    mmdPlayerControl.showPlayerControl();
    // show loading screen
    engine.displayLoadingUI();

    const loadingTexts: string[] = [];
    const updateLoadingText = (updateIndex: number, text: string): void => {
      loadingTexts[updateIndex] = text;
      engine.loadingUIText = `<br/><br/><br/><br/>${loadingTexts.join("<br/><br/>")}`;
    };

    // for load .bvmd file, we use BvmdLoader. if you want to load .vmd or .vpd file, use VmdLoader / VpdLoader
    const bvmdLoader = new VmdLoader(scene);
    bvmdLoader.loggingEnabled = true;

    const progress = (event: ISceneLoaderProgressEvent, word: string) =>
      `Loading ${word}... ${event.loaded}/${event.total} (${Math.floor((event.loaded * 100) / event.total)}%)`;
    // fetch assets in parallel by using Promise.all
    const cameraAndStage = Promise.all([
      MMDLoadDetails.vmdCamera
        ? bvmdLoader.loadAsync("camera", MMDLoadDetails.vmdCamera, (event) =>
            updateLoadingText(
              2,
              `Loading camera... ${event.loaded}/${event.total} (${Math.floor((event.loaded * 100) / event.total)}%)`,
            ),
          )
        : undefined,
      MMDLoadDetails.stagePMX.length === 0
        ? new Promise<"bread">((resolve) => resolve("bread"))
        : SceneLoader.ImportMeshAsync(
            undefined,
            MMDLoadDetails.stageFolder,
            MMDLoadDetails.stagePMX,
            scene,
            (event) =>
              updateLoadingText(
                3,
                `Loading stage... ${event.loaded}/${event.total} (${Math.floor((event.loaded * 100) / event.total)}%)`,
              ),
          ).then((result) => result.meshes[0] as MmdMesh),
      (async (): Promise<void> => {
        updateLoadingText(4, "Loading physics engine...");
        // for Light physics engine
        if (MMDLoadDetails.useBulletPhysics) {
          const physicsInstance = await ammoPhysics();
          const physicsPlugin = new MmdAmmoJSPlugin(true, physicsInstance);
          scene.enablePhysics(new Vector3(0, -98, 0), physicsPlugin);
        } else {
          const physicsInstance = await havokPhysics();
          const physicsPlugin = new HavokPlugin(true, physicsInstance);
          scene.enablePhysics(new Vector3(0, -98, 0), physicsPlugin);
        }
        // for Ammo.js physics engine
        updateLoadingText(4, "Loading physics engine... Done");
      })(),
    ]);

    const mmdEntities = Promise.all(
      MMDLoadDetails.entities.reduce(
        (prev, entity, index) => {
          const unionPromise: [
            Promise<MmdAnimation> | undefined,
            Promise<MmdMesh> | undefined,
          ] = [
            entity.movement
              ? bvmdLoader.loadAsync(
                  `motion ${index}`,
                  entity.movement,
                  (event) =>
                    updateLoadingText(0, progress(event, `motion ${index}`)),
                )
              : undefined,
            entity.model
              ? SceneLoader.ImportMeshAsync(
                  undefined,
                  entity.model.folder,
                  entity.model.file,
                  scene,
                  (event) =>
                    updateLoadingText(1, progress(event, `model ${index}`)),
                ).then((result) => result.meshes[0] as MmdMesh)
              : undefined,
          ];
          prev.push(Promise.all(unionPromise));
          return prev;
        },
        [] as Promise<[MmdAnimation | undefined, MmdMesh | undefined]>[],
      ),
    );
    const batch = await Promise.all([cameraAndStage, mmdEntities]);
    const [mmdAnimationCamera, stageMesh] = batch[0];
    const entities = batch[1];
    // hide loading screen
    scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());

    mmdRuntimeMusic.setCamera(mmdCamera);
    if (mmdAnimationCamera) {
      mmdCamera.addAnimation(mmdAnimationCamera);
      mmdCamera.setAnimation("camera");
    }

    var inputMap: { [x: string]: boolean } = {};
    scene.actionManager = new ActionManager(scene);
    scene.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
        inputMap[evt.sourceEvent.key] = evt.sourceEvent.type === "keydown";
      }),
    );
    scene.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
        inputMap[evt.sourceEvent.key] = evt.sourceEvent.type === "keydown";
      }),
    );
    let flightSpeedButton: { innerHTML: string } | Element | null =
      document.querySelector("button#flight-speed");
    if (!flightSpeedButton) flightSpeedButton = { innerHTML: "" };
    const refUpdate = () => {
      flightSpeedButton.innerHTML = `C:${camera.speed.toFixed(2)} x${audioPlayer.playbackRate.toFixed(3)} z${
        scene.activeCamera?.maxZ
      }`;
    };
    refUpdate();
    {
      entities.forEach((entity, i) => {
        if (entity[1]) {
          entity[1].parent = mmdRoot;
          if (MMDLoadDetails.offsetCharacters) {
            const side = Math.ceil(i % 2 ? i / 2 : -i / 2);
            entity[1].position = new Vector3(13 * side, 0, 0);
          } else {
            const position = MMDLoadDetails.entitiesOffset[i];
            if (position)
              entity[1].position = new Vector3(
                position.x,
                position.y,
                position.z,
              );
            const angle = MMDLoadDetails.entitiesAngle[i];
            if (angle)
              entity[1].rotation = new Vector3(angle.x, angle.y, angle.z);
          }
        }
      });

      if (stageMesh !== "bread") {
        stageMesh.parent = mmdRoot;

        if (MMDLoadDetails.startMode === "desktop") {
          for (const mesh of stageMesh.metadata.meshes) {
            if (mesh.material) {
              try {
                // // @ts-expect-error
                //mesh.material.twoSidedLighting = true;
              } catch {}
              //mesh.material.backFaceCulling = false;
            }
            mesh.receiveShadows = true;
          }
          //@ts-expect-error
          MMDLoadDetails.controller.stageMesh = stageMesh;
          stageMesh.receiveShadows = true;

          shadowGenerator.addShadowCaster(stageMesh);
        }
      }
      MMDLoadDetails.modelMorph = [] as MmdMorphController[];
      MMDLoadDetails.entitiesData = entities;
      const liveModels: MmdModel[] = [];
      entities.forEach((entity, index) => {
        if (entity[1]) {
          const modelMesh = entity[1];
          if (MMDLoadDetails.startMode === "desktop") {
            for (const mesh of modelMesh.metadata.meshes) {
              if (mesh.material) {
                try {
                  // // @ts-expect-error
                  // mesh.material.twoSidedLighting = true;
                } catch {}
                //mesh.material.backFaceCulling = false;
              }
              mesh.receiveShadows = true;
            }
            modelMesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(modelMesh);
          }
          const mmdModel = mmdRuntime.createMmdModel(modelMesh);
          if (entity[0]) {
            mmdModel.addAnimation(entity[0]);
            mmdModel.setAnimation(`motion ${index}`);
          }
          liveModels.push(mmdModel);
          MMDLoadDetails.modelMorph.push(mmdModel.morph);
          if (index === MMDLoadDetails.focusedModel) {
            // make sure directional light follow the model
            let bodyBone = mmdModel.runtimeBones.find(
              (bone) => bone.name === "センター",
            );
            const boneWorldMatrix = new Matrix();
            MMDLoadDetails.refocusModel = () => {
              const nextFocus = liveModels[MMDLoadDetails.focusedModel];
              if (nextFocus)
                bodyBone = nextFocus.runtimeBones.find(
                  (bone) => bone.name === "センター",
                );
            };
            scene.onBeforeRenderObservable.add(() => {
              if (
                scene.activeCamera === camera &&
                MMDLoadDetails.startMode === "mobile"
              ) {
                bodyBone!
                  .getWorldMatrixToRef(boneWorldMatrix)
                  .multiplyToRef(modelMesh.getWorldMatrix(), boneWorldMatrix);
                boneWorldMatrix.getTranslationToRef(camera.target);
                camera.target.y += MMDLoadDetails.zCamOffset.y;
                camera.target.z += -20 + MMDLoadDetails.zCamOffset.z;
                camera.target.x += MMDLoadDetails.zCamOffset.x;
              }
            });
          }
        }
      });

      for (let i = 0; i < MMDLoadDetails.maxModelFocus; i++) {
        for (const key in MMDLoadDetails.actionMemory[i]) {
          MMDLoadDetails.modelMorph[i]?.setMorphWeight(
            key,
            MMDLoadDetails.actionMemory[i]![key]!,
          );
        }
      }
      scene.onBeforeRenderObservable.add(() => {
        if (inputMap["f"]) {
          camera.speed = Math.max(0.04, camera.speed * 0.95);
          refUpdate();
        }
        if (inputMap["r"]) {
          camera.speed = Math.min(50, camera.speed * 1.05);
          refUpdate();
        }
        if (inputMap["-"] && scene.activeCamera) {
          scene.activeCamera.maxZ = Math.max(
            scene.activeCamera.maxZ - 100,
            1000,
          );
          refUpdate();
        }
        if (inputMap["="] && scene.activeCamera) {
          scene.activeCamera.maxZ = Math.min(
            scene.activeCamera.maxZ + 100,
            10000,
          );
          refUpdate();
        }
        if (inputMap["["]) {
          audioPlayer.playbackRate = Math.max(
            audioPlayer.playbackRate - 0.005,
            0.1,
          );
          refUpdate();
        }
        if (inputMap["]"]) {
          audioPlayer.playbackRate = Math.min(
            audioPlayer.playbackRate + 0.005,
            2,
          );
          refUpdate();
        }
        if (inputMap["0"]) {
          audioPlayer.playbackRate = 1;
          refUpdate();
        }
      });
    }

    // optimize scene when all assets are loaded (unstable)
    scene.onAfterRenderObservable.addOnce(() => {
      // if (MMDLoadDetails.startMode === "desktop") scene.freezeMaterials();

      const meshes = scene.meshes;
      for (let i = 0, len = meshes.length; i < len; ++i) {
        const mesh = meshes[i]!;
        // if (MMDLoadDetails.startMode === "desktop") mesh.freezeWorldMatrix();
        mesh.doNotSyncBoundingInfo = true;
        mesh.isPickable = false;
        mesh.doNotSyncBoundingInfo = true;
        mesh.alwaysSelectAsActiveMesh = true;
      }

      scene.skipPointerMovePicking = true;
      scene.skipPointerDownPicking = true;
      scene.skipPointerUpPicking = true;
      scene.skipFrustumClipping = true;
      scene.blockMaterialDirtyMechanism = true;
    });

    // if you want ground collision, uncomment following lines.
    // const groundRigidBody = new PhysicsBody(ground, PhysicsMotionType.STATIC, true, scene);
    // groundRigidBody.shape = new PhysicsShapeBox(
    //     new Vector3(0, -1, 0),
    //     new Quaternion(),
    //     new Vector3(100, 2, 100), scene);
    if (MMDLoadDetails.startMode === "desktop") {
      if (MMDLoadDetails.useAdvanceRendering) {
        const ssrRenderingPipeline = new SSRRenderingPipeline(
          "ssr",
          scene,
          [mmdCamera, camera],
          true,
          Constants.TEXTURETYPE_UNSIGNED_BYTE,
        );
        ssrRenderingPipeline.step = 32;
        ssrRenderingPipeline.maxSteps = 128;
        ssrRenderingPipeline.maxDistance = 500;
        ssrRenderingPipeline.enableSmoothReflections = false;
        ssrRenderingPipeline.enableAutomaticThicknessComputation = false;
        ssrRenderingPipeline.blurDownsample = 2;
        ssrRenderingPipeline.ssrDownsample = 2;
        ssrRenderingPipeline.thickness = 0.1;
        ssrRenderingPipeline.selfCollisionNumSkip = 2;
        ssrRenderingPipeline.blurDispersionStrength = 0;
        ssrRenderingPipeline.roughnessFactor = 0.1;
        ssrRenderingPipeline.reflectivityThreshold = 0.9;
        ssrRenderingPipeline.samples = 4;
      } else {
        const defaultPipeline = new DefaultRenderingPipeline(
          "default",
          true,
          scene,
          [mmdCamera, camera],
        );
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = false;
        defaultPipeline.chromaticAberrationEnabled = true;
        defaultPipeline.chromaticAberration.aberrationAmount = 1;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = false;
      }
    } else {
      const ssrRenderingPipeline = new SSRRenderingPipeline(
        "ssr",
        scene,
        [mmdCamera, camera],
        true,
        Constants.TEXTURETYPE_UNSIGNED_BYTE,
      );
      ssrRenderingPipeline.samples = 4;
    }

    // switch camera when right click
    let lastClickTime = -Infinity;
    const toggleCameraButton = document.querySelector<HTMLButtonElement>(
      "button#toggle-cameras",
    );
    let cameraID = 0;
    let cameraTypes = [mmdCamera, cameraFly, cameraArc];
    let cameraTypesNames = [
      "Camera: Motion File",
      "Camera: Fly",
      "Camera: Hooked",
    ];
    const updateCameraButtonText = () => {
      if (toggleCameraButton)
        toggleCameraButton!.innerText = cameraTypesNames[cameraID]!;
    };
    const changeCameraToNext = () => {
      cameraID = cameraTypes.length - 1 === cameraID ? 0 : cameraID + 1;
      scene.activeCamera = cameraTypes[cameraID]!;
      updateCameraButtonText();
    };

    updateCameraButtonText();
    if (toggleCameraButton) {
      toggleCameraButton.onclick = changeCameraToNext;
    }
    canvas.onkeydown = (event) => {
      event.preventDefault();
      if (event.key === "k") {
        if (mmdRuntimeMusic.isAnimationPlaying)
          mmdRuntimeMusic.pauseAnimation();
        else mmdRuntimeMusic.playAnimation();
      } else if (event.key === "l") {
        mmdRuntimeMusic.seekAnimation(
          Math.min(
            mmdRuntimeMusic.currentFrameTime + 30 * 5,
            30 * audioPlayer.duration,
          ),
        );
      } else if (event.key === "j") {
        mmdRuntimeMusic.seekAnimation(
          Math.max(mmdRuntimeMusic.currentFrameTime - 30 * 5, 0),
        );
      } else if (event.key === "o") {
        changeCameraToNext();
      }
    };
    canvas.onauxclick = (event) => {
      if (event.button === 1) {
        event.preventDefault();
        changeCameraToNext();
      }
    };
    canvas.onwheel = (event) => {
      event.preventDefault();
      if (event.ctrlKey) {
        if (event.deltaY > 0) {
          audioPlayer.playbackRate = Math.min(
            2,
            audioPlayer.playbackRate + 0.025,
          );
          refUpdate();
        } else if (event.deltaY < 0) {
          audioPlayer.playbackRate = Math.max(
            0.1,
            audioPlayer.playbackRate - 0.025,
          );
          refUpdate();
        }
      } else {
        if (event.getModifierState("CapsLock")) {
          const direction = camera
            .getDirection(Vector3.Forward())
            .multiplyByFloats(camera.speed, camera.speed, camera.speed);

          if (event.deltaY > 0) {
            camera.position = camera.position.subtract(direction);
          } else if (event.deltaY < 0) {
            camera.position = camera.position.add(direction);
          }
        } else {
          if (event.deltaY > 0) {
            camera.speed = Math.max(0.04, camera.speed * 0.95);
            refUpdate();
          } else if (event.deltaY < 0) {
            camera.speed = Math.min(50, camera.speed * 1.05);
            refUpdate();
          }
        }
      }
    };
    canvas.onclick = (event) => {
      event.preventDefault();
      const currentTime = performance.now();
      if (500 < currentTime - lastClickTime) {
        lastClickTime = currentTime;
        return;
      }
      lastClickTime = -Infinity;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      } else {
        canvas.requestPointerLock();
      }
    };
    // if you want to use inspector, uncomment following line.
    // Inspector.Show(scene, {});

    // // webxr experience for AR
    // const environment = scene.createDefaultEnvironment()?.ground!;
    // if (!environment) return scene;
    // const webXrExperience = await scene.createDefaultXRExperienceAsync({
    //   uiOptions: {
    //     sessionMode: "immersive-ar",
    //     referenceSpaceType: "local-floor",
    //   },
    //   floorMeshes: [environment],
    // });
    // if (webXrExperience.baseExperience !== undefined) {
    //   // post process seems not working on immersive-ar
    //   // webXrExperience.baseExperience.sessionManager.onXRFrameObservable.addOnce(() => {
    //   //     defaultPipeline.addCamera(webXrExperience.baseExperience.camera);
    //   // });
    //   webXrExperience.baseExperience.sessionManager.worldScalingFactor = 15;
    // }

    return scene;
  }
}

//#endregion

export { SceneBuilderSplit };
