"use client";
import { useState, useEffect } from "react";
import { MediaPanel } from "@/components/editor/media-panel";
import { CanvasPanel } from "@/components/editor/canvas-panel";
import { Timeline } from "@/components/editor/timeline";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { usePanelStore } from "@/stores/panel-store";
import Header from "@/components/editor/header";
import { Loading } from "@/components/editor/loading";
import FloatingControl from "@/components/editor/floating-controls/floating-control";
import { Compositor } from "openvideo";
import { WebCodecsUnsupportedModal } from "@/components/editor/webcodecs-unsupported-modal";
import Assistant from "./assistant/assistant";

type WebCodecsSupportState = {
  checked: boolean;
  supported: boolean;
  reason?: "insecure_context" | "missing_apis";
  missingApis: string[];
  origin?: string;
};

const REQUIRED_WEBCODECS_APIS = [
  "OffscreenCanvas",
  "VideoEncoder",
  "VideoDecoder",
  "VideoFrame",
  "AudioEncoder",
  "AudioDecoder",
  "AudioData",
] as const;

export default function Editor() {
  const {
    toolsPanel,
    copilotPanel,
    mainContent,
    timeline,
    setToolsPanel,
    setCopilotPanel,
    setMainContent,
    setTimeline,
    isCopilotVisible,
  } = usePanelStore();

  const [isReady, setIsReady] = useState(false);
  const [webCodecsSupport, setWebCodecsSupport] = useState<WebCodecsSupportState>({
    checked: false,
    supported: true,
    missingApis: [],
  });

  useEffect(() => {
    const checkSupport = async () => {
      const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
      const secureContext = window.isSecureContext || isLocalhost;
      const missingApis = REQUIRED_WEBCODECS_APIS.filter((api) => !(api in window));
      const origin = window.location.origin;

      if (!secureContext) {
        setWebCodecsSupport({
          checked: true,
          supported: false,
          reason: "insecure_context",
          missingApis,
          origin,
        });
        return;
      }

      if (missingApis.length > 0) {
        setWebCodecsSupport({
          checked: true,
          supported: false,
          reason: "missing_apis",
          missingApis,
          origin,
        });
        return;
      }

      // Keep the strict openvideo check for diagnostics only; do not hard-block editor UI.
      try {
        const strictSupported = await Compositor.isSupported();
        if (!strictSupported) {
          console.warn(
            "[editor] Compositor strict check failed, but base WebCodecs APIs are available. Continuing.",
          );
        }
      } catch (error) {
        console.warn(
          "[editor] Compositor support check threw. Continuing with base API checks.",
          error,
        );
      }

      setWebCodecsSupport({
        checked: true,
        supported: true,
        missingApis: [],
        origin,
      });
    };
    checkSupport();
  }, []);

  if (!webCodecsSupport.checked) {
    return (
      <div className="h-screen w-screen bg-background">
        <Loading />
      </div>
    );
  }

  if (webCodecsSupport.checked && !webCodecsSupport.supported) {
    return (
      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          WebCodecs is unavailable in the current context.
        </div>
        <WebCodecsUnsupportedModal
          open
          reason={webCodecsSupport.reason}
          missingApis={webCodecsSupport.missingApis}
          origin={webCodecsSupport.origin}
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {!isReady && (
        <div className="absolute inset-0 z-50">
          <Loading />
        </div>
      )}
      <Header />
      <div className="flex-1 min-h-0 min-w-0">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full gap-0">
          {/* Left Column: Media Panel */}
          <ResizablePanel
            defaultSize={toolsPanel}
            minSize={15}
            maxSize={40}
            onResize={setToolsPanel}
            className="max-w-7xl relative overflow-visible! bg-card min-w-0"
          >
            <MediaPanel />
            <FloatingControl />
          </ResizablePanel>

          <ResizableHandle className="bg-border/90" />

          {/* Middle Column: Preview + Timeline */}
          <ResizablePanel
            defaultSize={isCopilotVisible ? 100 - copilotPanel - toolsPanel : 100 - toolsPanel}
            minSize={40}
            className="min-w-0 min-h-0"
          >
            <ResizablePanelGroup direction="vertical" className="h-full w-full gap-0">
              {/* Canvas Panel */}
              <ResizablePanel
                defaultSize={mainContent}
                minSize={30}
                maxSize={85}
                onResize={setMainContent}
                className="min-h-0"
              >
                <CanvasPanel
                  onReady={() => {
                    setIsReady(true);
                  }}
                />
              </ResizablePanel>

              <ResizableHandle className="bg-border/90" />

              {/* Timeline Panel */}
              <ResizablePanel
                defaultSize={timeline}
                minSize={15}
                maxSize={70}
                onResize={setTimeline}
                className="min-h-0"
              >
                <Timeline />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          {isCopilotVisible && (
            <>
              <ResizableHandle className="bg-border/90" />
              {/* Right Column: Chat Copilot */}
              <ResizablePanel
                defaultSize={copilotPanel}
                minSize={15}
                maxSize={40}
                onResize={setCopilotPanel}
                className="max-w-7xl relative overflow-visible! bg-card min-w-0"
              >
                {/* Chat copilot */}
                <Assistant />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
