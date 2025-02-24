/* eslint-disable no-use-before-define */
/* eslint-disable no-param-reassign */
import { useEffect, useRef, useCallback, useState } from "react";
import * as PIXI from "pixi.js";
import {
  Live2DModel,
  MotionPreloadStrategy,
  MotionPriority,
} from "pixi-live2d-display-lipsyncpatch";
import {
  ModelInfo,
  useLive2DConfig,
  MotionWeightMap,
  TapMotionMap,
} from "../../context/live2d-config-context";
import { useLive2DModel as useModelContext } from "../../context/live2d-model-context";
import { setModelSize, resetModelPosition } from "./use-live2d-resize";
import { audioTaskQueue } from "../../utils/task-queue";
import { AiStateEnum, useAiState } from "../../context/ai-state-context";
import { toaster } from "../../components/ui/toaster";

interface UseLive2DModelProps {
  isPet: boolean; // Whether the model is in pet mode
  modelInfo: ModelInfo | undefined; // Live2D model configuration information
}

// Add type definitions
interface MotionGroup {
  [key: string]: number;
}

export const useLive2DModel = ({
  isPet,
  modelInfo,
}: UseLive2DModelProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const kScaleRef = useRef<string | number | undefined>(undefined);
  const { setCurrentModel } = useModelContext();
  const { setIsLoading } = useLive2DConfig();
  const loadingRef = useRef(false);
  const { setAiState, aiState } = useAiState();
  const [isModelReady, setIsModelReady] = useState(false);

  // Cleanup function for Live2D model
  const cleanupModel = useCallback(() => {
    if (modelRef.current) {
      modelRef.current.removeAllListeners();
      setCurrentModel(null);
      if (appRef.current) {
        appRef.current.stage.removeChild(modelRef.current);
        modelRef.current.destroy({
          children: true,
          texture: true,
          baseTexture: true,
        });
        PIXI.utils.clearTextureCache();
        modelRef.current = null;
      }
    }
    setIsModelReady(false);
  }, [setCurrentModel]);

  // Cleanup function for PIXI application
  const cleanupApp = useCallback(() => {
    if (appRef.current) {
      if (modelRef.current) {
        cleanupModel();
      }
      appRef.current.stage.removeChildren();
      PIXI.utils.clearTextureCache();
      appRef.current.renderer.clear();
      appRef.current.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true,
      });
      PIXI.utils.destroyTextureCache();
      appRef.current = null;
    }
  }, [cleanupModel]);

  // Initialize PIXI application with canvas (only once)
  useEffect(() => {
    if (!appRef.current && canvasRef.current) {
      const app = new PIXI.Application({
        view: canvasRef.current,
        autoStart: true,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0,
        antialias: true,
        clearBeforeRender: true,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0x000000,
        forceCanvas: false,
        sharedTicker: true,
      });

      // Optimize rendering
      app.renderer.plugins.interaction.autoPreventDefault = false;
      app.renderer.options.powerPreference = "high-performance";
      
      // Use RAF instead of ticker for smoother animation
      app.ticker.maxFPS = 60;
      app.ticker.minFPS = 30;

      // Render on every frame
      app.ticker.add(() => {
        if (app.renderer) {
          app.renderer.render(app.stage);
        }
      });

      appRef.current = app;
    }

    return () => {
      cleanupApp();
    };
  }, [cleanupApp]);

  const setupModel = useCallback(
    async (model: Live2DModel) => {
      if (!appRef.current || !modelInfo) return;

      if (modelRef.current) {
        modelRef.current.removeAllListeners();
        appRef.current.stage.removeChild(modelRef.current);
        modelRef.current.destroy({
          children: true,
          texture: true,
          baseTexture: true,
        });
        PIXI.utils.clearTextureCache();
      }

      modelRef.current = model;
      setCurrentModel(model);
      appRef.current.stage.addChild(model);

      model.interactive = true;
      model.cursor = "pointer";
      setIsModelReady(true);

      // Log available expressions
      const expressions = model.internalModel?.motionManager.expressionManager?.definitions.map(d => d.name);
      console.log('Available expressions:', expressions);

      // Log expression manager state
      console.log('Expression manager:', {
        hasManager: !!model.internalModel?.motionManager.expressionManager,
        definitions: model.internalModel?.motionManager.expressionManager?.definitions,
        current: model.internalModel?.motionManager.expressionManager?.currentExpression
      });
    },
    [setCurrentModel],
  );

  const setupModelSizeAndPosition = useCallback(() => {
    if (!modelRef.current) return;
    setModelSize(modelRef.current, kScaleRef.current);

    const { width, height } = isPet
      ? { width: window.innerWidth, height: window.innerHeight }
      : containerRef.current?.getBoundingClientRect() || {
        width: 0,
        height: 0,
      };

    resetModelPosition(modelRef.current, width, height, modelInfo?.initialXshift, modelInfo?.initialYshift);
  }, [modelInfo?.initialXshift, modelInfo?.initialYshift]);

  // Load Live2D model with configuration
  const loadModel = useCallback(async () => {
    if (!modelInfo?.url || !appRef.current) return;

    if (loadingRef.current) return; // Prevent multiple simultaneous loads

    console.log("Loading model:", modelInfo.url);

    try {
      loadingRef.current = true;
      setIsLoading(true);
      setAiState(AiStateEnum.LOADING);

      // Convert relative URL to absolute URL if needed
      const modelUrl = modelInfo.url.startsWith('http') 
        ? modelInfo.url 
        : `http://127.0.0.1:12393${modelInfo.url}`;

      // Initialize Live2D model with settings
      const model = await Live2DModel.from(modelUrl, {
        autoHitTest: true,
        autoFocus: modelInfo.pointerInteractive ?? false,
        autoUpdate: true,
        ticker: PIXI.Ticker.shared,
        motionPreload: MotionPreloadStrategy.ALL,
        idleMotionGroup: modelInfo.idleMotionGroupName,
      });

      // Preload textures if available
      const textures = (model as any).internalModel?.textures;
      if (textures && Array.isArray(textures)) {
        await Promise.all(
          textures.map((texture: any) => 
            texture.url ? PIXI.Texture.fromURL(texture.url) : Promise.resolve()
          )
        );
      }

      await setupModel(model);
    } catch (error) {
      console.error("Failed to load Live2D model:", error);
      toaster.create({
        title: `Failed to load Live2D model: ${error}`,
        type: "error",
        duration: 2000,
      });
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setAiState(AiStateEnum.IDLE);
    }
  }, [
    modelInfo?.url,
    modelInfo?.pointerInteractive,
    setIsLoading,
    setupModel,
  ]);

  const setupModelInteractions = useCallback(
    (model: Live2DModel) => {
      if (!model) return;

      model.removeAllListeners();

      let dragging = false;
      let pointerX = 0;
      let pointerY = 0;
      let isTap = false;
      const dragThreshold = 5;

      // Basic web interactions
      model.on("pointerdown", (e) => {
        if (e.button === 0) {
          dragging = true;
          isTap = true;
          pointerX = e.global.x - model.x;
          pointerY = e.global.y - model.y;
        }
      });

      model.on("pointermove", (e) => {
        if (dragging) {
          const newX = e.global.x - pointerX;
          const newY = e.global.y - pointerY;
          const dx = newX - model.x;
          const dy = newY - model.y;

          if (Math.hypot(dx, dy) > dragThreshold) {
            isTap = false;
          }

          model.position.x = newX;
          model.position.y = newY;
        }
      });

      model.on("pointerup", (e) => {
        if (dragging) {
          dragging = false;
          if (isTap) {
            handleTapMotion(model, e.global.x, e.global.y);
          }
        }
      });

      model.on("pointerupoutside", () => {
        dragging = false;
      });
    },
    [isPet],
  );

  const handleTapMotion = useCallback(
    (model: Live2DModel, x: number, y: number) => {
      if (!modelInfo?.tapMotions) return;

      // Convert global coordinates to model's local coordinates
      const localPos = model.toLocal(new PIXI.Point(x, y));
      const hitAreas = model.hitTest(localPos.x, localPos.y);

      const foundMotion = hitAreas.find((area) => {
        const motionGroup = modelInfo?.tapMotions?.[area];
        if (motionGroup) {
          console.log(`Found motion group for area ${area}:`, motionGroup);
          playRandomMotion(model, motionGroup);
          return true;
        }
        return false;
      });

      if (!foundMotion && Object.keys(modelInfo.tapMotions).length > 0) {
        const mergedMotions = getMergedMotionGroup(modelInfo.tapMotions);
        playRandomMotion(model, mergedMotions);
      }
    },
    [modelInfo?.tapMotions],
  );

  // Reset expression when AI state changes to IDLE (like finishing a conversation)
  useEffect(() => {
    if (aiState === AiStateEnum.IDLE && modelRef.current?.internalModel?.motionManager?.expressionManager) {
      console.log("Setting default expression...");
      
      // Get mapped expression name from model config
      const defaultEmotion = modelInfo?.defaultEmotion || "idle";
      const mappedExpression = modelInfo?.emotionMap?.[defaultEmotion];
      
      console.log("Expression mapping:", {
        defaultEmotion,
        mappedExpression,
        available: modelRef.current.internalModel.motionManager.expressionManager.definitions.map(d => d.name)
      });
      
      try {
        if (mappedExpression) {
          modelRef.current.internalModel.motionManager.expressionManager.setExpression(mappedExpression);
          console.log("✅ Set mapped expression:", mappedExpression);
        } else {
          // Try using original expression name as fallback
          modelRef.current.internalModel.motionManager.expressionManager.setExpression(defaultEmotion);
          console.log("✅ Set default expression:", defaultEmotion);
        }
      } catch (error) {
        console.error("❌ Failed to set expression:", error);
      }
    }
  }, [aiState, modelInfo?.defaultEmotion, modelInfo?.emotionMap]);

  // Load model when URL changes and cleanup on unmount
  useEffect(() => {
    if (modelInfo?.url) {
      loadModel();
    }
    return () => {
      cleanupModel();
    };
  }, [modelInfo?.url, modelInfo?.pointerInteractive, loadModel, cleanupModel]);

  useEffect(() => {
    kScaleRef.current = modelInfo?.kScale;
  }, [modelInfo?.kScale]);

  useEffect(() => {
    setupModelSizeAndPosition();
  }, [isModelReady, setupModelSizeAndPosition]);

  useEffect(() => {
    if (modelRef.current && isModelReady) {
      setupModelInteractions(modelRef.current);
    }
  }, [isModelReady, setupModelInteractions]); // Dependency of setupModelInteractions includes isPet already

  return {
    canvasRef,
    appRef,
    modelRef,
    containerRef,
  };
};

const playRandomMotion = (model: Live2DModel, motionGroup: MotionGroup) => {
  if (!motionGroup || Object.keys(motionGroup).length === 0) return;

  const totalWeight = Object.values(motionGroup).reduce((sum: number, weight: number) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  Object.entries(motionGroup).find(([motion, weight]) => {
    random -= weight as number;
    if (random <= 0) {
      const priority = audioTaskQueue.hasTask()
        ? MotionPriority.NORMAL
        : MotionPriority.NORMAL;

      console.log(
        `Playing weighted motion: ${motion} (weight: ${weight}/${totalWeight}, priority: ${priority})`,
      );
      model.motion(motion, undefined, priority);
      return true;
    }
    return false;
  });
};

const getMergedMotionGroup = (tapMotions: TapMotionMap): MotionGroup => {
  const mergedMotions: {
    [key: string]: { total: number; count: number };
  } = {};

  Object.entries(tapMotions).forEach(([_, motionGroup]) => {
    Object.entries(motionGroup as MotionGroup).forEach(([motion, weight]) => {
      if (!mergedMotions[motion]) {
        mergedMotions[motion] = { total: 0, count: 0 };
      }
      mergedMotions[motion].total += weight as number;
      mergedMotions[motion].count += 1;
    });
  });

  return Object.entries(mergedMotions).reduce(
    (acc, [motion, { total, count }]) => ({
      ...acc,
      [motion]: total / count,
    }),
    {} as MotionGroup,
  );
};
