"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Video,
  Music,
  TypeIcon,
  SparklesIcon,
  Image,
  Ellipsis,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  Clipboard,
  CopyPlus,
  LockKeyholeOpen,
  LockKeyhole,
} from "lucide-react";
import { useTimelineStore } from "@/stores/timeline-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { useStudioStore } from "@/stores/studio-store";
import { useProjectStore } from "@/stores/project-store";
import { useTheme } from "next-themes";

import { useTimelineZoom } from "@/hooks/use-timeline-zoom";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { TimelinePlayhead, useTimelinePlayheadRuler } from "./timeline-playhead";
import type { TimelineTrack, TrackType } from "@/types/timeline";
import { TimelineRuler } from "./timeline-ruler";
import {
  getTrackHeight,
  TIMELINE_CONSTANTS,
  snapTimeToFrame,
} from "@/components/editor/timeline/timeline-constants";
import { TimelineToolbar } from "./timeline-toolbar";
import { TimelineCanvas } from "./timeline";
import { TimelineStudioSync } from "./timeline-studio-sync";
import { useEditorHotkeys } from "@/hooks/use-editor-hotkeys";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Audio as StudioAudio, Image as StudioImage, Log, Video as StudioVideo } from "openvideo";
import { toast } from "sonner";
import { generateUUID } from "@/utils/id";
import type { MediaType } from "@/types/media";
import {
  clearTimelineAssetDragData,
  hasTimelineAssetDragData,
  readTimelineAssetDragData,
  type TimelineAssetDragPayload,
} from "@/lib/timeline-drag";
import { useClipActions } from "../options-floating-menu";

const TRACK_MENU_LABELS = {
  moveTrackUp: "\u4e0a\u79fb\u8f68\u9053",
  moveTrackDown: "\u4e0b\u79fb\u8f68\u9053",
  deleteTrack: "\u5220\u9664\u8f68\u9053",
};

type StudioTrackLike = {
  id: string;
  type?: string;
  clipIds?: string[];
};

const DEFAULT_IMAGE_DURATION_US = 5_000_000;

export function Timeline() {
  const { tracks, clips, getTotalDuration, setTracks: setTimelineTracks } = useTimelineStore();
  const { duration, seek, setDuration } = usePlaybackStore();
  const { studio } = useStudioStore();
  const { canvasSize } = useProjectStore();
  const { theme, resolvedTheme } = useTheme();
  const {
    selectedClip,
    isLocked,
    hasClipboard,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleToggleLock,
    handleDelete,
  } = useClipActions();

  const currentTheme = (theme === "system" ? resolvedTheme : theme) as "dark" | "light";

  const scrollbarColors = useMemo(() => {
    const isDark = currentTheme === "dark";
    return {
      fill: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)",
      stroke: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
    };
  }, [currentTheme]);

  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [isInTimeline, setIsInTimeline] = useState(false);

  // Track mouse down/up for distinguishing clicks from drag/resize ends
  const mouseTrackingRef = useRef({
    isMouseDown: false,
    downX: 0,
    downY: 0,
    downTime: 0,
  });

  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  // Timeline zoom functionality
  const { zoomLevel, setZoomLevel, handleWheel } = useTimelineZoom({
    containerRef: timelineRef,
    isInTimeline,
  });

  // Old marquee selection removed - using new SelectionBox component instead

  // Dynamic timeline width calculation based on playhead position and duration
  const dynamicTimelineWidth = Math.max(
    (duration || 0) * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel, // Base width from duration
    timelineRef.current?.clientWidth || 1000, // Minimum width
  );

  // Scroll synchronization and auto-scroll to playhead
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const tracksScrollRef = useRef<HTMLDivElement>(null);
  const trackLabelsRef = useRef<HTMLDivElement>(null);
  const tracksAreaRef = useRef<HTMLDivElement>(null);
  const tracksContentRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timelineCanvasRef = useRef<TimelineCanvas | null>(null);
  const [canvasInstance, setCanvasInstance] = useState<TimelineCanvas | null>(null);
  const isUpdatingRef = useRef(false);
  const [dragHoverTrackId, setDragHoverTrackId] = useState<string | null>(null);
  const [isTimelineDragActive, setIsTimelineDragActive] = useState(false);
  const lastDragPos = useRef({ x: 0, y: 0 });
  const dragRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    };
  }, []);

  const handleScrollChange = useCallback(
    (scrollX: number) => {
      setScrollLeft(scrollX);
      if (rulerScrollRef.current) {
        rulerScrollRef.current.scrollLeft = scrollX;
      }
      timelineCanvasRef.current?.setScroll(scrollX, undefined);
    },
    [timelineCanvasRef],
  );

  // Timeline playhead ruler handlers
  const { handleRulerMouseDown } = useTimelinePlayheadRuler({
    duration,
    zoomLevel,
    seek,
    rulerRef,
    rulerScrollRef,
    tracksScrollRef,
    playheadRef,
    onScrollChange: handleScrollChange,
  });

  // Timeline content click to seek handler
  const handleTimelineContentClick = useCallback(
    (e: React.MouseEvent) => {
      const { isMouseDown, downX, downY, downTime } = mouseTrackingRef.current;

      // Reset mouse tracking
      mouseTrackingRef.current = {
        isMouseDown: false,
        downX: 0,
        downY: 0,
        downTime: 0,
      };

      // Only process as click if we tracked a mouse down on timeline background
      if (!isMouseDown) {
        return;
      }

      // Check if mouse moved significantly (indicates drag, not click)
      const deltaX = Math.abs(e.clientX - downX);
      const deltaY = Math.abs(e.clientY - downY);
      const deltaTime = e.timeStamp - downTime;

      if (deltaX > 5 || deltaY > 5 || deltaTime > 500) {
        return;
      }

      // Don't seek if clicking on timeline elements, but still deselect
      if ((e.target as HTMLElement).closest(".timeline-element")) {
        return;
      }

      // Don't seek if clicking on playhead
      if (playheadRef.current?.contains(e.target as Node)) {
        return;
      }

      // Clear selected elements when clicking empty timeline area

      // Determine if we're clicking in ruler or tracks area
      const isRulerClick = (e.target as HTMLElement).closest("[data-ruler-area]");

      let mouseX: number;
      let scrollLeft = 0;

      if (isRulerClick) {
        // Calculate based on ruler position
        const rulerContent = rulerScrollRef.current;
        if (!rulerContent) {
          return;
        }
        const rect = rulerContent.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        scrollLeft = rulerContent.scrollLeft;
      } else {
        const tracksContent = tracksScrollRef.current;
        if (!tracksContent) {
          // If tracksScrollRef is gone (because we removed it), we can try to use canvas container if possible,
          // or just rely on ruler if we assume vertical stack is aligned.
          // But playhead seeking usually depends on ruler X.
          // If the user clicked elsewhere?
          // In the new layout, timeline-canvas is in a div. We didn't ref it for clicking yet.
          // But handleTimelineContentClick is attached to...
          // Wait, I removed the "tracksContainerRef" attachment in the previous step?
          // "onMouseDown={handleTimelineMouseDown} ... ref={tracksContainerRef}" was on the removed div.
          // So click seeking on the canvas tracks area MIGHT BE BROKEN unless I re-attach listeners.
          return;
        }
        const rect = tracksContent.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        scrollLeft = tracksContent.scrollLeft;
      }

      const rawTime = Math.max(
        0,
        Math.min(
          duration,
          (mouseX + scrollLeft) / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel),
        ),
      );

      // Use frame snapping for timeline clicking
      const projectFps = 30;
      const time = snapTimeToFrame(rawTime, projectFps);
      seek(time);
    },
    [duration, zoomLevel, seek, rulerScrollRef, tracksScrollRef],
  );

  // Update timeline duration when tracks change
  useEffect(() => {
    const totalDuration = getTotalDuration();
    setDuration(totalDuration);
  }, [tracks, clips, setDuration, getTotalDuration]);

  // Track viewport width
  useEffect(() => {
    if (!timelineRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportWidth(entry.contentRect.width);
      }
    });

    observer.observe(timelineRef.current);
    // Initial width
    setViewportWidth(timelineRef.current.clientWidth);

    return () => observer.disconnect();
  }, []);

  // --- Scroll synchronization effect ---
  // Horizontal scroll synchronization (Ruler -> Canvas) is now handled via canvas.initScrollbars
  // but we still need to keep the UI in sync when the canvas scrolls.

  useEffect(() => {
    const canvas = new TimelineCanvas("timeline-canvas", {
      getDuration: () => useTimelineStore.getState().getTotalDuration(),
    });
    timelineCanvasRef.current = canvas;
    setCanvasInstance(canvas);
    // Set up UI event listeners (scroll/zoom)
    canvas.on("scroll", ({ deltaX, deltaY, scrollX, scrollY }) => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      if (typeof scrollX === "number") {
        setScrollLeft(scrollX);
        if (rulerScrollRef.current) {
          rulerScrollRef.current.scrollLeft = scrollX;
        }
      } else if (deltaX !== 0 && rulerScrollRef.current) {
        const newX = rulerScrollRef.current.scrollLeft + deltaX;
        setScrollLeft(newX);
        rulerScrollRef.current.scrollLeft = newX;
      }

      if (typeof scrollY === "number" && trackLabelsRef.current) {
        trackLabelsRef.current.scrollTop = scrollY;
      } else if (deltaY !== 0 && trackLabelsRef.current) {
        trackLabelsRef.current.scrollTop += deltaY;
      }

      isUpdatingRef.current = false;
    });

    canvas.on("zoom", ({ delta, zoomLevel: newZoomLevel }) => {
      if (typeof newZoomLevel === "number") {
        setZoomLevel(newZoomLevel);
        return;
      }
      handleWheel({
        ctrlKey: true,
        deltaY: delta,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any);
    });

    canvas.initScrollbars({
      offsetX: 0,
      offsetY: 0,
      extraMarginX: 50,
      extraMarginY: 15,
      scrollbarWidth: 8,
      scrollbarColor: scrollbarColors.fill,
    });

    canvas.setTracks(tracks, clips);

    return () => {
      canvas.dispose();
    };
  }, []);

  // Listen for clip replacement (e.g. Placeholder -> Video)
  useEffect(() => {
    const studio = useStudioStore.getState().studio;
    if (!studio) return;

    const onReplaced = ({ newClip }: { newClip: any }) => {
      // Reload the clip in the timeline canvas to fetch thumbnails
      // We use newClip.id as it's the active clip now
      timelineCanvasRef.current?.reloadClip(newClip.id);
    };

    studio.on("clip:replaced", onReplaced);

    return () => {
      studio.off("clip:replaced", onReplaced);
    };
  }, []);

  useEffect(() => {
    if (timelineCanvasRef.current) {
      timelineCanvasRef.current.setTimeScale(zoomLevel);
      timelineCanvasRef.current.setTracks(tracks, clips);
    }
  }, [zoomLevel, tracks, clips]);

  useEffect(() => {
    if (timelineCanvasRef.current) {
      timelineCanvasRef.current.updateTheme(currentTheme);
    }
  }, [currentTheme]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasInstance) return;

      // Find object under mouse
      const target = canvasInstance.canvas.findTarget(e.nativeEvent);

      if (target && (target as any).elementId) {
        const clipId = (target as any).elementId;
        canvasInstance.selectClips([clipId]);
      }
    },
    [canvasInstance],
  );
  const handleSplit = useCallback(() => {
    // Current time is in seconds in PlaybackStore. Canvas expects microseconds.
    const splitTime = usePlaybackStore.getState().currentTime * 1_000_000;
    studio?.splitSelected(splitTime);
  }, [studio]);

  const isTrackTypeCompatible = useCallback((assetType: MediaType, trackType?: string) => {
    const normalizedType = (trackType || "").toLowerCase();
    if (assetType === "audio") {
      return normalizedType === "audio";
    }
    if (assetType === "image") {
      return (
        normalizedType === "image" || normalizedType === "video" || normalizedType === "placeholder"
      );
    }
    return normalizedType === "video" || normalizedType === "placeholder";
  }, []);

  const getStudioTracks = useCallback((): StudioTrackLike[] => {
    const studioTracks = (studio as any)?.getTracks?.();
    if (Array.isArray(studioTracks)) {
      return studioTracks as StudioTrackLike[];
    }
    return tracks as unknown as StudioTrackLike[];
  }, [studio, tracks]);

  const getTrackClipInfos = useCallback(
    (track: StudioTrackLike): Array<{ id: string; from: number; to: number }> => {
      const clipIds = Array.isArray(track.clipIds) ? track.clipIds : [];
      const clipInfos: Array<{ id: string; from: number; to: number }> = [];
      const getClip = (studio as any)?.getClip ?? (studio as any)?.getClipById;

      for (const clipId of clipIds) {
        if (typeof clipId !== "string" || typeof getClip !== "function") continue;
        const clip = getClip.call(studio, clipId) as
          | {
              display?: { from?: number; to?: number };
              duration?: number;
            }
          | undefined;

        const from = Number(clip?.display?.from);
        const to = Number(clip?.display?.to);
        if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
          clipInfos.push({ id: clipId, from, to });
          continue;
        }

        const duration = Number(clip?.duration);
        if (Number.isFinite(from) && Number.isFinite(duration) && duration > 0) {
          clipInfos.push({ id: clipId, from, to: from + duration });
        }
      }

      return clipInfos.sort((a, b) => a.from - b.from);
    },
    [studio],
  );

  const getClipDurationUs = useCallback(
    (
      clip: {
        display?: { from?: number; to?: number };
        duration?: number;
      },
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
    },
    [],
  );

  const rippleShiftTrackClips = useCallback(
    async (trackId: string | undefined, insertStartUs: number, deltaUs: number) => {
      if (!studio || !trackId || deltaUs <= 0) return;

      const targetTrack = getStudioTracks().find((track) => track.id === trackId);
      if (!targetTrack) return;

      const clipsToShift = getTrackClipInfos(targetTrack).filter(
        (clip) => clip.from >= insertStartUs,
      );
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

      const batchUpdate = (studio as any)?.updateClips;
      if (typeof batchUpdate === "function") {
        await batchUpdate.call(studio, shiftedUpdates);
        return;
      }

      const singleUpdate = (studio as any)?.updateClip;
      if (typeof singleUpdate === "function") {
        for (const update of shiftedUpdates) {
          await singleUpdate.call(studio, update.id, update.updates);
        }
      }
    },
    [getStudioTracks, getTrackClipInfos, studio],
  );

  const buildTrackName = useCallback((trackType: TrackType, existingTracks: StudioTrackLike[]) => {
    const sequence =
      existingTracks.filter(
        (track) => String(track.type || "").toLowerCase() === trackType.toLowerCase(),
      ).length + 1;
    return `${trackType} ${sequence}`;
  }, []);

  const appendTrack = useCallback(
    (trackType: TrackType) => {
      const currentTracks = useTimelineStore.getState().tracks as unknown as StudioTrackLike[];
      const newTrack = {
        id: generateUUID(),
        name: buildTrackName(trackType, currentTracks),
        type: trackType,
        clipIds: [],
        muted: false,
      };
      const nextTracks = [...currentTracks, newTrack] as TimelineTrack[];

      setTimelineTracks(nextTracks);
      if (studio && typeof (studio as any).setTracks === "function") {
        (studio as any).setTracks(nextTracks);
      }

      return newTrack.id;
    },
    [buildTrackName, setTimelineTracks, studio],
  );

  const handleCreateTrack = useCallback(
    (trackType: TrackType) => {
      appendTrack(trackType);
      toast.success(`${trackType} created.`);
    },
    [appendTrack],
  );

  const handleDeleteTrack = useCallback(
    async (trackId: string) => {
      const currentTracks = useTimelineStore.getState().tracks;
      const targetTrack = currentTracks.find((track) => track.id === trackId);
      if (!targetTrack) return;

      const clipIds = Array.isArray(targetTrack.clipIds) ? targetTrack.clipIds : [];
      if (clipIds.length > 0) {
        const confirmed = window.confirm(
          `Delete this track and ${clipIds.length} clip(s) on it? This cannot be undone.`,
        );
        if (!confirmed) return;

        try {
          if (studio && typeof (studio as any).removeClipsById === "function") {
            await (studio as any).removeClipsById(clipIds);
          } else if (studio && typeof (studio as any).removeClipById === "function") {
            for (const clipId of clipIds) {
              await (studio as any).removeClipById(clipId);
            }
          }
        } catch (error) {
          console.error("Failed to remove clips before deleting track:", error);
          toast.error("Failed to delete track clips.");
          return;
        }
      }

      const nextTracks = useTimelineStore.getState().tracks.filter((track) => track.id !== trackId);
      setTimelineTracks(nextTracks);
      if (studio && typeof (studio as any).setTracks === "function") {
        (studio as any).setTracks(nextTracks);
      }
      toast.success("Track deleted.");
    },
    [setTimelineTracks, studio],
  );

  const getTrackIdFromClientY = useCallback(
    (clientY: number) => {
      const tracksAreaEl = tracksAreaRef.current;
      if (!tracksAreaEl) return undefined;

      const scrollTop = trackLabelsRef.current?.scrollTop || 0;
      const localY = clientY - tracksAreaEl.getBoundingClientRect().top + scrollTop;
      let cursorY = TIMELINE_CONSTANTS.TRACK_PADDING_TOP;

      for (const track of tracks) {
        const trackHeight = getTrackHeight(track.type);
        if (localY >= cursorY && localY <= cursorY + trackHeight) {
          return track.id;
        }
        cursorY += trackHeight + TIMELINE_CONSTANTS.TRACK_SPACING;
      }

      return undefined;
    },
    [tracks],
  );

  const getFallbackTrackIdForAsset = useCallback(
    (assetType: MediaType) => {
      const compatibleTrack = tracks.find((track) => isTrackTypeCompatible(assetType, track.type));
      return compatibleTrack?.id;
    },
    [isTrackTypeCompatible, tracks],
  );

  const ensureTargetTrackId = useCallback(
    (assetType: MediaType, preferredTrackId?: string) => {
      if (preferredTrackId) {
        const preferredTrack = tracks.find((track) => track.id === preferredTrackId);
        if (preferredTrack && isTrackTypeCompatible(assetType, preferredTrack.type)) {
          return preferredTrack.id;
        }
      }

      const fallbackTrackId = getFallbackTrackIdForAsset(assetType);
      if (fallbackTrackId) return fallbackTrackId;

      if (assetType === "audio") {
        return appendTrack("Audio");
      }
      if (assetType === "image") {
        return appendTrack("Image");
      }
      return appendTrack("Video");
    },
    [appendTrack, getFallbackTrackIdForAsset, isTrackTypeCompatible, tracks],
  );

  const getDropInsertTimeUs = useCallback(
    (clientX: number) => {
      const fallbackUs = Math.max(
        0,
        Math.round(usePlaybackStore.getState().currentTime * 1_000_000),
      );
      const trackContentEl = tracksContentRef.current;
      if (!trackContentEl) return fallbackUs;

      const rect = trackContentEl.getBoundingClientRect();
      const localX = Math.max(0, clientX - rect.left + scrollLeft);
      const rawTime = localX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel);
      const snappedTime = snapTimeToFrame(Math.max(0, rawTime), 30);
      return Math.max(0, Math.round(snappedTime * 1_000_000));
    },
    [scrollLeft, zoomLevel],
  );

  const addDraggedAssetToTrack = useCallback(
    async (payload: TimelineAssetDragPayload, trackId: string, insertStartUs: number) => {
      if (!studio) return;

      const fallbackDurationUs =
        typeof payload.duration === "number" &&
        Number.isFinite(payload.duration) &&
        payload.duration > 0
          ? payload.duration * 1_000_000
          : undefined;

      if (payload.type === "image") {
        const imageClip = await StudioImage.fromUrl(payload.src);
        imageClip.name = payload.name;
        await rippleShiftTrackClips(trackId, insertStartUs, DEFAULT_IMAGE_DURATION_US);
        imageClip.display = {
          from: insertStartUs,
          to: insertStartUs + DEFAULT_IMAGE_DURATION_US,
        };
        imageClip.duration = DEFAULT_IMAGE_DURATION_US;
        await imageClip.scaleToFit(canvasSize.width, canvasSize.height);
        imageClip.centerInScene(canvasSize.width, canvasSize.height);
        await studio.addClip(imageClip, { trackId });
        return;
      }

      if (payload.type === "audio") {
        const audioClip = await StudioAudio.fromUrl(payload.src);
        audioClip.name = payload.name;
        const durationUs = getClipDurationUs(audioClip as any, fallbackDurationUs);
        await rippleShiftTrackClips(trackId, insertStartUs, durationUs);
        if (durationUs > 0) {
          (audioClip as any).display = {
            from: insertStartUs,
            to: insertStartUs + durationUs,
          };
        }
        await studio.addClip(audioClip, { trackId });
        return;
      }

      const videoClip = await StudioVideo.fromUrl(payload.src);
      videoClip.name = payload.name;
      const durationUs = getClipDurationUs(videoClip as any, fallbackDurationUs);
      await rippleShiftTrackClips(trackId, insertStartUs, durationUs);
      if (durationUs > 0) {
        (videoClip as any).display = {
          from: insertStartUs,
          to: insertStartUs + durationUs,
        };
      }
      await videoClip.scaleToFit(canvasSize.width, canvasSize.height);
      videoClip.centerInScene(canvasSize.width, canvasSize.height);
      await studio.addClip(videoClip, { trackId });
    },
    [canvasSize.height, canvasSize.width, getClipDurationUs, rippleShiftTrackClips, studio],
  );

  const clearDragState = useCallback(() => {
    setIsTimelineDragActive(false);
    setDragHoverTrackId(null);
    clearTimelineAssetDragData();
  }, []);

  const handleTimelineDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!hasTimelineAssetDragData(event.dataTransfer)) return;

      const payload = readTimelineAssetDragData(event.dataTransfer);
      if (!payload) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsTimelineDragActive(true);

      const hoveredTrackId = getTrackIdFromClientY(event.clientY);
      if (hoveredTrackId) {
        const hoveredTrack = tracks.find((track) => track.id === hoveredTrackId);
        if (hoveredTrack && isTrackTypeCompatible(payload.type, hoveredTrack.type)) {
          setDragHoverTrackId(hoveredTrackId);
          return;
        }
      }

      setDragHoverTrackId(getFallbackTrackIdForAsset(payload.type) || null);
    },
    [getFallbackTrackIdForAsset, getTrackIdFromClientY, isTrackTypeCompatible, tracks],
  );

  const handleTimelineDrop = useCallback(
    async (event: React.DragEvent<HTMLElement>) => {
      const payload = readTimelineAssetDragData(event.dataTransfer);
      if (!payload) {
        clearDragState();
        return;
      }

      event.preventDefault();
      clearDragState();

      if (!studio) {
        toast.error("Editor is not ready yet.");
        return;
      }

      const hoveredTrackId = getTrackIdFromClientY(event.clientY);
      const targetTrackId = ensureTargetTrackId(payload.type, hoveredTrackId);
      if (!targetTrackId) {
        toast.error("No compatible track is available.");
        return;
      }

      const insertStartUs = getDropInsertTimeUs(event.clientX);
      try {
        await addDraggedAssetToTrack(payload, targetTrackId, insertStartUs);
      } catch (error) {
        Log.error("Failed to add dragged asset to timeline:", error);
        toast.error("Failed to add asset to timeline.");
      }
    },
    [
      addDraggedAssetToTrack,
      clearDragState,
      ensureTargetTrackId,
      getDropInsertTimeUs,
      getTrackIdFromClientY,
      studio,
    ],
  );

  const handleTimelineDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
        return;
      }
      clearDragState();
    },
    [clearDragState],
  );

  useEditorHotkeys({
    timelineCanvas: timelineCanvasRef.current,
    setZoomLevel,
  });

  return (
    <div
      className={
        "h-full flex flex-col transition-colors duration-200 relative bg-card rounded-sm overflow-hidden"
      }
      onMouseEnter={() => setIsInTimeline(true)}
      onMouseLeave={() => setIsInTimeline(false)}
    >
      <TimelineToolbar
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onSplit={handleSplit}
        onAddTrack={(trackType) => handleCreateTrack(trackType)}
      />
      <TimelineStudioSync timelineCanvas={canvasInstance} />

      {/* Timeline Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-card" ref={timelineRef}>
        <TimelinePlayhead
          duration={duration}
          zoomLevel={zoomLevel}
          tracks={tracks}
          seek={seek}
          rulerRef={rulerRef}
          rulerScrollRef={rulerScrollRef}
          tracksScrollRef={tracksScrollRef}
          trackLabelsRef={trackLabelsRef}
          timelineRef={timelineRef}
          playheadRef={playheadRef}
          isSnappingToPlayhead={false}
          scrollLeft={scrollLeft}
          onScrollChange={handleScrollChange}
        />

        {/* Timeline Header with Ruler */}
        <div className="flex sticky top-0">
          {/* Track Labels Header */}
          <div className="w-16 shrink-0 bg-card border-r flex items-center justify-between h-6">
            <span className="text-sm font-medium text-muted-foreground opacity-0">.</span>
          </div>

          {/* Timeline Ruler */}
          <div
            className={cn("flex-1 relative overflow-hidden h-6", duration === 0 && "opacity-0")}
            onWheel={(e) => {
              // Check if this is horizontal scrolling - if so, don't handle it here
              if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                return; // Let ScrollArea handle horizontal scrolling
              }
              handleWheel(e);
            }}
            onClick={handleTimelineContentClick}
            data-ruler-area
          >
            <ScrollArea
              className="w-full scrollbar-hidden"
              ref={rulerScrollRef}
              onScroll={(e) => {
                if (isUpdatingRef.current) return;
                const scrollX = (e.currentTarget as HTMLDivElement).scrollLeft;
                handleScrollChange(scrollX);
              }}
            >
              <div
                ref={rulerRef}
                className="relative h-6 select-none cursor-default"
                style={{
                  width: `${dynamicTimelineWidth}px`,
                }}
                onMouseDown={handleRulerMouseDown}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    transform: `translateX(${scrollLeft}px)`,
                    width: viewportWidth ? `${viewportWidth - 64}px` : "100%",
                  }}
                >
                  <TimelineRuler
                    zoomLevel={zoomLevel}
                    duration={duration}
                    width={viewportWidth ? viewportWidth - 64 : 1000}
                    scrollLeft={scrollLeft}
                  />
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Tracks Area */}
        <div
          ref={tracksAreaRef}
          className={cn(
            "flex-1 flex overflow-hidden transition-colors",
            isTimelineDragActive && "bg-primary/5",
          )}
          onDragOver={handleTimelineDragOver}
          onDrop={handleTimelineDrop}
          onDragLeave={handleTimelineDragLeave}
        >
          {/* Track Labels */}
          {tracks.length > 0 && (
            <div
              ref={trackLabelsRef}
              className="w-16 shrink-0 overflow-y-hidden z-10"
              data-track-labels
            >
              <div className="flex flex-col">
                {tracks.map((track, index) => (
                  <div key={track.id}>
                    {/* Top separator for first track */}
                    {index === 0 && (
                      <div
                        className="w-full"
                        style={{
                          height: `${TIMELINE_CONSTANTS.TRACK_PADDING_TOP}px`,
                          marginBottom: "0px",
                          background: "transparent",
                        }}
                      />
                    )}

                    <div
                      className={cn(
                        "flex items-center px-3 group transition-colors",
                        dragHoverTrackId === track.id
                          ? "bg-primary/15 ring-1 ring-inset ring-primary/40"
                          : "bg-input/40",
                      )}
                      style={{ height: getTrackHeight(track.type as any) }}
                    >
                      <div className="flex items-center justify-center flex-1 min-w-0 gap-1">
                        <TrackIcon track={track} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-4 p-0 h-6 w-4">
                              <Ellipsis className="size-3 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" side="right">
                            <DropdownMenuItem
                              disabled={index === 0}
                              onClick={() => {
                                const { moveTrack } = useTimelineStore.getState();
                                moveTrack(track.id, index - 1);
                              }}
                            >
                              <ArrowUp className="size-4 mr-2" />
                              {TRACK_MENU_LABELS.moveTrackUp}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={index === tracks.length - 1}
                              onClick={() => {
                                const { moveTrack } = useTimelineStore.getState();
                                moveTrack(track.id, index + 1);
                              }}
                            >
                              <ArrowDown className="size-4 mr-2" />
                              {TRACK_MENU_LABELS.moveTrackDown}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                void handleDeleteTrack(track.id);
                              }}
                            >
                              <Trash2 className="size-4 mr-2" />
                              {TRACK_MENU_LABELS.deleteTrack}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Separator after each track */}
                    <div
                      className="w-full relative"
                      style={{
                        height: `${TIMELINE_CONSTANTS.TRACK_SPACING}px`,
                        background: "transparent",
                      }}
                    ></div>
                  </div>
                ))}
                {/* Spacer to match canvas extraMarginY */}
                <div style={{ height: "15px", flexShrink: 0 }} />
              </div>
            </div>
          )}

          <div
            ref={tracksContentRef}
            className={cn(
              "flex-1 relative overflow-hidden transition-colors",
              isTimelineDragActive && "bg-primary/5",
            )}
          >
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  id="timeline-canvas"
                  className="w-full h-full"
                  onContextMenu={handleContextMenu}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!timelineCanvasRef.current) return;

                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;

                    // Spatial debounce: only update if moved significantly
                    const dx = Math.abs(x - lastDragPos.current.x);
                    const dy = Math.abs(y - lastDragPos.current.y);
                    if (dx < 2 && dy < 2) return;

                    lastDragPos.current = { x, y };

                    if (dragRafRef.current) return;
                    dragRafRef.current = requestAnimationFrame(() => {
                      dragRafRef.current = null;
                      timelineCanvasRef.current?.findJunction(x, y, true);
                    });
                  }}
                  onDragLeave={() => {
                    if (timelineCanvasRef.current) {
                      timelineCanvasRef.current.clearTransitionButton();
                    }
                  }}
                  onDrop={async (e) => {
                    const type = e.dataTransfer.getData("type");
                    if (type !== "transition") return;

                    const transitionKey = e.dataTransfer.getData("text/plain");
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;

                    if (timelineCanvasRef.current && studio) {
                      const existingTransition = timelineCanvasRef.current.findTransition(x, y);

                      if (existingTransition) {
                        const clipA = clips[existingTransition.clipAId];
                        const clipB = clips[existingTransition.clipBId];
                        const minDuration = Math.min(
                          clipA?.duration ?? Infinity,
                          clipB?.duration ?? Infinity,
                        );
                        let duration = minDuration === Infinity ? 2_000_000 : minDuration * 0.25;
                        const fps = 30;
                        let frameCount = Math.round((duration / 1_000_000) * fps);
                        if (frameCount % 2 !== 0) frameCount += 1;
                        duration = Math.round((frameCount / fps) * 1_000_000);

                        await studio.addTransition(
                          transitionKey,
                          duration,
                          existingTransition.clipAId,
                          existingTransition.clipBId,
                        );
                      } else {
                        const junction = timelineCanvasRef.current.getJunction(
                          x,
                          y,
                          true, // Use expanded logic for drop as well
                        );
                        if (junction) {
                          const minDuration = Math.min(
                            junction.clipA.duration ?? Infinity,
                            junction.clipB.duration ?? Infinity,
                          );
                          let duration = minDuration === Infinity ? 2_000_000 : minDuration * 0.25;
                          const fps = 30;
                          let frameCount = Math.round((duration / 1_000_000) * fps);
                          if (frameCount % 2 !== 0) frameCount += 1;
                          duration = Math.round((frameCount / fps) * 1_000_000);

                          await studio.addTransition(
                            transitionKey,
                            duration,
                            junction.clipA.id,
                            junction.clipB.id,
                          );
                        }
                      }
                    }
                  }}
                />
              </ContextMenuTrigger>
              {selectedClip && selectedClip?.type !== "Transition" && (
                <ContextMenuContent
                  className="w-44"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {!isLocked && (
                    <>
                      <ContextMenuItem onClick={handleCopy} disabled={!selectedClip}>
                        <Copy className="mr-2 w-4 h-4" />
                        Copy
                        <ContextMenuShortcut>⌘ C</ContextMenuShortcut>
                      </ContextMenuItem>

                      <ContextMenuItem onClick={handlePaste} disabled={!hasClipboard}>
                        <Clipboard className="mr-2 w-4 h-4" />
                        Paste
                        <ContextMenuShortcut>⌘ V</ContextMenuShortcut>
                      </ContextMenuItem>

                      <ContextMenuItem onClick={handleDuplicate} disabled={!selectedClip}>
                        <CopyPlus className="mr-2 w-4 h-4" />
                        Duplicate
                        <ContextMenuShortcut>⌘ D</ContextMenuShortcut>
                      </ContextMenuItem>
                    </>
                  )}

                  {selectedClip ? (
                    <ContextMenuItem onClick={handleToggleLock}>
                      {isLocked ? (
                        <LockKeyholeOpen className="mr-2 w-4 h-4" />
                      ) : (
                        <LockKeyhole className="mr-2 w-4 h-4" />
                      )}
                      {isLocked ? "Unlock Clip" : "Lock Clip"}
                      <ContextMenuShortcut>⌘ L</ContextMenuShortcut>
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuItem disabled>
                      <LockKeyhole className="mr-2 w-4 h-4" />
                      Lock Clip
                      <ContextMenuShortcut>⌘ L</ContextMenuShortcut>
                    </ContextMenuItem>
                  )}

                  {!isLocked && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={handleDelete} disabled={!selectedClip}>
                        <Trash2 className="mr-2 w-4 h-4" />
                        Delete
                        <ContextMenuShortcut>⌫</ContextMenuShortcut>
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              )}
            </ContextMenu>
            {/* <TimelineClipMenu timelineCanvas={canvasInstance} /> */}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackIcon({ track }: { track: TimelineTrack }) {
  return (
    <>
      {track.type === "Image" && <Image className="w-4 h-4 shrink-0 text-muted-foreground" />}
      {(track.type === "Video" || track.type === "Placeholder") && (
        <Video className="w-4 h-4 shrink-0 text-muted-foreground" />
      )}
      {track.type === "Text" && <TypeIcon className="w-4 h-4 shrink-0 text-muted-foreground" />}
      {track.type === "Caption" && <TypeIcon className="w-4 h-4 shrink-0 text-muted-foreground" />}
      {track.type === "Audio" && <Music className="w-4 h-4 shrink-0 text-muted-foreground" />}
      {track.type === "Effect" && (
        <SparklesIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
      )}
    </>
  );
}
