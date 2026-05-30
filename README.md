# NetBench - 网络多点测试平台

一个类似 ITDog 的综合性网络多点测试平台，支持从全球多个节点同时发起 Ping、HTTP/HTTPS 和网络测速测试，实时查看各地网络状况。

## ✨ 核心特性

- **📡 Ping 多点测试** — 输入目标主机，从所有在线节点同时 Ping，实时展示各地延迟和丢包率
- **🌐 HTTP/HTTPS 多点测试** — 多节点同时请求目标 URL，检测各地响应状态码、TTFB、DNS 解析时间
- **⚡ 网络多点测速** — 多节点同时测量下载/上传速度、延迟和抖动
- **🖥️ 节点赞助系统** — 安装节点程序即可贡献测试节点，获得信誉积分
- **📊 实时结果推送** — WebSocket 实时推送各节点测试结果，按延迟/速度自动排序
- **🔒 安全可靠** — JWT 认证、节点 Token、信誉积分系统、自动故障转移

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
│   ├── api-gateway/             # API 网关
│   ├── orchestrator-service/    # 测试编排服务（多点调度核心）
│   ├── ping-service/            # Ping 测试服务
│   ├── http-service/            # HTTP 测试服务
│   ├── speedtest-service/       # 网络测速服务
│   ├── node-service/            # 节点管理服务
│   ├── user-service/            # 用户服务
│   ├── data-service/            # 数据处理服务
│   └── monitoring-service/      # 监控告警服务
├── shared/                      # 共享库
│   ├── logger/                  # 日志模块 (Winston)
│   ├── types/                   # TypeScript 类型定义
│   ├── database/                # 数据库客户端 (PG/Redis/Influx)
│   └── messaging/               # 消息队列 (RabbitMQ)
├── web/                         # 前端 (React + Vite + TailwindCSS)
├── node-agent/                  # 节点代理程序 (CLI)
├── k8s/                         # Kubernetes 部署配置
├── scripts/                     # 数据库初始化脚本
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

节点代理程序允许用户贡献自己的服务器作为测试节点。

### 安装

```bash
npm install -g @netbench/node-agent
```

### 使用

```bash
# 首次注册并启动
netbench-agent start --server https://your-netbench-server.com --name "我的节点"

# 查看状态
netbench-agent status

# 修改配置
netbench-agent config --name "新名称"
```

### 环境变量

节点程序支持以下环境变量来自定义位置信息：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_COUNTRY` | 国家 | Unknown |
| `NODE_REGION` | 地区 | Unknown |
| `NODE_CITY` | 城市 | Unknown |
| `NODE_LAT` | 纬度 | 0 |
| `NODE_LON` | 经度 | 0 |
| `NODE_ISP` | ISP 运营商 | Unknown |
| `MAX_TASKS` | 最大并发任务数 | 5 |
| `BANDWIDTH_LIMIT` | 带宽限制 (bytes) | 0 (无限制) |

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
