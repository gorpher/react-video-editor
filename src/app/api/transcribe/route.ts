// app/api/transcribe/route.ts
import { NextResponse } from "next/server";
import { transcribe } from "@/lib/transcribe";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let url: string | undefined;
    let targetLanguage: string | undefined;
    let language: string | undefined;
    let model: string | undefined;
    let audioData: ArrayBuffer | undefined;
    let mimeType: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      url = formData.get("url")?.toString();
      targetLanguage = formData.get("targetLanguage")?.toString();
      language = formData.get("language")?.toString();
      model = formData.get("model")?.toString();

      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const blob = file as Blob;
        audioData = await blob.arrayBuffer();
        mimeType = (file as File).type || "application/octet-stream";
      }
    } else {
      const body = await request.json();
      url = body?.url;
      targetLanguage = body?.targetLanguage;
      language = body?.language;
      model = body?.model;
    }

    if (!url && !audioData) {
      return NextResponse.json(
        { message: "Audio URL or uploaded file is required" },
        { status: 400 },
      );
    }

    // Transcribe audio using the shared transcribe library
    const result = await transcribe({
      url,
      audioData,
      mimeType,
      language: targetLanguage || language, // Support both field names
      model: model || "nova-3",
      smartFormat: true,
      paragraphs: true,
      words: true,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Transcription error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
