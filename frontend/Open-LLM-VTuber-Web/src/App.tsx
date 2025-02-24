import {
  Box, Flex, ChakraProvider, defaultSystem,
} from '@chakra-ui/react';
import { useState, useEffect, useRef } from 'react';
import Canvas from './components/canvas/canvas';
import Sidebar from './components/sidebar/sidebar';
import Footer from './components/footer/footer';
import { AiStateProvider } from './context/ai-state-context';
import { Live2DConfigProvider } from './context/live2d-config-context';
import { SubtitleProvider } from './context/subtitle-context';
import { BgUrlProvider } from './context/bgurl-context';
import { layoutStyles } from './layout'; 
import WebSocketHandler from './services/websocket-handler';
import { CameraProvider } from './context/camera-context';
import { ChatHistoryProvider } from './context/chat-history-context';
import { CharacterConfigProvider } from './context/character-config-context';
import { Toaster } from './components/ui/toaster';
import { Live2DModelProvider } from './context/live2d-model-context';
import { ProactiveSpeakProvider } from './context/proactive-speak-context';
import { ScreenCaptureProvider } from './context/screen-capture-context';
// import { AudioManager } from './services/audio-manager';

function App(): JSX.Element {
  const [showSidebar, setShowSidebar] = useState(true);
  const [isFooterCollapsed, setIsFooterCollapsed] = useState(false);
  // const audioManagerRef = useRef<AudioManager | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    try {
      // audioManagerRef.current = new AudioManager();
    } catch (error) {
      // console.error('Failed to initialize AudioManager:', error);
    }
  }, []);

  useEffect(() => {
    const initAudio = async () => {
      // if (audioManagerRef.current) {
      //   await audioManagerRef.current.play();
      // }
    };
    initAudio();
  }, []);

  useEffect(() => {
    return () => {
      // if (audioManagerRef.current) {
      //   audioManagerRef.current.pause();
      // }
    };
  }, []);

  return (
    <ChakraProvider value={defaultSystem}>
      <Live2DModelProvider>
        <CameraProvider>
          <ScreenCaptureProvider>
            <ChatHistoryProvider>
              <AiStateProvider>
                <ProactiveSpeakProvider>
                  <CharacterConfigProvider>
                    <Live2DConfigProvider>
                      <SubtitleProvider>
                        <BgUrlProvider>
                          <WebSocketHandler audioManager={null}>
                            <Toaster />
                            <Flex {...layoutStyles.appContainer}>
                              <Box
                                {...layoutStyles.sidebar}
                                {...(!showSidebar && { width: '24px' })}
                              >
                                <Sidebar
                                  isCollapsed={!showSidebar}
                                  onToggle={() => setShowSidebar(!showSidebar)}
                                />
                              </Box>
                              <Box {...layoutStyles.mainContent}>
                                <Canvas />
                                <Box
                                  {...layoutStyles.footer}
                                  {...(isFooterCollapsed && layoutStyles.collapsedFooter)}
                                >
                                  <Footer
                                    isCollapsed={isFooterCollapsed}
                                    onToggle={() => setIsFooterCollapsed(!isFooterCollapsed)}
                                  />
                                </Box>
                              </Box>
                            </Flex>
                          </WebSocketHandler>
                        </BgUrlProvider>
                      </SubtitleProvider>
                    </Live2DConfigProvider>
                  </CharacterConfigProvider>
                </ProactiveSpeakProvider>
              </AiStateProvider>
            </ChatHistoryProvider>
          </ScreenCaptureProvider>
        </CameraProvider>
      </Live2DModelProvider>
    </ChakraProvider>
  );
}

export default App;
