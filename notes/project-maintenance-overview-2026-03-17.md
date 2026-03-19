# react-video-editor 项目维护总览

- 更新时间：2026-03-17 15:32:52 +08:00
- 目的：帮助后续维护者快速建立对当前项目的整体认知
- 关联笔记：
  - `notes/project-notes-2026-03-17.md`
  - `notes/aifilm-media-integration-2026-03-17.md`

原项目：https://github.com/openvideodev/react-video-editor

## 1. 项目定位

这是一个基于 **Next.js App Router + React 19** 的浏览器端 AI 视频编辑器，项目名为 `openvideo-editor`。

核心能力包含：

- 项目列表与项目编辑
- 画布编辑（基于 `openvideo` / WebCodecs）
- 时间轴编排
- 本地素材上传与缓存
- AI Copilot 对话式编辑
- 自定义特效 / 转场预设
- AIFilm 素材库代理接入

## 2. 技术栈

- 前端框架：`Next.js 16`、`React 19`
- 样式/UI：Tailwind、Radix UI、Lucide
- 状态管理：`zustand`
- 编辑引擎：`openvideo`、`WebCodecs`、`pixi.js`、`fabric`
- 数据存储：`Prisma + PostgreSQL`
- 认证：`better-auth`
- AI：`Genkit + Google Gemini`
- 媒体能力：Deepgram、R2(S3)、ElevenLabs、Pexels
- 包管理器：`pnpm`

## 3. 主要页面与访问路径

- `/`：当前已重定向到 `/projects`
- `/projects`：项目列表页，支持创建、搜索、删除项目
- `/edit/[projectId]`：编辑器主页面
- `/signin`、`/confirm`：认证相关页面

典型流程：

1. 用户进入 `/projects`
2. 创建或打开项目
3. 跳转到 `/edit/[projectId]`
4. 读取项目数据并初始化 `project-store`
5. 挂载 Editor：左侧素材栏、中间画布+时间轴、右侧 AI 助手

## 4. 关键目录

- `src/app`：页面与 API Route Handler
- `src/components/editor`：编辑器核心 UI
- `src/stores`：全局状态仓库
- `src/lib`：认证、配置、存储、AIFilm、R2 等基础能力
- `src/genkit`：AI Flow 与工具定义
- `prisma/schema.prisma`：数据库模型
- `notes`：当前项目维护笔记

## 5. 编辑器核心架构

### 5.1 编辑页入口

`src/app/edit/[projectId]/page.tsx`

- 负责根据 `projectId` 加载项目
- 将项目尺寸/FPS/初始 JSON 注入 `useProjectStore`
- 已在进入编辑器前预注册用户自定义 effects/transitions
- 项目不存在时跳回 `/projects`

### 5.2 编辑器主容器

`src/components/editor/editor.tsx`

- 三栏布局：`MediaPanel` / `CanvasPanel + Timeline` / `Assistant`
- 面板尺寸保存在 `usePanelStore`
- 启动时检查 WebCodecs 支持情况
- 若处于不安全上下文（例如局域网 http）会阻止编辑器渲染并弹出说明

### 5.3 画布

`src/components/editor/canvas-panel.tsx`

- 创建 `openvideo` 的 `Studio` 实例
- 加载字体、自定义转场、自定义特效
- 从 `project-store.initialStudioJSON` 恢复工程内容
- 将 `Studio` 实例写入 `useStudioStore`

### 5.4 时间轴

`src/components/editor/timeline/index.tsx`

- 时间轴数据来自 `useTimelineStore`
- 播放状态来自 `usePlaybackStore`
- 与 `Studio` 保持同步
- 支持滚动、缩放、拖拽、分割、删除、复制、轨道顺序调整

### 5.5 左侧素材/属性面板

`src/components/editor/media-panel/index.tsx`

- Tab 方式切换 Uploads / Images / Videos / Music / Text / Effects 等面板
- 当画布有选中元素时，会切换到 `PropertiesPanel`

## 6. 存储与数据流

### 6.1 项目存储

`src/lib/storage/storage-service.ts`

- 当前采用 **session-aware local-first** 思路
- 已登录：优先使用 `/api/projects*` 走远端数据库
- 未登录或接口 `401/403/5xx`：自动回退到 IndexedDB 本地项目存储
- 项目媒体文件走 OPFS + IndexedDB 元数据组合

这意味着当前项目不是“纯云端”或“纯本地”，而是混合模式。

### 6.2 项目数据库模型

`prisma/schema.prisma`

- `User`
- `Session`
- `Account`
- `Verification`
- `CustomPreset`
- `Project`

`Project.data` 是当前工程 JSON 的主要持久化字段。

## 7. 服务端接口维护重点

- `/api/projects`、`/api/projects/[id]`：项目 CRUD，必须登录后访问
- `/api/custom-presets`：用户特效/转场预设
- `/api/chat/editor`：AI 助手入口，转给 `chatFlow`
- `/api/uploads/presign`：生成 R2 预签名上传地址
- `/api/batch-export`：导出结果写入本地 `D:\animations`
- `/api/aifilm/media`、`/api/aifilm/media-files/*`：AIFilm 同源代理

## 8. AI 与第三方能力

### 8.1 AI 助手

`src/components/editor/assistant/assistant.tsx` + `src/genkit/chat-flow.ts`

- 前端通过 `/api/chat/editor` 流式获取 AI 回复
- AI 会结合当前时间轴素材上下文进行编辑建议或直接调用工具
- 工具动作最终仍落到前端 `Studio` 实例上执行

### 8.2 AIFilm 素材库接入

当前不是前端直接跨域请求 AIFilm，而是：

`Browser -> /api/aifilm/* -> AIFilm backend`

原则上不要轻易移除这层代理，否则会影响 cookie、鉴权头、Range 请求和后续交付兼容性。

## 9. 关键环境变量

- `AIFILM_API_BASE_URL`
- `AIFILM_DEV_USER_ID`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `DEEPGRAM_API_KEY`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `R2_PUBLIC_DOMAIN`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`

注意：前端不应硬编码后端地址，尤其是 AIFilm 地址必须经环境变量和代理层统一管理。

## 10. 当前维护时最需要注意的风险点

1. **WebCodecs 依赖安全上下文**：局域网 `http://IP:3000` 下可能直接不可用
2. **认证接口默认受保护**：项目、预设接口无登录态会返回 401
3. **项目存储是混合模式**：排查数据问题时必须先判断当前走的是远端还是本地回退
4. **Uploads 面板存在“本地全局素材池”特征**：当前 `PROJECT_ID = "local-uploads"`，不是跟随具体项目隔离
5. **导出接口依赖本地固定目录**：`/api/batch-export` 直接写 `D:\animations`
6. **AI/三方能力强依赖环境变量**：缺少配置时通常不会编译报错，但运行时会失败
7. **React StrictMode 已开启**：排查重复请求/重复初始化时要优先考虑开发模式双调用

## 11. 建议的日常排查顺序

1. 先确认问题发生在 `/projects` 还是 `/edit/[projectId]`
2. 再判断是 UI 层、Studio 层、时间轴层、存储层还是 API 层
3. 若涉及项目读写，先看是否有登录态，再看是否走本地 fallback
4. 若涉及素材加载，区分本地上传、R2 链路、AIFilm 代理链路
5. 若涉及无法编辑/黑屏，优先检查浏览器是否满足 WebCodecs + secure context
6. 若涉及 AI 助手，检查 `/api/chat/editor`、Genkit 和模型环境变量

## 12. 建议优先熟悉的文件

- `src/app/projects/page.tsx`
- `src/app/edit/[projectId]/page.tsx`
- `src/components/editor/editor.tsx`
- `src/components/editor/canvas-panel.tsx`
- `src/components/editor/timeline/index.tsx`
- `src/components/editor/media-panel/panel/uploads.tsx`
- `src/lib/storage/storage-service.ts`
- `src/lib/aifilm-media.ts`
- `src/app/api/aifilm/media/route.ts`
- `prisma/schema.prisma`

## 13. 当前结论

这个项目已经不是一个“纯前端 Demo”，而是一个包含：编辑器内核、认证、数据库、对象存储、AI 编排、第三方素材代理 的完整应用雏形。

后续维护时，优先要守住三条线：

- 不破坏编辑器主流程（项目 -> 编辑 -> 保存）
- 不破坏同源代理和环境变量配置原则
- 不轻易改动认证/存储/导出这类跨模块基础能力
## 14. 2026-03-18 迭代复盘（汉化 / 转场 / 音轨 / 插入）

### 14.1 本轮完成内容（可交付）
- 完成媒体面板核心汉化（素材/图片/视频/文字/音乐/配音/音效/转场），并保留隐藏标签（captions/effects/elements）的可扩展能力。
- 转场从“入口存在但难以生效”调整为“可按选择上下文稳定添加”，并加入片段衔接容差。
- 修复音乐面板上传按钮无响应、音频分割后导出失败两类高频问题。
- 素材卡片交互升级：AIFilm 视频脚标、悬浮 `+` 直接上轨、按分割线插入并顺延后续片段（ripple）。
- 补齐实用功能：轨道工具栏“关闭原声/恢复原声”、Elements 形状可正常创建。
- 保存/命名策略纠偏：命名放在项目管理和项目标题重命名，不在“保存动作”中强制命名。

### 14.2 界面汉化与构建稳定性
落点：`src/components/editor/media-panel/store.ts`

- 标签配置改为 `satisfies Partial<Record<Tab, MediaTabConfig>>`，解决“隐藏 tabs 导致 TS 构建报缺字段”问题。
- 面板文案已切到中文，后续如继续放开 captions/effects/elements，只需补齐 tabs 配置并保持类型一致。
- 维护建议：避免用非 UTF-8 流程改中文文案，Windows 终端乱码通常是控制台编码问题，不等于文件损坏。

### 14.3 转场修正（从摆设到可用）
落点：`src/components/editor/media-panel/panel/transition.tsx`

- 支持“选中 2 段”或“选中 1 段自动找相邻片段”两种添加方式。
- 仅允许同轨道视频/图片做转场，避免跨轨误加。
- 增加容差常量 `TRANSITION_JOIN_TOLERANCE_US = 300_000`（0.3s）。
- 当间隔偏大时给出提示，但仍按最近边界尝试添加，提升容错体验。

### 14.4 音乐轨道与导出修复
落点：
- `src/components/editor/media-panel/panel/music.tsx`
- `src/components/editor/export-modal.tsx`

- 音乐上传按钮：通过隐藏 input + `fileInputRef.current?.click()` 明确打通触发链路。
- 仅接收 `audio/*`，并保持本地/上传 URL 双路径兼容。
- 导出前增加 `repairClipSourcesForExport`：
  - 检测并修复失效 `blob:` 源；
  - 通过本地素材池（按 `id/name`）回填可读 URL；
  - 无法修复时明确抛错，避免“无提示失败”。

### 14.5 视频插入与素材面板交互修正
落点：`src/components/editor/media-panel/panel/uploads.tsx`

- 素材卡片新增：
  - AIFilm 来源标记；
  - AIFilm 视频“视频”脚标；
  - 悬浮 `+` 一键上轨（弱化“必须点缩略图本体”的学习成本）。
- 插入策略升级（参考 PR/剪映体验）：
  - 取分割线时间 `getCurrentInsertTimeUs()`；
  - 优先命中兼容轨道 `getPreferredTrackId()`；
  - 若分割线落在片段中间，锚点对齐到该片段尾 `resolveInsertAnchorUs()`；
  - 对同轨后续片段执行顺延 `rippleShiftTrackClips()`，实现“插入并整体后推”。

### 14.6 相关补强
- Elements 形状修复（`src/components/editor/media-panel/panel/elements.tsx`）：改为 Canvas 生成 PNG dataURL，再 `Image.fromUrl`，规避 `The source image could not be decoded`。
- 关闭原声（`src/components/editor/timeline/timeline-toolbar.tsx`）：
  - 功能位置在轨道工具栏；
  - 对视频片段批量写 `volume=0`；
  - 开启静音期间新增视频自动跟随静音（监听 `clips:added`）。
- 面板切换一致性（`src/components/editor/media-panel/store.ts`）：`setActiveTab` 同步 `showProperties=false`，避免“点素材无反应”的状态卡住。

### 14.7 保存机制与命名机制（产品策略）
落点：
- `src/app/projects/page.tsx`
- `src/components/editor/header.tsx`

- 保留编辑器自动保存（防丢失），并保留手工保存按钮（可控落盘）。
- 命名责任回归项目管理：
  - 新建项目时可输入名称；
  - 项目列表支持重命名。
- 编辑页顶部标题支持即时重命名，但“保存”动作不再承担“首次命名”职责，避免交互冲突。

### 14.8 离线打包与部署经验
落点：`docker-compose.offline.yml`

- PostgreSQL 已保持容器内网通信，不再映射宿主 `5432`，避免端口冲突和不必要暴露。
- 打包阶段常见失败（Docker Desktop 未启动、镜像源 EOF、`@swc/helpers` 缺失）属于环境依赖问题，不是本轮业务改动引入。
- 交付原则：打包机需先能完整 `npm/pnpm build` + `docker build`，再执行离线 bundle 封装。

### 14.9 给后续二开的技巧清单
1. 时间线所有排布优先使用“微秒”统一单位，避免秒/us 混用造成错位。
2. 做“插入并顺延”时，先按 `from` 倒序更新后续片段，防止更新覆盖。
3. 与轨道相关的新增能力，优先做“轨道类型兼容判断”，再做插入，减少异常轨道创建。
4. 导出链路不要信任 `blob:` 的长期可读性，导出前做可读性检查与源修复。
5. 媒体面板状态改动要同时考虑 `activeTab / showProperties / selectedClips` 三者联动。
6. AIFilm 素材访问应继续走 `/api/aifilm/*` 代理，避免前端直连破坏鉴权、同源与离线交付一致性。
7. UI 文案改动前先确认文件编码与终端编码，避免“显示乱码”被误判为“文件损坏”。
8. 离线发包前固定做一轮构建自检（前端 build、镜像 build、compose 配置核对），比部署后排障成本低很多。