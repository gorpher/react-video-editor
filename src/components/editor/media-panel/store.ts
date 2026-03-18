import {
  IconFolder,
  IconLetterT,
  IconSubtitles,
  IconMusic,
  IconMicrophone,
  IconWaveSine,
  IconArrowsLeftRight,
  IconSparkles,
  type IconProps,
  IconPhoto,
  IconVideo,
} from "@tabler/icons-react";
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

export const tabs: {
  [key in Tab]: { icon: React.FC<IconProps>; label: string };
} = {
  uploads: {
    icon: IconFolder,
    label: "素材",
  },
  images: {
    icon: IconPhoto,
    label: "图片",
  },
  videos: {
    icon: IconVideo,
    label: "视频",
  },
  text: {
    icon: IconLetterT,
    label: "文字",
  },
  captions: {
    icon: IconSubtitles,
    label: "字幕",
  },
  music: {
    icon: IconMusic,
    label: "音乐",
  },
  voiceovers: {
    icon: IconMicrophone,
    label: "配音",
  },
  sfx: {
    icon: IconWaveSine,
    label: "音效",
  },
  transitions: {
    icon: IconArrowsLeftRight,
    label: "转场",
  },
  effects: {
    icon: IconSparkles,
    label: "特效",
  },
  elements: {
    icon: IconSparkles,
    label: "元素",
  },
};

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
