"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface ShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  label: string;
  keys: string[];
  disabled?: boolean;
}

interface ShortcutCategory {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUTS: ShortcutCategory[] = [
  {
    title: "全局",
    items: [
      { label: "全选", keys: ["⌘", "A"] },
      {
        label: "多选片段",
        keys: ["⇧", "Left-Click"],
      },
      { label: "复制", keys: ["⌘", "C"] },
      { label: "剪切", keys: ["⌘", "X"] },
      { label: "粘贴", keys: ["⌘", "V"] },
      { label: "删除", keys: ["⌫"] },
      { label: "撤销", keys: ["⌘", "Z"] },
      { label: "重做", keys: ["⇧", "⌘", "Z"] },
      { label: "播放 / 暂停", keys: ["Space"] },
      { label: "文字换行", keys: ["⌘", "Enter"], disabled: true },
      { label: "分割句子", keys: ["Enter"], disabled: true },
    ],
  },
  {
    title: "时间轴",
    items: [
      { label: "分割", keys: ["⌘", "B"] },
      { label: "放大", keys: ["⌘", "+"] },
      { label: "缩小", keys: ["⌘", "-"] },
      { label: "上下滚动", keys: ["Scroll"], disabled: true },
      { label: "左右滚动", keys: ["⇧", "Scroll"], disabled: true },
      { label: "上一帧", keys: ["⌘", "←"] },
      { label: "下一帧", keys: ["⌘", "→"] },
      { label: "开关预览轴", keys: ["S"], disabled: true },
      { label: "吸附", keys: ["N"], disabled: true },
      {
        label: "分离 / 恢复音频",
        keys: ["⇧", "⌘", "S"],
        disabled: true,
      },
      { label: "添加 / 移除节拍", keys: ["M"], disabled: true },
    ],
  },
  {
    title: "画布",
    items: [
      { label: "全屏", keys: ["⇧", "⌘", "F"], disabled: true },
      { label: "移动", keys: ["V"], disabled: true },
      { label: "手形工具", keys: ["H"], disabled: true },
      { label: "放大", keys: ["⇧", "+"], disabled: true },
      { label: "缩小", keys: ["⇧", "-"], disabled: true },
      { label: "适应窗口", keys: ["⇧", "F"], disabled: true },
      { label: "缩放至 50%", keys: ["⇧", "0"], disabled: true },
      { label: "缩放至 100%", keys: ["⇧", "1"], disabled: true },
      { label: "缩放至 200%", keys: ["⇧", "2"], disabled: true },
      { label: "上移 1px", keys: ["↑"] },
      { label: "下移 1px", keys: ["↓"] },
      { label: "左移 1px", keys: ["←"] },
      { label: "右移 1px", keys: ["→"] },
      { label: "移动 5px", keys: ["⇧", "Arrow Keys"] },
    ],
  },
];

export function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-5xl w-full max-w-5xl border bg-card p-6 py-8 overflow-hidden">
        <DialogHeader className="px-6">
          <DialogTitle className="text-lg font-semibold">快捷键</DialogTitle>
        </DialogHeader>
        <div className="px-6">
          <div className="grid grid-cols-3 gap-8">
            {SHORTCUTS.map((category, index) => (
              <div key={category.title} className="flex flex-col gap-6 relative">
                <h3 className="text-sm font-semibold">{category.title}</h3>
                <div className="flex flex-col gap-5">
                  {category.items.map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        "flex items-center justify-between text-sm",
                        item.disabled ? "opacity-40" : "",
                      )}
                    >
                      <span className="text-zinc-300">{item.label}</span>
                      <div className="flex gap-5">
                        {item.keys.map((key, i) => (
                          <Kbd
                            key={i}
                            className="bg-zinc-800 border-zinc-700 text-zinc-300 min-w-6"
                          >
                            {key}
                          </Kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {index < SHORTCUTS.length - 1 && (
                  <>
                    <div className="md:hidden">
                      <Separator className="my-4 bg-zinc-800" />
                    </div>
                    <div className="hidden md:block absolute -right-4 top-0 bottom-0 w-[1px] bg-zinc-800" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
