import {
  createContext, useContext, useState, useMemo, useEffect, useCallback,
} from 'react';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { useConfig } from '@/context/character-config-context';
import { toaster } from '@/components/ui/toaster';

/**
 * Model emotion mapping interface
 * @interface EmotionMap
 */
interface EmotionMap {
  [key: string]: number | string;
}

/**
 * Motion weight mapping interface
 * @interface MotionWeightMap
 */
export interface MotionWeightMap {
  [key: string]: number;
}

/**
 * Tap motion mapping interface
 * @interface TapMotionMap
 */
export interface TapMotionMap {
  [key: string]: MotionWeightMap;
}

/**
 * Live2D model information interface
 * @interface ModelInfo
 */
export interface ModelInfo {
  /** Model name */
  name?: string;

  /** Model description */
  description?: string;

  /** Model URL */
  url: string;

  /** Scale factor */
  kScale: number;

  /** Initial X position shift */
  initialXshift: number;

  /** Initial Y position shift */
  initialYshift: number;

  /** Idle motion group name */
  idleMotionGroupName?: string;

  /** Default emotion */
  defaultEmotion?: number | string;

  /** Emotion mapping configuration */
  emotionMap: EmotionMap;

  /** Enable pointer interactivity */
  pointerInteractive?: boolean;

  /** Tap motion mapping configuration */
  tapMotions?: TapMotionMap;

  /** Enable scroll to resize */
  scrollToResize?: boolean;
}

/**
 * Live2D configuration context state interface
 * @interface Live2DConfigState
 */
interface Live2DConfigState {
  modelInfo?: ModelInfo;
  setModelInfo: (info: ModelInfo | undefined) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  updateModelScale: (newScale: number) => void;
}

/**
 * Default values and constants
 */
const DEFAULT_CONFIG = {
  modelInfo: {
    scrollToResize: true,
  } as ModelInfo | undefined,
  isLoading: false,
};

/**
 * Create the Live2D configuration context
 */
export const Live2DConfigContext = createContext<Live2DConfigState | null>(null);

/**
 * Live2D Configuration Provider Component
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export function Live2DConfigProvider({ children }: { children: React.ReactNode }) {
  const { confUid } = useConfig();
  const [isPet, setIsPet] = useState(false);
  const [isLoading, setIsLoading] = useState(DEFAULT_CONFIG.isLoading);
  const [pendingModelInfo, setPendingModelInfo] = useState<ModelInfo | undefined>(undefined);

  const getStorageKey = useCallback((uid: string, isPetMode: boolean) => 
    `${uid}_${isPetMode ? "pet" : "window"}`,
  []);

  const [modelInfo, setModelInfoState] = useLocalStorage<ModelInfo | undefined>(
    "modelInfo",
    DEFAULT_CONFIG.modelInfo,
    {
      filter: useCallback((value) => (value ? { ...value, url: "" } : value), []),
    },
  );

  const [scaleMemory, setScaleMemory] = useLocalStorage<Record<string, number>>(
    "scale_memory",
    {},
  );

  const setModelInfo = useCallback((info: ModelInfo | undefined) => {
    if (!info) {
      setModelInfoState(undefined);
      return;
    }

    if (JSON.stringify(modelInfo) === JSON.stringify(info)) {
      console.log("ℹ️ Model info không thay đổi, bỏ qua");
      return;
    }

    console.log("✅ Cập nhật model info:", info);
    setModelInfoState(info);
  }, [modelInfo, setModelInfoState]);

  const updateModelScale = useCallback((newScale: number) => {
    if (!modelInfo?.name || !confUid) return;

    const key = getStorageKey(confUid, isPet);
    setScaleMemory((prev) => ({
      ...prev,
      [key]: newScale,
    }));
  }, [confUid, getStorageKey, isPet, modelInfo?.name, setScaleMemory]);

  useEffect(() => {
    if (pendingModelInfo && confUid) {
      console.log("🔄 Xử lý pending model info sau khi có confUid");
      setModelInfo(pendingModelInfo);
      setPendingModelInfo(undefined);
    }
  }, [confUid, pendingModelInfo, setModelInfo]);

  const contextValue = useMemo(() => ({
    modelInfo,
    setModelInfo,
    isLoading,
    setIsLoading,
    updateModelScale,
  }), [modelInfo, setModelInfo, isLoading, updateModelScale]);

  return (
    <Live2DConfigContext.Provider value={contextValue}>
      {children}
    </Live2DConfigContext.Provider>
  );
}

/**
 * Custom hook to use the Live2D configuration context
 * @throws {Error} If used outside of Live2DConfigProvider
 */
export function useLive2DConfig() {
  const context = useContext(Live2DConfigContext);

  if (!context) {
    throw new Error('useLive2DConfig must be used within a Live2DConfigProvider');
  }

  return context;
}

// Export the provider as default
export default Live2DConfigProvider;
