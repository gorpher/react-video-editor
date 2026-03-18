"use client";

import { useProjectStore } from "@/stores/project-store";
import { useStudioStore } from "@/stores/studio-store";
import { Image, Log } from "openvideo";
import { toast } from "sonner";

type ShapeKind = "ellipse" | "square" | "polygon";

type ShapePreset = {
  id: string;
  name: string;
  kind: ShapeKind;
  fill: string;
};

const SHAPE_PRESETS: ShapePreset[] = [
  { id: "ellipse", name: "圆形", kind: "ellipse", fill: "#F8FAFC" },
  { id: "square", name: "方形", kind: "square", fill: "#BFDBFE" },
  { id: "polygon", name: "多边形", kind: "polygon", fill: "#FDE68A" },
];

const SHAPE_DURATION_US = 5 * 1_000_000;
const SHAPE_CANVAS_SIZE = 512;

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const buildShapeDataUrl = (shape: ShapePreset): string | null => {
  const canvas = document.createElement("canvas");
  canvas.width = SHAPE_CANVAS_SIZE;
  canvas.height = SHAPE_CANVAS_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, SHAPE_CANVAS_SIZE, SHAPE_CANVAS_SIZE);
  ctx.fillStyle = shape.fill;

  if (shape.kind === "ellipse") {
    ctx.beginPath();
    ctx.arc(SHAPE_CANVAS_SIZE / 2, SHAPE_CANVAS_SIZE / 2, 200, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape.kind === "square") {
    drawRoundedRect(ctx, 96, 96, 320, 320, 42);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(256, 52);
    ctx.lineTo(455, 197);
    ctx.lineTo(379, 432);
    ctx.lineTo(133, 432);
    ctx.lineTo(57, 197);
    ctx.closePath();
    ctx.fill();
  }

  return canvas.toDataURL("image/png");
};

export default function PanelElements() {
  const { studio } = useStudioStore();
  const { canvasSize } = useProjectStore();

  const handleAddShape = async (shape: ShapePreset) => {
    if (!studio) {
      toast.error("编辑器尚未初始化。");
      return;
    }

    try {
      const shapeDataUrl = buildShapeDataUrl(shape);
      if (!shapeDataUrl) {
        toast.error("当前环境不支持形状渲染。");
        return;
      }
      const shapeClip = await Image.fromUrl(shapeDataUrl);

      shapeClip.name = shape.name;
      shapeClip.display = { from: 0, to: SHAPE_DURATION_US };
      shapeClip.duration = SHAPE_DURATION_US;

      const targetSize = Math.round(Math.min(canvasSize.width, canvasSize.height) * 0.45);
      await shapeClip.scaleToFit(targetSize, targetSize);
      shapeClip.centerInScene(canvasSize.width, canvasSize.height);

      await studio.addClip(shapeClip);
    } catch (error) {
      Log.error("Failed to add shape element:", error);
      toast.error("添加形状失败，请重试。");
    }
  };

  return (
    <div className="px-4 h-full">
      <div className="text-text-primary flex h-12 flex-none items-center text-sm font-medium">
        形状
      </div>
      <div className="grid grid-cols-3 gap-4">
        {SHAPE_PRESETS.map((shape) => (
          <button
            key={shape.id}
            type="button"
            className="flex flex-col gap-2"
            onClick={() => handleAddShape(shape)}
          >
            <div className="aspect-square bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex items-center justify-center cursor-pointer transition-colors duration-200">
              <div className="w-16 h-16 rounded-full flex items-center justify-center">
                {shape.kind === "ellipse" && (
                  <div className="w-12 h-12 rounded-full" style={{ backgroundColor: shape.fill }} />
                )}
                {shape.kind === "square" && (
                  <div className="w-10 h-10 rounded-md" style={{ backgroundColor: shape.fill }} />
                )}
                {shape.kind === "polygon" && (
                  <div
                    className="w-12 h-12"
                    style={{
                      backgroundColor: shape.fill,
                      clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
                    }}
                  />
                )}
              </div>
            </div>
            <span className="text-xs text-white/50">{shape.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
