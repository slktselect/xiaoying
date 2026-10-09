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
public/index.html   简历页面骨架
public/styles.css   样式（响应式 + 打印优化）
public/app.js       读取 resume.json 渲染页面，向 Worker 换取视频播放地址
public/resume.json  简历内容 —— 你只需要改这个文件
wrangler.toml       Workers / 静态资源 / R2 绑定 / 环境变量
```

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/`、`/resume.json`、`/styles.css`、`/app.js` | Workers 静态资源直出，不消耗 Worker 调用 |
| GET | `/api/video?key=<对象key>` | 校验来源后签发短期播放地址，前端播放器调用 |
| GET | `/v/<key>?exp=<秒>&sig=<签名>` | 校验签名后从 R2 返回视频，支持 `Range` → `206` |
| GET | `/sign?key=&ttl=` | 业务后端用的签发接口，需 `Authorization: Bearer $SIGN_TOKEN` |

签名算法：`payload = "<key>\n<exp>"`（`BIND_IP=1` 时追加 `"\n<客户端IP>"`），
`sig = base64url(HMAC-SHA256(SIGN_SECRET, payload))`。

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
VIDEO_KEYS = "self-intro.mp4"                                # 只允许这些 key 被签发播放
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

## 注意事项

- `ALLOW_REFERERS` 留空表示不校验 Referer，上线前请务必配置。
- Worker 已实现 `Range` → `206 Partial Content`，缺少它浏览器无法拖动视频进度条。
- R2 **不收取出网流量费**，适合放视频。
- 页面未设置 CORS（默认最严）；若后续要加载跨域字幕再另行放行。
- `resume.json` 是纯数据，`app.js` 全量渲染，改内容无需改动代码。
