import { useEffect, useCallback } from "react";
import { useInterrupt } from "@/components/canvas/live2d";
import { useLive2DConfig } from "@/context/live2d-config-context";
import { useSwitchCharacter } from "@/hooks/utils/use-switch-character";

export function useIpcHandlers({ isPet }: { isPet: boolean }) {
  const { interrupt } = useInterrupt();
  const { modelInfo, setModelInfo } = useLive2DConfig();
  const { switchCharacter } = useSwitchCharacter();

  const interruptHandler = useCallback(() => {
    interrupt();
  }, [interrupt]);

  const scrollToResizeHandler = useCallback(() => {
    if (modelInfo) {
      setModelInfo({
        ...modelInfo,
        scrollToResize: !modelInfo.scrollToResize,
      });
    }
  }, [modelInfo, setModelInfo]);

  const switchCharacterHandler = useCallback(
    (_event: Electron.IpcRendererEvent, filename: string) => {
      switchCharacter(filename);
    },
    [switchCharacter],
  );

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;
    if (!isPet) return;

    window.electron.ipcRenderer.removeAllListeners("interrupt");
    window.electron.ipcRenderer.removeAllListeners("toggle-scroll-to-resize");
    window.electron.ipcRenderer.removeAllListeners("switch-character");

    window.electron.ipcRenderer.on("interrupt", interruptHandler);
    window.electron.ipcRenderer.on(
      "toggle-scroll-to-resize",
      scrollToResizeHandler,
    );
    window.electron.ipcRenderer.on("switch-character", switchCharacterHandler);

    return () => {
      window.electron?.ipcRenderer.removeAllListeners("interrupt");
      window.electron?.ipcRenderer.removeAllListeners(
        "toggle-scroll-to-resize",
      );
      window.electron?.ipcRenderer.removeAllListeners("switch-character");
    };
  }, [
    interruptHandler,
    scrollToResizeHandler,
    switchCharacterHandler,
    isPet,
  ]);
}
