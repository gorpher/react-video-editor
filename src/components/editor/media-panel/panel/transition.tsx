import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudioStore } from "@/stores/studio-store";
import { getTransitionOptions, registerCustomTransition, type IClip, type Studio } from "openvideo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const TRANSITION_DURATION_DEFAULT = 2_000_000;
const TRANSITION_DURATION_MIN = 100_000;
const MEDIA_TRANSITION_TYPES = new Set(["Video", "Image"]);

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomPreset = {
  id: string;
  name: string;
  category: string;
  data: { label: string; fragment: string };
  published: boolean;
  userId: string;
};

type TransitionPair = {
  fromClip: IClip;
  toClip: IClip;
};

const isTransitionMediaClip = (clip: IClip | null | undefined): clip is IClip => {
  return !!clip && MEDIA_TRANSITION_TYPES.has(clip.type);
};

const getTrackIdByClipId = (studio: Studio, clipId: string): string | undefined => {
  return studio.getTracks().find((track) => track.clipIds.includes(clipId))?.id;
};

const computeTransitionDuration = (fromClip: IClip, toClip: IClip): number => {
  const minDuration = Math.min(fromClip.duration ?? Infinity, toClip.duration ?? Infinity);

  if (!Number.isFinite(minDuration)) {
    return TRANSITION_DURATION_DEFAULT;
  }

  return Math.max(TRANSITION_DURATION_MIN, minDuration * 0.25);
};

const resolveTransitionPairFromSelection = (
  studio: Studio,
  selectedClips: IClip[],
): TransitionPair | { error: string } => {
  const mediaSelected = selectedClips.filter(isTransitionMediaClip);

  if (mediaSelected.length === 2) {
    const [first, second] = mediaSelected;
    const firstTrackId = getTrackIdByClipId(studio, first.id);
    const secondTrackId = getTrackIdByClipId(studio, second.id);

    if (!firstTrackId || !secondTrackId || firstTrackId !== secondTrackId) {
      return { error: "请在同一轨道选择两个视频/图片片段后再添加转场。" };
    }

    if (first.id === second.id) {
      return { error: "转场需要两个不同的片段。" };
    }

    return first.display.from <= second.display.from
      ? { fromClip: first, toClip: second }
      : { fromClip: second, toClip: first };
  }

  if (mediaSelected.length > 2) {
    return { error: "当前选中了超过两个片段，请只保留一个或两个片段后再添加转场。" };
  }

  if (mediaSelected.length === 1) {
    const baseClip = mediaSelected[0];
    const trackId = getTrackIdByClipId(studio, baseClip.id);
    const track = trackId ? studio.getTracks().find((t) => t.id === trackId) : undefined;

    if (!track) {
      return { error: "未找到当前片段所在轨道，无法添加转场。" };
    }

    const trackMediaClips = track.clipIds
      .map((id) => studio.getClipById(id))
      .filter(isTransitionMediaClip)
      .sort((a, b) => a.display.from - b.display.from);

    const currentIndex = trackMediaClips.findIndex((clip) => clip.id === baseClip.id);
    if (currentIndex === -1) {
      return { error: "当前片段不在可转场列表中。" };
    }

    const prevClip = trackMediaClips[currentIndex - 1];
    const nextClip = trackMediaClips[currentIndex + 1];

    if (!prevClip && !nextClip) {
      return { error: "当前轨道没有可连接的相邻视频/图片片段。" };
    }

    if (prevClip && nextClip) {
      const prevGap = Math.abs(baseClip.display.from - prevClip.display.to);
      const nextGap = Math.abs(nextClip.display.from - baseClip.display.to);
      return prevGap <= nextGap
        ? { fromClip: prevClip, toClip: baseClip }
        : { fromClip: baseClip, toClip: nextClip };
    }

    if (nextClip) {
      return { fromClip: baseClip, toClip: nextClip };
    }

    return { fromClip: prevClip!, toClip: baseClip };
  }

  return { error: "请先在时间线上选中一个或两个视频/图片片段，再添加转场。" };
};

const addTransitionFromSelection = async ({
  studio,
  selectedClips,
  transitionKey,
  transitionLabel,
}: {
  studio: Studio | null;
  selectedClips: IClip[];
  transitionKey: string;
  transitionLabel: string;
}) => {
  if (!studio) {
    toast.error("编辑器尚未初始化。");
    return;
  }

  const currentSelection = selectedClips.length > 0 ? selectedClips : studio.getSelectedClips();
  const pairOrError = resolveTransitionPairFromSelection(studio, currentSelection);

  if ("error" in pairOrError) {
    toast.error(pairOrError.error);
    return;
  }

  const { fromClip, toClip } = pairOrError;
  const duration = computeTransitionDuration(fromClip, toClip);

  try {
    await studio.addTransition(transitionKey, duration, fromClip.id, toClip.id);
    toast.success(`已添加转场：${transitionLabel}`);
  } catch (error) {
    console.error("Failed to add transition from media panel", error);
    toast.error("添加转场失败，请重试。");
  }
};

// ─── Shared card for built-in transitions ─────────────────────────────────────

type TransitionCardProps = {
  effectKey: string;
  label: string;
  previewStatic: string;
  previewDynamic: string;
  onClick: () => void;
  badge?: string;
};

const TransitionCard = ({
  effectKey,
  label,
  previewStatic,
  previewDynamic,
  onClick,
  badge,
}: TransitionCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="flex w-full items-center gap-2 flex-col group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="relative w-full aspect-video rounded-md bg-input/30 border overflow-hidden">
        {previewStatic || previewDynamic ? (
          <>
            {previewStatic && (
              <img
                src={previewStatic}
                loading="lazy"
                className="
            absolute inset-0 w-full h-full object-cover rounded-sm
            transition-opacity duration-150
            opacity-100 group-hover:opacity-0
          "
              />
            )}

            {isHovered && previewDynamic && (
              <img
                src={previewDynamic}
                className="
              absolute inset-0 w-full h-full object-cover rounded-sm
              transition-opacity duration-150
              opacity-0 group-hover:opacity-100
            "
              />
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground text-center px-2 bg-primary/40 h-full w-full"></div>
        )}

        {badge && (
          <div className="absolute top-1 right-1 bg-primary/80 text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
            {badge}
          </div>
        )}

        <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-xs font-medium truncate text-center transition-opacity duration-150 group-hover:opacity-0">
          {label}
        </div>
      </div>
    </div>
  );
};

// ─── Default Transitions ──────────────────────────────────────────────────────

const TransitionDefault = () => {
  const { studio, selectedClips } = useStudioStore();
  const allTransitions = getTransitionOptions();

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5 justify-items-center">
      {allTransitions.map((effect) => (
        <TransitionCard
          key={effect.key}
          effectKey={effect.key}
          label={effect.label}
          previewStatic={effect.previewStatic}
          previewDynamic={effect.previewDynamic}
          onClick={() =>
            addTransitionFromSelection({
              studio,
              selectedClips,
              transitionKey: effect.key,
              transitionLabel: effect.label,
            })
          }
        />
      ))}
    </div>
  );
};

// ─── Custom Transitions (from DB) ────────────────────────────────────────────

const TransitionCustom = () => {
  const { studio, selectedClips } = useStudioStore();
  const [ownPresets, setOwnPresets] = useState<CustomPreset[]>([]);
  const [publishedPresets, setPublishedPresets] = useState<CustomPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPresets = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/custom-presets?category=transitions");
        if (!res.ok) throw new Error("Failed to fetch custom transitions");
        const json = await res.json();
        setOwnPresets(json.own ?? []);
        setPublishedPresets(json.published ?? []);
      } catch {
        setError("Could not load custom transitions.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPresets();
  }, []);

  const handleClick = async (preset: CustomPreset) => {
    if (!studio) return;
    // Derive a stable key from the preset id
    const key = `custom_transition_${preset.id}`;
    // Register the custom GLSL shader so the engine can render it
    await registerCustomTransition(key, {
      key,
      label: preset.data.label || preset.name,
      fragment: preset.data.fragment,
    } as any);
    await addTransitionFromSelection({
      studio,
      selectedClips,
      transitionKey: key,
      transitionLabel: preset.data.label || preset.name,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-xs">Loading custom transitions…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-destructive">{error}</div>
    );
  }

  if (ownPresets.length === 0 && publishedPresets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
        <span className="text-xs">No custom transitions yet.</span>
        <span className="text-[10px]">Create one from the Gallery to see it here.</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5 justify-items-center">
      {ownPresets.map((preset) => (
        <TransitionCard
          key={preset.id}
          effectKey={preset.id}
          label={preset.data.label || preset.name}
          previewStatic=""
          previewDynamic=""
          onClick={() => handleClick(preset)}
        />
      ))}
      {publishedPresets.map((preset) => (
        <TransitionCard
          key={preset.id}
          effectKey={preset.id}
          label={preset.data.label || preset.name}
          previewStatic=""
          previewDynamic=""
          onClick={() => handleClick(preset)}
          badge="Public"
        />
      ))}
    </div>
  );
};

// ─── Panel ────────────────────────────────────────────────────────────────────

const PanelTransition = () => {
  return (
    <div className="py-4 px-4 h-full flex flex-col gap-4">
      <Tabs defaultValue="default" className="w-full h-full flex flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="default" className="flex-1">
            Default
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex-1">
            Custom
          </TabsTrigger>
        </TabsList>

        <TabsContent value="default" className="flex-1 mt-4">
          <ScrollArea className="h-full">
            <TransitionDefault />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="custom" className="flex-1 mt-4">
          <ScrollArea className="h-full">
            <TransitionCustom />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PanelTransition;
