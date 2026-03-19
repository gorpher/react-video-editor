"use client";

import { useState, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudioStore } from "@/stores/studio-store";
import { useProjectStore } from "@/stores/project-store";
import { Video, Log } from "openvideo";
import { Search, Film, Upload, Trash2, Plus } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { storageService } from "@/lib/storage/storage-service";
import type { MediaFile } from "@/types/media";
import { uploadFile } from "@/lib/upload-utils";
import { clearTimelineAssetDragData, writeTimelineAssetDragData } from "@/lib/timeline-drag";

const STORAGE_KEY = "designcombo_uploads";
const PROJECT_ID = "local-uploads";

interface VisualAsset {
  id: string;
  src: string;
  name: string;
  duration?: number;
  size?: number;
}

function formatDuration(seconds?: number) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function PanelVideos() {
  const { studio } = useStudioStore();
  const { canvasSize } = useProjectStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [videos, setVideos] = useState<VisualAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  let fileInputEl: HTMLInputElement | null = null;
  const fileInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) fileInputEl = node;
  }, []);

  const loadVideos = useCallback(() => {
    const stored: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    setVideos(stored.filter((a) => a.type === "video"));
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const stored: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("video/")) continue;
        const id = crypto.randomUUID();
        let uploadResult;
        try {
          uploadResult = await uploadFile(file);
        } catch {}
        const src = uploadResult?.url || URL.createObjectURL(file);
        if (storageService.isOPFSSupported()) {
          await storageService.saveMediaFile({
            projectId: PROJECT_ID,
            mediaItem: { id, file, name: file.name, type: "video", url: src } as MediaFile,
          });
        }
        stored.unshift({
          id,
          name: file.name,
          src,
          type: "video",
          size: file.size,
          source: "local",
        });
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      loadVideos();
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (storageService.isOPFSSupported()) {
      await storageService.deleteMediaFile({ projectId: PROJECT_ID, id });
    }
    const stored: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.filter((a) => a.id !== id)));
    loadVideos();
  };

  const addItemToCanvas = async (asset: VisualAsset) => {
    if (!studio) return;
    try {
      const videoClip = await Video.fromUrl(asset.src);
      videoClip.name = asset.name;
      await videoClip.scaleToFit(canvasSize.width, canvasSize.height);
      videoClip.centerInScene(canvasSize.width, canvasSize.height);
      await studio.addClip(videoClip);
    } catch (error) {
      Log.error("Failed to add video:", error);
    }
  };

  const filtered = videos.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-full flex flex-col">
      <input
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
      />
      <div className="flex-none p-4 flex gap-2">
        <InputGroup>
          <InputGroupAddon className="bg-secondary/30 pointer-events-none text-muted-foreground w-8 justify-center">
            <Search size={14} />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="搜索视频..."
            className="bg-secondary/30 border-0 h-full text-xs box-border pl-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
        <Button variant="outline" disabled={isUploading} onClick={() => fileInputEl?.click()}>
          <Upload size={14} />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <Film size={32} className="opacity-50" />
            <span className="text-sm">{videos.length === 0 ? "暂无视频" : "未找到匹配视频"}</span>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-x-3 gap-y-4">
            {filtered.map((asset) => (
              <div
                key={asset.id}
                className="flex flex-col gap-1.5 group"
                draggable
                onDragStart={(event) => {
                  writeTimelineAssetDragData(event.dataTransfer, {
                    id: asset.id,
                    type: "video",
                    src: asset.src,
                    name: asset.name,
                    duration: asset.duration,
                  });
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => {
                  clearTimelineAssetDragData();
                }}
              >
                <div className="relative aspect-square rounded-sm overflow-hidden bg-foreground/20 border border-transparent group-hover:border-primary/50 transition-all flex items-center justify-center bg-black/40">
                  <video
                    src={asset.src}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    muted
                    onMouseOver={(e) => (e.currentTarget as HTMLVideoElement).play()}
                    onMouseOut={(e) => {
                      (e.currentTarget as HTMLVideoElement).pause();
                      (e.currentTarget as HTMLVideoElement).currentTime = 0;
                    }}
                  />
                  {asset.duration && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-medium">
                      {formatDuration(asset.duration)}
                    </div>
                  )}
                  <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-black/0 opacity-0 group-hover:opacity-100 group-hover:bg-black/35 transition-all">
                    <button
                      type="button"
                      aria-label="Add video to canvas"
                      className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black shadow-md"
                      onClick={() => addItemToCanvas(asset)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="absolute top-1 right-1 z-20 p-1 rounded bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(asset.id);
                    }}
                  >
                    <Trash2 size={12} className="text-white" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground group-hover:text-foreground truncate transition-colors px-0.5">
                  {asset.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
