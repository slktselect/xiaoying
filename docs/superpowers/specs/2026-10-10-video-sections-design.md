# 视频分区功能 — 设计文档

| | |
| --- | --- |
| 日期 | 2026-10-10 |
| 状态 | 待用户审阅 |

## 背景

简历的视频区块当前是扁平的一列卡片（`videos: [...]`）。用户希望按"分区"组织（如个人介绍、作品集、影视后期），并实现"主画面 + 缩略栏"的画廊式交互。配套地，上传脚本也要能在切片/导入时给视频分到分区。

**用户决策**：
- 旧配置里现有的 `videos` 条目（不带 `section` 字段）**全部删除**，新设计**不向后兼容**
- 每个分区支持填一段简介（`desc`）
- 视频嵌套在分区下：`sections: [{title, desc, videos: [...]}]`

R2 桶里的旧对象保留（不属于本次范围）。

## 目标

1. 视频按 `section` 嵌套分组，每个分区有标题 + 简介 + 视频列表
2. 分区作为页内二级标题（不进导航）
3. 同时**只有一个**视频播放；点击缩略图会停旧的、播新的
4. **默认全部不播放**，等用户主动点
5. 上传脚本能交互式给视频分配分区、支持新建分区、填写分区简介
6. 脚本能只把 R2 上已有视频挂进配置（不重新切片/上传）
7. 脚本能整理分区：重命名、改简介、跨分区移动视频

## 非目标

- 改 R2 存储路径结构（仍是 `videos/<file-slug>/`）
- 改 Worker 代码（`VIDEO_KEYS` 仍按 R2 前缀匹配）
- 改 `wrangler.toml`
- 自动从视频里提取元数据

---

## 设计

### 1. 配置（`src/resume.config.js`）

```js
sections: [
  {
    title: 'MCN账号视频',
    desc: '代运营 MCN 账号短视频（抖音/快手/小红书）',
    videos: [
      { key: 'videos/intro/index.m3u8',  title: '默认作品', desc: '', poster: '' },
      { key: 'videos/demo1/index.m3u8',  title: '代运营 demo 1', desc: '', poster: '' },
    ],
  },
  {
    title: '网剧（灵瞳鉴宝）',
    desc: '网剧项目相关作品',
    videos: [
      { key: 'videos/pilot/index.m3u8', title: '先导片', desc: '', poster: '' },
    ],
  },
]
```

- `sections` 替代旧的顶层 `videos` 数组
- 每个 section：
  - `title` 必填
  - `desc` 可选（简介）
  - `videos` 数组，元素是 `{key, title, desc?, poster?}`
- section 顺序 = 在 `sections` 数组的顺序
- section 内视频顺序 = 在 `videos` 数组的顺序

### 2. 布局

**宽屏（≥ lg / 1024px）**
- 左 2/3：hero（16:9）
- 右 1/3：分区列表（垂直滚动）
  - 每个分区：`h3` 标题 + `desc`（一段灰色小字）+ 缩略卡垂直堆叠
  - 当前 hero 所属的缩略卡有视觉高亮（边框/标记）

**窄屏（< lg）**
- 上：hero（满宽，16:9）
- 下：分区 chips 横排（可横滑）
- 当前分区的 `desc` 段落 + 缩略卡横排

### 3. 播放模型（不变）

- 同时只播一个
- 默认全不播放
- 点击缩略图：停旧、播新
- hero 用 `key={activeKey}` 重建释放 hls.js

### 4. 组件结构

| 文件 | 状态 | 职责 |
| --- | --- | --- |
| `src/components/VideoGallery.jsx` | 改 | 从 `sections` 读取（替代 `videos`）；管理 `activeKey` |
| `src/components/SectionGroup.jsx` | 改 | 渲染分区标题 + desc + 缩略卡 |
| `src/components/VideoHero.jsx` | 不变 | 大画面；用 `useVideoPlayer` hook |
| `src/components/VideoThumb.jsx` | 不变 | 缩略卡 |
| `src/components/useVideoPlayer.js` | 不变 | 共用 hook |
| `src/components/VideoCard.jsx` | 改 | 不再被 App 引用；保留作 fallback / embed 模式 |
| `src/App.jsx` | 改 | 改用 `<VideoGallery sections={visibleSections} />` |

**关键实现点**：
- `VideoGallery` 内部把 `sections` 拍平为带 section 标记的 video 列表用于 activeKey 定位
- `SectionGroup` 接收 `title` + `desc` + `videos` 三个 props，渲染头部信息 + 缩略列表
- 嵌套结构对 React 友好：直接 `sections.map((s) => <SectionGroup ... />)` 即可

### 5. 脚本（`video-workflow/slice.py`）

启动后**先选模式**：

```
1) 切片并上传新视频
2) 把已传到 R2 的视频挂进配置
3) 整理现有视频的分区
4) 退出
```

**路径 1：切片上传**（现有批量流程 + 分区）

- 切片完成后，询问"是否上传到 R2"
- **分区来源按文件夹自动推导**（同 T1 规则：子文件夹名 = 分区 title）

- **每个分区处理第一个视频前问一次 `desc`（可空）**：
  ```
  分区: MCN账号视频
  简介（可空，回车跳过）>
  ```
  之后该分区的其他视频不再问 desc

- 子文件夹名 → 分区 title 的转换规则（不变）：
  ```
  1.MCN账号视频          → MCN账号视频
  2.网剧（灵瞳鉴宝）      → 网剧（灵瞳鉴宝）
  3.政府事业单位承包视频   → 政府事业单位承包视频
  01-个人介绍            → 个人介绍
  ```

- 写进配置时把 section 块（title + desc + videos[]）追加到 `sections: [...]`

**路径 2：导入 R2 视频**

- 问 R2 key（一次可输入多个，逗号或换行分隔）
- 对每个 key：问 `title`、问挂到哪个 section（已有/新建）
- **新建 section 时问 `desc`**；挂到已有 section 不再问 desc
- 末尾问是否直接写进 `src/resume.config.js`

**路径 3：整理分区**

- 打印当前所有 section：
  ```
  1) [MCN账号视频]  (2 个视频)  代运营 MCN 账号短视频…
  2) [网剧（灵瞳鉴宝）]  (1 个视频)  网剧项目相关作品
  3) [未命名]  (0 个视频)
  ```
- 操作菜单：
  ```
  1) 重命名分区
  2) 改分区简介
  3) 移动视频到另一个分区
  4) 删除分区
  5) 新建分区
  6) 返回
  ```
- 改完会写回配置（先备份 .bak）

### 6. 写配置的脚本逻辑

- `make_entry(video)`：返回单条 video 字符串，无 `section` 字段
- `make_section(title, desc, videos)`：返回 section 块（含 desc + 内嵌 videos）
- `append_videos_config(section_or_video)`：
  - 找 `sections: [...]` 块
  - 如果 `section.title` 已在某条 section 里，append 到该 section 的 `videos`
  - 否则 append 整个新 section 块
- `path3` 重写整个 `sections: [...]` 块（备份后）

### 7. 实施时的一次性迁移

- 现有 `videos: []` 会在实施当天**整段清空**，改为 `sections: []`
- R2 桶里旧的对象不删
- `wrangler.toml` 不动

---

## 文件改动清单（相对 T1-T10 已实现版）

| 文件 | 改动 |
| --- | --- |
| `src/App.jsx` | 改：消费 `sections` 而非 `videos` |
| `src/components/VideoGallery.jsx` | 改：从 `sections` 读取，section 头部加 desc |
| `src/components/SectionGroup.jsx` | 改：加 `desc` 展示 |
| `src/components/VideoCard.jsx` | 改：移除 section 必填（不再被 App 引用） |
| `video-workflow/slice.py` | 大改：`make_entry` 简化；新增 `make_section`；`append_videos_config` 支持 section 块；path1 问 desc；path2 问 desc；path3 完整操作 |
| `video-workflow/tests/test_config.py` | 改：`make_entry` 签名去 section；新增 `make_section` 单测 |
| `video-workflow/tests/test_menu.py` | 改：path2 验证 section 嵌套；path3 验证 desc |
| `src/resume.config.js` | `videos: []` → `sections: []` |
| `docs/superpowers/specs/2026-10-10-video-sections-design.md` | 改：本文档 |

## 测试

- `python -m pytest video-workflow/tests/`：34+ 个测试应全过
- 本地 `npm run dev`：浏览器里验证
  - 宽屏：左 hero + 右分区列表（含 desc）；点缩略图切换；只有一个播放；默认全不播
  - 窄屏（DevTools 模拟手机）：上 hero + 下 chips + desc + 缩略横排
- 脚本三路径验证

## 风险

| 风险 | 缓解 |
| --- | --- |
| 嵌套结构对老 config 不兼容 | 实施当天清空 `videos`，从 `sections: []` 起步 |
| section 块大（videos 多）写文件 regex 复杂 | 拆三段处理：找 sections 块 / 解析现有 section / 重组 |

## 未来

- 分区折叠/展开
- 缩略图自动提取
- 分区图标/颜色
- 视频拖拽排序
- 全屏按钮
