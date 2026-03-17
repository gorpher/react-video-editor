"use client";

import { useState, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudioStore } from "@/stores/studio-store";
import { useProjectStore } from "@/stores/project-store";
import { Image, Log } from "openvideo";
import { Search, Image as ImageIcon, Upload, Trash2 } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { storageService } from "@/lib/storage/storage-service";
import type { MediaFile } from "@/types/media";
import { uploadFile } from "@/lib/upload-utils";

const STORAGE_KEY = "designcombo_uploads";
const PROJECT_ID = "local-uploads";

interface VisualAsset {
  id: string;
  src: string;
  name: string;
  size?: number;
}

export default function PanelImages() {
  const { studio } = useStudioStore();
  const { canvasSize } = useProjectStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [images, setImages] = useState<VisualAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) fileInputEl = node;
  }, []);
  let fileInputEl: HTMLInputElement | null = null;

  const loadImages = useCallback(() => {
    const stored: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    setImages(stored.filter((a) => a.type === "image"));
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const stored: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const id = crypto.randomUUID();
        let uploadResult;
        try {
          uploadResult = await uploadFile(file);
        } catch {}
        const src = uploadResult?.url || URL.createObjectURL(file);
        if (storageService.isOPFSSupported()) {
          await storageService.saveMediaFile({
            projectId: PROJECT_ID,
            mediaItem: { id, file, name: file.name, type: "image", url: src } as MediaFile,
          });
        }
        stored.unshift({
          id,
          name: file.name,
          src,
          type: "image",
          size: file.size,
          source: "local",
        });
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      loadImages();
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (storageService.isOPFSSupported()) {
      await storageService.deleteMediaFile({ projectId: PROJECT_ID, id });
    }
    const stored: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.filter((a) => a.id !== id)));
    loadImages();
  };

  const addItemToCanvas = async (asset: VisualAsset) => {
    if (!studio) return;
    try {
      const imageClip = await Image.fromUrl(asset.src);
      imageClip.name = asset.name;
      imageClip.display = { from: 0, to: 5 * 1e6 };
      imageClip.duration = 5 * 1e6;
      await imageClip.scaleToFit(canvasSize.width, canvasSize.height);
      imageClip.centerInScene(canvasSize.width, canvasSize.height);
      await studio.addClip(imageClip);
    } catch (error) {
      Log.error("Failed to add image:", error);
    }
  };

  const filtered = images.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-full flex flex-col">
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
      />
      <div className="flex-none p-4 flex gap-2">
        <InputGroup>
          <InputGroupAddon className="bg-secondary/30 pointer-events-none text-muted-foreground w-8 justify-center">
            <Search size={14} />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="搜索图片..."
            className="bg-secondary/30 border-0 h-full text-xs box-border pl-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
        <Button variant="outline" disabled={isUploading} onClick={() => fileInputEl?.click()}>
          <Upload size={14} />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <ImageIcon size={32} className="opacity-50" />
            <span className="text-sm">{images.length === 0 ? "暂无图片" : "未找到匹配图片"}</span>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-x-3 gap-y-4">
            {filtered.map((asset) => (
              <div
                key={asset.id}
                className="flex flex-col gap-1.5 group cursor-pointer"
                onClick={() => addItemToCanvas(asset)}
              >
                <div className="relative aspect-square rounded-sm overflow-hidden bg-foreground/20 border border-transparent group-hover:border-primary/50 transition-all">
                  <img
                    src={asset.src}
                    alt={asset.name}
                    className="max-w-full max-h-full object-contain w-full h-full"
                  />
                  <button
                    type="button"
                    className="absolute top-1 right-1 p-1 rounded bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(asset.id);
                    }}
                  >
                    <Trash2 size={12} className="text-white" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground group-hover:text-foreground truncate transition-colors px-0.5">
                  {asset.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
