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

2026-10-10 二次改版（起因：4 个视频实测全是竖版 9:16，16:9 的 hero 留大片黑边、
16:9 的缩略卡把封面裁掉 68% 只剩中间一条）：

**宽屏（≥ lg / 1024px）**
- 「剪辑作品」标题下一排**分区标签**（pill，可切换；只有一个分区时隐藏）
- 左 2/5：hero，视频盒按**竖版** 9:16 高度收窄（`lg:h-[min(68vh,600px)]`）居中，
  盒子 `lg:w-fit` 收缩到视频宽 → **不产生黑边**（横版则直接 16:9 占满列宽）
- 右 3/5：当前分区的 `desc` + 缩略卡 **3 列网格**（点标签切换，不再全量堆叠滚动）

**窄屏（< lg）**
- 上：hero（满宽，按视频方向）
- 下：同一排分区标签 + 当前分区的 `desc` + 缩略卡 2 列（sm 起 3 列）

**缩略卡**：不写死比例——封面按自己的宽高比撑开盒子（`img` 用 `h-auto w-full`，
容器 `min-h-[120px]` 防懒加载时塌陷）。横版封面就是 16:9、竖版封面就是 9:16，
永远完整显示，且不依赖 `onLoad` 的触发时序。

#### 横竖版自动适应（2026-10-14 三次改版）

用户新增了横屏视频（LS-0672、卢浮宫、康恩贝…），而播放器/缩略卡写死 9:16，
横版视频只能 letterbox 在竖盒里。现在两边都按视频真实方向自适应：

- **大画面**：先用**封面图**探测（`new Image()` 读 `naturalWidth/Height`）——
  封面和视频同比例，且不依赖播放。**不能用 `video` 的 `loadedmetadata`**：
  autoplay 被浏览器拦截时 hls.js 不加载数据，`videoWidth` 一直是 0（实测
  headless 里除自动播成功的那个外全是 0）。`onLoadedMetadata` 仅作无封面时的兜底。
  - 横版：`aspect-video w-full`（占满列宽）
  - 竖版：`aspect-[9/16] lg:h-[min(68vh,600px)] lg:w-auto`，外层 `lg:w-fit`
    收缩到视频宽，两侧不露黑
- **缩略卡**：自然比例（见上），无需 JS 探测
- **栅格跟着方向走**（`useVideoOrientation` 提到 Gallery 层，通过 prop 传给 Hero，
  避免两个组件各探测一遍）：
  - 横版 `lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]`——**向右侧缩略列表要空间**，
    播放器从 345×194 涨到 **539×303**（实测）
  - 竖版 `lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]`——列表更宽，好放 9:16 缩略图
  - 横版时缩略图改 2 列（右栏变窄，3 列会挤成一条）
  - `useVideoOrientation` 返回三态 `true/false/null`，让"没封面"时能退到
    `loadedmetadata` 兜底

验证：Playwright 遍历 7 个分区，播放器盒比例与封面原比误差 < 0.03 判贴合，
结果 **7/7**（3 个横版分区 539×303=1.779，4 个竖版 329×585=0.562）；
1280/768/390 三端横向溢出均为 0。

#### hero 只能有一个实例（2026-10-14 安卓双播放修复）

**事故**：安卓上点缩略图后同一个视频播两遍（双份声音），暂停键只能停住看得见那个。

**根因**：`VideoGallery` 原来把 hero 渲染了两遍——宽屏块（`hidden lg:grid`）
和窄屏块（`lg:hidden`）各一个，两个都带 `autoplay`。手机上窄屏那个可见、
宽屏那个在 `display:none` 容器里，但 **`display:none` 的 video 照样会执行
autoplay 效果里的 `play()` 并出声**。点缩略图 → 两个 hero 一起 remount → 一起播。

**证据**（Playwright 模拟安卓 Chrome，Android UA + `is_mobile`）：
```
修复前  点缩略图后：共 2 个 video，正在播 2 个（paused=False，t 同步到 2.29，
                     其中一个「看得见=False 被隐藏=True」）
修复后  点缩略图后：共 1 个 video，正在播 1 个；pause() 后 t 停住不涨
```

**修法**：
1. hero 只渲染一个，用同一套 DOM 同时服务两种断点：外层容器 `lg:grid lg:grid-cols-[...]`，
   窄屏时 hero 是块级元素自然满宽堆叠、列表在下面，宽屏时落进两栏栅格。
2. `useVideoPlayer` 的 effect cleanup 里加 `media.pause()`——只在切视频/卸载时
   走到（续期走的 `reload()` 不重跑 effect），不会打断播放中续期。

**教训**：响应式布局里**不要把带副作用的组件渲染两遍**再用 `hidden` 二选一，
尤其是 video/audio 这类「隐藏也会继续跑」的元素。

域名：2026-10-14 起用 **xiaoying.selector.fun**（`wrangler.toml` 的
`ALLOW_REFERERS` 已同步），旧 `xiaoying.68a02a26.nip.io` 已失效。

**切区语义**：点标签 = 选该分区第一个视频（换大画面）；点缩略图 = 只在同分区内换。

（改版前：宽屏左 2/3 hero（16:9）+ 右 1/3 全部分区垂直堆叠滚动；窄屏 chips + 横排。）

### 3. 播放模型（不变）

- 同时只播一个
- 默认全不播放
- 点击缩略图：停旧、播新
- hero 用 `key={activeKey}` 重建释放 hls.js

### 4. 组件结构

| 文件 | 状态 | 职责 |
| --- | --- | --- |
| `src/components/VideoGallery.jsx` | 改 | 从 `sections` 读取；分区标签 + 当前分区缩略网格 |
| `src/components/VideoHero.jsx` | 改 | 大画面；poster 走签名 URL；竖版 9:16 盒子 |
| `src/components/VideoThumb.jsx` | 改 | 缩略卡；poster 走签名 URL；9:16 完整显示 |
| `src/components/useVideoPlayer.js` | 不变 | 共用 hook |
| `src/components/useSignedUrl.js` | 新增 | 把 R2 key 换成签名 URL（封面用） |
| `src/components/VideoCard.jsx` | 改 | 不再被 App 引用；保留作 fallback / embed 模式 |
| `src/components/SectionGroup.jsx` | 删除 | 二次改版后无人引用（列表改为标签 + 网格） |
| `src/App.jsx` | 改 | 改用 `<VideoGallery sections={visibleSections} />` |

**关键实现点**：
- `VideoGallery` 内部把 `sections` 拍平为带 section 标记的 video 列表用于 activeKey 定位
- 嵌套结构对 React 友好：直接 `sections.map((s) => ...)` 即可

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

### 8. 缩略图封面（2026-10-10 追加）

缩略卡原来显示「暂无封面」。改成**切片时顺手抽第一帧**当封面：

- 抽帧（有原始 mp4，路径 1）：`ffmpeg -ss 1 -i src -frames:v 1 -q:v 3 poster.jpg`
  （1 秒处，避开片头黑场；抽不到再退回第 0 秒）
- 存 R2：`videos/<slug>/poster.jpg`（与 `index.m3u8` 同目录，`videos/*` 白名单已覆盖）
- 配置：`poster: 'videos/<slug>/poster.jpg'`

前端 `poster` 存的是 **R2 key**，不能直接塞 `<img src>`（会 403）。`useSignedUrl`
把它换成 `/api/video?key=...` 签发的短期地址；传进来的本来就是 URL 时原样透传
（向后兼容手填外链）。

路径 4「给已有视频补封面」：不需要本地原始 mp4，直接下 R2 里的 `seg_000.ts`
→ 抽帧 → 传 `poster.jpg` → 写回配置。已经全都有封面时会问「要全部重新抽一遍吗」。

#### 踩过的坑（都是真实事故，回归测试在 tests/ 里）

1. **抽帧点不能对分片用 1 秒**。`.ts` 分片是独立 GOP，从 1 秒切入没有参考帧，
   ffmpeg 会 `returncode=0` 但**一张图都不写**。补封面必须用第 0 秒
   （`seg_000` 的第 0 帧就是视频第 1 帧）。判据：`-ss 1` 四个分片全抽出 0 字节，
   `-ss 0` 抽出 4 张互不相同的图。
2. **抽帧前必须删掉目标文件**。ffmpeg 抽不出来时不会覆盖旧文件，
   复用同一个工作目录就会「返回上一轮的残留图」——曾导致 4 个视频封面全成了第一个的画面。
   现在每个视频用独立工作目录，且每次抽帧前 `unlink()`。
3. **改写 `sections` 块必须只动视频分区**。整块重新序列化会把用 `items` 的正文分区
   （专业技能/工作经历…）连同内容一起抹掉。现在 `rebuild_sections_inner`
   只重写带 `videos` 的块，其余字节不动。
4. **写回前要反转义、写回时再转义**。配置里的 `\n` 是 JS 转义；解析时若不还原，
   写回时会被 `_esc` 二次转义成 `\\n`，换行就变成字面量了。
5. **拼接时别漏逗号**。删掉旧逗号后忘了在最后一块视频分区后面补回来，
   生成的 config 少一个 `,`，`vite build` 直接 `Expected ',' or ']' but found '{'`，整站白屏。
   现在写回后会自动跑 `node --check` 校验，不通过就回滚原文件。

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
- 分区图标/颜色
- 视频拖拽排序
- 全屏按钮
- 封面手动替换（现在只能靠重新抽帧）
