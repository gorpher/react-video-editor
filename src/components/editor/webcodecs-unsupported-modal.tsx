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
          <DialogTitle>Browser Not Supported</DialogTitle>
          <DialogDescription>
            WebCodecs is required for this editor to render and export video.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {reason === "insecure_context" ? (
            <p className="text-sm text-muted-foreground">
              This page is running on an insecure origin{origin ? ` (${origin})` : ""}. WebCodecs
              requires a secure context. Use `https://` or open via `localhost`.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your runtime is missing required WebCodecs APIs.
            </p>
          )}
          {missingApis.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-2">Missing APIs:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {missingApis.map((api) => (
                  <li key={api}>{api}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="font-medium text-sm mb-2">Please use one of the following browsers:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Google Chrome (version 94+)</li>
              <li>Microsoft Edge (version 94+)</li>
              <li>Opera (version 80+)</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: Safari and Firefox do not currently support WebCodecs.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
