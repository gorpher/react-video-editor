# AI 助手模型替换方案

> 当前状态：已集成，暂未替换。待后期按需实施。

---

## 现状

编辑器右上角的"AI 助手"面板，底层调用 **Google Gemini 2.5 Flash**，通过 Google 的 Genkit 框架接入。

**核心文件：** `src/genkit/chat-flow.ts`

**用到的模型能力：**
- Tool Use（函数调用）：AI 可直接操控时间轴，执行添加/删除/分割素材等操作
- 多模态：可分析时间轴上的视频、图片内容
- Thinking 推理模式：回答前先进行内部推理（budget: 2000 tokens）
- 流式输出：逐步返回结果，体验更流畅

---

## 为什么考虑替换？

| 原因 | 说明 |
|---|---|
| 成本 | Gemini 2.5 Flash 按量计费，高并发下费用可观 |
| 国内访问 | Google API 在国内需要代理 |
| 能力差异 | 不同场景对 tool use 稳定性要求不同 |

---

## 可选方案

### 方案 A：Claude Sonnet / Haiku（Anthropic）

**适合场景：** 对 tool use 稳定性要求高、需要更强推理能力

| 项目 | 内容 |
|---|---|
| 推荐模型 | `claude-sonnet-4-6`（质量优先）或 `claude-haiku-4-5`（成本优先）|
| Genkit 插件 | `@genkit-ai/anthropic` |
| 环境变量 | `ANTHROPIC_API_KEY` |

```ts
// src/genkit/chat-flow.ts
import { anthropic } from "@genkit-ai/anthropic";

export const ai = genkit({
  plugins: [anthropic()],
  model: anthropic.model("claude-sonnet-4-6"),
});
```

注意：去掉 `thinkingConfig`（Claude 的 extended thinking 参数格式不同）。

---

### 方案 B：Gemini 降级（留在 Google，降低成本）

**适合场景：** 保持现有架构不变，只降成本

| 模型 | 特点 |
|---|---|
| `gemini-2.0-flash` | 上一代，更便宜，稳定 |
| `gemini-2.5-flash-lite` | 最轻量，成本最低 |

```ts
// 只改这一行，其余不动
model: googleAI.model("gemini-2.0-flash")
```

---

### 方案 C：Qwen（阿里云，国内友好）

**适合场景：** 国内部署、无需代理访问

| 项目 | 内容 |
|---|---|
| 推荐模型 | `qwen2.5-vl-72b-instruct`（多模态）|
| 接入方式 | OpenAI 兼容接口（DashScope）|
| 环境变量 | `OPENAI_API_KEY=<dashscope key>` |

```ts
import { openAI } from "@genkit-ai/openai";

export const ai = genkit({
  plugins: [openAI({ baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" })],
  model: openAI.model("qwen2.5-vl-72b-instruct"),
});
```

注意：去掉 `thinkingConfig`。

---

## 替换时的注意事项

1. **`thinkingConfig` 是 Gemini 专属参数**，换厂商时必须去掉，否则报错
2. **多模态内容格式**各家略有差异，换厂商后需测试 `src/genkit/utils.ts` 中的 `buildMessageContent()` 是否正常
3. **Tool 定义**（`src/genkit/tools.ts`）Genkit 会自动适配各家格式，一般无需改动
4. **流式 chunk 结构**可能因模型而异，需在 `src/components/editor/assistant/assistant.tsx` 中测试 `reasoning` / `tool` 事件是否正常触发

---

## 涉及文件

| 文件 | 说明 |
|---|---|
| `src/genkit/chat-flow.ts` | 模型配置 + flow 定义，**主要改动点** |
| `src/genkit/tools.ts` | 所有 tool 定义 |
| `src/genkit/utils.ts` | 多模态内容构建逻辑 |
| `src/app/api/chat/editor/route.ts` | API 路由，通常不需改动 |
| `src/components/editor/assistant/assistant.tsx` | 前端，streaming 解析逻辑 |
