# xiaoying

托管在 Cloudflare 的**在线简历站点**。页面由 Workers 静态资源直出，简历中的视频存放在 R2，
通过 Worker 签发**短期签名 URL + Referer 白名单**做防盗链，支持拖动进度条播放。

构建 / 部署命令：

```powershell
npx wrangler deploy
```

## 项目结构

```
src/index.js        Worker：视频签名校验 + R2 回源 + 静态资源兜底
src/usage.js        每日用量统计与免费额度护栏（Workers KV）
public/index.html   简历页面骨架
public/styles.css   样式（响应式 + 打印优化）
public/app.js       读取 resume.json 渲染页面，向 Worker 换取视频播放地址
public/resume.json  简历内容 —— 你只需要改这个文件
wrangler.toml       Workers / 静态资源 / R2 绑定 / 环境变量
```

## 分享二维码

页面右下角常驻「分享」按钮，点击弹出二维码：

- 二维码**在本地生成**（自托管的 `public/vendor/qrcode.js`，`qrcode-generator`），
  不会把网址发给任何外部接口，也不依赖 CDN；
- 内容是 `location.origin + location.pathname`，只带站点路径，不含 hash / 查询串；
- 弹窗里可复制链接（无 Clipboard API 时退回 `execCommand`）、保存二维码 PNG；
  手机浏览器会额外出现「系统分享」（`navigator.share`）；
- 点击遮罩、按 `Esc`、`关闭` 都能关掉；打印时按钮与弹窗都不输出。

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/`、`/resume.json`、`/styles.css`、`/app.js` | Workers 静态资源直出，不消耗 Worker 调用 |
| GET | `/api/video?key=<对象key>` | 校验来源后签发短期播放地址，前端播放器调用 |
| GET | `/v/<key>?exp=<秒>&sig=<签名>` | 校验签名后从 R2 返回视频，支持 `Range` → `206` |
| GET | `/sign?key=&ttl=` | 业务后端用的签发接口，需 `Authorization: Bearer $SIGN_TOKEN` |
| GET | `/usage` | 查看当日用量，仅 `USAGE_ALLOW_IPS` 中的 IP 可访问 |

签名算法：`payload = "<key>\n<exp>"`（`BIND_IP=1` 时追加 `"\n<客户端IP>"`），
`sig = base64url(HMAC-SHA256(SIGN_SECRET, payload))`。

> `exp` 会向上取整到 `SIGN_WINDOW`（默认 300 秒）的整数倍，
> 这是为了让同一时间窗内所有访客得到**完全相同**的 URL，从而命中同一份 CDN 缓存。

## 部署步骤

### 1. 登录并创建 R2 桶

```powershell
npx wrangler login
npx wrangler r2 bucket create xiaoying-video
```

### 2. 改简历内容

编辑 `public/resume.json`（其中的 `videos[].key` 就是 R2 里的对象名）。
示例数据均为占位内容，请替换成自己的真实信息。

### 3. 上传视频

```powershell
npx wrangler r2 object put xiaoying-video/self-intro.mp4 -f .\self-intro.mp4 --content-type video/mp4
```

> 上传时带上 `--content-type` 可省去 Worker 按扩展名猜测。R2 单次 PUT 上限 5GB。

### 4. 配置密钥

```powershell
npx wrangler secret put SIGN_SECRET   # 签名密钥：openssl rand -hex 32
```

若要在自己的业务后端签发（而非使用 `/api/video`），再执行：

```powershell
npx wrangler secret put SIGN_TOKEN
```

### 5. 部署

```powershell
npx wrangler deploy
```

部署后输出形如 `https://xiaoying.<subdomain>.workers.dev`。

日常开发：

```powershell
npm run dev     # 本地调试（如需 /sign，先 cp .dev.vars.example .dev.vars）
npm run tail    # 线上实时日志
npx wrangler r2 object list xiaoying-video
```

## 防盗链配置

部署拿到域名后，**务必**在 `wrangler.toml` 的 `[vars]` 里收紧，然后重新 `npx wrangler deploy`：

```toml
VIDEO_KEYS = "gna.mp4"                                       # 只允许这些 key 被签发播放
ALLOW_REFERERS = "xiaoying.xxx.workers.dev,resume.example.com"  # 只允许本站页面嵌入播放
ALLOW_EMPTY_REFERER = "0"                                    # 无 Referer 的直接访问一律 403
BIND_IP = "1"                                                # 可选：签名绑定客户端 IP
PLAY_TTL = "300"                                             # 播放地址有效期（秒）
```

三重防护：

1. `/api/video` 校验 Referer，站外页面拿不到播放地址；
2. `VIDEO_KEYS` 白名单，防止遍历 R2 上的其它对象；
3. `/v/<key>` 校验 HMAC 签名与过期时间，地址泄露也会很快失效（`crypto.subtle.verify` 常量时间比较）。

> 若绑定自定义域名或使用 Workers.dev 之外的入口，记得把对应域名加进 `ALLOW_REFERERS`。

## HLS 分片播放（秒开）

视频在 R2 里以 HLS 形式存放，播放器只拉取需要的分片，不必等整个文件下载完：

```
hls/index.m3u8   播放列表
hls/seg_000.ts   2 秒分片
hls/seg_001.ts
...              共 31 个
```

### 用 FFmpeg 切片

```powershell
ffmpeg -i gna.mp4 `
  -c:v libx264 -preset veryfast -crf 23 -maxrate 2400k -bufsize 4800k `
  -pix_fmt yuv420p -g 48 -keyint_min 48 -sc_threshold 0 `
  -c:a aac -b:a 128k -ar 44100 `
  -f hls -hls_time 2 -hls_playlist_type vod -hls_flags independent_segments `
  -hls_segment_filename "seg_%03d.ts" index.m3u8
```

**「秒开」的关键是 `-g 48`（约 2 秒一个关键帧）**，不是 `-hls_time`：

| 方式 | 首片大小 | 起播 |
| --- | --- | --- |
| `-c copy`（不重编码） | 1.71 MB / 5.34 秒 | 要等整片下完 |
| 重编码 + 2 秒关键帧 | 663 KB / 2 秒 | 约 0.5 秒 |

原因：`-c copy` 只能在源文件**已存在的关键帧**处切断。本片源关键帧间隔 5.3 秒，
所以就算写 `-hls_time 2`，分片还是 5 秒长；`-hls_time` 只有在关键帧足够密时才生效。
总大小基本不变（16.77 MB vs 源 16.56 MB，平均 2232 kbps）。

### Worker 侧：播放列表改写

m3u8 里是**相对路径**（`seg_000.ts`），播放器按相对路径请求分片时**不会继承**播放列表 URL 上的
`exp` / `sig`，分片请求会因缺签名被 403。所以 Worker 返回 `.m3u8` 时会把每个分片地址
改写成带签名的 `/v/<key>?exp=&sig=`，且共用同一个 `exp`（与播放列表同窗口，便于 CDN 缓存）。

`VIDEO_KEYS` 支持前缀通配（`hls/*`），不必把 31 个分片逐个写进白名单。

### 前端

桌面版 Chrome / Edge 不支持原生 HLS，需要 `hls.js`
（已 vendored 到 `public/vendor/hls.light.min.js`，自托管，不依赖外部 CDN）；
Safari / iOS 原生支持，直接走 `video.src`，不会走 hls.js。

### 上传切片（重要）

> ⚠️ 本项目环境里 **`wrangler r2 object put` 写入的对象 Worker 读不到**：
> CLI 上传后 `wrangler r2 object get` 能取回，但 Worker 侧 `head()` 返回 404
> （CLI 与 Worker 绑定解析到的不是同一个桶实例）。改用下面两种方式之一：

1. **Cloudflare 控制台上传**（最省事）：R2 → `xiaoying-video` → 上传，先建 `hls/` 前缀再拖入全部文件。
2. **REST API**（可脚本批量）：

```powershell
Invoke-RestMethod -Method Put `
  -Uri "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/r2/buckets/xiaoying-video/objects/hls/seg_000.ts" `
  -Headers @{ Authorization = "Bearer $token" } `
  -InFile ".\seg_000.ts" -ContentType "video/mp2t"
```

分片 Content-Type 用 `video/mp2t`，播放列表用 `application/vnd.apple.mpegurl`。

## 用 S3 API 管理 R2 对象

除了 `wrangler r2 object put`，也可以用标准 S3 工具（rclone、AWS CLI、Cyberduck 等）管理 `xiaoying-video`，
大文件分片上传更稳。入口地址：

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com/xiaoying-video
```

`<ACCOUNT_ID>` 在 Cloudflare 控制台 → R2 概览页可以看到，**不要写进代码仓库**。

1. R2 → 管理 R2 API 令牌 → 创建**账户级**令牌（Object Read & Write），得到 Access Key ID / Secret Access Key；
2. 用 rclone：

```powershell
rclone config   # 选 Amazon S3 -> provider=Cloudflare -> endpoint=<ACCOUNT_ID>.r2.cloudflarestorage.com
rclone ls r2:xiaoying-video
rclone copy .\gna.mp4 r2:xiaoying-video --s3-chunk-size 64M --progress
```

> 用 Dashboard 上传超过 4.7GB 的文件必须走 S3 API；本项目单个视频远小于此，两种方式都可以。

## 使用 Cloudflare 免费 CDN 分发

视频响应带 `Cache-Control: public, max-age=...` 与 `Cloudflare-CDN-Cache-Control`，
配合 `SIGN_WINDOW` 让同一时间窗内所有访客共享同一个 URL → 边缘节点只需缓存一份。
只要有一份被缓存，后续请求就由 CDN 直出，**不再调用 Worker、不再回源 R2**。

### 必须做的一步：配置 Cache Rule

带查询串的 URL 在部分默认配置下不会被缓存，需在控制台显式放行：

> 控制台 → 网站（或 Workers 所在zone）→ Caching → Cache Rules → 创建规则

- 表达式：`starts_with(http.request.uri.path, "/v/")`
- Cache eligibility：**Eligible for cache**（相当于 Cache Everything）
- Edge TTL：Use cache-control / 设为 300 秒
- Cache Key：默认即包含完整查询字符串，**不要**排除 `exp` / `sig`（否则会串号）

同时建议打开 **Tiered Caching**（免费）：Caching → Tiered Cache，
让上层节点统一回源，进一步减少对 R2 的请求数。

静态页面（`public/`）由 Workers Assets 直出，本身就带边缘缓存，无需额外配置。

验证是否命中 CDN：

```powershell
curl -I "https://<你的域名>/v/gna.mp4?exp=...&sig=..."   # 看 cf-cache-status: HIT
```

## 免费额度护栏（避免产生任何费用）

### Cloudflare 免费计划额度（2026 年）

| 项目 | 免费额度 | 超出后 |
| --- | --- | --- |
| Workers 请求数 | 10 万次/天（免费计划硬性封顶，不会计费） | 当日拒绝 (HTTP 1027) |
| Workers CPU | 10 ms/请求（流式响应基本不计） | 不计费 |
| R2 存储 | 10 GB·月 | **按 $0.015/GB·月 计费** |
| R2 Class A（写/列出） | 100 万次/月 | 计费 |
| R2 Class B（读） | 1000 万次/月 | 计费 |
| R2 出网流量 | **免费** | — |
| Workers KV | 10 万次读/天、1000 次写/天、1 GB | 计费 |

结论：**唯一可能真正产生费用的是 R2 存储用量与操作次数**，出网永远免费。

### 代码层护栏（`wrangler.toml` → `[vars]`，已实现）

```toml
DAILY_REQUEST_LIMIT = "50000"      # 每天动态请求上限，达到即返回 429（远低于 10 万/天）
DAILY_BYTES_LIMIT   = "5368709120" # 每天出网上限 5 GiB，达到即返回 429
QUOTA_FLUSH_INTERVAL = "600"       # 用量每 10 分钟写回 KV 一次，省 KV 写额度
QUOTA_ENFORCE = "1"                # 0 = 只统计不拦截
MAX_RANGE_BYTES = "8388608"        # 单次 Range 最多 8 MiB，防止小 Range 刷 R2 读次数
```

启用统计（未启用时自动降级为不限制，不影响部署）：

```powershell
npx wrangler kv namespace create xiaoying-usage
# 把输出的 id 填到 wrangler.toml 的 [[kv_namespaces]] 里（默认已注释）
npx wrangler deploy
```

查看当日用量（`USAGE_ALLOW_IPS` 留空时该接口对所有人 403）：

```toml
USAGE_ALLOW_IPS = "你的公网IP"
```

```powershell
curl https://<你的域名>/usage
```

> 计数是**近似值**（isolate 内存先累计再批量写回），作为预算护栏足够。
> 需要精确/实时请改用 Durable Objects —— 但那需要 Workers 付费计划。

### 平台层护栏（强烈建议，免费且不消耗 Worker 调用）

1. **WAF 速率限制**：控制台 → Security → WAF → Rate limiting rules，
   对 `URI Path starts with /v/ 或 /api/` 限制「每 IP 每分钟请求数」，动作为 **Block**，缓解脚本刷量。
2. **账单通知**：控制台 → Billing → 设置支出提醒；Notifications 里开启 Billing 通知。
3. **Hotlink 兜底**：Cloudflare → Scrape Shield → 打开 Hotlink Protection（主要针对图片，视频靠本项目自己的签名）。
4. **视频体积**：简历视频建议压缩到 100 MB 以内，多几个视频也不会接近 10 GB 存储上限。

## 注意事项

- `ALLOW_REFERERS` 留空表示不校验 Referer，上线前请务必配置。
- Worker 已实现 `Range` → `206 Partial Content`，缺少它浏览器无法拖动视频进度条。
- R2 **不收取出网流量费**，适合放视频。
- CDN 缓存会让超限后的旧链接在 `max-age` 秒内继续可用；上限即便如此也只是软着陆，
  真正兜底靠 WAF 速率限制。
- 页面未设置 CORS（默认最严）；若后续要加载跨域字幕再另行放行。
- `resume.json` 是纯数据，`app.js` 全量渲染，改内容无需改动代码。
- 不要把 Cloudflare 账号 ID、R2 S3 端点中的账号段、`SIGN_SECRET` 写进仓库。
