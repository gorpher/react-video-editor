import { deepgramToCombo } from "./deepgram-to-combo";
import type { TranscriptObject } from "./types";

export interface TranscribeOptions {
  /**
   * Audio URL to transcribe (publicly accessible from server side)
   */
  url?: string;

  /**
   * Raw audio/video binary data to transcribe.
   * Useful for local blob sources that cannot be fetched by Deepgram directly.
   */
  audioData?: ArrayBuffer | Uint8Array;

  /**
   * MIME type for audioData.
   */
  mimeType?: string;

  /**
   * API key for Deepgram (optional, defaults to env variable)
   */
  apiKey?: string;

  /**
   * Target language for transcription (optional)
   * If not provided, will auto-detect
   */
  language?: string;

  /**
   * Deepgram model to use (optional, defaults to "nova-3")
   */
  model?: string;

  /**
   * Whether to enable smart formatting (optional, defaults to true)
   */
  smartFormat?: boolean;

  /**
   * Whether to include paragraphs in the result (optional, defaults to true)
   */
  paragraphs?: boolean;

  /**
   * Whether to include word-level timestamps (optional, defaults to true)
   */
  words?: boolean;
}

function getDeepgramApiBaseUrl() {
  return (process.env.DEEPGRAM_URL || "https://api.deepgram.com/v1").trim().replace(/\/+$/, "");
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getDeepgramErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as {
      message?: unknown;
      err_msg?: unknown;
      error?: unknown;
      detail?: unknown;
    };

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }

    if (typeof record.err_msg === "string" && record.err_msg.trim()) {
      return record.err_msg;
    }

    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }

    if (typeof record.detail === "string" && record.detail.trim()) {
      return record.detail;
    }
  }

  return fallback;
}

/**
 * Transcribe audio using Deepgram (URL or binary data).
 *
 * @param options - Transcription options
 * @returns Parsed transcription result in Combo format
 *
 * @example
 * ```typescript
 * const result = await transcribe({
 *   url: "https://example.com/audio.mp3",
 *   language: "en"
 * });
 * ```
 */
export async function transcribe(
  options: TranscribeOptions,
): Promise<Partial<TranscriptObject> | null> {
  const {
    url,
    audioData,
    mimeType,
    apiKey = process.env.DEEPGRAM_API_KEY || process.env.DEPPGRAM_KEY,
    language,
    model = "nova-3",
    smartFormat = true,
    paragraphs = true,
    words = true,
  } = options;

  if (!url && !audioData) {
    throw new Error("Either audio URL or audio data is required");
  }

  if (!apiKey) {
    throw new Error("Deepgram API key is required");
  }

  const deepgramEndpoint = `${getDeepgramApiBaseUrl()}/listen`;
  const query = new URLSearchParams();
  query.set("model", model);
  query.set("smart_format", smartFormat ? "true" : "false");
  query.set("paragraphs", paragraphs ? "true" : "false");
  query.set("words", words ? "true" : "false");
  query.set("detect_language", "true");

  if (language && language !== "auto") {
    query.set("language", language);
  }

  const headers = new Headers({
    Authorization: `Token ${apiKey}`,
  });

  let body: BodyInit;
  if (audioData) {
    const bytes = audioData instanceof Uint8Array ? audioData : new Uint8Array(audioData);
    const safeBytes = Uint8Array.from(bytes);
    const contentType = mimeType || "application/octet-stream";
    headers.set("Content-Type", contentType);
    body = new Blob([safeBytes.buffer], { type: contentType });
  } else {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify({ url });
  }

  const response = await fetch(`${deepgramEndpoint}?${query.toString()}`, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  const text = await response.text();
  const deepgramPayload = text ? safeParseJson(text) : {};

  if (!response.ok) {
    const errorMessage = getDeepgramErrorMessage(
      deepgramPayload ?? text,
      "Failed to transcribe audio",
    );
    throw new Error(errorMessage);
  }

  if (!deepgramPayload || typeof deepgramPayload !== "object") {
    throw new Error("Deepgram returned unexpected response format");
  }

  // Convert Deepgram result to Combo format
  const parsed = await deepgramToCombo(deepgramPayload);

  if (!parsed) {
    throw new Error("No transcription text was produced");
  }

  return parsed;
}

export { deepgramToCombo } from "./deepgram-to-combo";
export { detectLanguage } from "./detect-language";
// Export types
export * from "./types";
