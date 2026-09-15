# luogu-discuss-saver

洛谷讨论帖存档站 —— **仅讨论帖子系统**。对洛谷社区的讨论帖（帖子 + 回复 + 多版本快照）做按需抓取、持久化与浏览，部署于 Cloudflare Pages / Workers / D1，前端界面移植自 [luogu-archive](https://github.com/oi-zone/luogu-archive)。

## 功能

- **讨论帖浏览**：帖子正文、回复列表（分页加载）、多版本快照与「时光机」版本切换、快照链接分享
- **讨论信息流**：与 luogu-archive 相同的打分算法（近期回复加权 + 确定性抖动 + 游标分页）的瀑布流推荐
- **探索 / 最新**：热门讨论与最近归档列表
- **龙王榜**：近 20 天活跃用户排行
- **用户页**：用户快照信息、发布/回复时间线
- **按需抓取**：访问未归档帖子时提示，可通过「更新帖子」按钮手动触发抓取
- **自动追更（低频率 + 随机化）**：Worker cron 每小时唤醒一次，掷骰（默认 1/3）通过后入队一条带 0~30 分钟随机延迟的发现任务；发现轮读取讨论列表、跳过置顶帖，仅对「洛谷回复数 − 已归档数 ≥ 阈值」且超过按帖冷却的帖子入队，单轮最多 5 个。北京时间 0~7 点不执行（`DISCOVERY_*` 变量可全部调整）
- **Markdown 渲染**：移植洛谷 Markdown 方言（@提及、B 站视频、提示块、洛谷表格与代码块）、LaTeX、代码高亮；链接带悬浮预览卡，@提及带「回复推断」浮层

## 架构

采用 **Pages + Worker 双部署单元** 的混合架构：

```
                    用户浏览器
                        │
                        ▼
     ┌─────────────────────────────────────┐
     │  Cloudflare Pages「lglg」            │
     │  ├─ 静态前端（frontend/ → dist/）    │
     │  └─ Pages Functions（src/api/）      │  读：直连 D1
     │     GET /api/discussions/:id 等      │  写：仅入队（Queue Producer）
     │     POST /api/discussions/:id/crawl  │
     └──────────────────┬──────────────────┘
                        │ CRAWL_QUEUE（luogu-crawl）
                        ▼
     ┌─────────────────────────────────────┐
     │  后台 Worker「lgds-jobs」（worker/） │
     │  ├─ Queue Consumer → 抓取洛谷        │
     │  └─ Durable Object PostLocker        │
     │      → 同帖快照写入串行化             │
     └──────────────────┬──────────────────┘
                        ▼
                  D1（SQLite，共用）
```

Pages Functions 支持 D1 绑定与 Queue **Producer**，但 **Queue 消费与 Durable Object 类必须由独立 Worker 承载**，因此抓取消费端放在无用户入口的后台 Worker，用户访问全部走 Pages。

**队列不可用**：Queue 不可用（配额耗尽 / 未绑定）时，`/crawl` 端点直接返回 503，不做 Function 内直连降级——抓取必须经队列单 isolate 串行消费，才能保证全局请求节流与回填链完整。

**快照写入的两条路径**（`src/crawler/discuss.ts` 自动选择）：

- Worker（绑定 `POST_LOCKER`）→ DO 按 postId 严格串行，语义对齐上游的 `pg_advisory_xact_lock`；
- Pages（未绑定 DO）→ contentHash 幂等去重兜底。

**任务幂等**：抓取任务按 `contentHash` 幂等，重复消费不会写入重复快照；队列消息不做时效丢弃，积压任务按序消费即可自然收敛。

## 关键取数结论

| 项     | 结论                                                                                    |
| ----- | ------------------------------------------------------------------------------------- |
| 域     | `www.luogu.com.cn`。`.com` 同样架在 Cloudflare 上，边缘出站会被 CF-to-CF 拦截，不可用                    |
| 头     | `x-luogu-type: content-only`（上游 `client.ts` 同名；`x-lentille-request` 是旧别名）             |
| 鉴权    | `.cn` 需要小号 cookie（`__client_id` + `_uid`），以 secret 注入                                 |
| 响应    | HTML 文档壳，数据在 `<script id="lentille-context">` 的 JSON 中 —— 解析 lentille 数据，不解析 HTML DOM |
| 网宿 CC | 触发时返回 302 + `Set-Cookie: C3VK=...`；warmup 取 C3VK 回填 Cookie 后重试                        |

## 目录结构

```
src/                      共用逻辑（Pages 与 Worker 都引用）
├── api/routes.ts         读 API（Hono）+ 抓取派发端点 + 边缘缓存
├── db/schema.ts          Drizzle SQLite schema（migrations/）
├── crawler/
│   ├── http.ts           .cn 域 + content-only 头 + cookie + C3VK 回环
│   ├── lentille.ts       提取 <script id="lentille-context"> JSON
│   ├── discuss.ts        fetchDiscuss / listDiscuss（持久化入口）
│   ├── persist.ts        快照持久化（DO 与回退路径共用）
│   └── user.ts / problem.ts / types.ts / errors.ts / utils.ts
├── durable/postLockerInterface.ts   DO 接口（实现见 worker/）
├── queue/jobs.ts         Job 类型 + enqueue
└── query/                读路径（Drizzle 关系查询）
    ├── discussion.ts     帖子 / 回复 / 快照时间线
    ├── feed.ts           信息流打分 + 游标分页
    ├── trending.ts       龙王榜 / 探索 / 最新
    └── userProfile.ts    用户页聚合

frontend/                 静态前端（Vite + React 19 + Tailwind CSS v4，SPA）
└── src/pages/            home（信息流）/ trending（龙王榜）/ discussion / user

functions/api/[[path]].ts Pages Functions 入口（挂载 Hono app）

worker/                   后台 Worker（Queue Consumer + DO）
├── wrangler.toml
└── src/
    ├── index.ts          entry（queue consumer）
    ├── queue/consumer.ts processJob（链式回填调度）
    └── durable/postLocker.ts  PostLocker DO

wrangler.toml             Pages 配置（pages_build_output_dir = "dist"）
```

## API 一览

| 方法   | 路径                              | 说明                                        |
| ---- | ------------------------------- | ----------------------------------------- |
| GET  | `/api/discussions`              | 帖子列表                                      |
| GET  | `/api/discussions/:id`          | 帖子详情 + 最新快照（`?capturedAt=` 定位历史快照）        |
| GET  | `/api/discussions/:id/replies`  | 回复列表（`take` / `skip` / `order=newest` 分页） |
| GET  | `/api/discussions/:id/timeline` | 快照时间线（游标分页）                               |
| GET  | `/api/replies/:id`              | 单条回复 + 最新快照                               |
| GET  | `/api/discussions/:id/reply-inference/:userId` | 回复推断：该用户在本帖的回复（`cursor` / `relativeTo` 定位，返回相邻回复 id） |
| GET  | `/api/entries`                  | 批量条目元数据（`entry-ref=type:id`，Markdown 悬浮卡/@提及外显用，边缘缓存 60s） |
| GET  | `/api/feed`                     | 信息流（游标分页，边缘缓存 60s）                        |
| GET  | `/api/trending/explore`         | 探索列表（边缘缓存 60s）                            |
| GET  | `/api/trending/recent`          | 最近归档（边缘缓存 60s）                            |
| GET  | `/api/users/:id`                | 用户页聚合数据                                   |
| GET  | `/api/users/:id/timeline`       | 用户时间线（游标分页）                               |
| POST | `/api/discussions/:id/crawl`    | 触发抓取（入队；按帖冷却 `CRAWL_COOLDOWN_SECONDS`，默认 300s；队列不可用返回 503） |
| —    | Worker cron `0 * * * *` → 发现任务 | 自动追更：掷骰 + 随机延迟 + 置顶/delta/冷却闸门（不在 Pages 暴露 HTTP 入口） |
| GET  | `/api/health/luogu`             | 取数通路 + cookie 健康检查                        |

## 部署

环境要求：Node.js ≥ 22，wrangler（devDependency 提供）并已 `wrangler login`。

```bash
# 0. 安装依赖
npm install

# 1. 创建 D1 与 Queues，并把 database_id 填进 wrangler.toml 与 worker/wrangler.toml
wrangler d1 create luogu-discuss
wrangler queues create luogu-crawl
wrangler queues create luogu-crawl-dlq
npm run db:migrate:remote

# 2. 部署（首次会创建 Worker 与 Pages 项目）
npm run deploy:worker     # 后台 Worker（Queue 消费 + DO）
npm run deploy:pages      # 静态前端 + 读 API

# 3. 配置 secret（小号 cookie；Pages 与 Worker 各配一份）
wrangler secret put LUOGU_COOKIE --config worker/wrangler.toml
wrangler pages secret put LUOGU_COOKIE --project-name <pages 项目名>

# 4. 验证
curl "https://<你的域名>/api/health/luogu"
```

本地开发：

```bash
npm run db:migrate:local      # 建本地 D1（Pages 与 Worker 共用同一本地库）
npm run dev:worker            # 后台 Worker（Queue/DO，--persist-to .wrangler/state）
npm run build                 # 构建静态前端 → dist/
wrangler pages dev dist       # Pages Functions（默认 8788）
npm run dev                   # 前端 Vite（5173，/api 代理到 8788）
```

> 本地 wrangler 持久化目录相对配置文件所在目录解析：`npm run dev:worker` 已带  
> `--persist-to .wrangler/state`，与 Pages 的本地库共用同一份；否则会出现 `no such table`。  
> 本地 Queue 是各 dev 进程独立的内存实现，「Pages 生产者 → Worker 消费者」这一跳只能在部署后验证。

## 抓取流程

1. 用户点「更新帖子」或访问未归档帖子 → `POST /api/discussions/:id/crawl` → 入队（队列不可用时返回 503）；
2. Queue Consumer 消费 `discuss` 任务 → `fetchDiscuss` 抓取该帖（首楼 + 回复，链式向前翻页补齐历史回复）；
3. 快照经 `PostLocker` DO 按 postId 串行写入 D1，contentHash 幂等去重；
4. 前端重新拉取详情与回复即可看到新快照。

## 频率与合规

- **单账号请求间隔**：`CRAWL_MIN_INTERVAL_MS`（默认 6000ms），`.cn` 域请保持 ≥ 5s；
- **增量阈值**：`REPLY_DELTA_THRESHOLD`（默认 5），旧帖仅当未归档回复数超过该值才整体重抓；
- **无自动发现**：本项目不做定时列表扫描，一切抓取均由用户按需触发。

## 数据模型

从 [luogu-discussion-archive](https://github.com/piterator-org/luogu-discussion-archive) 剥离：只保留讨论帖  
（Post / Reply + 多版本快照 + 下架记录）及其外键依赖（User / UserSnapshot / Problem / Forum），剔除文章、剪贴板、判决、动态等子系统。

- `Post` / `PostSnapshot`：帖子多版本快照（title / content / author / forum 随时间变化）
- `Reply` / `ReplySnapshot`：回复多版本快照
- `Takedown`：下架记录
- `User` / `UserSnapshot`：用户名、颜色、徽章、CCF/XCPC 等级的历史快照

## 许可证

本项目基于上游 [luogu-discussion-archive](https://github.com/piterator-org/luogu-discussion-archive) 与  
[luogu-archive](https://github.com/oi-zone/luogu-archive)，以 **AGPL-3.0-only** 发布，详见 [LICENSE.md](LICENSE.md)。
