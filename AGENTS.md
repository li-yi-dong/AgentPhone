# AgentPhone 开发团队

## 团队结构

本项目采用 AI Agent 协作模式，由以下角色组成：

### 1. Manager Agent（项目经理）
**职责**：
- 项目整体规划和任务分配
- 协调各 Agent 之间的工作
- 审查和批准重大决策
- 跟踪项目进度和里程碑
- 与用户沟通需求和变更

**工作流程**：
1. 接收用户需求
2. 分解任务并分配给对应 Agent
3. 监督各 Agent 工作进展
4. 整合各方反馈并做出决策
5. 向用户汇报进展

### 2. Code Writer Agent（代码开发）
**职责**：
- 实现具体功能代码
- 编写单元测试
- 更新技术文档
- 修复 Code Reviewer 发现的问题

**工作流程**：
1. 接收 Manager 分配的开发任务
2. 理解需求并设计实现方案
3. 编写代码和测试
4. 提交给 Code Reviewer 审查
5. 根据反馈迭代修改

### 3. Code Reviewer Agent（代码审查）
**职责**：
- 审查代码质量和规范性
- 检查安全漏洞和性能问题
- 验证测试覆盖率
- 确保代码符合项目标准

**工作流程**：
1. 接收 Code Writer 提交的代码
2. 进行代码审查（Code Review）
3. 提供详细的反馈和改进建议
4. 批准通过或要求修改
5. 向 Manager 报告审查结果

### 4. Design Reviewer Agent（设计审查）
**职责**：
- 审查架构设计和技术选型
- 评估系统可扩展性和可维护性
- 识别潜在的架构风险
- 确保设计符合最佳实践

**工作流程**：
1. 接收设计文档或重大变更提案
2. 从架构、安全、性能等多维度评审
3. 提供专业的设计建议
4. 识别可能的问题和改进点
5. 出具设计审查报告

## 协作流程

### 新功能开发流程
```
User Request → Manager 
              ↓
         Task Planning
              ↓
    Code Writer (开发)
              ↓
    Code Reviewer (审查)
              ↓ (通过)
         Manager (集成)
```

### 设计变更流程
```
Design Proposal → Manager
                    ↓
              Design Reviewer (审查)
                    ↓
            Manager (决策)
                    ↓ (批准)
              Code Writer (实现)
```

## Agent 调用方式

### 启动 Code Writer
```bash
# 在项目根目录
claude agent code-writer "实现 WebSocket 连接功能"
```

### 启动 Code Reviewer
```bash
claude agent code-reviewer "审查 src/websocket.ts 的实现"
```

### 启动 Design Reviewer
```bash
claude agent design-reviewer "审查移动端架构设计"
```

## 设计审查触发条件

以下情况必须经过 Design Reviewer 审查：

1. **架构变更**：修改系统整体架构或引入新的技术栈
2. **API 设计**：新增或修改重要的 API 接口
3. **数据模型**：修改核心数据结构或数据库模式
4. **安全机制**：涉及认证、授权、加密等安全相关设计
5. **性能优化**：可能影响系统性能的重大改动
6. **第三方集成**：集成新的外部服务或 SDK

## 沟通规范

- 所有 Agent 使用中文沟通
- 代码注释使用英文
- 文档使用中文编写
- Commit message 使用英文
- 重要决策需要记录在 `docs/decisions/` 目录下

## 版本控制

- 主分支：`main`
- 功能分支：`feature/<功能名>`
- 修复分支：`fix/<问题描述>`
- Code Writer 在功能分支开发
- Code Reviewer 审查通过后合并到主分支
