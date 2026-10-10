# 视频分区功能 — 设计文档

| | |
| --- | --- |
| 日期 | 2026-10-10 |
| 状态 | 待用户审阅 |

## 背景

简历的视频区块当前是扁平的一列卡片（`videos: [...]`）。用户希望按"分区"组织（如个人介绍、作品集、影视后期），并实现"主画面 + 缩略栏"的画廊式交互。配套地，上传脚本也要能在切片/导入时给视频分到分区。

**用户决策**：旧配置里现有的 `videos` 条目（不带 `section` 字段）**全部删除**，新设计**不向后兼容**。`section` 是必填字段，不再有"其他"分区兜底。R2 桶里的旧对象保留（不属于本次范围）。

## 目标

1. 视频按 `section` 字段分组，分区作为页内二级标题（不进导航）
2. 同时**只有一个**视频播放；点击缩略图会停旧的、播新的
3. **默认全部不播放**，等用户主动点
4. 上传脚本能交互式给视频分配分区、支持新建分区
5. 脚本能只把 R2 上已有视频挂进配置（不重新切片/上传）

## 非目标

- 改 R2 存储路径结构（仍是 `videos/<slug>/`）
- 改 Worker 代码（`VIDEO_KEYS` 仍按 R2 前缀匹配）
- 改 `wrangler.toml`
- 自动从视频里提取元数据（时长、码率、自动缩略图等）

---

## 设计

### 1. 配置（`src/resume.config.js`）

```js
videos: [
  { section: '个人介绍', key: 'videos/intro/index.m3u8', title: '...', desc: '...', poster: '' },
  { section: '作品集',   key: 'videos/xxx/index.m3u8',   title: '...', desc: '...', poster: '' },
]
```

- `section` **必填**；前端解析时缺字段直接报错
- 分区顺序 = 首次出现在 `videos` 数组的顺序
- 同分区视频顺序 = 数组顺序
- **不向后兼容**：现有 `videos: [{...}]`（无 `section` 字段的）会在实施时**整段清空**；新视频必须由脚本写入并带 `section`

### 2. 布局

**宽屏（≥ lg / 1024px）**
- 左 2/3：大画面（hero），16:9
- 右 1/3：分区列表（垂直滚动）
  - 每个分区：`h3` 分区标题 + 缩略卡片垂直堆叠
  - 当前 hero 所属的缩略卡有视觉高亮（边框/标记）

**窄屏（< lg）**
- 上：hero（满宽，16:9）
- 下：分区 chips 横排（可横滑）+ 当前分区的缩略卡横排
- 分区 chips 当前激活 = hero 所属分区；点 chip 滚到对应横排

### 3. 播放模型

- **同时只播一个**：通过共享的 `activeKey` 状态控制
- **初始状态**：`videos[0]` 作为 hero，**不自动播放**（显示 poster）
- **点击 hero 自身的播放按钮**：当前 hero 开始播放
- **点击缩略图**：
  1. 该缩略图成为新的 hero
  2. 旧 hero（如果正在播放）立即 `pause()` + `currentTime = 0`
  3. 新 hero 自动 `play()`
- **点击 hero 暂停按钮**：当前 hero 暂停，其他不变
- **切换 hero 的视觉过渡**：150ms 淡入淡出

### 4. 组件结构

| 文件 | 状态 | 职责 |
| --- | --- | --- |
| `src/components/VideoGallery.jsx` | 新增 | 顶层布局；管理 `activeKey`；分宽屏/窄屏两套 |
| `src/components/VideoHero.jsx` | 新增 | 大画面；用 `useVideoPlayer` hook 管播放；接收 `activeKey` 变化时自动 stop |
| `src/components/VideoThumb.jsx` | 新增 | 缩略卡；显示 poster + title；点击触发切换；当前 active 的高亮 |
| `src/components/SectionGroup.jsx` | 新增 | 单分区的缩略卡容器（宽屏垂直、窄屏横排） |
| `src/components/VideoCard.jsx` | 改写 | 把内部 fetchUrl / 续期 / hls.js 加载抽到 `useVideoPlayer` hook；保留"独立卡片"渲染逻辑（用 `?embed=card` 时仍可单独用） |
| `src/components/useVideoPlayer.js` | 新增 | 共用 hook：fetch signed URL、HLS 加载、续期定时器；返回 `{ mediaRef, status, reload }` |
| `src/App.jsx` | 修改 | `videos` 区从 `videos.map(VideoCard)` 换成 `<VideoGallery videos={visibleVideos} />` |
| `src/index.css` | 微调 | 加缩略卡和分区的少量样式 |

**关键实现点**：

- `VideoHero` 用 `key={activeKey}` 让 React 在切换时**重建** DOM 节点（彻底释放旧 hls.js 实例和内存），而不是手动 `pause()`。这避免了 HLS 切换的脏状态。
- 新的 hero 在挂载时调 `play()`，触发自动播放（用户刚刚点击过缩略图，是用户手势，浏览器允许）。
- `videos[0]` 作为初始 hero，`activeKey = videos[0].key`。首次播放需要用户点 hero 的播放按钮（页面加载时无用户手势，不能 autoplay）。
- 导航不显示分区：`Nav` 现有逻辑不变，分区锚点 `#section-<slug>` 用于页内跳转，但不出现在 Nav 列表里。

### 5. 脚本（`video-workflow/slice.py`）

启动后**先选模式**：

```
1) 切片并上传新视频
2) 把已传到 R2 的视频挂进配置（不重新切片上传）
3) 整理现有视频的分区
4) 退出
```

**路径 1：切片上传**（现有批量流程 + 分区）

- 切片完成后，询问"是否上传到 R2"
- **分区来源按文件夹自动推导**（不用逐条问答）：

  | 你给的路径 | 分区名来自 |
  | --- | --- |
  | 指向**文件** | 问一次：`这个视频属于哪个分区？`（可输新名字） |
  | 指向**文件夹**，里面有子文件夹 | **每个子文件夹 = 一个分区**，分区名 = 子文件夹名（去掉开头的 `1.` `2、` 等序号） |
  | 指向**文件夹**，视频直接放在里面 | 问一次：`这一批归到哪个分区？`（回车默认用文件夹名） |

- 子文件夹名 → 分区名的转换规则：
  ```
  1.MCN账号视频          → MCN账号视频
  2.网剧（灵瞳鉴宝）      → 网剧（灵瞳鉴宝）
  3.政府事业单位承包视频   → 政府事业单位承包视频
  01-个人介绍            → 个人介绍
  ```
  即：去掉开头的 `数字 + 分隔符(. 、 -, _ 空格)`，保留括号与中文原名
- 推导出的分区列表会在开始切片前**打印出来让你确认**，可以按 `n` 中止
- 写进配置时把 `section` 字段加进每条条目

**路径 2：导入 R2 视频**
- 问 R2 key（一次可输入多个，逗号或换行分隔）
- 对每个 key：
  - 问 `title`（必填）
  - 问分区（同路径 1 的流程）
  - 问 `desc`、`poster`（可空）
- 追加到 `videos` 数组；**不切片、不上传**、不调 R2
- 末尾问是否直接写进 `src/resume.config.js`

**路径 3：整理分区**
- 打印当前所有视频 + 分区：
  ```
  1) [个人介绍] hls/index.m3u8       作品展示
  2) [作品集]   videos/xxx/...       Demo 作品
  ```
- 让你选一条或几条改分区
- 支持把某个分区整体重命名（影响所有属于该分区的视频）

### 6. 写配置的脚本逻辑

- `make_snippet(entries)`：`entries` 元素是 `{section, key, title, desc, poster}`，每条都必须有 `section`
- `write_config(snippet)`：正则匹配 `videos: [...]` 块替换；写入前**校验**每条都有 `section` 否则报错退出
- `append_videos_config(entries)`（批量追加）：保持追加，**每条都必须有 `section`**

### 7. 实施时的一次性迁移

- 现有的 `videos: [{...}]`（无 `section` 字段）会在**实施当天**被整段清空（数组替换成 `[]`）
- R2 桶里旧的对象（`hls/index.m3u8`、`new/index.m3u8`、`gna.mp4` 等）**不删**，留作用户将来用路径 2 重新导入
- `wrangler.toml` 的 `VIDEO_KEYS` 不动（白名单仍允许历史 key，新视频再按需扩展）

---

## 文件改动清单

| 文件 | 改动 |
| --- | --- |
| `src/App.jsx` | 改：视频区改用 `<VideoGallery>` |
| `src/components/VideoCard.jsx` | 改：抽出 hook |
| `src/components/useVideoPlayer.js` | 新增 |
| `src/components/VideoHero.jsx` | 新增 |
| `src/components/VideoThumb.jsx` | 新增 |
| `src/components/VideoGallery.jsx` | 新增 |
| `src/components/SectionGroup.jsx` | 新增 |
| `src/index.css` | 微调：缩略卡和分区的少量样式 |
| `video-workflow/slice.py` | 大改：三路径菜单 + 分区询问 + 写配置扩展 |
| `src/resume.config.js` | 清空 `videos` 数组（一次性迁移） |
| `docs/superpowers/specs/2026-10-10-video-sections-design.md` | 新增（本文档） |

## 测试

- 本地 `npm run dev`：浏览器里验证
  - 宽屏：左 hero + 右分区列表；点缩略图切换；只有一个播放；默认全不播
  - 窄屏（DevTools 模拟手机）：上 hero + 下分区 chips + 缩略横排
- 切换缩略图：旧 video 立即停、新 video 自动播、视觉 150ms 过渡
- `python slice.py`：验证三路径菜单、分区询问、配置写入
- 不加自动化测试（UI 简单手测够）

## 风险

| 风险 | 缓解 |
| --- | --- |
| HLS 切换残留缓冲 | hero 用 `key={activeKey}` 重建，彻底释放旧 hls.js |
| 缩略图点击后浏览器拦截 autoplay | 这次 click 是用户手势，浏览器允许；万一被拦，hero 状态显示"点击播放"提示 |
| 大量分区把宽屏右栏撑得很长 | 右栏自带 `overflow-y-auto` 滚动；分区很多时考虑折叠（未来） |

## 未来

- 分区折叠/展开（多分区时）
- 缩略图自动提取（用 ffmpeg 取首帧）
- 分区图标/颜色
- 视频拖拽排序
- 全屏按钮
