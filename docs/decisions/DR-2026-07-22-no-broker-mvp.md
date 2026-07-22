# ADR-001：MVP 阶段不使用 Broker，采用局域网直连

**日期**：2026-07-22  
**状态**：已批准  
**决策者**：用户 + Manager Agent

## 背景

系统需要在手机和电脑之间建立 WebSocket 连接。原始设计包含一个公网 Broker 服务作为中继，以支持手机在任意网络下连接到家里/公司的 Mac。

## 决策

MVP 阶段不实现 Broker，采用**局域网直连**模式：手机和 Mac 在同一 WiFi 下，手机直接连接 Mac 的局域网 IP。

## 理由

- 大幅简化架构：去掉整个 Broker 层，从三层变为两层
- 去掉云服务依赖：无需部署服务器、无需考虑数据出境
- 快速验证核心价值：PTY 透明代理 + 手机终端渲染，这才是最难的部分
- 局域网延迟更低：直连比经过 Broker 中转延迟更小

## MVP 简化后的架构

```
手机 APP ──WebSocket──► Desktop Agent ──PTY──► Claude Code 进程
         (局域网直连)
```

## 后续

Broker 不是废弃，而是延后。Phase 2 再加，设计上预留扩展点（Desktop Agent 的 WebSocket 服务端接口不变，后续加 Broker 只需在外面套一层路由）。
