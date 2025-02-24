/* eslint-disable no-sparse-arrays */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { wsService, MessageEvent } from '../services/websocket-service';
import {
  WebSocketContext, HistoryInfo, defaultWsUrl, defaultBaseUrl,
} from '../context/websocket-context';
import { ModelInfo, useLive2DConfig } from '../context/live2d-config-context';
import { useSubtitle } from '../context/subtitle-context';
import { useAudioTask } from '../hooks/utils/use-audio-task';
import { useBgUrl } from '../context/bgurl-context';
import { useConfig } from '../context/character-config-context';
import { useChatHistory } from '../context/chat-history-context';
import { toaster } from '../components/ui/toaster';
import { AiState, useAiState } from "../context/ai-state-context";
import { useLocalStorage } from '../hooks/utils/use-local-storage';
import { useLive2DModel } from '../context/live2d-model-context';
import { sliceAudioFromPosition } from '../utils/audio-utils';



interface WebSocketHandlerProps {
  children: React.ReactNode;
  audioManager: any;
}

// Types for story management
interface IdleStory {
  id: string;
  title: string;
  audio: string;
  text: string;
  expression?: string;
  volumes?: number[];
  slice_length?: number;
  motion?: string | null;
}

interface StoryState {
  story: IdleStory | null;
  position: number;
  audio: HTMLAudioElement | null;
  isPlaying: boolean;
}

function WebSocketHandler({ children, audioManager }: WebSocketHandlerProps) {
  const [wsState, setWsState] = useState<string>('CLOSED');
  const [wsUrl, setWsUrl] = useLocalStorage<string>('wsUrl', defaultWsUrl);
  const [baseUrl, setBaseUrl] = useLocalStorage<string>('baseUrl', defaultBaseUrl);
  const { aiState, setAiState } = useAiState();
  const { setModelInfo } = useLive2DConfig();
  const { setSubtitleText } = useSubtitle();
  const { clearResponse, setForceNewMessage } = useChatHistory();
  const { addAudioTask } = useAudioTask();
  const bgUrlContext = useBgUrl();
  const { confUid, setConfName, setConfUid, setConfigFiles } = useConfig();
  const { currentModel } = useLive2DModel();
  
  // Track model ready state
  const [modelLoaded, setModelLoaded] = useState(false);
  const modelReadySent = useRef(false);

  const {
    setCurrentHistoryUid, setMessages, setHistoryList, appendHumanMessage,
  } = useChatHistory();

  // Hàm gửi tín hiệu frontend-ready
  const sendFrontendReady = useCallback(() => {
    console.log('🔍 Kiểm tra điều kiện gửi frontend-ready:', {
      wsState,
      modelLoaded,
      modelReadySent: modelReadySent.current
    });

    if (wsState === 'OPEN' && modelLoaded && !modelReadySent.current) {
      console.log('🚀 Gửi tín hiệu frontend-ready');
      wsService.sendMessage({ type: 'frontend-ready' });
      modelReadySent.current = true;
    }
  }, [wsState, modelLoaded]);

  const handleControlMessage = useCallback((controlText: string) => {
    switch (controlText) {
      case 'stop-audio':
        if (currentModel) {
          currentModel.stopSpeaking();
        }
        break;
      case 'conversation-chain-start':
        setAiState('thinking-speaking');
        if (currentModel) {
          currentModel.stopSpeaking();
        }
        clearResponse();
        setForceNewMessage(true);
        break;
      case 'conversation-chain-end':
        setAiState((currentState: AiState) => {
          if (currentState === 'thinking-speaking') {
            return 'idle';
          }
          return currentState;
        });
        break;
      default:
        console.warn('Unknown control command:', controlText);
    }
  }, [setAiState, clearResponse, setForceNewMessage, currentModel]);

  const handleWebSocketMessage = useCallback(async (message: MessageEvent) => {
    console.log('📨 WebSocket Message:', {
      type: message.type,
      hasAudio: !!message.audio,
      hasText: !!message.text,
      hasActions: !!message.actions,
    });
    
    switch (message.type) {
      case 'audio-and-expression':
        if (aiState === 'interrupted' || aiState === 'listening') {
          return;
        }

        setAiState('thinking-speaking');
        
        addAudioTask({
          audioBase64: message.audio || '',
          text: message.text || null,
          expression: message.actions?.expression || null,
          motion: message.actions?.motion || null,
          onFinish: () => {
            setAiState('idle');
          }
        });
        break;

      case 'audio':
        if (aiState === 'interrupted' || aiState === 'listening') {
          return;
        }

        addAudioTask({
          audioBase64: message.audio || '',
          text: message.text || null,
          expression: message.actions?.expression || null,
          motion: message.actions?.motion || null,
        });
        break;

      case 'control':
        if (message.text) {
          handleControlMessage(message.text);
        } else {
          console.warn('Received control message without text');
        }
        break;

      case 'set-model-and-conf':
        console.log('🔄 Bắt đầu khởi tạo model mới');
        setAiState('loading');
        setModelLoaded(false);
        modelReadySent.current = false;
        
        try {
          const newConfUid = message.conf_uid;
          if (!newConfUid) {
            throw new Error('Không có confUid trong message');
          }

          console.log('📝 Cập nhật config:', { 
            uid: newConfUid, 
            name: message.conf_name 
          });

          if (!message.model_info) {
            throw new Error('Không có model_info trong message');
          }

          const modelInfo = { ...message.model_info };
          
          if (!modelInfo.url.startsWith("http")) {
            modelInfo.url = baseUrl + modelInfo.url;
          }
          
          try {
            const modelResponse = await fetch(modelInfo.url, {
              method: 'HEAD'
            });
            if (!modelResponse.ok) {
              throw new Error(`Model file không tồn tại: ${modelResponse.status}`);
            }
          } catch (fetchError) {
            throw new Error(`Không thể truy cập model file: ${(fetchError as Error).message}`);
          }
          
          console.log('🔗 Model URL (đã xác thực):', modelInfo.url);
          
          if (!modelInfo.name || !modelInfo.url) {
            throw new Error('Thiếu thông tin bắt buộc trong model_info');
          }

          console.log('🎭 Đang tải model:', {
            name: modelInfo.name,
            confUid: newConfUid,
            url: modelInfo.url
          });

          setConfUid(newConfUid);
          if (message.conf_name) {
            setConfName(message.conf_name);
          }

          await new Promise(resolve => setTimeout(resolve, 0));
          
          setModelInfo(modelInfo);
          setModelLoaded(true);
          setAiState('idle');
          console.log('✅ Model đã load xong');

        } catch (err: unknown) {
          const error = err as Error;
          console.error('❌ Lỗi khi khởi tạo model:', error);
          setAiState('idle');
          toaster.create({
            title: `Lỗi khởi tạo model: ${error.message}`,
            type: 'error',
            duration: 3000,
          });
        }
        break;

      case 'full-text':
        if (message.text) {
          setSubtitleText(message.text);
        }
        break;

      case 'config-files':
        if (message.configs) {
          setConfigFiles(message.configs);
        }
        break;

      case 'config-switched':
        setAiState('idle');
        setSubtitleText('New Character Loaded');

        toaster.create({
          title: 'Character switched',
          type: 'success',
          duration: 2000,
        });

        wsService.sendMessage({ type: 'fetch-history-list' });
        wsService.sendMessage({ type: 'create-new-history' });
        break;

      case 'background-files':
        if (message.files && Array.isArray(message.files)) {
          const backgroundFiles = message.files.map(file => ({
            name: file,
            url: `${baseUrl}/backgrounds/${file}`
          }));
          bgUrlContext?.setBackgroundFiles(backgroundFiles);
        }
        break;

      case 'history-data':
        if (message.messages) {
          setMessages(message.messages);
        }
        toaster.create({
          title: 'History loaded',
          type: 'success',
          duration: 2000,
        });
        break;

      case 'new-history-created':
        setAiState('idle');
        setSubtitleText('New Conversation Started');
        if (message.history_uid) {
          setCurrentHistoryUid(message.history_uid);
          setMessages([]);
          const newHistory: HistoryInfo = {
            uid: message.history_uid,
            latest_message: null,
            timestamp: new Date().toISOString(),
          };
          setHistoryList((prev: HistoryInfo[]) => [newHistory, ...prev]);
          toaster.create({
            title: 'New chat history created',
            type: 'success',
            duration: 2000,
          });
        }
        break;

      case 'history-deleted':
        toaster.create({
          title: message.success
            ? 'History deleted successfully'
            : 'Failed to delete history',
          type: message.success ? 'success' : 'error',
          duration: 2000,
        });
        break;

      case 'history-list':
        if (message.histories) {
          setHistoryList(message.histories);
          if (message.histories.length > 0) {
            setCurrentHistoryUid(message.histories[0].uid);
          }
        }
        break;

      case 'user-input-transcription':
        console.log('user-input-transcription: ', message.text);
        if (message.text) {
          appendHumanMessage(message.text);
        }
        break;

      case 'error':
        toaster.create({
          title: message.message,
          type: 'error',
          duration: 2000,
        });
        break;

      case 'ping':
        wsService.sendMessage({ type: 'pong' });
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }, [aiState, addAudioTask, appendHumanMessage, baseUrl, bgUrlContext, setAiState, setConfName, setConfUid, setConfigFiles, setCurrentHistoryUid, setHistoryList, setMessages, setModelInfo, setSubtitleText, sendFrontendReady]);

  // Effect để theo dõi model loaded state
  useEffect(() => {
    if (modelLoaded) {
      console.log('✨ Model đã load xong, kiểm tra gửi frontend-ready');
      sendFrontendReady();
    }
  }, [modelLoaded, sendFrontendReady]);

  // Effect để xử lý trạng thái WebSocket
  useEffect(() => {
    const handleStateChange = (newState: string) => {
      console.log(`🔄 Trạng thái WebSocket thay đổi: ${newState}`);
      setWsState(newState);

      if (newState === 'OPEN') {
        console.log('🔌 WebSocket mở, kiểm tra gửi frontend-ready');
        sendFrontendReady();
      } else if (newState === 'CLOSED' || newState === 'ERROR') {
        console.log('🔌 WebSocket đóng/lỗi, reset states');
        modelReadySent.current = false;
        setModelLoaded(false);
      }
    };

    console.log('🔄 Thiết lập WebSocket handlers');
    const stateSubscription = wsService.onStateChange(handleStateChange);
    const messageSubscription = wsService.onMessage(handleWebSocketMessage);

    // Kết nối ban đầu
    console.log('🔌 Bắt đầu kết nối WebSocket');
    wsService.connect(wsUrl);

    return () => {
      console.log('🧹 Dọn dẹp kết nối WebSocket...');
      stateSubscription.unsubscribe();
      messageSubscription.unsubscribe();
    };
  }, [wsUrl, handleWebSocketMessage, sendFrontendReady]);

  const webSocketContextValue = useMemo(() => ({
    wsState,
    wsUrl,
    setWsUrl,
    baseUrl,
    setBaseUrl,
    sendMessage: wsService.sendMessage.bind(wsService),
    reconnect: () => {
      modelReadySent.current = false;
      wsService.connect(wsUrl);
    }
  }), [wsState, wsUrl, baseUrl]);

  return (
    <WebSocketContext.Provider value={webSocketContextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export default WebSocketHandler;
