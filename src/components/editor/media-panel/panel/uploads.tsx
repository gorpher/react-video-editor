"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudioStore } from "@/stores/studio-store";
import { useProjectStore } from "@/stores/project-store";
import { Image, Video, Audio, Log, clipToJSON, type IClip as StudioClip } from "openvideo";
import { Upload, Film, Search, X, HardDrive, Trash2, Music } from "lucide-react";
import { storageService, type StorageStats } from "@/lib/storage/storage-service";
import type { MediaFile, MediaType } from "@/types/media";
import type { AifilmMediaItem } from "@/lib/aifilm-media";
import { uploadFile } from "@/lib/upload-utils";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
interface VisualAsset {
  id: string;
  type: MediaType;
  src: string;
  name: string;
  preview?: string;
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
  source: "local" | "aifilm";
}

const STORAGE_KEY = "designcombo_uploads";
const PROJECT_ID = "local-uploads";

// Detect file type from MIME type and extension
function detectFileType(file: File): MediaType {
  const mime = file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) {
    return "audio";
  }
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) {
    return "video";
  }
  return "image";
}

// Replace old blob URLs with new ones in serialized clips
// function replaceUrlsInClips<T>(
//   clips: T[],
//   urlMapping: Record<string, string>
// ): T[] {
//   const json = JSON.stringify(clips);
//   let updated = json;
//   for (const [oldUrl, newUrl] of Object.entries(urlMapping)) {
//     updated = updated.split(oldUrl).join(newUrl);
//   }
//   return JSON.parse(updated);
// }

// Helper to format duration like 00:00
function formatDuration(seconds?: number) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function normalizeLocalAsset(
  asset: Omit<VisualAsset, "source"> & { source?: VisualAsset["source"] },
): VisualAsset {
  return {
    ...asset,
    source: "local",
  };
}

function isSupportedRemoteMediaType(mediaType: string): mediaType is MediaType {
  return mediaType === "image" || mediaType === "video" || mediaType === "audio";
}

function mapAifilmMediaToAsset(item: AifilmMediaItem): VisualAsset | null {
  if (!item.url || !isSupportedRemoteMediaType(item.mediaType)) {
    return null;
  }

  return {
    id: `aifilm:${item.id}`,
    type: item.mediaType,
    src: item.url,
    preview: item.url,
    name: item.filename,
    width: item.width,
    height: item.height,
    duration: item.durationSec,
    size: item.sizeBytes,
    source: "aifilm",
  };
}

// Asset card component
function AssetCard({
  asset,
  onAdd,
  onDelete,
}: {
  asset: VisualAsset;
  onAdd: (asset: VisualAsset) => void;
  onDelete?: (id: string) => void;
}) {
  const previewSrc = asset.preview || asset.src;

  return (
    <div className="flex flex-col gap-1.5 group cursor-pointer" onClick={() => onAdd(asset)}>
      <div className="relative aspect-square rounded-sm overflow-hidden bg-foreground/20 border border-transparent group-hover:border-primary/50 transition-all flex items-center justify-center">
        {asset.type === "image" ? (
          <img src={previewSrc} alt={asset.name} className="max-w-full max-h-full object-contain" />
        ) : asset.type === "audio" ? (
          <div className="w-full h-full flex items-center justify-center relative">
            <Music className="text-[#2dc28c]" size={32} fill="#2dc28c" fillOpacity={0.2} />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black/40 relative">
            <video
              src={previewSrc}
              className="max-w-full max-h-full object-contain pointer-events-none"
              muted
              onMouseOver={(e) => (e.currentTarget as HTMLVideoElement).play()}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLVideoElement).pause();
                (e.currentTarget as HTMLVideoElement).currentTime = 0;
              }}
            />
          </div>
        )}

        {/* Duration Overlay (Bottom Left) */}
        {asset.duration && (
          <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-medium">
            {formatDuration(asset.duration)}
          </div>
        )}

        {asset.source === "aifilm" && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-primary/85 text-[10px] text-primary-foreground font-medium">
            AIFilm
          </div>
        )}

        {/* Remove Button (Minimalist on Hover) */}
        {asset.source === "local" && onDelete && (
          <button
            type="button"
            className="absolute top-1 right-1 p-1 rounded bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset.id);
            }}
          >
            <Trash2 size={12} className="text-white" />
          </button>
        )}
      </div>

      {/* Label (External) */}
      <p className="text-[10px] text-muted-foreground group-hover:text-foreground truncate transition-colors px-0.5">
        {asset.name}
      </p>
    </div>
  );
}

export default function PanelUploads() {
  const { studio } = useStudioStore();
  const { canvasSize } = useProjectStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [uploads, setUploads] = useState<VisualAsset[]>([]);
  const [remoteAssets, setRemoteAssets] = useState<VisualAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load storage stats
  const loadStorageStats = useCallback(async () => {
    const stats = await storageService.getStorageStats();
    setStorageStats(stats);
  }, []);

  const loadAifilmAssets = useCallback(async (signal?: AbortSignal) => {
    setIsRemoteLoading(true);

    try {
      const response = await fetch("/api/aifilm/media", {
        cache: "no-store",
        signal,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        items?: AifilmMediaItem[];
        error?: string;
        unavailable?: boolean;
      };

      if (!response.ok) {
        console.warn("[AIFilmMedia] Uploads panel list request unavailable", {
          status: response.status,
          message: payload.error || "Failed to load AIFilm media.",
        });
        setRemoteAssets([]);
        setRemoteError(payload.error || "AIFilm media is unavailable right now.");
        return;
      }

      const assets = (payload.items || [])
        .map(mapAifilmMediaToAsset)
        .filter((asset): asset is VisualAsset => Boolean(asset));

      console.info("[AIFilmMedia] Loaded uploads panel assets", {
        count: assets.length,
      });
      setRemoteAssets(assets);
      if (payload.unavailable) {
        setRemoteError(payload.error || "AIFilm media is unavailable right now.");
      } else {
        setRemoteError(null);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.warn("[AIFilmMedia] Failed to load uploads panel assets", error);
      setRemoteAssets([]);
      setRemoteError(error instanceof Error ? error.message : "Failed to load AIFilm media.");
    } finally {
      if (!signal?.aborted) {
        setIsRemoteLoading(false);
      }
    }
  }, []);

  // Recover uploads from OPFS on mount
  useEffect(() => {
    const recoverFromOPFS = async () => {
      try {
        if (!storageService.isOPFSSupported()) {
          // Fall back to localStorage only (won't persist blobs)
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            setUploads(JSON.parse(stored).map(normalizeLocalAsset));
          }
          setIsLoaded(true);
          return;
        }

        // Load files from OPFS
        const opfsFiles = await storageService.loadAllMediaFiles({
          projectId: PROJECT_ID,
        });

        if (opfsFiles.length === 0) {
          // No OPFS files, try localStorage for backwards compatibility
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            setUploads(JSON.parse(stored).map(normalizeLocalAsset));
          }
          setIsLoaded(true);
          await loadStorageStats();
          return;
        }

        // Load old localStorage entries for URL mapping
        const oldEntries: VisualAsset[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").map(
          normalizeLocalAsset,
        );
        const urlMapping: Record<string, string> = {};

        // Generate new blob URLs from OPFS files
        const recoveredAssets: VisualAsset[] = opfsFiles.map((file) => {
          const newBlobUrl = file.url || URL.createObjectURL(file.file);

          // Find matching old entry by ID or name to map URLs
          const oldEntry = oldEntries.find((e) => e.id === file.id || e.name === file.name);

          if (oldEntry?.src && oldEntry.src !== newBlobUrl) {
            urlMapping[oldEntry.src] = newBlobUrl;
          }

          // Prefer R2 URL from previous state if available
          const isR2Url = oldEntry?.src && !oldEntry.src.startsWith("blob:");
          const finalUrl = isR2Url ? oldEntry.src! : newBlobUrl;

          return {
            id: file.id,
            name: file.name,
            src: finalUrl,
            type: file.type,
            width: file.width,
            height: file.height,
            duration: file.duration,
            source: "local",
          };
        });
        console.warn("USE THIS LOGIC WHEN NEW CLIPS ARE ADDEDE EVENT");
        // // Update timeline clips with new blob URLs if needed
        // if (Object.keys(urlMapping).length > 0 && studio) {
        //   try {
        //     // Serialize current clips
        //     const serializedClips = studio.clips.map((clip) =>
        //       clipToJSON(clip as unknown as StudioClip)
        //     );
        //     console.log('Serialized clips:', {
        //       serializedClips,
        //       urlMapping
        //     });
        //     // Replace old URLs with new blob URLs
        //     const updatedClips = replaceUrlsInClips(
        //       serializedClips,
        //       urlMapping
        //     );
        //     if (updatedClips.length > 0) {
        //       console.log('Updated clips:', updatedClips);

        //       // Reload with updated URLs
        //       await studio.loadFromJSON({ clips: updatedClips });
        //     }
        //   } catch (error) {
        //     Log.warn('Failed to update timeline URLs:', error);
        //   }
        // }

        setUploads(recoveredAssets);
        // Update localStorage with new URLs
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recoveredAssets));
        await loadStorageStats();
      } catch (error) {
        console.error("Failed to recover uploads from OPFS:", error);
        // Fall back to localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUploads(JSON.parse(stored).map(normalizeLocalAsset));
        }
      } finally {
        setIsLoaded(true);
      }
    };

    recoverFromOPFS();
  }, [studio, loadStorageStats]);

  useEffect(() => {
    const abortController = new AbortController();
    void loadAifilmAssets(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [loadAifilmAssets]);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAssets: VisualAsset[] = [];

    try {
      for (const file of Array.from(files)) {
        const id = crypto.randomUUID();
        const type = detectFileType(file);

        // 1. Upload to R2
        let uploadResult;
        try {
          uploadResult = await uploadFile(file);
        } catch (error) {
          console.error("R2 upload failed, falling back to local only:", error);
        }

        const src = uploadResult?.url || URL.createObjectURL(file);

        // 2. Save to OPFS if supported (for local caching/backup)
        if (storageService.isOPFSSupported()) {
          const mediaFile: MediaFile = {
            id,
            file,
            name: file.name,
            type,
            url: src,
          };
          await storageService.saveMediaFile({
            projectId: PROJECT_ID,
            mediaItem: mediaFile,
          });
        }

        newAssets.push({
          id,
          name: file.name,
          src: src,
          type,
          size: file.size,
          source: "local",
        });
      }

      const updated = [...newAssets, ...uploads];
      setUploads(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      await loadStorageStats();
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      if (storageService.isOPFSSupported()) {
        await storageService.deleteMediaFile({
          projectId: PROJECT_ID,
          id,
        });
      }

      const updated = uploads.filter((a) => a.id !== id);
      setUploads(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      await loadStorageStats();
    } catch (error) {
      console.error("Failed to delete upload:", error);
    }
  };

  // Add item to canvas
  const addItemToCanvas = async (asset: VisualAsset) => {
    if (!studio) return;

    try {
      if (asset.type === "image") {
        const imageClip = await Image.fromUrl(asset.src);
        imageClip.name = asset.name;
        imageClip.display = { from: 0, to: 5 * 1e6 };
        imageClip.duration = 5 * 1e6;
        await imageClip.scaleToFit(canvasSize.width, canvasSize.height);
        imageClip.centerInScene(canvasSize.width, canvasSize.height);
        await studio.addClip(imageClip);
      } else if (asset.type === "audio") {
        const audioClip = await Audio.fromUrl(asset.src);
        audioClip.name = asset.name;
        await studio.addClip(audioClip);
      } else {
        const videoClip = await Video.fromUrl(asset.src);
        videoClip.name = asset.name;
        await videoClip.scaleToFit(canvasSize.width, canvasSize.height);
        videoClip.centerInScene(canvasSize.width, canvasSize.height);
        await studio.addClip(videoClip);
      }
    } catch (error) {
      Log.error(`Failed to add ${asset.type}:`, error);
    }
  };

  const mergedAssets = useMemo(() => [...remoteAssets, ...uploads], [remoteAssets, uploads]);

  // Filter assets by search query
  const filteredAssets = useMemo(
    () =>
      mergedAssets.filter((asset) => asset.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [mergedAssets, searchQuery],
  );

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-sm text-muted-foreground">加载中...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*,audio/*"
        multiple
        onChange={handleFileUpload}
      />
      {/* Search input */}
      {mergedAssets.length > 0 || isRemoteLoading || remoteError ? (
        <div>
          <div className="flex-1 p-4 flex gap-2">
            <InputGroup>
              <InputGroupAddon className="bg-secondary/30 pointer-events-none text-muted-foreground w-8 justify-center">
                <Search size={14} />
              </InputGroupAddon>

              <InputGroupInput
                placeholder="搜索素材..."
                className="bg-secondary/30 border-0 h-full text-xs box-border pl-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant={"outline"}
            >
              <Upload size={14} />
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex-1 p-4 flex gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant={"outline"}
              className="w-full"
            >
              <Upload size={14} /> 上传
            </Button>
          </div>
        </div>
      )}

      {isRemoteLoading && (
        <div className="px-4 pb-2 text-[11px] text-muted-foreground">正在加载 AIFilm 素材库...</div>
      )}

      {remoteError && (
        <div className="px-4 pb-2 text-[11px] text-amber-600 dark:text-amber-400">
          AIFilm 素材库不可用：{remoteError}
        </div>
      )}

      {/* Assets grid */}
      <ScrollArea className="flex-1 px-4">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <Upload size={32} className="opacity-50" />
            <span className="text-sm">
              {mergedAssets.length === 0 ? "暂无素材" : "未找到匹配素材"}
            </span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-x-3 gap-y-4">
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onAdd={addItemToCanvas}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
