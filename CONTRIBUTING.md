# Contributing to LLMChat

感谢你对 LLMChat 的贡献！

## 开发环境

```bash
# 克隆仓库
git clone https://github.com/your-username/LLMChat.git
cd LLMChat

# 安装依赖
npm install

# 启动开发模式
./start.sh
```

## 提交 Issue

- **Bug 报告**：请描述复现步骤、期望行为、实际行为，附上截图或日志
- **功能请求**：描述使用场景和期望效果

## 提交 Pull Request

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/your-feature`
3. 提交前确认 TS 编译通过：`npx tsc -b --noEmit`
4. 提交代码并推送：`git push origin feat/your-feature`
5. 创建 Pull Request，描述改动内容和测试方法

## 代码规范

- 所有类型/接口导入必须使用 `import type`（项目开启了 `verbatimModuleSyntax`）
- 新增数据库字段必须通过新的 migration version，不能修改已有 SQL
- 保持组件职责单一，避免在单个文件中堆积过多逻辑

## 目录结构

```
src/
  components/chat/      # 聊天相关组件
  components/settings/  # 设置页面
  components/logs/      # 日志查看器
  stores/               # Zustand 状态
  lib/                  # API、DB、Logger 工具
  types/                # 核心类型定义
src-tauri/
  src/lib.rs            # Tauri 初始化 + SQLite migrations
```
