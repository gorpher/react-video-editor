import { type NextRequest, NextResponse } from "next/server";

import {
  buildAifilmApiUrl,
  buildAifilmRequestHeaders,
  type AifilmMediaItem,
  getAifilmApiBaseUrl,
  toAifilmProxyMediaUrl,
} from "@/lib/aifilm-media";

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as { error?: unknown; message?: unknown };
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (record.error && typeof record.error === "object") {
      const nested = record.error as { message?: unknown };
      if (typeof nested.message === "string" && nested.message.trim()) {
        return nested.message;
      }
    }
  }

  return fallback;
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!getAifilmApiBaseUrl()) {
    return NextResponse.json({
      items: [],
      unavailable: true,
      error:
        "AIFilm API base URL is not configured. Set AIFILM_API_BASE_URL or NEXT_PUBLIC_AIFILM_API_BASE_URL.",
    });
  }

  const requestUrl = new URL(request.url);
  const upstreamUrl = buildAifilmApiUrl("/api/v1/media", requestUrl.search);
  if (!upstreamUrl) {
    return NextResponse.json({
      items: [],
      unavailable: true,
      error: "AIFilm API base URL is invalid.",
    });
  }

  try {
    const response = await fetch(upstreamUrl, {
      headers: buildAifilmRequestHeaders(request.headers),
      cache: "no-store",
    });

    const text = await response.text();
    const parsedPayload = text ? safeParseJson(text) : {};
    const payload =
      parsedPayload && typeof parsedPayload === "object"
        ? (parsedPayload as { items?: AifilmMediaItem[] })
        : null;

    if (!response.ok) {
      const errorMessage = getErrorMessage(
        payload ?? text,
        "AIFilm media is temporarily unavailable.",
      );
      console.warn("[AIFilmMedia] Upstream list request unavailable", {
        status: response.status,
        upstreamUrl,
        errorMessage,
      });
      return NextResponse.json({
        items: [],
        unavailable: true,
        error: errorMessage,
      });
    }

    if (text && !payload) {
      console.warn("[AIFilmMedia] Upstream returned non-JSON list payload", {
        upstreamUrl,
        status: response.status,
        contentType: response.headers.get("content-type") ?? "unknown",
      });
      return NextResponse.json({
        items: [],
        unavailable: true,
        error: "AIFilm media returned an unexpected response format.",
      });
    }

    const items = Array.isArray(payload?.items)
      ? payload.items.map((item) => ({
          ...item,
          url: toAifilmProxyMediaUrl(item.url),
        }))
      : [];

    console.info("[AIFilmMedia] Loaded media list", { count: items.length });
    return NextResponse.json({ items, unavailable: false });
  } catch (error) {
    console.warn("[AIFilmMedia] Unexpected list proxy error", error);
    return NextResponse.json({
      items: [],
      unavailable: true,
      error: "AIFilm media is temporarily unavailable.",
    });
  }
}
