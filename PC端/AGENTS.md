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

## Check item entry decisions (2026-11-15 follow-up)

- 尽量保留原系统的新增操作习惯：左侧添加一级；每个一级行右侧提供“＋二级”，新增二级不能放在右侧参数编辑区。三级按用户最后描述的旧习惯保留右侧新增。
- 一级新增弹窗同时配置名称、普通／加分类型及权重；普通项新增弹窗（含二、三级）可直接填写权重，保存后保留；加分项无需权重。点击左侧一级项时，右侧明确展示一级检查项权重。
- 左侧新增子项必须绑定被点击行的父级 ID，不能依赖此前选中的检查项。

## Template audit fixes approved (2026-11-16)

- 模板编辑须提示未保存状态；返回、侧栏切换和 hash 后退提供继续编辑／放弃／保存草稿并离开，关闭或刷新页面使用浏览器离开提醒。
- 基本信息保留节点频次（单次／周期）、周期数与单位、地址必填；系统专业字典与本模板参与专业分开，矩阵行按所选专业重新生成并保留匹配权重。
- 检查项可删除；父项删除须说明下级影响，已有巡检问题引用的本项／后代不可删除。仅修改草稿，保存后生效。
- 同级权重显示合计与差额；校验失败使用错误样式并展开、选中、定位出错项。
- 左树箭头控制折叠，名称控制选中；树独立滚动，保存动作固定可达。保留左侧加一级／二级、右侧加三级。新增弹窗显示父路径和兄弟项权重余额。
