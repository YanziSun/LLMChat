# LLMChat

一个 macOS 桌面 AI 聊天客户端，支持多模型对话、分支树结构和图片/文件上传。

![LLMChat](https://img.shields.io/badge/platform-macOS-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Tauri](https://img.shields.io/badge/Tauri-2.x-orange) ![Release](https://img.shields.io/github/v/release/YanziSun/LLMChat)

## 下载

**[⬇ 下载 LLMChat v0.1.0（macOS Apple Silicon）](https://github.com/YanziSun/LLMChat/releases/download/v0.1.0/LLMChat_0.1.0_aarch64.dmg)**

> 首次打开提示"无法打开"或"应用已损坏"？运行以下命令即可：
> ```bash
> xattr -cr /Applications/LLMChat.app
> ```
> 或将 `.app` 拖入 `/Applications` 后右键 → 打开。

## 功能特性

- **单模型对话** — 流式输出，Markdown 渲染，代码高亮
- **Multi-Parallel** — 多模型并排同时回答，直观对比
- **Multi-Round-Robin** — 多模型轮流对话，模型之间互相看到对方回复
- **分支树** — 任意消息处 Fork 对话，自由切换分支
- **图片 / 文件上传** — 支持 Vision 模型，图片内联展示（点击放大）
- **自动标题** — 首次对话后自动生成对话标题
- **系统指令** — 全局指令 + 每个对话独立指令 + Round-Robin 每个参与者独立指令
- **日志查看器** — 侧边栏内置日志面板，支持 Error/Warn/Info 过滤
- **数据本地存储** — SQLite，数据完全在本地，不上传任何内容

## 截图

> 应用界面截图（TODO）

## 系统要求

- macOS 12+（Apple Silicon）
- 自行编译需要：[Node.js](https://nodejs.org/) 18+、[Rust](https://rustup.rs/) 1.70+

## 快速开始

### 直接安装（推荐）

1. [下载 DMG](https://github.com/YanziSun/LLMChat/releases/download/v0.1.0/LLMChat_0.1.0_aarch64.dmg)
2. 打开 DMG，将 `LLMChat.app` 拖入 `/Applications`
3. 首次打开若提示"无法验证"，在终端运行：
   ```bash
   xattr -cr /Applications/LLMChat.app
   ```
4. 在 **Settings** 中添加模型即可开始使用

### 从源码编译

#### 安装依赖

```bash
# 安装前端依赖
npm install

# 安装 Rust（如未安装）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 开发模式

```bash
./start.sh
```

或手动启动：

```bash
# 终端 1 — 前端
npm run dev

# 终端 2 — Tauri 后端
export PATH="$HOME/.cargo/bin:$PATH"
cd src-tauri && cargo run --no-default-features
```

### 打包发布

```bash
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.cargo/bin:$PATH"
CARGO_BUILD_JOBS=2 cargo tauri build
```

输出文件：`src-tauri/target/release/bundle/dmg/LLMChat_0.1.0_aarch64.dmg`

> 首次打开提示"应用已损坏"时：右键 → 打开，或运行 `xattr -cr "/Applications/LLMChat.app"`

## 配置模型

LLMChat 使用 **OpenAI 兼容格式** API，支持任何兼容的服务商：

- OpenAI（GPT-4, GPT-4o 等）
- Anthropic Claude（通过兼容代理）
- DeepSeek、通义千问、智谱 AI 等国内服务
- Ollama 本地模型（`http://localhost:11434/v1`）
- 任何 OpenAI 兼容接口

在应用内 **Settings → Add Model** 填入 Base URL、API Key 和 Model ID 即可。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | [Tauri 2.x](https://tauri.app/) (Rust) |
| 前端 | React + TypeScript + Vite |
| UI | TailwindCSS v3 |
| 状态管理 | Zustand |
| 数据库 | SQLite via tauri-plugin-sql |
| Markdown | react-markdown + rehype-highlight |

## 数据存储位置

```
~/Library/Application Support/com.llmchat.desktop/llmchat.db   # 对话数据
~/Library/Logs/com.llmchat.desktop/LLMChat.log                  # 应用日志
```

## 贡献

欢迎提交 Issue 和 Pull Request！请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

[MIT](LICENSE)
