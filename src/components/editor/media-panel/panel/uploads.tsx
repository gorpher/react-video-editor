"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudioStore } from "@/stores/studio-store";
import { useProjectStore } from "@/stores/project-store";
import { Image, Video, Audio, Log, clipToJSON, type IClip as StudioClip } from "openvideo";
import { Upload, Film, Search, X, HardDrive, Trash2, Music, Plus } from "lucide-react";
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
    <div className="flex flex-col gap-1.5 group">
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

        {asset.source === "aifilm" && asset.type === "video" && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-medium flex items-center gap-1">
            <Film size={10} />
            <span>视频</span>
          </div>
        )}

        {asset.source === "aifilm" && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-primary/85 text-[10px] text-primary-foreground font-medium">
            AIFilm
          </div>
        )}

        <button
          type="button"
          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/35 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(asset);
          }}
          title="添加到轨道"
          aria-label={`添加 ${asset.name} 到轨道`}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all shadow">
            <Plus size={18} />
          </span>
        </button>

        {/* Remove Button (Minimalist on Hover) */}
        {asset.source === "local" && onDelete && (
          <button
            type="button"
            className="absolute top-1 right-1 p-1 rounded bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive z-10"
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

  type StudioTrackLike = {
    id: string;
    type?: string;
    clipIds?: string[];
  };

  const getCurrentInsertTimeUs = () => {
    const getCurrentTime = (studio as any)?.getCurrentTime;
    if (typeof getCurrentTime === "function") {
      const currentTimeUs = Number(getCurrentTime.call(studio));
      if (Number.isFinite(currentTimeUs) && currentTimeUs >= 0) {
        return currentTimeUs;
      }
    }

    const fallbackCurrentTimeUs = Number((studio as any)?.currentTime);
    if (Number.isFinite(fallbackCurrentTimeUs) && fallbackCurrentTimeUs >= 0) {
      return fallbackCurrentTimeUs;
    }

    return 0;
  };

  const getStudioTracks = (): StudioTrackLike[] => {
    const tracks = (studio as any)?.getTracks?.();
    return Array.isArray(tracks) ? (tracks as StudioTrackLike[]) : [];
  };

  const getTrackClipInfos = (
    track: StudioTrackLike,
  ): Array<{ id: string; from: number; to: number }> => {
    const clipIds = Array.isArray(track.clipIds) ? track.clipIds : [];
    const clips: Array<{ id: string; from: number; to: number }> = [];

    for (const clipId of clipIds) {
      if (typeof clipId !== "string") continue;
      const clip = (studio as any)?.getClip?.(clipId) as
        | {
            display?: { from?: number; to?: number };
            duration?: number;
          }
        | undefined;

      const from = Number(clip?.display?.from);
      const to = Number(clip?.display?.to);
      if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
        clips.push({ id: clipId, from, to });
        continue;
      }

      const duration = Number(clip?.duration);
      if (Number.isFinite(from) && Number.isFinite(duration) && duration > 0) {
        clips.push({ id: clipId, from, to: from + duration });
      }
    }

    return clips.sort((a, b) => a.from - b.from);
  };

  const getTrackClipRanges = (track: StudioTrackLike): Array<{ from: number; to: number }> => {
    return getTrackClipInfos(track).map((clip) => ({ from: clip.from, to: clip.to }));
  };

  const isTrackTypeCompatible = (assetType: MediaType, trackType?: string) => {
    const normalizedType = (trackType || "").toLowerCase();
    if (assetType === "audio") {
      return normalizedType === "audio";
    }

    return normalizedType === "video" || normalizedType === "image";
  };

  const getPreferredTrackId = (assetType: MediaType, atUs: number): string | undefined => {
    const candidateTracks = getStudioTracks().filter((track) =>
      isTrackTypeCompatible(assetType, track.type),
    );

    if (candidateTracks.length === 0) {
      return undefined;
    }

    let coveringTrackId: string | undefined;
    let coveringClipFrom = -1;
    let nearestEndedTrackId: string | undefined;
    let nearestEndedTo = -1;

    for (const track of candidateTracks) {
      const ranges = getTrackClipRanges(track);
      for (const range of ranges) {
        if (atUs >= range.from && atUs < range.to) {
          if (range.from > coveringClipFrom) {
            coveringClipFrom = range.from;
            coveringTrackId = track.id;
          }
          continue;
        }

        if (range.to <= atUs && range.to > nearestEndedTo) {
          nearestEndedTo = range.to;
          nearestEndedTrackId = track.id;
        }
      }
    }

    return coveringTrackId || nearestEndedTrackId || candidateTracks[0]?.id;
  };

  const resolveInsertAnchorUs = (trackId: string | undefined, desiredStartUs: number) => {
    if (!trackId) {
      return desiredStartUs;
    }

    const track = getStudioTracks().find((item) => item.id === trackId);
    if (!track) {
      return desiredStartUs;
    }

    const ranges = getTrackClipRanges(track);
    for (const range of ranges) {
      if (desiredStartUs > range.from && desiredStartUs < range.to) {
        // Keep insertion at a clean boundary when playhead is inside an existing clip.
        return range.to;
      }
    }

    return desiredStartUs;
  };

  const rippleShiftTrackClips = async (
    trackId: string | undefined,
    insertStartUs: number,
    deltaUs: number,
  ) => {
    if (!trackId || deltaUs <= 0) return;

    const track = getStudioTracks().find((item) => item.id === trackId);
    if (!track) return;

    const clipsToShift = getTrackClipInfos(track).filter((clip) => clip.from >= insertStartUs);
    if (clipsToShift.length === 0) return;

    const shiftedUpdates = clipsToShift
      .sort((a, b) => b.from - a.from)
      .map((clip) => ({
        id: clip.id,
        updates: {
          display: {
            from: clip.from + deltaUs,
            to: clip.to + deltaUs,
          },
        },
      }));

    if (typeof (studio as any).updateClips === "function") {
      await (studio as any).updateClips(shiftedUpdates);
      return;
    }

    for (const update of shiftedUpdates) {
      await (studio as any).updateClip(update.id, update.updates);
    }
  };

  const getClipDurationUs = (
    clip: { display?: { from?: number; to?: number }; duration?: number },
    fallbackDurationUs?: number,
  ) => {
    const from = Number(clip.display?.from);
    const to = Number(clip.display?.to);
    if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
      return to - from;
    }

    const duration = Number(clip.duration);
    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }

    if (
      typeof fallbackDurationUs === "number" &&
      Number.isFinite(fallbackDurationUs) &&
      fallbackDurationUs > 0
    ) {
      return fallbackDurationUs;
    }

    return 0;
  };

  // Add item to canvas
  const addItemToCanvas = async (asset: VisualAsset) => {
    if (!studio) return;

    try {
      const baseStartUs = getCurrentInsertTimeUs();
      const preferredTrackId = getPreferredTrackId(asset.type, baseStartUs);
      const insertStartUs = resolveInsertAnchorUs(preferredTrackId, baseStartUs);
      const fallbackDurationUs =
        typeof asset.duration === "number" && Number.isFinite(asset.duration) && asset.duration > 0
          ? asset.duration * 1_000_000
          : undefined;

      if (asset.type === "image") {
        const imageClip = await Image.fromUrl(asset.src);
        imageClip.name = asset.name;
        const imageDurationUs = 5 * 1_000_000;
        await rippleShiftTrackClips(preferredTrackId, insertStartUs, imageDurationUs);
        imageClip.display = { from: insertStartUs, to: insertStartUs + imageDurationUs };
        imageClip.duration = imageDurationUs;
        await imageClip.scaleToFit(canvasSize.width, canvasSize.height);
        imageClip.centerInScene(canvasSize.width, canvasSize.height);
        await studio.addClip(
          imageClip,
          preferredTrackId ? { trackId: preferredTrackId } : undefined,
        );
      } else if (asset.type === "audio") {
        const audioClip = await Audio.fromUrl(asset.src);
        audioClip.name = asset.name;
        const audioDurationUs = getClipDurationUs(audioClip as any, fallbackDurationUs);
        await rippleShiftTrackClips(preferredTrackId, insertStartUs, audioDurationUs);
        if (audioDurationUs > 0) {
          (audioClip as any).display = { from: insertStartUs, to: insertStartUs + audioDurationUs };
        }
        await studio.addClip(
          audioClip,
          preferredTrackId ? { trackId: preferredTrackId } : undefined,
        );
      } else {
        const videoClip = await Video.fromUrl(asset.src);
        videoClip.name = asset.name;
        const videoDurationUs = getClipDurationUs(videoClip as any, fallbackDurationUs);
        await rippleShiftTrackClips(preferredTrackId, insertStartUs, videoDurationUs);
        if (videoDurationUs > 0) {
          (videoClip as any).display = { from: insertStartUs, to: insertStartUs + videoDurationUs };
        }
        await videoClip.scaleToFit(canvasSize.width, canvasSize.height);
        videoClip.centerInScene(canvasSize.width, canvasSize.height);
        await studio.addClip(
          videoClip,
          preferredTrackId ? { trackId: preferredTrackId } : undefined,
        );
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
