# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Template workflow decisions (2026-11-15)

- 新增模板直接进入空白编辑页，不弹前置创建窗口，不复制当前检查项。
- 一级检查项配置类型：普通检查项／加分项；加分项及下级不参与普通项权重。
- 编辑页按基本信息、检查项、专业权重纵向排列，专业权重与评分规则不用 Tab。
- 检查项下方提供“生成专业权重”；“重新调整专业权重”每次读取最新检查项，按 ID 保留已有权重，新普通项生成待配置列，加分项不生成列。变更后提示重新生成，阻止用旧矩阵启用。
