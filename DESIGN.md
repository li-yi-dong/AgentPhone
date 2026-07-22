# AgentPhone 设计文档

> **版本**：v0.3.0  
> **创建日期**：2026-07-22  
> **状态**：草稿

## 1. 产品概述

### 1.1 产品目标

AgentPhone 是一个移动端应用，让用户能够通过手机远程操控电脑端运行的 Claude Code 实例。核心价值：

- **随时随地**：离开电脑时仍可监控和操控正在运行的 Claude Code 任务
- **实时交互**：查看 Claude Code 的输出流、发送指令、批准/拒绝操作请求
- **通知提醒**：当 Claude Code 需要用户输入或完成任务时推送通知

### 1.2 核心场景

1. 长任务监控：在手机上实时查看 Claude Code 执行长时间任务的进度
2. 远程审批：Claude Code 在执行高风险操作前请求用户确认
3. 指令发送：通过手机向 Claude Code 发送新的指令或补充信息
4. 会话管理：查看和管理多个并发的 Claude Code 会话

---

## 2. 系统架构

### 2.1 核心设计约束

- **本地终端体验零感知**：用户在本地终端使用 Claude Code 的体验必须与直接运行完全一致
- **手机是第二控制面**：不是替代本地终端，而是与之并联
- **MVP 范围**：手机与 Mac 在同一局域网（WiFi）下，直连，不依赖任何外部服务器（见 ADR-001）

### 2.2 MVP 架构（两层，局域网直连）

```
┌──────────────────────────────────────────┐
│              用户本地终端                 │
│          (Terminal Emulator)             │
└────────────────┬─────────────────────────┘
                 │ stdin / stdout (PTY)
                 ▼
┌──────────────────────────────────────────┐
│            Desktop Agent                │
│       (Mac 本地进程，PTY 透明代理)        │
│                                          │
│  ┌──────────────┐   ┌─────────────────┐  │
│  │  PTY Master  │   │  WebSocket      │  │
│  │  输入合并    │   │  Server  :8080  │  │
│  │  输出广播    │   └────────┬────────┘  │
│  └──────┬───────┘            │           │
│         │ fork PTY Slave     │           │
│         ▼                    │           │
│  ┌──────────────┐            │           │
│  │  Claude Code │            │           │
│  │  进程        │            │           │
│  └──────────────┘            │           │
└─────────────────────────────-┼───────────┘
                               │ ws://192.168.x.x:8080（局域网）
                               ▼
┌──────────────────────────────────────────┐
│              手机端 APP                   │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ 扫码连接 │  │ xterm.js │  │ 键盘   │  │
│  │          │  │ 终端渲染 │  │ 输入   │  │
│  └──────────┘  └──────────┘  └────────┘  │
└──────────────────────────────────────────┘
```

### 2.3 数据流

#### 启动
```bash
# 用户在 Mac 终端执行（替代直接执行 claude）
$ agentphone

# Desktop Agent 做：
# 1. 启动 WebSocket Server，监听本机 IP:8080
# 2. 在终端打印局域网地址 + 二维码（供手机扫码连接）
# 3. 创建 PTY，fork Claude Code 进程
# 4. 连通：本地终端 ↔ PTY Master ↔ Claude Code
```

#### 输出广播（Claude Code → 两端同步）
```
Claude Code 输出
      ↓
 PTY Master 读取
      ├──► 本地终端（立即写入，无额外延迟）
      └──► 所有已连接的 WebSocket 客户端（广播）
```

#### 输入合并（两端 → Claude Code）
```
本地终端键入  ──┐
               ├──► 串行写入 PTY Master ──► Claude Code
手机端键入    ──┘      （先到先处理）
```

### 2.4 各层职责

#### Desktop Agent（Mac 本地进程，核心）

| 职责 | 说明 |
|------|------|
| PTY 透明代理 | Fork Claude Code，作为 PTY Master 透明包裹，本地终端体验零感知 |
| WebSocket Server | 监听局域网 IP:8080，接受手机端连接 |
| 输出广播 | Claude Code 输出同时写入本地终端和所有 WS 客户端 |
| 输入合并 | 将本地键盘和手机端键入串行发给 Claude Code |
| 历史缓冲 | 内存中保留最近输出，手机中途加入时回放 |
| 配对认证 | 生成一次性 token，手机扫码后验证 |

#### Mobile App（手机端）

| 职责 | 说明 |
|------|------|
| 连接管理 | 扫二维码或手动输入 IP 连接 Desktop Agent |
| 终端渲染 | xterm.js (WebView) 渲染 ANSI 转义序列 |
| 输入发送 | 将键入内容通过 WebSocket 发给 Desktop Agent |
| 历史回放 | 连接后接收缓冲历史，显示已有对话 |

---

## 3. 功能规划

### 3.1 MVP（第一阶段）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 会话连接 | 扫描二维码或输入 URL 连接到电脑端 | P0 |
| 实时输出 | 查看 Claude Code 的终端输出流 | P0 |
| 发送输入 | 通过手机键盘向 Claude Code 发送文本 | P0 |
| 基础认证 | 通过 Token 或密码认证连接 | P0 |

### 3.2 第二阶段

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 推送通知 | Claude Code 等待输入时推送通知 | P1 |
| 多会话管理 | 在多个 Claude Code 实例间切换 | P1 |
| 历史记录 | 查看历史交互记录 | P1 |
| 审批流程 | 一键批准/拒绝 Claude Code 的操作请求 | P1 |

### 3.3 第三阶段

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 文件浏览 | 在手机上浏览电脑上的项目文件 | P2 |
| 语音输入 | 语音转文字发送指令 | P2 |
| 快捷指令 | 保存常用指令快速发送 | P2 |
| 多人协作 | 多个手机同时连接同一个会话 | P2 |

---

## 4. 技术选型

### 4.1 手机端 APP

| 技术 | 选型 | 理由 |
|------|------|------|
| 框架 | React Native + Expo | 跨平台、生态成熟、开发效率高 |
| 终端渲染 | xterm.js（WebView 内嵌） | 完整支持 ANSI 转义序列，生态最成熟 |
| 状态管理 | Zustand | 轻量、简洁 |
| 网络 | WebSocket（ws 原生 API） | 直连 Desktop Agent，无需 REST |

### 4.2 Desktop Agent（Mac 本地）

| 技术 | 选型 | 理由 |
|------|------|------|
| 运行时 | Node.js | 生态成熟，node-pty 官方支持 |
| PTY | node-pty | macOS/Linux 原生绑定，稳定 |
| WebSocket Server | ws 库 | 轻量，无框架依赖 |
| 打包 | esbuild + pkg | 单文件可执行，用户 `npm i -g` 即可 |
| 配对二维码 | qrcode | 终端内显示二维码，扫码连接 |

---

## 5. 通信协议

### 5.1 WebSocket 消息格式

```typescript
interface Message {
  type: MessageType;
  timestamp: number;
  payload: any;
}

enum MessageType {
  // PTY I/O
  PTY_OUTPUT = 'pty:output',         // Desktop → Mobile（ANSI 转义序列原始字节）
  PTY_INPUT  = 'pty:input',          // Mobile → Desktop（用户键入）
  PTY_RESIZE = 'pty:resize',         // Mobile → Desktop（终端窗口大小）

  // 连接握手
  AUTH_REQUEST  = 'auth:request',    // Mobile → Desktop（发送 token）
  AUTH_OK       = 'auth:ok',         // Desktop → Mobile（认证成功）
  AUTH_FAIL     = 'auth:fail',       // Desktop → Mobile（认证失败）

  // 状态同步
  STATE_SNAPSHOT = 'state:snapshot', // Desktop → Mobile（历史缓冲回放）

  // 控制
  CONTROL_SIGNAL = 'control:signal', // Mobile → Desktop（Ctrl+C 等信号）

  // 心跳
  PING = 'ping',
  PONG = 'pong',
}
```

### 5.2 连接与认证流程

Desktop Agent 启动时生成一个随机 `token`，显示在终端二维码中。手机扫码后携带 token 连接，Desktop Agent 验证通过即建立会话：

```
用户终端              Desktop Agent              手机 APP
  │                        │                        │
  │──$ agentphone─────────►│                        │
  │                        │ 生成随机 token          │
  │◄──显示 IP + 二维码──── │ 启动 WS Server :8080   │
  │   ws://192.168.1.5:8080│                        │
  │   token=xyz123         │                        │
  │                        │                        │
  │                        │◄──WS Connect──────────│
  │                        │◄──AUTH_REQUEST(token)─│
  │                        │   验证 token           │
  │                        │──AUTH_OK─────────────►│
  │                        │──STATE_SNAPSHOT───────►│（历史缓冲）
  │                        │                        │
  │──用户键入─────────────►│──PTY_OUTPUT───────────►│（实时同步）
  │◄──Claude 响应──────────│──PTY_OUTPUT───────────►│
  │                        │                        │
  │                        │◄──PTY_INPUT───────────│（手机端键入）
  │◄──Claude 响应──────────│──PTY_OUTPUT───────────►│
```

### 5.3 核心消息示例

```typescript
// PTY 输出（Desktop → Mobile）
{ type: 'pty:output', timestamp: 1721665893208,
  payload: { data: '\x1b[32mI understand.\x1b[0m\n' } }

// PTY 输入（Mobile → Desktop）
{ type: 'pty:input', timestamp: 1721665893210,
  payload: { data: 'help\n' } }

// 终端大小（Mobile → Desktop，手机横竖屏切换时发送）
{ type: 'pty:resize', timestamp: 1721665893211,
  payload: { cols: 80, rows: 24 } }

// 历史快照（Desktop → Mobile，连接成功后立即发送）
{ type: 'state:snapshot', timestamp: 1721665893212,
  payload: {
    history: '\x1b[1m> hello\x1b[0m\nHi! How can I help?\n...',  // 合并的历史输出
    cols: 120, rows: 30
  } }
```

### 5.4 安全设计

- token 随每次启动随机生成，一次性使用（手机断线重连需重新扫码或使用缓存 token）
- MVP 阶段：局域网内使用 `ws://`（明文），后续可升级为 `wss://`（自签名证书）
- token 不持久化，Desktop Agent 重启即失效
- 输入冲突：本地终端和手机端的输入均串行写入 PTY，先到先处理，互不干扰

---

## 6. 项目结构

```
AgentPhone/
├── apps/
│   ├── mobile/              # React Native 手机端应用
│   │   ├── src/
│   │   │   ├── screens/     # 页面：连接页、终端页
│   │   │   ├── components/  # Terminal 组件（xterm.js WebView）
│   │   │   ├── store/       # Zustand 状态
│   │   │   └── services/    # WebSocket 客户端
│   │   └── package.json
│   └── desktop-agent/       # Mac 端 PTY 透明代理
│       ├── src/
│       │   ├── pty.ts        # PTY Master/Slave + Claude Code 进程管理
│       │   ├── server.ts     # WebSocket Server
│       │   ├── session.ts    # 会话管理（历史缓冲、客户端列表）
│       │   └── qrcode.ts     # 终端二维码生成
│       └── package.json
├── packages/
│   └── protocol/            # 共享 TypeScript 类型（消息格式）
│       └── src/
│           └── messages.ts
├── docs/
│   └── decisions/           # 架构决策记录 (ADR)
├── DESIGN.md
├── AGENTS.md
└── package.json             # pnpm workspace 根配置
```

---

## 7. 开发路线图

### Phase 1：MVP 核心连通（目标：3周）
- [ ] 搭建 pnpm monorepo 项目结构
- [ ] Desktop Agent：PTY 透明代理 + WebSocket Server
- [ ] Desktop Agent：终端内显示 IP + 二维码
- [ ] Mobile APP：扫码连接 + xterm.js 终端渲染
- [ ] Mobile APP：键盘输入发送
- [ ] 端到端验证：手机查看输出 + 手机发送指令

### Phase 2：稳定性与体验（目标：2周）
- [ ] 断线自动重连
- [ ] 手机中途加入的历史回放
- [ ] Ctrl+C / 信号转发
- [ ] 手机横竖屏切换时 PTY resize 同步
- [ ] 连接状态指示（已连接/断开/重连中）

### Phase 3：远程访问（后续）
- [ ] 引入 Broker 支持手机不在同一 WiFi 下远程访问
- [ ] 推送通知（Claude Code 等待输入时提醒）
- [ ] Windows 支持

---

## 8. 已决策事项

| 事项 | 决策 | ADR |
|------|------|-----|
| MVP 是否需要 Broker | 否，先做局域网直连 | ADR-001 |
| Windows 支持 | MVP 不支持，仅 macOS/Linux | — |

---

## 变更历史

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-07-22 | v0.1.0 | 初始设计文档 | Manager Agent |
| 2026-07-22 | v0.2.0 | 重构核心架构为 PTY 透明代理模式；细化通信协议和认证流程 | Manager Agent |
| 2026-07-22 | v0.3.0 | 根据 ADR-001 移除 Broker，简化为两层局域网直连架构；更新技术选型、协议、项目结构和路线图 | Manager Agent |
