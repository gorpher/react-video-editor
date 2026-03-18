export const ANIMATION_TYPE_LABELS: Record<string, string> = {
  keyframes: "关键帧",
  fadeIn: "淡入",
  zoomIn: "放大进入",
  slideIn: "滑入",
  blurIn: "模糊进入",
  pulse: "脉冲",
  popCaption: "弹入",
  bounceCaption: "弹跳",
  scaleCaption: "缩放",
  slideLeftCaption: "左滑入",
  slideRightCaption: "右滑入",
  slideUpCaption: "上滑入",
  slideDownCaption: "下滑入",
  slideFadeByWord: "按词滑入淡化",
  upDownCaption: "上下进入",
  upLeftCaption: "左上进入",
  charFadeIn: "逐字淡入",
  charSlideUp: "逐字上滑",
  charTypewriter: "逐字打字机",
  fadeByWord: "按词淡入",
  popByWord: "按词弹入",
  scaleFadeByWord: "按词缩放淡入",
  bounceByWord: "按词弹跳",
  rotateInByWord: "按词旋转进入",
  slideRightByWord: "按词右滑",
  slideLeftByWord: "按词左滑",
  fadeRotateByWord: "按词淡入旋转",
  skewByWord: "按词倾斜",
  waveByWord: "按词波浪",
  blurInByWord: "按词模糊进入",
  dropSoftByWord: "按词柔和下落",
  elasticPopByWord: "按词弹性弹入",
  flipUpByWord: "按词上翻",
  spinInByWord: "按词旋入",
  stretchInByWord: "按词拉伸进入",
  revealZoomByWord: "按词缩放显现",
  floatWaveByWord: "按词漂浮波浪",
  fadeOut: "淡出",
  zoomOut: "缩小退出",
  slideOut: "滑出",
  blurOut: "模糊退出",
};

export const ANIMATABLE_PROPERTY_LABELS: Record<string, string> = {
  x: "X 位置",
  y: "Y 位置",
  width: "宽度",
  height: "高度",
  scale: "缩放",
  scaleX: "X 缩放",
  scaleY: "Y 缩放",
  opacity: "不透明度",
  angle: "旋转",
  blur: "模糊",
  brightness: "亮度",
  mirror: "镜像",
};

export function getAnimationTypeLabel(type?: string): string {
  if (!type) return "未命名动画";
  return ANIMATION_TYPE_LABELS[type] ?? type;
}

export function getAnimatablePropertyLabel(property: string, fallback?: string): string {
  return ANIMATABLE_PROPERTY_LABELS[property] ?? fallback ?? property;
}
