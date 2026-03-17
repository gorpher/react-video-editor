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

export async function GET(request: NextRequest) {
  if (!getAifilmApiBaseUrl()) {
    return NextResponse.json(
      {
        error:
          "AIFilm API base URL is not configured. Set AIFILM_API_BASE_URL or NEXT_PUBLIC_AIFILM_API_BASE_URL.",
      },
      { status: 503 },
    );
  }

  const requestUrl = new URL(request.url);
  const upstreamUrl = buildAifilmApiUrl("/api/v1/media", requestUrl.search);
  if (!upstreamUrl) {
    return NextResponse.json({ error: "AIFilm API base URL is invalid." }, { status: 503 });
  }

  try {
    const response = await fetch(upstreamUrl, {
      headers: buildAifilmRequestHeaders(request.headers),
      cache: "no-store",
    });
    const text = await response.text();
    const payload = text ? (JSON.parse(text) as { items?: AifilmMediaItem[] }) : {};

    if (!response.ok) {
      const errorMessage = getErrorMessage(payload, "Failed to load AIFilm media.");
      console.error("[AIFilmMedia] Failed to fetch list", {
        status: response.status,
        upstreamUrl,
        errorMessage,
      });
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const items = Array.isArray(payload.items)
      ? payload.items.map((item) => ({
          ...item,
          url: toAifilmProxyMediaUrl(item.url),
        }))
      : [];

    console.info("[AIFilmMedia] Loaded media list", { count: items.length });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[AIFilmMedia] Unexpected list proxy error", error);
    return NextResponse.json({ error: "Failed to load AIFilm media." }, { status: 500 });
  }
}
