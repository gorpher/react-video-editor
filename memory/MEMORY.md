# react-video-editor 项目记忆

## 项目定位
Next.js 16 + React 19 的浏览器端 AI 视频编辑器（openvideo-editor）。
包含编辑器内核、认证、数据库、对象存储、AI 编排、第三方素材代理。

## 技术栈
- 框架：Next.js 16, React 19
- 包管理：pnpm
- 状态：zustand
- 编辑引擎：openvideo, WebCodecs, pixi.js, fabric
- 数据库：Prisma + PostgreSQL
- 认证：better-auth
- AI：Genkit + Google Gemini
- 存储：R2(S3), IndexedDB/OPFS

## 关键路径
- 项目列表：`/projects`（首页重定向到此）
- 编辑页：`/edit/[projectId]`
- 编辑入口文件：`src/app/edit/[projectId]/page.tsx`
- 编辑器容器：`src/components/editor/editor.tsx`
- 左侧素材面板：`src/components/editor/media-panel/panel/uploads.tsx`
- 项目存储服务：`src/lib/storage/storage-service.ts`
- AIFilm 代理工具库：`src/lib/aifilm-media.ts`
- AIFilm 列表代理：`src/app/api/aifilm/media/route.ts`
- AIFilm 文件代理：`src/app/api/aifilm/media-files/[...path]/route.ts`

## AIFilm 素材接入（一期已完成）
- 架构：Browser -> /api/aifilm/* -> AIFilm backend（同源代理）
- 范围：仅 Uploads 面板，AIFilm 素材与本地上传合并显示
- 关键环境变量：AIFILM_API_BASE_URL、AIFILM_DEV_USER_ID
- 已验证：pnpm build 成功，图片素材可加入画布/时间线
- 待验证：视频/音频加入时间线并播放、刷新后重新加载

## 存储模式
session-aware local-first 混合模式：
- 已登录 → /api/projects* 远端数据库
- 未登录/401/5xx → IndexedDB 本地回退

## 主要风险点
1. WebCodecs 依赖 secure context（局域网 http 下不可用）
2. 项目/预设接口无登录态返回 401
3. 存储是混合模式，排查数据时先判断走远端还是本地
4. Uploads 面板 PROJECT_ID="local-uploads"，不按项目隔离
5. /api/batch-export 写死本地 D:\animations 目录
6. React StrictMode 已开启（开发模式双调用）

## 维护原则
- 不破坏编辑器主流程（项目 -> 编辑 -> 保存）
- 不破坏同源代理和环境变量配置原则
- 不轻易改动认证/存储/导出这类跨模块基础能力
- 不跳过 Next 代理直接让前端跨域请求 AIFilm 媒体
