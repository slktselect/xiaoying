# 视频分区功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把简历视频区改成"主画面 + 分区缩略栏"画廊，并让脚本能按文件夹自动识别分区。

**Architecture:**
- 前端：新增 `VideoGallery`（顶层布局）+ `VideoHero`（主画面）+ `VideoThumb`（缩略卡）+ `SectionGroup`（分区容器）；把 `VideoCard` 内的播放逻辑抽到 `useVideoPlayer` hook 共用
- 脚本：把现有 `batch_process` 改成"文件夹名 = 分区名"模式；新增"导入 R2 视频"和"整理分区"两条路径；`videos` 条目强制 `section` 字段
- 一次性迁移：实施当天 `src/resume.config.js` 的 `videos` 数组清空；前端在 `videos` 为空时只渲染"暂无视频"占位

**Tech Stack:** React 19, Vite 8, Tailwind 4, hls.js；Python 3.13（conda base），pytest 8+（新增 dev 依赖）

**Spec:** `docs/superpowers/specs/2026-10-10-video-sections-design.md`

---

## Global Constraints

- `videos[].section` 字段**必填**，前端缺字段直接报错；脚本写入前校验
- 同时**只能有一个视频播放**，通过 React `key={activeKey}` 重建 hero 节点实现
- 默认**全部不播放**，等用户点
- 切换 hero 不自动播，但点击缩略图会**停旧的 + 播新的**（用户手势内自动播放）
- 分区名来源 = 文件夹名（去掉开头的 `数字 + 分隔符`）
- R2 路径 `videos/<slug>/` 不变
- 视频文件后缀白名单：`.mp4 .mov .mkv .avi .flv .wmv .m4v .webm .ts .mpg .mpeg`
- ffmpeg 路径固定：`C:\Users\p5233\AppData\Local\Temp\ffbin\node_modules\ffmpeg-static\ffmpeg.exe`

## Review Focus（spec 暗示但没任务单测的输入/失败模式）

| 输入/失败模式 | 期望行为 | 归属任务 |
| --- | --- | --- |
| `videos` 为空数组 | 前端只渲染"暂无视频"占位，不崩 | 任务 9 |
| 子文件夹里没有视频文件 | 跳过该子文件夹，不报错 | 任务 2 |
| 文件夹名去掉序号后为空 | 报错退出"分区名不能为空" | 任务 2 |
| 单文件模式运行（旧行为） | 必须问分区名，不允许跳过分区 | 任务 4 |
| 切换 hero 时旧视频正在播 | 旧 DOM 节点先卸载 → 资源释放；新节点挂载后 `play()` | 任务 6 |
| 视频源缺失 `section` 字段（手改坏的情况） | 前端 console.error + 渲染该视频时显示"配置错误" | 任务 9 |

---

## 文件结构

| 路径 | 状态 | 职责 |
| --- | --- | --- |
| `src/components/useVideoPlayer.js` | 新 | 播放 hook（fetch 签名 / HLS / 续期） |
| `src/components/VideoCard.jsx` | 改 | 改用 `useVideoPlayer`；保留独立卡片渲染（向后兼容） |
| `src/components/VideoHero.jsx` | 新 | 大画面组件，接收 `video` + `autoplay` 标志 |
| `src/components/VideoThumb.jsx` | 新 | 缩略卡组件（poster + title + 点击） |
| `src/components/SectionGroup.jsx` | 新 | 单分区的缩略卡容器 |
| `src/components/VideoGallery.jsx` | 新 | 顶层布局，宽窄屏两套 |
| `src/App.jsx` | 改 | `videos` 区改用 `<VideoGallery>` |
| `src/index.css` | 改 | 缩略卡与分区的少量样式 |
| `src/resume.config.js` | 改 | 清空 `videos` 数组（一次性迁移） |
| `video-workflow/slice.py` | 改 | 3 路径菜单 + 文件夹→分区 |
| `video-workflow/tests/test_section.py` | 新 | `parse_section_name` / `slugify` 单测 |
| `video-workflow/tests/test_config.py` | 新 | `make_entry` / `append_videos_config` 单测 |
| `pyproject.toml` 或 `pytest.ini` | 新 | pytest 配置（标记 video-workflow/tests/） |

---

## Task 1: Python — 切片脚本的测试脚手架 + `slugify` / `parse_section_name` 单测

**Files:**
- Create: `video-workflow/tests/__init__.py`
- Create: `video-workflow/tests/test_section.py`
- Create: `video-workflow/pytest.ini`（或 `pyproject.toml` 的 `[tool.pytest.ini_options]`）

**Step 1: 加 pytest 依赖**

conda base 安装：
```bash
C:\Users\p5233\anaconda3\python.exe -m pip install pytest
```

**Step 2: 写失败的测试** — `video-workflow/tests/test_section.py`：

```python
from slice import slugify, parse_section_name


def test_slugify_basic():
    assert slugify("Hello World") == "hello-world"


def test_slugify_chinese():
    assert slugify("作品展示") == "作品展示"


def test_slugify_spaces_and_dots():
    assert slugify("My Video 2.0") == "my-video-2-0"


def test_parse_section_with_digit_dot():
    assert parse_section_name("1.MCN账号视频") == "MCN账号视频"


def test_parse_section_with_digit_comma():
    assert parse_section_name("2、网剧") == "网剧"


def test_parse_section_with_dash():
    assert parse_section_name("03-政府事业单位") == "政府事业单位"


def test_parse_section_with_underscore():
    assert parse_section_name("01_个人介绍") == "个人介绍"


def test_parse_section_no_prefix():
    assert parse_section_name("作品集") == "作品集"


def test_parse_section_strips_outer_spaces():
    assert parse_section_name("  3. 影视后期  ") == "影视后期"


def test_parse_section_empty_after_strip():
    import pytest
    with pytest.raises(ValueError, match="分区名不能为空"):
        parse_section_name("1.")


def test_parse_section_keeps_parens():
    assert parse_section_name("2.网剧（灵瞳鉴宝）") == "网剧（灵瞳鉴宝）"
```

**Step 3: 跑测试确认失败**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying\video-workflow
C:\Users\p5233\anaconda3\python.exe -m pytest tests/ -v
```

Expected: import error（`parse_section_name` 还不存在）

**Step 4: 在 `slice.py` 顶部 `slugify` 后面加 `parse_section_name`**

```python
def parse_section_name(folder_name):
    """从子文件夹名推导分区名：去掉开头的 '数字 + 分隔符'。

    1.MCN账号视频          → MCN账号视频
    2.网剧（灵瞳鉴宝）      → 网剧（灵瞳鉴宝）
    3-个人介绍            → 个人介绍
    01_作品集              → 作品集
    作品集                 → 作品集

    raises ValueError if result is empty
    """
    s = folder_name.strip()
    # 去掉开头的 "数字 + (. / 、 / , / - / _ / 空格)"
    s = re.sub(
        r"^\d+\s*[.\u3001,\-_\s]\s*",
        "",
        s,
    ).strip()
    if not s:
        raise ValueError(f"分区名不能为空：'{folder_name}'")
    return s
```

**Step 5: 跑测试确认通过**

Expected: 11 passed

**Step 6: 提交**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
git add video-workflow/
git commit -m "test+feat(slice): 加 pytest 脚手架和 parse_section_name/slugify 单测"
```

---

## Task 2: Python — 批量模式的"按子文件夹分组"逻辑

**Files:**
- Create: `video-workflow/tests/test_batch.py`
- Modify: `video-workflow/slice.py:145-148`（`collect_videos` 改为 `discover_groups`）

**Step 1: 写失败的测试** — `video-workflow/tests/test_batch.py`：

```python
import shutil
from pathlib import Path
import pytest
import slice


@pytest.fixture
def sample_folder(tmp_path):
    """tmp_path/
      1.MCN账号视频/
        a.mp4
        b.mp4
      2.网剧（灵瞳鉴宝）/
        c.mp4
      d.mp4                   ← 根目录直接放
      README.txt               ← 非视频，应忽略
    """
    g1 = tmp_path / "1.MCN账号视频"
    g2 = tmp_path / "2.网剧（灵瞳鉴宝）"
    g1.mkdir()
    g2.mkdir()
    for f in ["a.mp4", "b.mp4"]:
        (g1 / f).write_bytes(b"\x00")
    (g2 / "c.mp4").write_bytes(b"\x00")
    (tmp_path / "d.mp4").write_bytes(b"\x00")
    (tmp_path / "README.txt").write_text("note")
    return tmp_path


def test_discover_groups_returns_section_groups(sample_folder):
    groups = slice.discover_groups(sample_folder)
    sections = {g["section"] for g in groups}
    assert sections == {"MCN账号视频", "网剧（灵瞳鉴宝）"}


def test_discover_groups_includes_videos_per_group(sample_folder):
    groups = slice.discover_groups(sample_folder)
    foo = next(g for g in groups if g["section"] == "MCN账号视频")
    names = {f.name for f in foo["videos"]}
    assert names == {"a.mp4", "b.mp4"}


def test_discover_groups_handles_orphan_videos_in_root(sample_folder):
    groups = slice.discover_groups(sample_folder)
    # 根目录直接放的视频 → 用一个 placeholder 分区名
    orphan = [g for g in groups if g["section"] == "(根目录)"]
    assert len(orphan) == 1
    assert {f.name for f in orphan["videos"]} == {"d.mp4"}
```

**Step 2: 跑测试确认失败**

Expected: `discover_groups` 还不存在

**Step 3: 实现 `discover_groups`**，放在 `collect_videos` 上面：

```python
def discover_groups(folder):
    """扫描文件夹，返回 [{ section, videos }] 列表。
    - 子文件夹里有视频 → 每个子文件夹 = 一个 section
    - 根目录直接放的视频 → 标到 (根目录) 段，运行时问用户
    """
    groups = []
    for sub in sorted(folder.iterdir(), key=lambda x: x.name.lower()):
        if not sub.is_dir():
            continue
        vids = [f for f in sub.iterdir() if f.is_file() and f.suffix.lower() in VIDEO_EXT]
        if not vids:
            continue
        section = parse_section_name(sub.name)
        groups.append({"section": section, "videos": sorted(vids, key=lambda x: x.name.lower())})

    # 根目录直接放的视频
    root_vids = [
        f for f in folder.iterdir()
        if f.is_file() and f.suffix.lower() in VIDEO_EXT
    ]
    if root_vids:
        groups.append({
            "section": "(根目录)",
            "videos": sorted(root_vids, key=lambda x: x.name.lower()),
        })
    return groups
```

**Step 4: 跑测试确认通过**

Expected: 3 passed

**Step 5: 提交**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
git add video-workflow/
git commit -m "feat(slice): discover_groups 按子文件夹自动分分组"
```

---

## Task 3: Python — `make_entry` 加 `section` 字段 + 校验

**Files:**
- Create: `video-workflow/tests/test_config.py`
- Modify: `video-workflow/slice.py:381-391`（`make_entry`）

**Step 1: 写失败的测试** — `video-workflow/tests/test_config.py`：

```python
import pytest
import slice


def test_make_entry_includes_section():
    s = slice.make_entry("videos/foo/index.m3u8", "Foo", section="MCN账号视频")
    assert "section: 'MCN账号视频'" in s
    assert "key: 'videos/foo/index.m3u8'" in s
    assert "title: 'Foo'" in s


def test_make_entry_escapes_single_quote_in_title():
    s = slice.make_entry("k", "Tom's show", section="X")
    # 简单 escape：单引号 → \'
    assert "title: 'Tom\\'s show'" in s


def test_make_entry_requires_section():
    with pytest.raises(ValueError, match="section 必填"):
        slice.make_entry("k", "T", section="")
    with pytest.raises(ValueError, match="section 必填"):
        slice.make_entry("k", "T", section=None)


def test_make_entry_escapes_single_quote_in_section():
    s = slice.make_entry("k", "T", section="Tom's")
    assert "section: 'Tom\\'s'" in s
```

**Step 2: 跑测试确认失败**

Expected: signature mismatch (current `make_entry` takes 2 args)

**Step 3: 改 `make_entry`**

```python
def _esc(s):
    """JS 单引号字符串里需要转义单引号。"""
    return str(s).replace("\\", "\\\\").replace("'", "\\'")


def make_entry(key, title, section=None):
    """生成单个 videos 条目。section 必填。"""
    if not section or not str(section).strip():
        raise ValueError(f"section 必填（key={key}, title={title}）")
    return (
        "    {\n"
        f"      section: '{_esc(section)}',\n"
        f"      key: '{_esc(key)}',\n"
        f"      title: '{_esc(title)}',\n"
        "      desc: '存放于 Cloudflare R2，播放地址由 Worker 临时签发。',\n"
        "      // 封面图，留空则用视频第一帧\n"
        "      poster: '',\n"
        "    }"
    )
```

**Step 4: 跑测试确认通过**

Expected: 4 passed

**Step 5: 提交**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
git add video-workflow/
git commit -m "feat(slice): make_entry 加 section 必填字段 + 单引号转义"
```

---

## Task 4: Python — `append_videos_config` 校验 section + 处理空/缺失情况

**Files:**
- Modify: `video-workflow/slice.py:406-451`（`append_videos_config`）
- Modify: `video-workflow/tests/test_config.py`

**Step 1: 在 `test_config.py` 加测试**

```python
def test_append_videos_requires_section(tmp_path):
    cfg = tmp_path / "resume.config.js"
    cfg.write_text(
        "const resume = {\n"
        "  videos: [\n"
        "    { key: 'old/index.m3u8', title: 'Old' },\n"
        "  ],\n"
        "};\n"
        "export default resume;\n",
        encoding="utf-8",
    )
    slice.RESUME_CONFIG = cfg
    with pytest.raises(ValueError, match="缺少 section"):
        slice.append_videos_config([{"key": "k", "title": "t", "section": ""}])


def test_append_videos_preserves_existing(tmp_path):
    cfg = tmp_path / "resume.config.js"
    cfg.write_text(
        "const resume = {\n"
        "  videos: [\n"
        "    { section: 'Old', key: 'old/index.m3u8', title: 'Old' },\n"
        "  ],\n"
        "};\n"
        "export default resume;\n",
        encoding="utf-8",
    )
    slice.RESUME_CONFIG = cfg
    ok = slice.append_videos_config([
        {"key": "new/index.m3u8", "title": "New", "section": "作品集"},
    ])
    assert ok
    text = cfg.read_text(encoding="utf-8")
    assert "key: 'old/index.m3u8'" in text
    assert "key: 'new/index.m3u8'" in text
    assert "section: '作品集'" in text


def test_append_videos_writes_backup(tmp_path):
    cfg = tmp_path / "resume.config.js"
    cfg.write_text("videos: [\n  { section: 'A', key: 'k1', title: 't1' },\n],\n", encoding="utf-8")
    slice.RESUME_CONFIG = cfg
    slice.append_videos_config([{"key": "k2", "title": "t2", "section": "B"}])
    assert (tmp_path / "resume.config.js.bak").exists()
```

**Step 2: 跑测试确认失败**

Expected: `append_videos_config` 不抛 ValueError

**Step 3: 改 `append_videos_config`**

```python
def append_videos_config(entries):
    """把 entries 追加到 src/resume.config.js 的 videos: [...] 块（不替换已有）。
    每条都必须有 section 字段。
    """
    if not RESUME_CONFIG.exists():
        print(f"找不到 {RESUME_CONFIG}，请手动粘贴。")
        return False

    for e in entries:
        if not e.get("section") or not str(e.get("section", "")).strip():
            raise ValueError(f"条目缺少 section：{e}")

    try:
        text = RESUME_CONFIG.read_text(encoding="utf-8")
    except Exception as e:
        print(f"读配置失败：{e}")
        return False

    pat = re.compile(
        r"(?P<indent>  )videos: \[\n(?P<inner>.*?)(?P<close>  )\],\n",
        re.S,
    )
    m = pat.search(text)
    if not m:
        print("配置里没找到 videos: [...] 块，请手动粘贴。")
        return False

    indent = m.group("indent")
    close = m.group("close")
    inner = m.group("inner").rstrip()
    if inner and not inner.rstrip().endswith(","):
        inner = inner.rstrip() + ","

    new_blocks = [
        make_entry(e["key"], e["title"], section=e.get("section"))
        for e in entries
    ]
    joined = ",\n".join(new_blocks) + ","
    new_inner = inner + ("\n" if inner else "") + joined
    new_block = f"{indent}videos: [\n{new_inner}\n{close}],"
    new_text = text[:m.start()] + new_block + "\n" + text[m.end():]

    backup = RESUME_CONFIG.with_suffix(RESUME_CONFIG.suffix + ".bak")
    try:
        backup.write_text(text, encoding="utf-8")
        RESUME_CONFIG.write_text(new_text, encoding="utf-8")
    except Exception as e:
        print(f"写入失败：{e}")
        return False

    print(f"已追加 {len(entries)} 条到 {RESUME_CONFIG}")
    print(f"原文件备份在 {backup}")
    return True
```

**Step 4: 跑测试确认通过**

Expected: 全部通过

**Step 5: 提交**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
git add video-workflow/
git commit -m "feat(slice): append_videos_config 强制 section 必填"
```

---

## Task 5: Python — `batch_process` 接入 `discover_groups` + 分区

**Files:**
- Modify: `video-workflow/slice.py:499-564`（`batch_process`）
- Modify: `video-workflow/tests/test_batch.py`

**Step 1: 加测试**

```python
def test_batch_process_section_assignment(monkeypatch, sample_folder, capsys, tmp_path):
    """端到端：扫描 sample_folder → 每个视频带上对应分区。
    跳过真实 ffmpeg 切片（patch slice_one）和 R2 上传（patch upload_r2）。
    """
    import slice

    # 让脚本不实际切片和上传
    monkeypatch.setattr(slice, "check_ffmpeg", lambda: None)
    monkeypatch.setattr(slice, "slice_one", lambda src, out: True)
    monkeypatch.setattr(slice, "upload_r2", lambda out, prefix: True)
    monkeypatch.setattr(slice, "ask_yes_no", lambda tip, default=True: True)

    # OUT_ROOT 重定向到 tmp_path 避免污染
    monkeypatch.setattr(slice, "OUT_ROOT", tmp_path / "out")
    (tmp_path / "out").mkdir()

    # RESUME_CONFIG 副本
    cfg = tmp_path / "resume.config.js"
    cfg.write_text("videos: [],\n", encoding="utf-8")
    monkeypatch.setattr(slice, "RESUME_CONFIG", cfg)

    slice.batch_process(sample_folder)

    text = cfg.read_text(encoding="utf-8")
    # 至少含两个分区
    assert "section: 'MCN账号视频'" in text
    assert "section: '网剧（灵瞳鉴宝）'" in text
    # 三个子目录里的视频 key 都在
    assert "videos/a-mp4/index.m3u8" in text  # slugify 后 a.mp4 → a-mp4
```

**Step 2: 跑测试确认失败**

Expected: 当前 `batch_process` 不接受文件夹也不分组

**Step 3: 改 `batch_process`**

```python
def batch_process(folder):
    """文件夹模式：扫描子文件夹，每个子文件夹 = 一个 section，批量切片并上传。
    完成后把每条 entry 追加到 src/resume.config.js。
    """
    groups = discover_groups(folder)
    if not groups:
        die(f"{folder} 里没找到视频文件（支持的后缀：{' '.join(sorted(VIDEO_EXT))})")

    # 根目录直接放的情况：问一次分区名
    root_group = next((g for g in groups if g["section"] == "(根目录)"), None)
    if root_group:
        try:
            raw = input("\n根目录直接放的视频要归到哪个分区？（回车用文件夹名）> ")
        except EOFError:
            raw = ""
        name = clean(raw) or folder.name
        try:
            name = parse_section_name(name)
        except ValueError:
            die(f"分区名无效：'{name}'")
        root_group["section"] = name

    # 打印分区表让用户确认
    print(f"\n在 {folder} 找到 {sum(len(g['videos']) for g in groups)} 个视频，分 {len(groups)} 个分区：")
    for g in groups:
        print(f"  [{g['section']}]  {len(g['videos'])} 个")
        for v in g["videos"]:
            size = v.stat().st_size / 1024 / 1024
            print(f"    - {v.name:<40}  {size:>7.2f} MB")
    if not ask_yes_no("分区和视频清单是否正确"):
        die("已取消")

    do_upload = ask_yes_no("全部上传到 R2 存储池")

    entries = []
    for g in groups:
        for src in g["videos"]:
            print(f"\n{'=' * 58}")
            print(f" [{g['section']}] {src.name}")
            print("=" * 58)

            slug = slugify(src.stem)
            prefix = f"{R2_PREFIX_BASE}/{slug}"
            out = make_out_dir(src)
            print(f"R2 前缀：{prefix}")

            if not slice_one(src, out):
                print(f"[跳过] {src.name} 切片失败")
                continue

            if do_upload:
                if not upload_r2(out, prefix):
                    print(f"[跳过] {src.name} 上传失败")
                    continue
            else:
                print("[跳过上传]（按你的要求不传）")

            entries.append({
                "key": f"{prefix}/index.m3u8",
                "title": src.stem,
                "section": g["section"],
            })
            print(f"[就绪] {src.name} → [{g['section']}] {prefix}/index.m3u8")

    if not entries:
        die("没有成功处理任何视频。")

    snippet = make_snippet_block(entries)
    snip_file = OUT_ROOT / "resume.config.snippet.js"
    try:
        snip_file.parent.mkdir(parents=True, exist_ok=True)
        snip_file.write_text(snippet, encoding="utf-8")
    except Exception:
        pass

    print(f"\n将追加 {len(entries)} 条到 videos: [...]（不替换已有）：")
    print("-" * 58)
    print(snippet, end="")
    print("-" * 58)

    if not ask_yes_no("追加进 src/resume.config.js（会先备份为 .bak）"):
        print("\n已跳过。代码在上面，请手动粘贴。")
    else:
        append_videos_config(entries)

    print(f"\n[注意] 用到了 {R2_PREFIX_BASE}/* 这个前缀，")
    print(f"       记得在 wrangler.toml 的 VIDEO_KEYS 加上 {R2_PREFIX_BASE}/*")
    print("       现有前缀（gna.mp4,hls/*,new/*）无需删除，新旧可以并存。")
    print("\n最后一步：npm run deploy")
```

同时改 `make_snippet_block` 让它接收带 `section` 的 entries：

```python
def make_snippet_block(entries):
    body = ",\n".join(
        make_entry(e["key"], e["title"], section=e.get("section"))
        for e in entries
    )
    return (
        "  /* ---------------- 介绍视频 ---------------- */\n"
        "  // key 必须是 worker 侧 VIDEO_KEYS 白名单允许的对象名\n"
        f"  // 所有视频放在 {R2_PREFIX_BASE}/<文件名>/ 下，公用一个白名单 {R2_PREFIX_BASE}/*\n"
        "  videos: [\n"
        f"{body}\n"
        "  ],\n"
    )
```

**Step 4: 跑测试确认通过**

Expected: 全部通过

**Step 5: 手动跑一遍**（用真实 gna.mp4 的临时副本）：

```bash
mkdir C:\Users\p5233\AppData\Local\Temp\test-sections
copy "C:\Program Files\WindowsApps\AD2F1837.HPPCHardwareDiagnosticsWindows_2.6.4.0_x64__v10z8vjag6ke6\wwwroot\_content\HPI.Wrappers.BlazorMediaStress\gna.mp4" C:\Users\p5233\AppData\Local\Temp\test-sections\1.MCN\a.mp4
copy ... gna.mp4 C:\Users\p5233\AppData\Local\Temp\test-sections\1.MCN\b.mp4
copy ... gna.mp4 C:\Users\p5233\AppData\Local\Temp\test-sections\2.网剧（灵瞳鉴宝）\c.mp4
cd video-workflow
# 喂：n 跳过上传；y 追加配置
# 但用测试副本避免污染真文件
```

**Step 6: 提交**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
git add video-workflow/
git commit -m "feat(slice): batch_process 按子文件夹自动分 section"
```

---

## Task 6: Python — 3 路径菜单 + 路径 2 (导入 R2 视频) + 路径 3 (整理分区)

**Files:**
- Modify: `video-workflow/slice.py:567-582`（`main`）
- Modify: `video-workflow/slice.py:456-496`（`single_process`）
- Create: `video-workflow/tests/test_menu.py`

**Step 1: 在 `test_menu.py` 加测试**

```python
import pytest
import slice


def test_mode_menu_choices(monkeypatch, capsys):
    """3 路径菜单能正确派发。"""
    called = {"count": 0}
    def fake_path1():
        called["count"] += 1
    monkeypatch.setattr(slice, "path1_slice_upload", fake_path1)
    inputs = iter(["1", "q"])
    monkeypatch.setattr("builtins.input", lambda _: next(inputs))
    with pytest.raises(SystemExit):
        slice.main_with_mode()
    assert called["count"] == 1


def test_mode_menu_dispatch_to_path2(monkeypatch, capsys):
    called = {"count": 0}
    def fake_path2():
        called["count"] += 1
    monkeypatch.setattr(slice, "path2_import_r2", fake_path2)
    inputs = iter(["2", "q"])
    monkeypatch.setattr("builtins.input", lambda _: next(inputs))
    with pytest.raises(SystemExit):
        slice.main_with_mode()
    assert called["count"] == 1
```

**Step 2: 把 main 拆出 `main_with_mode`**

```python
def main_with_mode():
    """3 路径菜单入口。"""
    check_ffmpeg()
    print("=" * 58)
    print(" 简历视频管理")
    print("=" * 58)
    print("1) 切片并上传新视频（按文件夹自动分分区）")
    print("2) 把已传到 R2 的视频挂进配置（不重新切片上传）")
    print("3) 整理现有视频的分区")
    print("4) 退出")
    print("-" * 58)

    try:
        choice = input("选择模式 [1-4] > ")
    except EOFError:
        choice = "4"
    choice = clean(choice)

    if choice == "1":
        path1_slice_upload()
    elif choice == "2":
        path2_import_r2()
    elif choice == "3":
        path3_manage_sections()
    else:
        print("已退出。")


def path1_slice_upload():
    """路径 1：原 batch/single 流程的统一入口。"""
    path = ask_path()
    if path.is_dir():
        batch_process(path)
    else:
        single_process(path)
```

**Step 3: 实现 `path2_import_r2`**

```python
def path2_import_r2():
    """路径 2：只把 R2 上已有视频挂进配置，不切片不上传。"""
    if not RESUME_CONFIG.exists():
        die(f"找不到 {RESUME_CONFIG}")

    print("\n输入 R2 key（一次可多个，逗号或换行分隔）")
    print("  例: hls/index.m3u8, new/index.m3u8")
    print("  或一行一个，回车结束")
    try:
        lines = []
        while True:
            raw = input("> ")
            if not clean(raw):
                break
            lines.append(clean(raw))
    except EOFError:
        pass
    keys = []
    for ln in lines:
        for k in ln.split(","):
            k = clean(k)
            if k:
                keys.append(k)

    if not keys:
        print("没输入 key，已退出。")
        return

    entries = []
    for k in keys:
        print(f"\n[{k}]")
        try:
            title = input("  title > ")
        except EOFError:
            die("中断")
        if not clean(title):
            die("title 不能为空")
        try:
            raw_sec = input("  section > ")
        except EOFError:
            die("中断")
        sec = clean(raw_sec)
        if not sec:
            die("section 不能为空")
        try:
            sec = parse_section_name(sec)
        except ValueError as e:
            die(str(e))
        entries.append({"key": k, "title": clean(title), "section": sec})

    snippet = make_snippet_block(entries)
    print("-" * 58)
    print(snippet, end="")
    print("-" * 58)

    if ask_yes_no("追加进 src/resume.config.js"):
        append_videos_config(entries)
    else:
        print("已跳过，代码在上面。")
```

**Step 4: 实现 `path3_manage_sections`**

```python
def path3_manage_sections():
    """路径 3：列出所有视频，逐一改分区；支持重命名分区。"""
    if not RESUME_CONFIG.exists():
        die(f"找不到 {RESUME_CONFIG}")
    text = RESUME_CONFIG.read_text(encoding="utf-8")

    # 用现有正则取出 videos 块
    pat = re.compile(r"  videos: \[(?P<inner>.*?)\n  \],", re.S)
    m = pat.search(text)
    if not m:
        die("配置里没找到 videos: [...] 块")
    inner = m.group("inner")

    # 简易解析：每条 { ... } 块提 section / key / title
    item_pat = re.compile(
        r"\{\s*section:\s*'(?P<section>[^']*)',\s*"
        r"key:\s*'(?P<key>[^']*)',\s*"
        r"title:\s*'(?P<title>[^']*)'",
    )
    items = [mm.groupdict() for mm in item_pat.finditer(inner)]
    if not items:
        print("当前没有视频条目。")
        return

    print(f"\n当前 {len(items)} 条视频：")
    for i, it in enumerate(items, 1):
        print(f"  {i}) [{it['section']}] {it['key']:<40} {it['title']}")

    try:
        pick = input("\n要改的条目编号（多个用逗号，q 退出）> ")
    except EOFError:
        return
    pick = clean(pick)
    if pick.lower() in ("q", "quit", ""):
        return
    try:
        idxs = [int(x) for x in pick.split(",")]
    except ValueError:
        die("编号格式不对")
    if any(i < 1 or i > len(items) for i in idxs):
        die("编号超出范围")

    try:
        new_sec = input("新的分区名 > ")
    except EOFError:
        return
    new_sec = clean(new_sec)
    if not new_sec:
        die("分区名不能为空")
    try:
        new_sec = parse_section_name(new_sec)
    except ValueError as e:
        die(str(e))

    # 直接重写整个 videos 块
    new_items = []
    selected = set(idxs)
    for i, it in enumerate(items, 1):
        if i in selected:
            it = dict(it, section=new_sec)
        new_items.append(it)

    new_body = ",\n".join(
        make_entry(it["key"], it["title"], section=it["section"])
        for it in new_items
    )
    new_block = f"  videos: [\n{new_body}\n  ],\n"
    new_text = text[:m.start()] + new_block + text[m.end():]

    backup = RESUME_CONFIG.with_suffix(RESUME_CONFIG.suffix + ".bak")
    backup.write_text(text, encoding="utf-8")
    RESUME_CONFIG.write_text(new_text, encoding="utf-8")
    print(f"已更新 {len(idxs)} 条。备份：{backup}")
```

**Step 5: 改 `main()` 用新入口**

```python
def main():
    try:
        main_with_mode()
    except KeyboardInterrupt:
        print("\n\n已中断。")
        sys.exit(130)
```

**Step 6: 跑测试确认通过**

Expected: 全部通过

**Step 7: 手动跑路径 2 / 3**（不需要真实 R2，只走代码生成与配置写入）

**Step 8: 提交**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
git add video-workflow/
git commit -m "feat(slice): 3 路径菜单（切片/导入/整理）+ 改 single_process 必问 section"
```

同时改 `single_process` 让它也走分区询问（保持旧单文件模式可用）：

```python
def single_process(src):
    """单文件模式：必填分区名。"""
    out = make_out_dir(src)
    print(f"输出到：{out}\n")

    if not slice_one(src, out):
        die("切片失败")

    slug = slugify(src.stem)
    prefix = f"{R2_PREFIX_BASE}/{slug}"
    upload_ok = False
    tried_upload = False
    if ask_yes_no("是否上传到 R2 存储池"):
        tried_upload = True
        upload_ok = upload_r2(out, prefix)
    else:
        print("\n跳过上传。产物留在本地，需要时再传。")

    # 问分区
    try:
        raw_sec = input(f"\n这个视频属于哪个分区？（回车用 src 同名）> ")
    except EOFError:
        raw_sec = ""
    sec = clean(raw_sec) or src.stem
    try:
        sec = parse_section_name(sec)
    except ValueError as e:
        die(str(e))

    entries = [{"key": f"{prefix}/index.m3u8", "title": src.stem, "section": sec}]
    # ... 其余同前，但用新的 make_entry / make_snippet_block
```

---

## Task 7: React — 提取 `useVideoPlayer` hook

**Files:**
- Create: `src/components/useVideoPlayer.js`
- Modify: `src/components/VideoCard.jsx`

**Step 1: 读 `VideoCard.jsx` 的播放逻辑块**（已读，现有）

**Step 2: 抽 hook** — `src/components/useVideoPlayer.js`：

```js
import { useEffect, useRef, useState } from 'react';

const REFRESH_LEAD = 60;
const MIN_REFRESH_GAP = 5000;
const MAX_FAILS = 3;

/**
 * 视频播放 hook：取签名 URL、加载 HLS、定时续期。
 * @param {string} key  R2 对象 key
 * @returns { mediaRef, status, reload }
 */
export default function useVideoPlayer(key) {
  const mediaRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [nonce, setNonce] = useState(0);

  const expRef = useRef(0);
  const timerRef = useRef(null);
  const lastRefreshRef = useRef(0);
  const failsRef = useRef(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return undefined;
    aliveRef.current = true;
    failsRef.current = 0;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const fetchUrl = async () => {
      const res = await fetch(`/api/video?key=${encodeURIComponent(key)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    const scheduleRefresh = () => {
      clearTimer();
      const waitMs = (expRef.current - Math.floor(Date.now() / 1000) - REFRESH_LEAD) * 1000;
      if (waitMs <= 0) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const m = mediaRef.current;
        if (!m || m.paused || m.ended) return;
        reload();
      }, waitMs);
    };

    const reload = async () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_REFRESH_GAP) return false;
      lastRefreshRef.current = now;
      const at = media.currentTime;
      const wasPlaying = !media.paused && !media.ended;
      let data;
      try {
        data = await fetchUrl();
      } catch (e) {
        if (aliveRef.current) setStatus({ loading: false, error: `播放地址已过期，续期失败：${e.message}` });
        return false;
      }
      if (!aliveRef.current) return false;
      expRef.current = data.exp || 0;
      scheduleRefresh();
      if (hlsRef.current) {
        hlsRef.current.loadSource(data.url);
        if (wasPlaying) media.play().catch(() => {});
      } else {
        media.src = data.url;
        media.load();
        const restore = () => {
          media.removeEventListener('loadedmetadata', restore);
          if (at > 0) { try { media.currentTime = at; } catch {} }
          if (wasPlaying) media.play().catch(() => {});
        };
        media.addEventListener('loadedmetadata', restore);
      }
      return true;
    };

    const onFatal = async () => {
      if (!aliveRef.current) return;
      failsRef.current += 1;
      if (failsRef.current > MAX_FAILS) {
        setStatus({ loading: false, error: '视频加载失败或链接已过期' });
        return;
      }
      const ok = await reload();
      if (!ok && aliveRef.current) setStatus({ loading: false, error: '视频加载失败或链接已过期' });
    };

    const onPlaying = () => {
      failsRef.current = 0;
      setStatus({ loading: false, error: '' });
    };
    media.addEventListener('playing', onPlaying);

    const attach = async () => {
      setStatus({ loading: true, error: '' });
      try {
        const data = await fetchUrl();
        if (!aliveRef.current) return;
        expRef.current = data.exp || 0;
        lastRefreshRef.current = Date.now();
        scheduleRefresh();

        const isHls = /\.m3u8$/i.test((key || '').trim());
        if (!isHls) {
          media.src = data.url;
        } else if (media.canPlayType('application/vnd.apple.mpegurl')) {
          media.src = data.url;
        } else {
          const { default: Hls } = await import('hls.js');
          if (!aliveRef.current) return;
          if (!Hls.isSupported()) {
            setStatus({ loading: false, error: '当前浏览器不支持 HLS 播放' });
            return;
          }
          const hls = new Hls({ enableWorker: true, backBufferLength: 30 });
          hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) onFatal(); });
          hls.loadSource(data.url);
          hls.attachMedia(media);
          hlsRef.current = hls;
        }
        if (aliveRef.current) setStatus({ loading: false, error: '' });
      } catch (e) {
        if (aliveRef.current) setStatus({ loading: false, error: `播放地址获取失败：${e.message}` });
      }
    };

    attach();
    return () => {
      aliveRef.current = false;
      clearTimer();
      media.removeEventListener('playing', onPlaying);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [key, nonce]);

  return { mediaRef, status, reload: () => setNonce((n) => n + 1) };
}
```

**Step 3: 改 `VideoCard.jsx` 用 hook**（保留原 UI）

```jsx
import useVideoPlayer from './useVideoPlayer';

export default function VideoCard({ video }) {
  const { mediaRef, status, reload } = useVideoPlayer(video.key);
  return (
    <div className="print-plain mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 pb-3 sm:p-5">
        <h3 className="font-semibold text-slate-900">{video.title}</h3>
        {video.desc && <p className="mt-1 text-sm text-slate-500">{video.desc}</p>}
      </div>
      <div className="relative bg-black">
        <video
          ref={mediaRef}
          controls
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          x5-video-player-type="h5-page"
          x5-video-player-fullscreen="true"
          preload="metadata"
          poster={video.poster || undefined}
          className="aspect-video w-full"
          onError={() => reload()}
        />
        {status.loading && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm text-white">
            正在获取播放地址…
          </div>
        )}
        {!status.loading && status.error && (
          <div className="absolute inset-0 grid place-items-center gap-3 bg-black/60 px-6 text-center">
            <p className="text-sm text-white">{status.error}</p>
            <button type="button" onClick={reload} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">
              重新获取
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: 在 dev 验证**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
npm run dev
# 浏览器打开，等 5 秒，临时改用 App 里的 VideoCard 渲染（如果还没接入 VideoGallery 的话先回退到 .map(VideoCard) 验证）
# 确认 hls 视频仍能播，续期定时器没破
```

**Step 5: 提交**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
git add src/components/
git commit -m "refactor(video): 抽出 useVideoPlayer hook（VideoCard 改用 hook）"
```

---

## Task 8: React — `VideoHero` 组件（带 autoplay 控制）

**Files:**
- Create: `src/components/VideoHero.jsx`

**Step 1: 实现**

```jsx
import { useEffect, useRef } from 'react';
import useVideoPlayer from './useVideoPlayer';

/**
 * 大画面视频组件。autoplay 为 true 时挂载后自动播放。
 * 父组件用 key={video.key} 触发重建，确保旧节点资源被彻底释放。
 */
export default function VideoHero({ video, autoplay = false }) {
  const { mediaRef, status, reload } = useVideoPlayer(video.key);
  const attemptedRef = useRef(false);

  useEffect(() => {
    attemptedRef.current = false;
  }, [video.key]);

  useEffect(() => {
    if (!autoplay || attemptedRef.current) return;
    const m = mediaRef.current;
    if (!m) return;
    // 等待 source 加载完
    const tryPlay = () => {
      attemptedRef.current = true;
      m.play().catch(() => {
        // 浏览器拦截 → 显示"点击播放"
        attemptedRef.current = false;
      });
    };
    if (m.readyState >= 2) tryPlay();
    else m.addEventListener('loadeddata', tryPlay, { once: true });
  }, [autoplay, video.key]);

  if (!video) return null;

  return (
    <div className="print-plain overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 pb-3 sm:p-5">
        <h3 className="font-semibold text-slate-900">{video.title}</h3>
        {video.section && (
          <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{video.section}</p>
        )}
        {video.desc && <p className="mt-1 text-sm text-slate-500">{video.desc}</p>}
      </div>
      <div className="relative bg-black">
        <video
          ref={mediaRef}
          controls
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          x5-video-player-type="h5-page"
          x5-video-player-fullscreen="true"
          preload="metadata"
          poster={video.poster || undefined}
          className="aspect-video w-full"
          onError={() => reload()}
        />
        {status.loading && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm text-white">
            正在获取播放地址…
          </div>
        )}
        {!status.loading && status.error && (
          <div className="absolute inset-0 grid place-items-center gap-3 bg-black/60 px-6 text-center">
            <p className="text-sm text-white">{status.error}</p>
            <button type="button" onClick={reload} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">
              重新获取
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: 不验证（与 Task 9 一起）**

**Step 3: 提交**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
git add src/components/VideoHero.jsx
git commit -m "feat(video): VideoHero 组件（支持 autoplay）"
```

---

## Task 9: React — `VideoThumb` + `SectionGroup` + `VideoGallery` + 接入 App

**Files:**
- Create: `src/components/VideoThumb.jsx`
- Create: `src/components/SectionGroup.jsx`
- Create: `src/components/VideoGallery.jsx`
- Modify: `src/App.jsx`
- Modify: `src/index.css`（少量样式）
- Modify: `src/resume.config.js`（清空 videos）

**Step 1: `VideoThumb.jsx`**

```jsx
export default function VideoThumb({ video, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(video)}
      className={`group block w-full text-left transition ${
        active ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg' : ''
      }`}
      aria-pressed={active}
    >
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
        {video.poster ? (
          <img src={video.poster} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            暂无封面
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-800 group-hover:text-blue-600">
        {video.title}
      </p>
    </button>
  );
}
```

**Step 2: `SectionGroup.jsx`**

```jsx
import VideoThumb from './VideoThumb';

export default function SectionGroup({ section, videos, activeKey, onSelect, layout = 'vertical' }) {
  return (
    <div className={layout === 'vertical' ? 'space-y-2' : 'space-y-2'}>
      <h3 className="px-1 text-sm font-semibold text-slate-700">{section}</h3>
      <div className={layout === 'vertical'
        ? 'space-y-2'
        : 'flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      }>
        {videos.map((v) => (
          <div key={v.key} className={layout === 'vertical' ? '' : 'w-40 shrink-0'}>
            <VideoThumb video={v} active={v.key === activeKey} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: `VideoGallery.jsx`**

```jsx
import { useMemo, useState } from 'react';
import VideoHero from './VideoHero';
import SectionGroup from './SectionGroup';

/** 把 videos 按 section 分组，分区顺序 = 首次出现顺序。 */
function groupBySection(videos) {
  const groups = [];
  const map = new Map();
  for (const v of videos) {
    if (!v.section) {
      console.error('视频配置错误：缺少 section 字段', v);
      continue;
    }
    if (!map.has(v.section)) {
      const g = { section: v.section, videos: [] };
      groups.push(g);
      map.set(v.section, g);
    }
    map.get(v.section).videos.push(v);
  }
  return groups;
}

export default function VideoGallery({ videos }) {
  if (!videos || videos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        暂无视频
      </div>
    );
  }

  const groups = useMemo(() => groupBySection(videos), [videos]);
  const [activeKey, setActiveKey] = useState(videos[0].key);
  const active = videos.find((v) => v.key === activeKey) || videos[0];

  const select = (v) => {
    if (v.key === activeKey) return;
    setActiveKey(v.key);
  };

  return (
    <>
      {/* 宽屏（lg+）：左 hero 右 1/3 分区列表 */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">
          <VideoHero key={active.key} video={active} autoplay />
        </div>
        <div className="space-y-5 overflow-y-auto pr-1 max-h-[80vh]">
          {groups.map((g) => (
            <SectionGroup
              key={g.section}
              section={g.section}
              videos={g.videos}
              activeKey={activeKey}
              onSelect={select}
              layout="vertical"
            />
          ))}
        </div>
      </div>

      {/* 窄屏：上 hero，下 chips + 缩略横排 */}
      <div className="lg:hidden space-y-4">
        <VideoHero key={active.key} video={active} autoplay />
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((g) => (
            <button
              key={g.section}
              type="button"
              onClick={() => select(g.videos[0])}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                g.videos.some((v) => v.key === activeKey)
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {g.section}
            </button>
          ))}
        </div>
        {groups.map((g) =>
          g.videos.some((v) => v.key === activeKey) ? (
            <SectionGroup
              key={g.section}
              section={g.section}
              videos={g.videos}
              activeKey={activeKey}
              onSelect={select}
              layout="horizontal"
            />
          ) : null
        )}
      </div>
    </>
  );
}
```

**Step 4: 改 `src/App.jsx`**

```jsx
import VideoGallery from './components/VideoGallery.jsx';
// 删 VideoCard 的 import

export default function App() {
  const { profile = {}, contacts = [], videos = [], sections = [], share, footer } = resume;
  // ...
  {visibleVideos.length > 0 && (
    <section id="videos" className="scroll-mt-20 pt-8">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">视频介绍</h2>
      <VideoGallery videos={visibleVideos} />
    </section>
  )}
}
```

**Step 5: 改 `src/index.css`（追加）**

```css
/* 视频画廊：让窄屏缩略图横排好看 */
.gallery-thumb-row {
  scroll-snap-type: x mandatory;
}
.gallery-thumb-row > * {
  scroll-snap-align: start;
}
```

**Step 6: 清空 `src/resume.config.js` 的 videos**（一次性迁移）

```js
videos: [],
```

**Step 7: 验证**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
npm run dev
# 打开浏览器，应该看到"暂无视频"占位（videos 已清空）
# 这正常，等你用脚本添加视频后才有内容
```

**Step 8: 提交**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
git add src/
git commit -m "feat(video): VideoThumb/SectionGroup/VideoGallery + 接入 App + 清空 videos 迁移"
```

---

## Task 10: 端到端冒烟测试

**Files:** 无（只验证）

**Step 1: 用脚本生成测试数据**（用真实 gna.mp4 副本喂到 `discover_groups`）

- 准备 `C:\Users\p5233\AppData\Local\Temp\gallery-test\`
  - `1.MCN账号视频\a.mp4`（gna 副本）
  - `2.网剧（灵瞳鉴宝）\b.mp4`（gna 副本）
- 跑 `python slice.py`
  - 选 1（切片上传）
  - 给路径
  - 选 y（处理全部）、n（不上传）、y（追加配置）
- 检查 `src/resume.config.js` 是否有两条带 section 的条目

**Step 2: 前端验证**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
npm run dev
# 浏览器：
# - 宽屏：左 hero + 右两分区（MCN / 网剧）
# - 点网剧分区里的缩略图：hero 切换 + 自动播放
# - 缩小到 <1024px：上 hero + 下 chips + 横排缩略
# - 默认不播放：刷新页面，hero 不动
```

**Step 3: 验证 Review Focus 项**

| 项 | 验证方法 |
| --- | --- |
| `videos` 为空时显示占位 | 手动把 videos 改回 `[]`，看是否显示"暂无视频" |
| 子文件夹无视频 | 创建一个空子文件夹，跑脚本应跳过不报错 |
| 视频缺 section 字段 | 手动加一个无 section 的条目，控制台应有 error，UI 不渲染该条 |
| 切换 hero 旧视频停止 | 在网剧视频播放时点 MCN 缩略图，确认网剧立即停，MCN 自动播 |
| 单文件模式必填 section | 跑单文件模式（不输入文件夹），确认问分区名 |
| 文件夹名前缀剥离 | 用 `1.`, `2、`, `03-`, `01_` 等不同命名测试 |

**Step 4: 通过后打 tag**

```bash
cd C:\Users\p5233\Documents\my_code\xiaoying
git tag v0.4.0-video-sections
```
