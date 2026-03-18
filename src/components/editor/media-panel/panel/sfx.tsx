"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useStudioStore } from "@/stores/studio-store";
import { Audio, Log } from "openvideo";
import { IconWaveSine } from "@tabler/icons-react";
import { AudioItem } from "./audio-item";
import { Search, Upload, Trash2 } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { storageService } from "@/lib/storage/storage-service";
import type { MediaFile } from "@/types/media";
import { uploadFile } from "@/lib/upload-utils";

const STORAGE_KEY = "designcombo_uploads";
const PROJECT_ID = "local-uploads";

interface AudioAsset {
  id: string;
  src: string;
  name: string;
}

export default function PanelSFX() {
  const { studio } = useStudioStore();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<AudioAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const stored: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    setItems(stored.filter((a) => a.type === "audio"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const stored: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("audio/")) continue;
        const id = crypto.randomUUID();
        let uploadResult;
        try {
          uploadResult = await uploadFile(file);
        } catch {}
        const src = uploadResult?.url || URL.createObjectURL(file);
        if (storageService.isOPFSSupported()) {
          await storageService.saveMediaFile({
            projectId: PROJECT_ID,
            mediaItem: { id, file, name: file.name, type: "audio", url: src } as MediaFile,
          });
        }
        stored.unshift({
          id,
          name: file.name,
          src,
          type: "audio",
          size: file.size,
          source: "local",
        });
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      load();
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
    load();
  };

  const handleAddAudio = async (url: string, name: string) => {
    if (!studio) return;
    try {
      const audioClip = await Audio.fromUrl(url);
      audioClip.name = name;
      await studio.addClip(audioClip);
    } catch (error) {
      Log.error("Failed to add audio:", error);
    }
  };

  const filtered = items.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-full flex flex-col">
      <input
        type="file"
        accept="audio/*"
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
            placeholder="搜索音效..."
            className="bg-secondary/30 border-0 h-full text-xs box-border pl-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
        <Button
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <IconWaveSine size={32} className="opacity-50" />
            <span className="text-sm">{items.length === 0 ? "暂无音效" : "未找到匹配音效"}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((item) => (
              <div key={item.id} className="group flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  <AudioItem
                    item={{ id: item.id, url: item.src, text: item.name }}
                    onAdd={handleAddAudio}
                    playingId={playingId}
                    setPlayingId={setPlayingId}
                  />
                </div>
                <button
                  className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
