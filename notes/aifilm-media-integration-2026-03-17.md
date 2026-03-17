# react-video-editor 对接 AIFilm 素材库说明

- 更新时间：2026-03-17 15:24:11 +08:00
- 阅读对象：后续维护 `react-video-editor` 的开发人员
- 当前阶段：一期最小接入已完成，目标是让左侧 `Uploads` 面板自动加载 AIFilm 素材库

## 1. 本次对接的结论

本次没有把 AIFilm 与 `react-video-editor` 做整仓融合，也没有直接让前端跨域访问 AIFilm 媒体。

当前采用的是 **Next 同源代理 + Uploads 面板最小接入**：

1. `react-video-editor` 前端只请求本站内的 `/api/aifilm/*`
2. Next Route Handler 再转发到 AIFilm 后端
3. 前端拿到的媒体地址是同源的 `/api/aifilm/media-files/...`
4. `Uploads` 面板将 AIFilm 远端素材与本地上传素材合并展示

这样做的原因是：

- 避免客户端直接跨域取媒体时丢失 cookie / header
- 避免依赖 `openvideo` 内部是否支持自定义鉴权头
- 保持 API 地址通过环境变量配置，不在前端硬编码
- 更接近后续通过 Nginx 或 Docker 统一编排部署的实际交付方式

## 2. 当前接入范围

当前只接入了 **左侧素材栏的 `Uploads` 面板**，不包含以下内容：

- `Images` / `Videos` 面板的 AIFilm 化
- AIFilm 项目加载 / 保存
- AIFilm 用户认证体系完整迁移
- AIFilm 工程文件与时间线双向同步

也就是说，本次能力边界是：

- 能自动加载 AIFilm 素材库
- 能显示在 `Uploads` 面板
- 能点击素材加入画布 / 时间线
- 保持现有本地上传逻辑不变

## 3. 联通架构

请求链路如下：

`Browser -> react-video-editor(/api/aifilm/*) -> AIFilm(/api/v1/media*)`

具体分成两条链路：

### 3.1 素材列表链路

1. 前端 `PanelUploads` 发起 `GET /api/aifilm/media`
2. Next 服务端转发到 AIFilm：`GET /api/v1/media`
3. AIFilm 返回素材列表 `items`
4. Next 将每个 `item.url` 改写为 `/api/aifilm/media-files/...`
5. 前端将 AIFilm 素材映射为 `VisualAsset` 并展示

### 3.2 媒体文件链路

1. 前端拿到的图片 / 音频 / 视频地址是 `/api/aifilm/media-files/...`
2. Next 服务端代理到 AIFilm：`GET /api/v1/media/files/:ownerId/:projectId/:filename`
3. 代理透传关键响应头，供图片展示、音视频播放和 Range 请求使用

## 4. 关键文件

### 4.1 `src/components/editor/media-panel/panel/uploads.tsx`

职责：

- 加载本地 uploads
- 拉取 AIFilm 远端素材
- 合并本地与远端素材列表
- 搜索合并后的素材
- 点击后调用 `Image.fromUrl` / `Video.fromUrl` / `Audio.fromUrl` 加入画布

当前约定：

- `source: "local" | "aifilm"`
- 远端素材显示 `AIFilm` 标签
- 远端素材不允许在此面板内删除
- 只接受 `image` / `video` / `audio` 三类远端媒体

### 4.2 `src/lib/aifilm-media.ts`

职责：

- 定义 `AifilmMediaItem`
- 读取环境变量中的 AIFilm 基础地址
- 构造转发 URL
- 构造转发请求头
- 将 AIFilm 返回的媒体文件地址改写为本地代理地址

### 4.3 `src/app/api/aifilm/media/route.ts`

职责：

- 代理 AIFilm 素材列表接口
- 转发 cookie
- 在开发态可附带 `x-dev-user-id`
- 将上游返回的 `item.url` 改写为本地媒体代理路径

### 4.4 `src/app/api/aifilm/media-files/[...path]/route.ts`

职责：

- 代理 AIFilm 媒体文件访问
- 支持 `GET` / `HEAD`
- 转发 `range` 请求头
- 透传 `content-type`、`content-length`、`accept-ranges`、`content-range` 等关键头

## 5. 环境变量

当前对接主要依赖以下变量：

- `AIFILM_API_BASE_URL`
- `AIFILM_DEV_USER_ID`

兼容的公开变量名也支持，但优先建议使用服务端变量：

- `NEXT_PUBLIC_AIFILM_API_BASE_URL`
- `NEXT_PUBLIC_AIFILM_DEV_USER_ID`

最小示例：

```env
AIFILM_API_BASE_URL=http://localhost:3000
AIFILM_DEV_USER_ID=dev-user
```

说明：

- `AIFILM_API_BASE_URL`：必填，指向 AIFilm 后端根地址
- `AIFILM_DEV_USER_ID`：可选，仅用于开发态无有效会话时的兜底
- 如果 Next 代理已经能转发有效的 AIFilm 登录态 cookie，则 `AIFILM_DEV_USER_ID` 可以留空

## 6. 鉴权与权限说明

本次对接依赖 AIFilm 后端现有鉴权逻辑，不在 `react-video-editor` 内重复实现权限系统。

当前代理层会做两件事：

1. 转发浏览器带来的 `cookie`
2. 如已配置开发态变量，则附带 `x-dev-user-id`

因此成功访问素材列表和媒体文件，需要满足以下之一：

- 当前请求上下文中已有合法的 AIFilm session cookie
- AIFilm 后端允许开发态 `x-dev-user-id` 回退，并且配置了 `AIFILM_DEV_USER_ID`

如果 AIFilm 后端项目权限不足，接口仍然会返回 `401/403`，这是预期行为。

## 7. 前端显示与交互规则

当前 `Uploads` 面板中的显示规则：

- AIFilm 素材与本地素材合并显示
- 搜索框同时搜索本地与远端素材
- 空状态文案从 `No uploads yet` 调整为 `No assets yet`
- 搜索提示改为 `Search assets...`
- 远端加载中显示 `Loading AIFilm library...`
- 远端失败时显示 `AIFilm library unavailable: ...`

这意味着：后续如果继续扩展素材源，应优先沿用“多素材源合并展示”的思路，而不是把 AIFilm 素材单独做成另一套平行逻辑。

## 8. 为什么必须保留代理层

除非后续有充分证据证明客户端直连 AIFilm 媒体完全稳定，否则不要轻易去掉 `/api/aifilm/*` 代理层。

原因：

- `openvideo` 在内部加载媒体时，不适合依赖自定义鉴权头
- 客户端跨域媒体请求对 cookie、CORS、Range 支持更敏感
- 同源代理更利于未来 Docker / Nginx 统一交付
- 当前已经验证这种方式可以稳定打通图片素材链路

## 9. 当前已验证结果

已完成的验证：

- `pnpm build` 成功
- 定向格式校验通过
- 页面联调中已确认：AIFilm 素材能在 `Uploads` 面板显示
- 页面联调中已确认：至少图片素材可成功加入画布 / 时间线

尚建议补充的烟测：

- 视频素材加入时间线并播放
- 音频素材加入时间线并播放
- 刷新页面后再次自动加载远端素材

## 10. 常见排查顺序

如果后续联调失败，优先按以下顺序排查：

1. `.env` 是否配置了 `AIFILM_API_BASE_URL`
2. 浏览器 Network 中 `GET /api/aifilm/media` 是否返回 200
3. 若失败，记录：`Request URL`、`Status Code`、`Response Body`
4. 检查 Next 服务端日志：
   - `[AIFilmMedia] Failed to fetch list`
   - `[AIFilmMedia] Failed to proxy media file`
   - `[AIFilmMedia] Unexpected list proxy error`
   - `[AIFilmMedia] Unexpected media proxy error`
5. 若是 401/403，优先检查 AIFilm 登录态或 `AIFILM_DEV_USER_ID`
6. 若是视频无法拖入或无法播放，重点检查媒体文件代理是否返回了 `range` / `content-range` / `accept-ranges`

## 11. 后续开发注意事项

1. 不要在前端硬编码 AIFilm API 地址与端口
2. 不要跳过 Next 代理直接让组件跨域请求 AIFilm 媒体
3. 如果扩展到更多面板，优先复用 `src/lib/aifilm-media.ts`
4. 如果要支持更多媒体类型，先确认 `openvideo` 的加载能力，再决定是否放入 `Uploads`
5. 如果后续要做 AIFilm 项目级深度集成，应单独设计项目保存、认证、权限与工程格式，不要把当前“素材库接入”误认为“编辑器已整体接入 AIFilm”

## 12. 当前对接的准确定位

请后续维护者明确：

- 这次完成的是 **素材库接入**
- 不是 **整个编辑器与 AIFilm 的全面融合**

当前状态适合作为一期可用能力继续迭代，但还不代表 AIFilm 与 `react-video-editor` 已经完成统一项目体系、统一认证体系和统一工程体系。