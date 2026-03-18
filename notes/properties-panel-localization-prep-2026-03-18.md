# 属性面板汉化准备清单（2026-03-18）

- 更新时间：2026-03-18
- 范围：选中轨道元素后右侧 `PropertiesPanel` 相关文案
- 目标：先定位英文来源并拆分改造边界，为下一步统一汉化做准备

## 1. 结论（先给结论）

当前截图中的英文文案主要来自项目内硬编码，不是第三方 UI 库强制输出。  
核心集中在 `src/components/editor/properties-panel/*`。

## 2. 你截图对应的主来源（第一优先级）

### 2.1 文本属性面板
- `src/components/editor/properties-panel/text-properties.tsx`
- 典型英文：
  - `Content`、`Transform`、`Rotation`、`Font`、`Style`、`Opacity`
  - `Animations`、`No animations applied`
  - `Stroke`、`Shadow`
  - `placeholder="Enter text..."`
  - `placeholder="Select font"`
  - `"{...}s duration"`

### 2.2 图片属性面板
- `src/components/editor/properties-panel/image-properties.tsx`
- 典型英文：
  - `Transform`、`Rotation`、`Opacity`
  - `Animations`、`No animations applied`
  - `Chroma Key`、`Similarity`、`Spill`
  - `Corner Radius`、`Stroke`、`Shadow`
  - `"{...}s duration"`

### 2.3 视频属性面板
- `src/components/editor/properties-panel/video-properties.tsx`
- 典型英文：
  - `Transform`、`Rotation`、`Volume`、`Opacity`
  - `Animations`、`No animations applied`
  - `Chroma Key`、`Similarity`、`Spill`
  - `Corner Radius`、`Stroke`、`Shadow`
  - `"{...}s duration"`

## 3. 关联面板（建议同批次处理）

### 3.1 字幕属性面板
- `src/components/editor/properties-panel/caption-properties.tsx`
- 典型英文：
  - `Content`、`Transform`、`Position`
  - `Vertical Position`、`Top/Center/Bottom`
  - `Words per line`、`Single/Multiple`
  - `Font`、`Style`、`Opacity`、`Animations`
  - `Presets`、`None`
  - `Caption Colors`、`Appeared`、`Active`、`Active Fill`、`Background`、`Keyword`
  - `Transparent`

### 3.2 音频属性面板
- `src/components/editor/properties-panel/audio-properties.tsx`
- 典型英文：
  - `Volume`、`Pitch`、`Speed`

### 3.3 转场属性面板
- `src/components/editor/properties-panel/transition-properties.tsx`
- 典型英文：
  - `Duration`
  - `Default`、`Custom`
  - `Could not load custom transitions.`
  - `Loading custom transitions…`
  - `No custom transitions yet.`
  - `Create one from the Gallery to see it here.`
  - `Public`

### 3.4 特效属性面板
- `src/components/editor/properties-panel/effect-properties.tsx`
- 典型英文：
  - `Properties not available for modification`
  - `Select a type`
  - `Add Replacement`、`Add Stop`
  - `Start`、`End`、`Offset`、`Alpha`
  - `Linear`、`Radial`、`Conic`
  - 各滤镜属性名目前直接显示 `property key`（如 `fillMode` 等）

### 3.5 多选状态
- `src/components/editor/properties-panel/index.tsx`
- 典型英文：`Group`

## 4. 非属性面板但会影响体验的关联英文

### 4.1 文本预设与默认文本
- `src/components/editor/media-panel/panel/text.tsx`
- 典型英文：
  - `Heading`、`Body text`
  - `Modern Bold`、`Elegant Serif`、`Neon Glow`、`Handwritten`
  - `Serif Style`、`Script`
  - 默认文本：`Add Text pro`
  - 默认 clip 名称：`Text`

## 5. 汉化改造建议（准备方案）

1. 先建立统一文案字典（推荐）  
   建议新增 `src/i18n/zh-CN/editor-properties.ts`，统一管理右侧属性面板文案 key。

2. 先做“静态文案替换”  
   即 JSX 中写死英文文本，优先替换成 `t.xxx`，避免散落。

3. 再处理“动态文案映射”  
   - 动画类型：`anim.type` 需要 `type -> 中文` 映射。
   - 特效属性：`property key -> 中文` 映射（当前直接显示 key）。
   - 转场标签：`effect.label` 若来自默认库，建议加兜底映射。

4. 统一格式细节  
   - `"{n}s duration"` 建议中文化为 `"{n} 秒"`。
   - `掳` 建议改为标准角度符号 `°`（当前疑似编码问题）。
   - `text-transform: uppercase` 对中文无意义，但可保留；若中英混排可按需调整样式。

## 6. 下一步执行顺序（建议）

1. 第一批：`text/image/video` 三个面板（与你截图直接相关）
2. 第二批：`caption/audio`
3. 第三批：`transition/effect`（含动态映射）
4. 第四批：`media-panel/panel/text.tsx` 的文本预设命名

