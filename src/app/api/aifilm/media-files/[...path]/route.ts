import { type NextRequest, NextResponse } from "next/server";

import {
  buildAifilmApiUrl,
  buildAifilmFilePath,
  buildAifilmRequestHeaders,
  getAifilmApiBaseUrl,
} from "@/lib/aifilm-media";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function buildProxyHeaders(response: Response) {
  const headers = new Headers();
  const allowedHeaders = [
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
    "cache-control",
    "etag",
    "last-modified",
    "content-disposition",
  ];

  for (const headerName of allowedHeaders) {
    const value = response.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

async function proxyAifilmMediaFile(
  request: NextRequest,
  context: RouteContext,
  method: "GET" | "HEAD",
) {
  if (!getAifilmApiBaseUrl()) {
    return NextResponse.json(
      {
        error:
          "AIFilm API base URL is not configured. Set AIFILM_API_BASE_URL or NEXT_PUBLIC_AIFILM_API_BASE_URL.",
      },
      { status: 503 },
    );
  }

  const { path = [] } = await context.params;
  if (path.length < 3) {
    return NextResponse.json({ error: "Invalid AIFilm media path." }, { status: 400 });
  }

  const requestUrl = new URL(request.url);
  const upstreamUrl = buildAifilmApiUrl(buildAifilmFilePath(path), requestUrl.search);
  if (!upstreamUrl) {
    return NextResponse.json({ error: "AIFilm API base URL is invalid." }, { status: 503 });
  }

  const headers = buildAifilmRequestHeaders(request.headers);
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    headers.set("range", rangeHeader);
  }

  try {
    const response = await fetch(upstreamUrl, {
      method,
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[AIFilmMedia] Failed to proxy media file", {
        status: response.status,
        upstreamUrl,
        method,
      });
    }

    const proxyHeaders = buildProxyHeaders(response);
    if (method === "HEAD") {
      return new NextResponse(null, {
        status: response.status,
        headers: proxyHeaders,
      });
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: proxyHeaders,
    });
  } catch (error) {
    console.error("[AIFilmMedia] Unexpected media proxy error", error);
    return NextResponse.json({ error: "Failed to proxy AIFilm media." }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyAifilmMediaFile(request, context, "GET");
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyAifilmMediaFile(request, context, "HEAD");
}
