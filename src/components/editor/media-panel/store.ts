import {
  IconArrowsLeftRight,
  IconFolder,
  type IconProps,
  IconLetterT,
  IconMicrophone,
  IconMusic,
  IconPhoto,
  IconVideo,
  IconWaveSine,
} from "@tabler/icons-react";
import type { ElementType } from "react";
import { create } from "zustand";

export type Tab =
  | "uploads"
  | "images"
  | "videos"
  | "music"
  | "text"
  | "captions"
  | "effects"
  | "elements"
  | "voiceovers"
  | "sfx"
  | "transitions";

export type MediaTabConfig = {
  icon: ElementType<IconProps>;
  label: string;
};

export const tabs = {
  uploads: {
    icon: IconFolder,
    label: "绱犳潗",
  },
  images: {
    icon: IconPhoto,
    label: "鍥剧墖",
  },
  videos: {
    icon: IconVideo,
    label: "瑙嗛",
  },
  text: {
    icon: IconLetterT,
    label: "鏂囧瓧",
  },
  music: {
    icon: IconMusic,
    label: "闊充箰",
  },
  voiceovers: {
    icon: IconMicrophone,
    label: "閰嶉煶",
  },
  sfx: {
    icon: IconWaveSine,
    label: "闊虫晥",
  },
  transitions: {
    icon: IconArrowsLeftRight,
    label: "杞満",
  },
  // captions/effects/elements are intentionally hidden for now.
} satisfies Partial<Record<Tab, MediaTabConfig>>;

interface MediaPanelStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  highlightMediaId: string | null;
  requestRevealMedia: (mediaId: string) => void;
  clearHighlight: () => void;
  showProperties: boolean;
  setShowProperties: (show: boolean) => void;
}

export const useMediaPanelStore = create<MediaPanelStore>((set) => ({
  activeTab: "uploads",
  setActiveTab: (tab) => set({ activeTab: tab, showProperties: false }),
  highlightMediaId: null,
  requestRevealMedia: (mediaId) =>
    set({
      activeTab: "uploads",
      highlightMediaId: mediaId,
      showProperties: false,
    }),
  clearHighlight: () => set({ highlightMediaId: null }),
  showProperties: false,
  setShowProperties: (show) => set({ showProperties: show }),
}));
