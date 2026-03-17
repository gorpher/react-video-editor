export type AifilmMediaType = "image" | "video" | "audio" | "archive" | "document" | "binary";

export interface AifilmMediaItem {
  id: string;
  ownerId: string;
  projectId?: string;
  sourceType: string;
  mediaType: AifilmMediaType;
  mimeType?: string;
  filename: string;
  storageKey: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  sha256?: string;
  meta?: unknown;
  createdAt: string;
  url: string;
}

const MEDIA_FILE_PREFIX = "/api/v1/media/files/";
const PROXY_MEDIA_FILE_PREFIX = "/api/aifilm/media-files/";

export function getAifilmApiBaseUrl() {
  const baseUrl =
    process.env.AIFILM_API_BASE_URL ?? process.env.NEXT_PUBLIC_AIFILM_API_BASE_URL ?? "";
  return baseUrl.trim().replace(/\/+$/, "");
}

export function buildAifilmApiUrl(pathname: string, search = "") {
  const baseUrl = getAifilmApiBaseUrl();
  if (!baseUrl) return null;

  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${baseUrl}${cleanPath}${search}`;
}

export function buildAifilmRequestHeaders(requestHeaders: Headers, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  const cookieHeader = requestHeaders.get("cookie");
  const devUserId = process.env.AIFILM_DEV_USER_ID ?? process.env.NEXT_PUBLIC_AIFILM_DEV_USER_ID;

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  if (devUserId?.trim()) {
    headers.set("x-dev-user-id", devUserId.trim());
  }

  return headers;
}

export function buildAifilmFilePath(pathSegments: string[]) {
  const normalized = pathSegments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));

  return `${MEDIA_FILE_PREFIX}${normalized.join("/")}`;
}

export function toAifilmProxyMediaUrl(rawUrl: string) {
  const clean = rawUrl.trim();
  if (!clean) return clean;
  if (clean.startsWith(PROXY_MEDIA_FILE_PREFIX)) return clean;

  try {
    const parsed = clean.startsWith("http") ? new URL(clean) : new URL(clean, "http://localhost");
    const pathAndSearch = `${parsed.pathname}${parsed.search}`;
    if (!pathAndSearch.startsWith(MEDIA_FILE_PREFIX)) {
      return clean;
    }

    return `${PROXY_MEDIA_FILE_PREFIX}${pathAndSearch.slice(MEDIA_FILE_PREFIX.length)}`;
  } catch {
    return clean;
  }
}
