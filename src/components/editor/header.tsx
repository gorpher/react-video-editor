"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { IconShare } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/stores/studio-store";
import { useProjectStore } from "@/stores/project-store";
import { DEFAULT_CANVAS_PRESETS } from "@/lib/editor-utils";
import { Log, type IClip } from "openvideo";
import { ExportModal } from "./export-modal";
import Link from "next/link";
import { Icons } from "../shared/icons";
import {
  Keyboard,
  FileJson,
  Download,
  Upload,
  MessageSquare,
  Settings,
  Database,
  FilePlus,
  Square,
  Smartphone,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { Compositor } from "openvideo";
import { ShortcutsModal } from "./shortcuts-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "../ui/mode-toggle";
import { useRouter, useParams } from "next/navigation";
import { storageService } from "@/lib/storage/storage-service";
import { Save } from "lucide-react";

export default function Header() {
  const { studio } = useStudioStore();
  const { aspectRatio, canvasSize, fps, setCanvasSize } = useProjectStore();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const [isSaving, setIsSaving] = useState(false);
  const [projectName, setProjectName] = useState("\u672a\u547d\u540d\u9879\u76ee");
  const [nameDraft, setNameDraft] = useState("\u672a\u547d\u540d\u9879\u76ee");
  const [isEditingName, setIsEditingName] = useState(false);
  const hasInitializedCanvasAutosaveRef = useRef(false);
  const getCanvasMode = (): "preset" | "custom" => {
    return DEFAULT_CANVAS_PRESETS.some(
      (preset) => preset.width === canvasSize.width && preset.height === canvasSize.height,
    )
      ? "preset"
      : "custom";
  };

  const handleApplyCustomSize = () => {
    const w = parseInt(customWidth);
    const h = parseInt(customHeight);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      setCanvasSize({ width: w, height: h }, "Custom");
    } else {
      toast.error("尺寸无效");
    }
  };

  const handleGetStarted = (route: string) => {
    router.push(route);
  };
  const handleBatchExport = async () => {
    if (!studio) return;
    setIsBatchExporting(true);
    const toastId = toast.loading("Initializing batch export...");

    try {
      // 1. Get animation keys and template
      const keysRes = await fetch("/api/batch-export");
      const { keys, template } = await keysRes.json();

      if (!keys || keys.length === 0) throw new Error("No animations found");

      // 2. Select project template: prefer current studio if it has clips, otherwise use API template
      const currentProject = studio.exportToJSON();
      const baseProject =
        currentProject.clips && currentProject.clips.length > 0 ? currentProject : template;

      if (!baseProject.clips || baseProject.clips.length === 0) {
        throw new Error("No template content available. Please add a clip to the canvas.");
      }

      const settings = baseProject.settings || {};

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        toast.loading(`Rendering ${i + 1}/${keys.length}: ${key}...`, {
          id: toastId,
        });

        // Prepare project for this animation
        const project = JSON.parse(JSON.stringify(baseProject));

        // Find the first non-Audio/Transition/Effect clip to animate
        const targetClip =
          project.clips.find(
            (c: any) => c.type !== "Audio" && c.type !== "Transition" && c.type !== "Effect",
          ) || project.clips[0];

        if (targetClip) {
          targetClip.animations = [
            {
              type: key,
              opts: { duration: 1000000, delay: 0 },
            },
          ];
          // Ensure clip covers the 1s duration
          targetClip.display = { from: 0, to: 1000000 };
          targetClip.duration = 1000000;
        }

        // Setup compositor
        const com = new Compositor({
          width: settings.width || 1080,
          height: settings.height || 1080,
          fps: settings.fps || 30,
          bgColor: settings.bgColor || "#000000",
          videoCodec: "avc1.42E032",
          bitrate: 10e6,
          // audio: true,
        });

        await com.initPixiApp();
        await com.loadFromJSON(project);

        // Render to blob
        const stream = com.output();
        const blob = await new Response(stream).blob();

        // Cleanup compositor
        com.destroy();

        // 3. Upload to server
        const formData = new FormData();
        formData.append("file", blob);
        formData.append("filename", key);

        const uploadRes = await fetch("/api/batch-export", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error(`Failed to save ${key}`);
      }

      toast.success(`Batch export complete! ${keys.length} videos saved to D:\\animations`, {
        id: toastId,
      });
    } catch (error: any) {
      toast.error(`Batch export failed: ${error.message}`, { id: toastId });
    } finally {
      setIsBatchExporting(false);
    }
  };
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!studio) return;

    setCanUndo(studio.history.canUndo());
    setCanRedo(studio.history.canRedo());

    const handleHistoryChange = ({ canUndo, canRedo }: { canUndo: boolean; canRedo: boolean }) => {
      setCanUndo(canUndo);
      setCanRedo(canRedo);
    };

    studio.on("history:changed", handleHistoryChange);

    return () => {
      studio.off("history:changed", handleHistoryChange);
    };
  }, [studio]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    const loadProjectName = async () => {
      try {
        const project = await storageService.loadProject({ id: projectId });
        const loadedName = project?.name?.trim() || "\u672a\u547d\u540d\u9879\u76ee";

        if (!cancelled) {
          setProjectName(loadedName);
          setNameDraft(loadedName);
        }
      } catch (error) {
        console.error("Failed to load project name", error);
      }
    };

    void loadProjectName();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSave = async (showToast = true) => {
    if (!studio || !projectId) return;

    if (showToast) {
      setIsSaving(true);
    }
    let toastId;
    if (showToast) {
      toastId = toast.loading("保存中...");
    }

    try {
      const studioJSON = studio.exportToJSON();
      await storageService.saveProjectFull(projectId, {
        data: studioJSON,
        canvasSize,
        canvasMode: getCanvasMode(),
        fps,
      });
      if (showToast) {
        toast.success("已保存", { id: toastId });
      }
    } catch (error) {
      console.error("Failed to save project", error);
      if (showToast) {
        toast.error("保存失败", { id: toastId });
      }
    } finally {
      if (showToast) {
        setIsSaving(false);
      }
    }
  };
  const persistProjectName = async (rawName: string, showSuccessToast = true) => {
    if (!projectId) return false;

    const nextName = rawName.trim();
    if (!nextName) {
      toast.error("\u9879\u76ee\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a");
      setNameDraft(projectName);
      return false;
    }

    if (nextName === projectName) {
      setNameDraft(nextName);
      return true;
    }

    try {
      const existing = await storageService.loadProject({ id: projectId });
      if (!existing) {
        toast.error("\u672a\u627e\u5230\u9879\u76ee");
        return false;
      }

      const latestData = studio?.exportToJSON() ?? existing.data;
      await storageService.saveProject({
        project: {
          ...existing,
          name: nextName,
          canvasSize,
          canvasMode: getCanvasMode(),
          fps,
          data: latestData,
          updatedAt: new Date(),
        },
      });

      setProjectName(nextName);
      setNameDraft(nextName);
      if (showSuccessToast) {
        toast.success("\u5df2\u66f4\u65b0\u9879\u76ee\u540d\u79f0");
      }
      return true;
    } catch (error) {
      console.error("Failed to rename project", error);
      toast.error("\u9879\u76ee\u91cd\u547d\u540d\u5931\u8d25");
      return false;
    }
  };

  const handleRenameProject = async () => {
    const renamed = await persistProjectName(nameDraft);
    if (renamed) {
      setIsEditingName(false);
    }
  };
  const handleManualSave = async () => {
    if (!studio || !projectId) return;

    if (isEditingName) {
      const renamed = await persistProjectName(nameDraft, false);
      if (!renamed) return;
      setIsEditingName(false);
    }

    await handleSave(true);
  };
  // Auto-save on studio changes (with debounce)
  useEffect(() => {
    if (!studio || !projectId) return;

    let timeoutId: NodeJS.Timeout;

    const onStudioChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleSave(false); // Silent save
      }, 2000); // 2 second debounce
    };

    studio.on("history:changed", onStudioChange);

    return () => {
      studio.off("history:changed", onStudioChange);
      clearTimeout(timeoutId);
    };
  }, [studio, projectId, canvasSize.width, canvasSize.height, fps]);

  useEffect(() => {
    hasInitializedCanvasAutosaveRef.current = false;
  }, [projectId]);

  // Canvas size/FPS changes are not always part of studio history.
  // Persist them with a lightweight silent save.
  useEffect(() => {
    if (!studio || !projectId) return;

    if (!hasInitializedCanvasAutosaveRef.current) {
      hasInitializedCanvasAutosaveRef.current = true;
      return;
    }

    const timeoutId = setTimeout(() => {
      void handleSave(false);
    }, 400);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [studio, projectId, canvasSize.width, canvasSize.height, fps]);

  const handleNew = () => {
    if (!studio) return;
    const confirmed = window.confirm("确定要新建项目吗？未保存的内容将丢失。");
    if (confirmed) {
      studio.clear();
    }
  };

  const handleExportJSON = () => {
    if (!studio) return;

    try {
      // Get all clips from studio
      const clips = (studio as any).clips as IClip[];
      if (clips.length === 0) {
        alert("没有可导出的片段");
        return;
      }

      // Export to JSON
      const json = studio.exportToJSON();
      const jsonString = JSON.stringify(json, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Download the JSON file
      const aEl = document.createElement("a");
      document.body.appendChild(aEl);
      aEl.href = url;
      aEl.download = `combo-project-${Date.now()}.json`;
      aEl.click();

      // Cleanup
      setTimeout(() => {
        if (document.body.contains(aEl)) {
          document.body.removeChild(aEl);
        }
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      Log.error("Export to JSON error:", error);
      alert("Failed to export to JSON: " + (error as Error).message);
    }
  };

  const handleImportJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text);

        if (!json.clips || !Array.isArray(json.clips)) {
          throw new Error("Invalid JSON format: missing clips array");
        }

        if (!studio) {
          throw new Error("Studio not initialized");
        }

        // Filter out clips with empty sources (except Text, Caption, and Effect)
        const validClips = json.clips.filter((clipJSON: any) => {
          if (
            clipJSON.type === "Text" ||
            clipJSON.type === "Caption" ||
            clipJSON.type === "Effect" ||
            clipJSON.type === "Transition"
          ) {
            return true;
          }
          return clipJSON.src && clipJSON.src.trim() !== "";
        });

        if (validClips.length === 0) {
          throw new Error("No valid clips found in JSON. All clips have empty source URLs.");
        }

        const validJson = { ...json, clips: validClips };
        await studio.loadFromJSON(validJson);
      } catch (error) {
        Log.error("Load from JSON error:", error);
        alert("Failed to load from JSON: " + (error as Error).message);
      } finally {
        document.body.removeChild(input);
      }
    };

    document.body.appendChild(input);
    input.click();
  };

  return (
    <header className="relative flex h-[52px] w-full shrink-0 items-center justify-between px-4 bg-card z-10 border-b">
      {/* Left Section */}
      <div className="flex items-center gap-2">
        <div
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-md cursor-pointer overflow-hidden"
          onClick={() => handleGetStarted("/")}
        >
          <img src="/logo.png" alt="logo" className="w-9 h-9 object-cover rounded-md" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">文件</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={handleExportJSON}>
              <Download className="mr-2 h-4 w-4" />
              <span>导出 JSON</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportJSON}>
              <Upload className="mr-2 h-4 w-4" />
              <span>从 JSON 导入</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleNew}>
              <FilePlus className="mr-2 h-4 w-4" />
              <span>清空 / 新建</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 ">
              画布尺寸
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-3">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground px-1 uppercase tracking-wider">
                  预设
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    {
                      label: "正方形",
                      icon: Square,
                      width: 1080,
                      height: 1080,
                    },
                    {
                      label: "竖屏",
                      icon: Smartphone,
                      width: 1080,
                      height: 1920,
                    },
                    {
                      label: "横屏",
                      icon: Monitor,
                      width: 1920,
                      height: 1080,
                    },
                  ].map((preset) => {
                    const isSelected = aspectRatio === preset.label;
                    const Icon = preset.icon;
                    return (
                      <DropdownMenuItem
                        key={preset.label}
                        onClick={() =>
                          setCanvasSize(
                            { width: preset.width, height: preset.height },
                            preset.label,
                          )
                        }
                        className="text-xs justify-between cursor-pointer px-2 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{preset.label}</span>
                        </div>
                        <div
                          className={cn(
                            "flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/50",
                            isSelected && "border-primary",
                          )}
                        >
                          {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-border/50 mx-1" />

              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground px-1 uppercase tracking-wider">
                  自定义
                </p>
                <div className="grid grid-cols-2 gap-2 px-1">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase">宽</label>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      placeholder="1920"
                      className="w-full bg-muted/50 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary h-7"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase">高</label>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      placeholder="1080"
                      className="w-full bg-muted/50 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary h-7"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleApplyCustomSize}
                  className="w-full h-8 text-xs font-medium mt-1"
                  size="sm"
                >
                  应用
                </Button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className=" pointer-events-auto flex h-10 items-center px-1.5">
          <Button onClick={() => studio?.undo()} disabled={!canUndo} variant="ghost" size="icon">
            <Icons.undo className="size-5" />
          </Button>
          <Button
            onClick={() => studio?.redo()}
            disabled={!canRedo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <Icons.redo className="size-5" />
          </Button>
          {/* <Button
            variant="ghost"
            size="sm"
            onClick={handleBatchExport}
            disabled={isBatchExporting}
          >
            <Database className="mr-2 h-4 w-4" />
            Batch Export Anim
          </Button> */}
        </div>
      </div>

      {/* Center Section */}
      <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[320px] max-w-[40vw] -translate-x-1/2 -translate-y-1/2">
        {isEditingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => void handleRenameProject()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleRenameProject();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setNameDraft(projectName);
                setIsEditingName(false);
              }
            }}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-center text-sm font-medium outline-none ring-0 focus-visible:border-primary"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(projectName);
              setIsEditingName(true);
            }}
            className="w-full truncate rounded-md px-2 py-1 text-center text-sm font-medium hover:bg-muted/60"
            title="点击重命名项目"
          >
            {projectName || "未命名项目"}
          </button>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <div className="flex items-center mr-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsShortcutsModalOpen(true)}
          >
            <Keyboard className="size-5" />
          </Button>

          {/* AI 助手按钮暂时隐藏，后期启用
          <Button
            size={"sm"}
            variant="outline"
            onClick={toggleCopilot}
            className="h-7"
            title="切换 AI 助手"
          >
            <Icons.ai className="size-5" />
            <span className="hidden md:block">AI 助手</span>
          </Button>
          */}
        </div>

        {/* End of right actions */}

        <ExportModal open={isExportModalOpen} onOpenChange={setIsExportModalOpen} />
        <ShortcutsModal open={isShortcutsModalOpen} onOpenChange={setIsShortcutsModalOpen} />

        <ModeToggle />

        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => void handleManualSave()}
          disabled={!studio || !projectId || isSaving}
        >
          <Save className="size-4" />
          {isSaving ? "\u4fdd\u5b58\u4e2d" : "\u4fdd\u5b58"}
        </Button>

        <Button size="sm" className="gap-2 rounded-full" onClick={() => setIsExportModalOpen(true)}>
          导出
        </Button>
      </div>
    </header>
  );
}
