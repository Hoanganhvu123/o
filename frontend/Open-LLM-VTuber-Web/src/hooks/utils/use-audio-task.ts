import { useRef } from 'react';
import { useAiState } from '@/context/ai-state-context';
import { useSubtitle } from '@/context/subtitle-context';
import { useChatHistory } from '@/context/chat-history-context';
import { audioTaskQueue } from '@/utils/task-queue';
import { useLive2DModel } from '@/context/live2d-model-context';
import { toaster } from '@/components/ui/toaster';

interface AudioTaskOptions {
  audioBase64: string;
  text: string | null;
  expression: string | null;
  motion: string | null;
  volumes?: number[];
  sliceLength?: number;
  onFinish?: () => void;
  resumePosition?: number;
  onTimeUpdate?: (currentTime: number) => void;
}

export const useAudioTask = () => {
  const { aiState } = useAiState();
  const { setSubtitleText } = useSubtitle();
  const { appendResponse, appendAIMessage } = useChatHistory();
  const { currentModel } = useLive2DModel();

  const stateRef = useRef({
    aiState,
    currentModel,
    setSubtitleText,
    appendResponse,
    appendAIMessage,
  });

  stateRef.current = {
    aiState,
    currentModel,
    setSubtitleText,
    appendResponse,
    appendAIMessage,
  };

  const handleAudioPlayback = async (options: AudioTaskOptions) => {
    const {
      aiState: currentAiState,
      currentModel: model,
      setSubtitleText: updateSubtitle,
      appendResponse: appendText,
      appendAIMessage: appendAI,
    } = stateRef.current;

    if (currentAiState === 'interrupted') {
      console.error('Audio playback blocked. State:', currentAiState);
      return;
    }

    const { audioBase64, text, expression, motion, resumePosition, onTimeUpdate, onFinish } = options;

    if (text) {
      appendText(text);
      appendAI(text);
      if (audioBase64) {
        updateSubtitle(text);
      }
    }

    if (!model) {
      console.error('Model not initialized');
      return;
    }

    try {
      // Apply expression if provided
      if (expression) {
        console.log('🎭 Setting expression:', expression);
        try {
          // Get mapped expression name from model config
          const mappedExpression = model.internalModel?.settings?.emotionMap?.[expression];
          console.log('Mapped expression:', {
            original: expression,
            mapped: mappedExpression,
            available: model.internalModel?.motionManager.expressionManager?.definitions.map(d => d.name)
          });
          
          if (mappedExpression) {
            model.expression(mappedExpression);
          } else {
            console.warn('Expression not found in mapping:', expression);
            // Try using original expression name as fallback
            model.expression(expression);
          }
        } catch (error) {
          console.error('Failed to set expression:', error);
        }
      }

      // Apply motion if provided
      if (motion && motion !== 'idle' && model.internalModel?.motionManager) {
        console.log('🎬 Playing motion:', motion);
        const definitions = model.internalModel.motionManager.definitions;
        if (Array.isArray(definitions)) {
          const motionDef = definitions.find(
            (def: any) => def.group === motion || def.name === motion
          );
          if (motionDef) {
            model.motion(motionDef.group, motionDef.index);
          } else {
            console.warn('Motion not found:', motion);
          }
        }
      }

      // Stop any current audio and ensure it's fully stopped
      console.log('⏹️ Stopping current audio');
      model.stopSpeaking();
      audioTaskQueue.stopCurrentAudio();
      
      // Wait for audio to fully stop
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Double check and force stop if still playing
      if (model.internalModel?.motionManager.playing) {
        console.log('⚠️ Audio still playing, forcing stop');
        model.stopSpeaking();
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Set processing state
      console.log('▶️ Starting audio playback');
      audioTaskQueue.setProcessing(true);

      // Create interval to track time
      let startTime = Date.now();
      let lastLoggedSecond = -1;
      const timeTracker = setInterval(() => {
        if (onTimeUpdate) {
          const currentTime = (Date.now() - startTime) / 1000;
          const currentSecond = Math.floor(currentTime);
          
          if (currentSecond !== lastLoggedSecond) {
            lastLoggedSecond = currentSecond;
          }
          
          onTimeUpdate(currentTime);
        }
      }, 100);

      // Play audio with Live2D model
      console.log('🎭 Playing audio with Live2D model');
      await model.speak(`data:audio/wav;base64,${audioBase64}`, {
        onFinish: () => {
          console.log("✅ Live2D model finished speaking");
          // Wait additional time to ensure audio is completely finished
          setTimeout(() => {
            console.log("✅ Audio cleanup and callback");
            clearInterval(timeTracker);
            audioTaskQueue.stopCurrentAudio();
            audioTaskQueue.setProcessing(false);
            if (onFinish) {
              onFinish();
            }
          }, 500);
        },
        onError: (error) => {
          console.error("❌ Audio playback error:", error);
          clearInterval(timeTracker);
          audioTaskQueue.stopCurrentAudio();
          audioTaskQueue.setProcessing(false);
        },
      });

    } catch (error) {
      console.error('❌ Speak function error:', error);
      audioTaskQueue.stopCurrentAudio();
      audioTaskQueue.setProcessing(false);
      toaster.create({
        title: `Speak function error: ${error}`,
        type: "error",
        duration: 2000,
      });
    }
  };

  const addAudioTask = (options: AudioTaskOptions) => {
    const { aiState: currentState } = stateRef.current;

    if (currentState === 'interrupted') {
      console.log('⏭️ Skipping audio task due to interrupted state');
      return;
    }

    console.log('🎵 Adding audio task:', {
      text: options.text,
      resumePosition: options.resumePosition,
      hasExpression: !!options.expression,
      hasMotion: !!options.motion
    });
    handleAudioPlayback(options);
  };

  return {
    addAudioTask,
    appendResponse,
  };
};

