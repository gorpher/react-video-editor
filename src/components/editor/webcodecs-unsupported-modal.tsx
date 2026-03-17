"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WebCodecsUnsupportedModalProps {
  open: boolean;
  reason?: "insecure_context" | "missing_apis";
  missingApis?: string[];
  origin?: string;
}

export function WebCodecsUnsupportedModal({
  open,
  reason,
  missingApis = [],
  origin,
}: WebCodecsUnsupportedModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>浏览器不支持</DialogTitle>
          <DialogDescription>此编辑器需要 WebCodecs 支持才能渲染和导出视频。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {reason === "insecure_context" ? (
            <p className="text-sm text-muted-foreground">
              当前页面运行在不安全的源{origin ? `（${origin}）` : ""}。WebCodecs
              需要安全上下文，请使用 https:// 或通过 localhost 访问。
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">当前运行环境缺少必要的 WebCodecs API。</p>
          )}
          {missingApis.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-2">缺少以下 API：</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {missingApis.map((api) => (
                  <li key={api}>{api}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="font-medium text-sm mb-2">请使用以下浏览器之一：</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Google Chrome（94 及以上版本）</li>
              <li>Microsoft Edge（94 及以上版本）</li>
              <li>Opera（80 及以上版本）</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            注意：Safari 和 Firefox 目前不支持 WebCodecs。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
