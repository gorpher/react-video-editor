import type { MediaType } from "@/types/media";

export const TIMELINE_ASSET_DRAG_MIME = "application/x-openvideo-timeline-asset";
const TIMELINE_ASSET_DRAG_TEXT_PREFIX = "__openvideo_timeline_asset__:";

let activeTimelineAssetDragPayload: TimelineAssetDragPayload | null = null;

export interface TimelineAssetDragPayload {
  id: string;
  type: MediaType;
  src: string;
  name: string;
  duration?: number;
}

function isValidMediaType(value: unknown): value is MediaType {
  return value === "image" || value === "video" || value === "audio";
}

export function hasTimelineAssetDragData(dataTransfer: DataTransfer | null | undefined): boolean {
  if (activeTimelineAssetDragPayload) return true;
  if (!dataTransfer) return false;

  const types = Array.from(dataTransfer.types || []);
  if (types.includes(TIMELINE_ASSET_DRAG_MIME)) return true;
  if (!types.includes("text/plain")) return false;

  const plainText = dataTransfer.getData("text/plain");
  return plainText.startsWith(TIMELINE_ASSET_DRAG_TEXT_PREFIX);
}

export function writeTimelineAssetDragData(
  dataTransfer: DataTransfer,
  payload: TimelineAssetDragPayload,
) {
  activeTimelineAssetDragPayload = payload;
  const serialized = JSON.stringify(payload);
  dataTransfer.setData(TIMELINE_ASSET_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", `${TIMELINE_ASSET_DRAG_TEXT_PREFIX}${serialized}`);
}

export function clearTimelineAssetDragData() {
  activeTimelineAssetDragPayload = null;
}

export function readTimelineAssetDragData(
  dataTransfer: DataTransfer | null | undefined,
): TimelineAssetDragPayload | null {
  if (activeTimelineAssetDragPayload) {
    return activeTimelineAssetDragPayload;
  }

  if (!dataTransfer) return null;

  const raw = dataTransfer.getData(TIMELINE_ASSET_DRAG_MIME);
  const plainText = dataTransfer.getData("text/plain");
  const fallbackRaw = plainText.startsWith(TIMELINE_ASSET_DRAG_TEXT_PREFIX)
    ? plainText.slice(TIMELINE_ASSET_DRAG_TEXT_PREFIX.length)
    : "";
  const payloadRaw = raw || fallbackRaw;

  if (!payloadRaw) return null;

  try {
    const parsed = JSON.parse(payloadRaw) as Partial<TimelineAssetDragPayload>;
    if (
      typeof parsed.id !== "string" ||
      !isValidMediaType(parsed.type) ||
      typeof parsed.src !== "string" ||
      typeof parsed.name !== "string"
    ) {
      return null;
    }

    const duration = Number(parsed.duration);
    return {
      id: parsed.id,
      type: parsed.type,
      src: parsed.src,
      name: parsed.name,
      duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    };
  } catch {
    return null;
  }
}
