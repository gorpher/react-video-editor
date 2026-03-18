"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Compositor, Log } from "openvideo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Video, Music, Clock } from "lucide-react";
import { useStudioStore } from "@/stores/studio-store";
import { storageService } from "@/lib/storage/storage-service";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportClipJSON = {
  id?: string;
  type?: string;
  src?: string;
  name?: string;
  [key: string]: any;
};

type LocalUploadAsset = {
  id?: string;
  type?: string;
  name?: string;
  src?: string;
};

const STORAGE_KEY = "designcombo_uploads";
const PROJECT_ID = "local-uploads";
const CLIP_TYPES_WITHOUT_SOURCE = new Set(["Text", "Caption", "Effect", "Transition"]);

const parseLocalUploads = (): LocalUploadAsset[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const canReadBlobSource = async (src: string): Promise<boolean> => {
  try {
    const response = await fetch(src);
    return response.ok;
  } catch {
    return false;
  }
};

const pushUniqueUrl = (target: Map<string, string[]>, key: string, url: string) => {
  if (!key || !url) return;
  const existing = target.get(key) || [];
  if (!existing.includes(url)) {
    target.set(key, [...existing, url]);
  }
};

const buildMediaSourceRecoveryMap = async () => {
  const localAssets = parseLocalUploads();
  const freshUrlById = new Map<string, string>();
  const urlsByName = new Map<string, string[]>();
  const replacementByOldSrc = new Map<string, string>();

  if (storageService.isOPFSSupported()) {
    const localFiles = await storageService.loadAllMediaFiles({ projectId: PROJECT_ID });
    for (const file of localFiles) {
      if (file.id && file.url) {
        freshUrlById.set(file.id, file.url);
      }
      if (file.name && file.url) {
        pushUniqueUrl(urlsByName, file.name, file.url);
      }
    }
  }

  for (const asset of localAssets) {
    const assetSrc = typeof asset.src === "string" ? asset.src.trim() : "";
    const assetName = typeof asset.name === "string" ? asset.name.trim() : "";
    const assetId = typeof asset.id === "string" ? asset.id : "";

    if (!assetSrc) continue;

    if (assetId && freshUrlById.has(assetId)) {
      replacementByOldSrc.set(assetSrc, freshUrlById.get(assetId)!);
    }

    if (assetName) {
      pushUniqueUrl(urlsByName, assetName, assetSrc);
    }
  }

  return {
    replacementByOldSrc,
    urlsByName,
  };
};

const repairClipSourcesForExport = async (clips: ExportClipJSON[]) => {
  const { replacementByOldSrc, urlsByName } = await buildMediaSourceRecoveryMap();
  const repairedClips: ExportClipJSON[] = [];
  const unresolvedClipNames: string[] = [];
  let repairedCount = 0;

  for (const clip of clips) {
    const clipType = clip?.type || "";
    if (CLIP_TYPES_WITHOUT_SOURCE.has(clipType)) {
      repairedClips.push(clip);
      continue;
    }

    const src = typeof clip?.src === "string" ? clip.src.trim() : "";
    if (!src) {
      continue;
    }

    if (!src.startsWith("blob:")) {
      repairedClips.push(clip);
      continue;
    }

    if (await canReadBlobSource(src)) {
      repairedClips.push(clip);
      continue;
    }

    let replacementSrc = replacementByOldSrc.get(src);

    if (!replacementSrc && typeof clip.name === "string") {
      const byNameCandidates = urlsByName.get(clip.name.trim()) || [];
      replacementSrc = byNameCandidates.find(Boolean);
    }

    if (replacementSrc) {
      repairedClips.push({
        ...clip,
        src: replacementSrc,
      });
      repairedCount += 1;
    } else {
      unresolvedClipNames.push(clip.name || clip.id || "Unknown clip");
    }
  }

  return {
    repairedClips,
    repairedCount,
    unresolvedClipNames: Array.from(new Set(unresolvedClipNames)),
  };
};

// ---------------------------------------------------------------------------
// Option definitions (sourced from mediabunny's supported formats/codecs)
// ---------------------------------------------------------------------------

const VIDEO_CODECS = [
  { value: "avc1.42E032", label: "H.264 (AVC)" },
  { value: "hvc1.1.6.L123.B0", label: "H.265 (HEVC)" },
  { value: "vp09.00.10.08", label: "VP9" },
];

const AUDIO_CODECS = [
  { value: "aac", label: "AAC" },
  { value: "opus", label: "Opus" },
  { value: "mp3", label: "MP3" },
  { value: "flac", label: "FLAC" },
];

const QUALITY_PRESETS = [
  { value: "20000000", label: "Ultra (20 Mbps)" },
  { value: "10000000", label: "High (10 Mbps)" },
  { value: "5000000", label: "Medium (5 Mbps)" },
  { value: "2000000", label: "Low (2 Mbps)" },
];

// Which container formats work with which video codecs
const VIDEO_FORMATS = [
  { value: "mp4", label: "MP4", codecs: ["avc1.42E032", "hvc1.1.6.L123.B0", "vp09.00.10.08"] },
  { value: "webm", label: "WebM", codecs: ["vp09.00.10.08"] },
  { value: "mkv", label: "MKV", codecs: ["avc1.42E032", "hvc1.1.6.L123.B0", "vp09.00.10.08"] },
  { value: "mov", label: "MOV", codecs: ["avc1.42E032", "hvc1.1.6.L123.B0"] },
];

const AUDIO_FORMATS = [
  { value: "mp3", label: "MP3" },
  { value: "wav", label: "WAV" },
  { value: "flac", label: "FLAC" },
  { value: "ogg", label: "OGG" },
];

const FRAME_RATES = [
  { value: "24", label: "24 fps" },
  { value: "25", label: "25 fps" },
  { value: "30", label: "30 fps" },
  { value: "50", label: "50 fps" },
  { value: "60", label: "60 fps" },
];

const SAMPLE_RATES = [
  { value: "44100", label: "44.1 kHz" },
  { value: "48000", label: "48 kHz" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportModal({ open, onOpenChange }: ExportModalProps) {
  const { studio } = useStudioStore();
  const studioOpts = studio?.getOptions() || { width: 1920, height: 1080, fps: 30 };

  // Step state
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportBlobUrl, setExportBlobUrl] = useState<string | null>(null);
  const [exportStartTime, setExportStartTime] = useState<number | null>(null);
  const [exportCombinator, setExportCombinator] = useState<Compositor | null>(null);

  // Export settings
  const [includeVideo, setIncludeVideo] = useState(true);
  const [videoCodec, setVideoCodec] = useState("avc1.42E032");
  const [quality, setQuality] = useState("10000000");
  const [format, setFormat] = useState("mp4");
  const [fps, setFps] = useState(String(studioOpts.fps || 30));

  const [includeAudio, setIncludeAudio] = useState(true);
  const [audioCodec, setAudioCodec] = useState("aac");
  const [audioSampleRate, setAudioSampleRate] = useState("48000");

  const maxDuration = studio?.getMaxDuration() || 0;

  // When video is disabled, switch to an audio-only format
  useEffect(() => {
    if (!includeVideo && format === "mp4") {
      setFormat("mp3");
    } else if (includeVideo && ["mp3", "wav", "flac", "ogg"].includes(format)) {
      setFormat("mp4");
    }
  }, [includeVideo]);

  // Ensure selected video codec is compatible with the chosen format
  useEffect(() => {
    if (!includeVideo) return;
    const f = VIDEO_FORMATS.find((x) => x.value === format);
    if (f && !f.codecs.includes(videoCodec)) {
      setVideoCodec(f.codecs[0]);
    }
  }, [format]);

  const resetState = () => {
    if (exportCombinator) {
      exportCombinator.destroy();
      setExportCombinator(null);
    }
    if (exportBlobUrl) {
      URL.revokeObjectURL(exportBlobUrl);
      setExportBlobUrl(null);
    }
    setExportStartTime(null);
    setIsExporting(false);
    setExportProgress(0);
    setIsConfiguring(true);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  const handleDownload = (url?: string) => {
    const downloadUrl = url || exportBlobUrl;
    if (!downloadUrl) return;
    const aEl = document.createElement("a");
    document.body.appendChild(aEl);
    aEl.setAttribute("href", downloadUrl);
    aEl.setAttribute("download", `openvideo-export-${Date.now()}.${format}`);
    aEl.setAttribute("target", "_self");
    aEl.click();
    setTimeout(() => {
      if (document.body.contains(aEl)) document.body.removeChild(aEl);
    }, 100);
  };

  const startExport = async () => {
    if (!studio) return;
    setIsConfiguring(false);
    setIsExporting(true);
    setExportProgress(0);
    setExportBlobUrl(null);
    setExportStartTime(Date.now());

    try {
      const json = studio.exportToJSON();
      if (!json.clips || json.clips.length === 0) throw new Error("No clips to export");

      const { repairedClips, repairedCount, unresolvedClipNames } =
        await repairClipSourcesForExport(json.clips as ExportClipJSON[]);

      if (repairedCount > 0) {
        toast.info(`Recovered ${repairedCount} local media source(s) before export.`);
      }

      if (unresolvedClipNames.length > 0) {
        throw new Error(
          `Some media sources are no longer available: ${unresolvedClipNames.join(", ")}`,
        );
      }

      const validClips = repairedClips.filter((clipJSON: any) => {
        if (["Text", "Caption", "Effect", "Transition"].includes(clipJSON.type)) return true;
        return clipJSON.src && clipJSON.src.trim() !== "";
      }) as any[];
      if (validClips.length === 0) throw new Error("No valid clips to export");

      const settings = json.settings || {};
      const combinatorOpts: any = {
        width: includeVideo ? settings.width || studioOpts.width || 1920 : 0,
        height: includeVideo ? settings.height || studioOpts.height || 1080 : 0,
        fps: Number(fps),
        bgColor: settings.bgColor || "#000000",
        format,
        videoCodec: includeVideo ? videoCodec : undefined,
        bitrate: Number(quality),
        audio: includeAudio ? true : false,
        audioCodec: includeAudio ? audioCodec : undefined,
        audioSampleRate: includeAudio ? Number(audioSampleRate) : undefined,
      };

      const com = new Compositor(combinatorOpts);
      if (includeVideo) await com.initPixiApp();
      setExportCombinator(com);

      com.on("OutputProgress", (v) => setExportProgress(v));

      await com.loadFromJSON({ ...json, clips: validClips } as any);
      const stream = com.output();
      const blob = await new Response(stream).blob();
      const blobUrl = URL.createObjectURL(blob);
      setExportBlobUrl(blobUrl);
      setIsExporting(false);

      setTimeout(() => {
        handleDownload(blobUrl);
        toast.success("渲染完成，下载已开始");
        setTimeout(() => handleClose(), 1500);
      }, 500);
    } catch (error) {
      Log.error("Export error:", error);
      alert("Failed to export: " + (error as Error).message);
      setIsExporting(false);
      setIsConfiguring(true);
    }
  };

  if (!open) return null;

  // Shared field row
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );

  const selectCls =
    "h-8 text-xs bg-muted border-border text-foreground hover:bg-muted/80 rounded-md";
  const selectContentCls =
    "bg-popover border-border text-popover-foreground backdrop-blur-xl text-xs";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-w-[420px] border border-border bg-background/80 p-0 text-foreground backdrop-blur-2xl shadow-2xl overflow-hidden rounded-2xl"
        showCloseButton={false}
      >
        {isConfiguring ? (
          <div className="flex flex-col">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
                导出
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {studioOpts.width}×{studioOpts.height} · {(maxDuration / 1e6).toFixed(1)}s
              </p>
            </div>

            <div className="px-6 pb-6 flex flex-col gap-3">
              {/* Video Section */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Video className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">视频</span>
                  </div>
                  <Switch checked={includeVideo} onCheckedChange={setIncludeVideo} />
                </div>
                <div
                  className={`px-4 py-3 flex flex-col gap-3 transition-opacity ${!includeVideo ? "opacity-30 pointer-events-none" : ""}`}
                >
                  <Row label="格式">
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger className={selectCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        {VIDEO_FORMATS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row label="编码">
                    <Select value={videoCodec} onValueChange={setVideoCodec}>
                      <SelectTrigger className={selectCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        {VIDEO_CODECS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row label="质量">
                    <Select value={quality} onValueChange={setQuality}>
                      <SelectTrigger className={selectCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        {QUALITY_PRESETS.map((q) => (
                          <SelectItem key={q.value} value={q.value}>
                            {q.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row label="帧率">
                    <Select value={fps} onValueChange={setFps}>
                      <SelectTrigger className={selectCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        {FRAME_RATES.map((fr) => (
                          <SelectItem key={fr.value} value={fr.value}>
                            {fr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Row>
                </div>
              </div>

              {/* Audio Section */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Music className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">音频</span>
                  </div>
                  <Switch checked={includeAudio} onCheckedChange={setIncludeAudio} />
                </div>
                <div
                  className={`px-4 py-3 flex flex-col gap-3 transition-opacity ${!includeAudio ? "opacity-30 pointer-events-none" : ""}`}
                >
                  {!includeVideo && (
                    <Row label="格式">
                      <Select value={format} onValueChange={setFormat}>
                        <SelectTrigger className={selectCls}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentCls}>
                          {AUDIO_FORMATS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Row>
                  )}
                  <Row label="编码">
                    <Select value={audioCodec} onValueChange={setAudioCodec}>
                      <SelectTrigger className={selectCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        {AUDIO_CODECS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row label="采样率">
                    <Select value={audioSampleRate} onValueChange={setAudioSampleRate}>
                      <SelectTrigger className={selectCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        {SAMPLE_RATES.map((sr) => (
                          <SelectItem key={sr.value} value={sr.value}>
                            {sr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Row>
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="text-[11px]">{(maxDuration / 1e6).toFixed(2)}s</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleClose}
                    className="h-8 px-4 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={startExport}
                    className="h-8 px-5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    导出
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Progress view */
          <div className="flex flex-col p-6 gap-6">
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">导出中…</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format.toUpperCase()} · {studioOpts.width}×{studioOpts.height}
              </p>
            </div>

            {/* Summary pill grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "格式", value: format.toUpperCase() },
                { label: "帧率", value: fps },
                {
                  label: "分辨率",
                  value: includeVideo ? `${studioOpts.width}×${studioOpts.height}` : "无",
                },
                { label: "视频", value: includeVideo ? "开" : "关" },
                { label: "音频", value: includeAudio ? "开" : "关" },
                {
                  label: "采样",
                  value: includeAudio ? `${Number(audioSampleRate) / 1000}k` : "无",
                },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-xs font-medium text-foreground truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">进度</span>
                <span className="text-xs font-mono text-muted-foreground">
                  {Math.round(exportProgress * 100)}%
                  {exportProgress > 0 && exportStartTime
                    ? (() => {
                        const elapsed = Date.now() - exportStartTime;
                        const remaining = (elapsed / exportProgress - elapsed) / 1000;
                        const mins = Math.floor(remaining / 60);
                        const secs = Math.floor(remaining % 60);
                        return ` · ${mins}m ${secs}s left`;
                      })()
                    : " · 准备中…"}
                </span>
              </div>
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${exportProgress * 100}%` }}
                />
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={handleClose}
              className="w-full h-9 text-xs rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {isExporting && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              取消导出
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
