# NetBench - 网络多点测试平台

一个类似 ITDog 的综合性网络多点测试平台，支持从全球多个节点同时发起 Ping、HTTP/HTTPS 和网络测速测试，实时查看各地网络状况。

## ✨ 核心特性

- **📡 Ping 多点测试** — 输入目标主机，从所有在线节点同时 Ping，实时展示各地延迟和丢包率
- **🌐 HTTP/HTTPS 多点测试** — 多节点同时请求目标 URL，检测各地响应状态码、TTFB、DNS 解析时间
- **⚡ 网络多点测速** — 多节点同时测量下载/上传速度、延迟和抖动
- **🖥️ 节点赞助系统** — 安装节点程序即可贡献测试节点，获得信誉积分
- **📊 实时结果推送** — WebSocket 实时推送各节点测试结果，按延迟/速度自动排序
- **🔒 安全可靠** — JWT 认证、节点 Token、信誉积分系统、自动故障转移
- **🗺️ 可视化地图** — 中国地图热力图展示各节点分布和测试结果

## 🏗️ 系统架构

```
用户浏览器
    │
    ▼
Nginx (前端静态资源)
    │ /api/*  /ws
    ▼
API Gateway (3000) ─── 认证/限流/路由/WebSocket
    │
    ├──► Orchestrator Service (3008) ─── 多点测试编排调度
    │       │
    │       ├──► Ping Service (3001) ─── ICMP Ping 测试引擎
    │       ├──► HTTP Service (3002) ─── HTTP/HTTPS 测试引擎
    │       ├──► Speedtest Service (3003) ─ 网络测速引擎
    │       └──► Node Service (3004) ─── 节点管理/负载均衡/信誉
    │
    ├──► User Service (3005) ─── 用户注册/登录/角色
    ├──► Data Service (3006) ─── 数据处理/归档/趋势分析/报告
    └──► Monitoring Service (3007) ─ 健康检查/告警规则

基础设施层: PostgreSQL │ Redis │ InfluxDB │ RabbitMQ
```

## 📁 项目结构

```
netbench-platform/
├── services/                    # 微服务
│   ├── api-gateway/             # API 网关 (认证、限流、路由、WebSocket)
│   │   ├── src/
│   │   │   ├── middleware/      # 中间件 (auth, errorHandler, requestLogger)
│   │   │   ├── routes/         # 路由配置
│   │   │   ├── websocket/      # WebSocket 处理
│   │   │   └── index.ts         # 服务入口
│   ├── orchestrator-service/   # 测试编排服务（多点调度核心）
│   │   └── src/
│   │       ├── orchestrator.ts # 编排逻辑
│   │       └── index.ts        # 服务入口
│   ├── ping-service/            # Ping 测试服务
│   │   └── src/
│   │       ├── engine.ts       # Ping 引擎
│   │       └── index.ts        # 服务入口
│   ├── http-service/            # HTTP 测试服务
│   │   └── src/
│   │       ├── engine.ts       # HTTP 测试引擎
│   │       └── index.ts        # 服务入口
│   ├── speedtest-service/       # 网络测速服务
│   │   └── src/
│   │       ├── engine.ts       # 测速引擎
│   │       └── index.ts        # 服务入口
│   ├── node-service/            # 节点管理服务
│   │   └── src/
│   │       ├── load-balancer.ts # 负载均衡算法
│   │       ├── reputation.ts   # 信誉积分系统
│   │       ├── repository.ts   # 数据访问层
│   │       └── index.ts        # 服务入口
│   ├── user-service/            # 用户服务
│   │   └── src/
│   │       └── index.ts        # 服务入口
│   ├── data-service/            # 数据处理服务
│   │   └── src/
│   │       ├── processor.ts    # 数据处理器
│   │       └── index.ts        # 服务入口
│   └── monitoring-service/      # 监控告警服务
│       └── src/
│           ├── alert-manager.ts # 告警管理
│           └── index.ts        # 服务入口
├── shared/                      # 共享库
│   ├── logger/                  # 日志模块 (Winston)
│   │   └── src/
│   │       └── index.ts
│   ├── types/                   # TypeScript 类型定义
│   │   └── src/
│   │       └── index.ts
│   ├── database/                # 数据库客户端
│   │   └── src/
│   │       ├── postgres.ts      # PostgreSQL 客户端
│   │       ├── redis.ts         # Redis 客户端
│   │       ├── influx.ts        # InfluxDB 客户端
│   │       └── index.ts
│   └── messaging/               # 消息队列 (RabbitMQ)
│       └── src/
│           └── index.ts
├── web/                         # 前端 (React + Vite + TailwindCSS)
│   ├── src/
│   │   ├── api/                # API 调用封装
│   │   ├── components/         # 公共组件
│   │   │   ├── ChinaHeatmap.tsx # 中国地图热力图
│   │   │   ├── MapView.tsx     # 地图视图
│   │   │   ├── Layout.tsx       # 布局组件
│   │   │   └── SponsorShowcase.tsx # 赞助商展示
│   │   ├── pages/              # 页面组件
│   │   │   ├── Dashboard.tsx   # 仪表盘
│   │   │   ├── PingTest.tsx    # Ping 测试页面
│   │   │   ├── HttpTest.tsx    # HTTP 测试页面
│   │   │   ├── SpeedTest.tsx   # 测速页面
│   │   │   ├── Nodes.tsx       # 节点列表
│   │   │   ├── History.tsx     # 历史记录
│   │   │   ├── Sponsor.tsx     # 赞助商页面
│   │   │   ├── Profile.tsx     # 用户资料
│   │   │   ├── Admin.tsx       # 管理后台
│   │   │   ├── Users.tsx       # 用户管理
│   │   │   ├── Login.tsx       # 登录页面
│   │   │   └── Register.tsx    # 注册页面
│   │   ├── store/              # 状态管理 (Zustand)
│   │   │   └── auth.ts
│   │   └── utils/              # 工具函数
│   │       └── nodeHelper.tsx
├── node-agent/                  # 节点代理程序 (CLI)
│   ├── src/
│   │   ├── agent.ts            # 代理核心逻辑
│   │   └── index.ts           # 程序入口
│   ├── install.sh              # 安装脚本
│   └── uninstall.sh            # 卸载脚本
├── k8s/                         # Kubernetes 部署配置
│   └── deploy.yaml
├── scripts/                     # 数据库初始化脚本
│   ├── init-db.sql
│   └── migrate-sponsor-showcase.sql
├── docker-compose.yml           # Docker Compose 开发环境
└── package.json                 # Monorepo 根配置
```

## 🚀 快速开始

### 环境要求

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16+ (开发环境可使用 Docker)
- Redis 7+ (开发环境可使用 Docker)

### Docker Compose 一键启动

```bash
# 克隆项目
git clone <repo-url>
cd netbench-platform

# 复制环境变量
cp .env.example .env

# 启动所有服务
docker-compose up -d

# 访问前端
# http://localhost:8080
```

### 本地开发

```bash
# 安装依赖
npm install

# 启动基础设施 (PostgreSQL, Redis, InfluxDB, RabbitMQ)
docker-compose up -d postgres redis influxdb rabbitmq

# 启动所有微服务 (开发模式)
npm run dev

# 或单独启动某个服务
npm run dev:gateway
npm run dev:ping
npm run dev:http
npm run dev:speedtest
npm run dev:node
npm run dev:user
npm run dev:data
npm run dev:monitor

# 启动前端
npm run dev --workspace=web
```

### 数据库初始化

数据库表会在 PostgreSQL 容器首次启动时自动创建（通过 `scripts/init-db.sql`）。

如需手动初始化：

```bash
psql -h localhost -U netbench -d netbench -f scripts/init-db.sql
```

## 🖥️ 节点代理程序

节点代理程序允许用户贡献自己的服务器作为测试节点，帮助扩大全球测速网络覆盖范围。

### 🌟 为什么贡献节点？

- **🌐 扩大测速范围** — 您所在的位置将成为新的测试节点，帮助更多用户了解当地网络质量
- **⚡ 极低资源占用** — Agent 仅需 Node.js 运行时，内存占用 < 30MB，CPU 占用几乎为零（仅在执行测试时有少量消耗）
- **🤖 自动化管理** — 安装后自动注册、心跳保活、任务轮询全部自动化，无需人工干预
- **🔒 安全隔离** — Agent 仅作为客户端主动连接服务器，不开放任何入站端口，不影响服务器其他服务

### 📋 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Linux (Ubuntu/Debian/CentOS/RHEL/Fedora/Alpine) |
| CPU | 任意架构 (x86_64 / ARM64) |
| 内存 | ≥ 128MB 可用 RAM |
| 磁盘 | ≥ 100MB 可用空间 |
| 网络 | 可访问外网（用于上报测试结果） |
| 权限 | root 或 sudo 权限（用于安装 systemd 服务） |

### 🚀 安装部署

#### 一键安装

```bash
curl -fsSL https://dl.hydun.com/netbench/node/install.sh | sudo bash
```

安装脚本会自动完成以下操作：
1. 检测并安装 Node.js 18+（如需要）
2. 下载并安装 Agent 程序
3. 自动检测节点地理位置（IP、国家、地区、城市、ISP）
4. 交互式配置节点名称和服务器地址
5. 向服务器注册节点并获取 Token
6. 配置 systemd 服务并启动

#### 交互式配置

首次安装时，脚本会提示输入以下信息：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| 服务器地址 | NetBench 平台地址 | `https://net.hydun.com` |
| 节点名称 | 节点标识名称 | `北京-电信` |

地理位置信息会自动从 IP 检测，也可通过环境变量手动指定。

### 🔧 常用命令

```bash
# 查看运行状态
systemctl status netbench-agent

# 实时查看日志
journalctl -u netbench-agent -f

# 重启 Agent
systemctl restart netbench-agent

# 查看配置文件
cat /opt/netbench-agent/.env

# 卸载 Agent
bash /opt/netbench-agent/uninstall.sh
```

### ⚙️ 环境变量

Agent 支持以下环境变量来自定义配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NETBENCH_SERVER` | 服务器地址 | 无（必填） |
| `NETBENCH_TOKEN` | 节点 Token | 自动获取 |
| `NODE_NAME` | 节点名称 | 无（必填） |
| `NODE_COUNTRY` | 国家 | 自动检测 |
| `NODE_REGION` | 地区/省份 | 自动检测 |
| `NODE_CITY` | 城市 | 自动检测 |
| `NODE_LAT` | 纬度 | 自动检测 |
| `NODE_LON` | 经度 | 自动检测 |
| `NODE_ISP` | ISP 运营商 | 自动检测 |
| `MAX_TASKS` | 最大并发任务数 | 5 |
| `LOG_LEVEL` | 日志级别 | info |

### 📡 节点能力

节点 Agent 支持以下三种测试任务：

| 测试类型 | 说明 | 配置参数 |
|----------|------|----------|
| Ping | ICMP Ping 测试 | count, timeout |
| HTTP | HTTP/HTTPS 请求测试 | method, headers, timeout, followRedirects |
| Speedtest | 带宽测速（下载/上传） | duration, parallel |

### ❓ 常见问题

**Q: Agent 会影响服务器性能吗？**

> 不会。Agent 在空闲时仅发送心跳（每 30 秒一次），几乎零 CPU 和内存开销。只有在被分配到测试任务时才会短暂使用带宽。

**Q: 如何更新 Agent？**

> 重新执行安装命令即可：`curl -fsSL https://dl.hydun.com/netbench/node/install.sh | sudo bash`。脚本会自动检测已有配置并保留，无需手动操作。

**Q: 同名的节点重复安装怎么办？**

> 不用担心。同名的节点会复用原有的 ID 和 Token，不会产生重复记录。您可以随时在后台管理页面编辑或删除节点。

**Q: Agent 需要开放端口吗？**

> 不需要。Agent 作为客户端主动连接服务器，不需要开放任何入站端口，不会增加安全风险。

**Q: 卸载后数据还在吗？**

> 是的。卸载仅删除 Agent 程序本身，服务器端的历史测试数据会被完整保留。

## 📡 API 接口

### 多点测试

```bash
# Ping 多点测试
POST /api/test/ping
{
  "target": "baidu.com",
  "count": 4,
  "timeout": 5000,
  "maxNodes": 50
}

# HTTP 多点测试
POST /api/test/http
{
  "url": "https://example.com",
  "method": "GET",
  "timeout": 10000,
  "maxNodes": 50
}

# 网络多点测速
POST /api/test/speedtest
{
  "duration": 10,
  "parallel": 4,
  "maxNodes": 20
}

# 查询批量测试结果
GET /api/batch/{batchId}
```

### 节点管理

```bash
# 注册节点
POST /api/nodes/register

# 节点心跳
POST /api/nodes/heartbeat

# 获取节点列表
GET /api/nodes?status=online&limit=50
```

### 用户系统

```bash
# 注册
POST /api/users/register
{ "username": "test", "email": "test@example.com", "password": "12345678", "role": "user" }

# 登录
POST /api/users/login
{ "username": "test", "password": "12345678" }

# 获取个人信息
GET /api/users/profile
```

### WebSocket 实时推送

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

// 订阅测试结果
ws.send(JSON.stringify({
  type: 'subscribe',
  data: { channels: ['test:result'] }
}));

// 接收实时结果
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'test:result') {
    console.log('节点测试结果:', msg.data);
  }
};
```

## 🎯 信誉积分系统

节点信誉积分由 5 个维度综合评估：

| 维度 | 权重 | 说明 |
|------|------|------|
| 任务成功率 | 30% | 成功完成的测试任务占比 |
| 响应时间 | 20% | 平均任务响应速度 |
| 可用率 | 25% | 节点在线时间比例 |
| 稳定性 | 15% | 成功率的方差（越稳定越高） |
| 贡献度 | 10% | 累计完成的测试任务数量 |

信誉积分低于 10 分的节点将被自动暂停。

## 🔄 负载均衡算法

选择测试节点时综合考虑以下因子：

| 因子 | 权重 | 说明 |
|------|------|------|
| 当前负载 | 35% | 优先选择空闲节点 |
| 信誉积分 | 30% | 优先选择高信誉节点 |
| 地理位置 | 20% | 优先选择距离用户近的节点 |
| 可用率 | 15% | 优先选择稳定在线的节点 |

## ☸️ Kubernetes 部署

```bash
# 部署到 Kubernetes
kubectl apply -f k8s/deploy.yaml

# 查看服务状态
kubectl get pods -n netbench
kubectl get services -n netbench
```

K8s 配置包含：
- 所有微服务的 Deployment 和 Service
- ConfigMap 和 Secret 配置
- Ingress 入口配置
- API Gateway 的 HPA 自动扩缩容（2-10 副本）

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, TypeScript, Vite, TailwindCSS, Zustand |
| API 网关 | Express, http-proxy-middleware, WebSocket |
| 微服务 | Node.js 20, Express, TypeScript |
| 关系数据库 | PostgreSQL 16 |
| 缓存 | Redis 7 |
| 时序数据库 | InfluxDB 2.7 |
| 消息队列 | RabbitMQ 3.12 |
| 容器化 | Docker, Docker Compose, Kubernetes |
| 日志 | Winston |
| 认证 | JWT |

## 📄 License

MIT
