import { type NextRequest, NextResponse } from "next/server";

const EMPTY_SOURCE_MAP = JSON.stringify({
  version: 3,
  file: "",
  sources: [],
  sourcesContent: [],
  names: [],
  mappings: "",
});

const OPFS_WORKER_SOURCE_MAP_PATH = /^\/opfs-worker-[\w-]+\.js\.map$/;

export function proxy(request: NextRequest) {
  if (OPFS_WORKER_SOURCE_MAP_PATH.test(request.nextUrl.pathname)) {
    return new NextResponse(EMPTY_SOURCE_MAP, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/opfs-worker-:path*"],
};
