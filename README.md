# copyDsh — DeepSeek Harness 插件

DeepSeek Harness（DSH）的个人插件合集。目前包含一个插件：**选中引用快捷键**。

在页面上选中一段文字，按下快捷键就把这段文字作为引用插入当前会话的输入框，和 Cursor 的「Add to Chat」一致。

## 安装

### 方式一：插件市场

1. 打开「插件」页面，进入「发现」，点击「索引源」。
2. 填入索引地址：

   ```text
   https://cdn.jsdelivr.net/gh/wenxint/copyDsh@main/index.json
   ```

   jsDelivr 访问不了时改用：

   ```text
   https://raw.githubusercontent.com/wenxint/copyDsh/main/index.json
   ```

3. 返回发现页，找到「选中引用快捷键」并安装。
4. 重启 DeepSeek Harness。

`https://github.com/wenxint/copyDsh` 是仓库地址，不是索引地址，直接填不会出现插件。

### 方式二：本地目录

在「插件」页面点「添加插件」，选择本仓库的 `bundle` 目录。

当前插件要求 DeepSeek Harness `>=0.2.1-rc.5 <0.3.0`。

## 选中引用快捷键

### 功能

- 页面任意位置选中文字（对话正文、右侧工作区的文件/代码预览、侧栏文档、同源 iframe 预览），按 `⌘L` 直接插入输入框。
- 插入的是输入框自己的引用块，消息发出后是 Markdown 引用；和划词后点「引用」的效果相同。
- 快捷键可在「设置 → 快捷键」里改写或清空，命令名是「将选中文字引用到输入框」。
- 送出消息时不会顺带清掉草稿里已有的其他内容；插入失败时输入框上会给出原因。
- 诊断：页面里 `window.__dshQuoteShortcut` 为 `ready` 表示插件已加载；`window.__dshQuoteShortcutLast` 记录最后一次触发的结果。

### 默认按键

| 环境 | 按键 |
| --- | --- |
| 桌面版 macOS / Windows / Linux | `⌘L` / `Ctrl+L` |
| 网页版 | `⌥⌘L` / `Ctrl+Alt+L`（避开浏览器地址栏） |

### 行为细节

| 情况 | 结果 |
| --- | --- |
| 选中正文/代码块/工作区文件 → `⌘L` | 引用插入输入框并聚焦，选区保留 |
| 没选中 / 只选了空白 | 不插入，也不拦截这次按键 |
| 选区在输入框内部 | 忽略，避免把草稿引用给自己 |
| 输入框正在发送/裁决 | 不插入，输入框上提示原因 |
| 当前没有可输入的会话 | 不插入，输入框上提示原因 |
| 焦点在终端 | 不拦截，保留终端自己的 `Ctrl+L` |

同一次按键由两条通道共同保障：可配置的快捷键命令（桌面端经原生键盘桥转发），以及 document 上按当前绑定匹配的 keydown 监听。两者用 400ms 冷却去重，不会插入两次；快捷键注册被拒时直连通道仍可用。

### 已知限制

- 只处理当前页面自身的选区，以及同源 iframe（HTML 预览）里的选区；右侧「浏览器」标签页是独立 guest（webview），跨域 iframe 同样读不到。
- 选区取自页面 DOM 文本，不保留原文档的格式或行号。
- 插入依赖输入框处于可编辑状态；正在发送、命令裁决期间会拒绝并提示。

## 目录

```text
index.json          插件市场索引（发现页的索引地址指向它）
bundle/             可安装的插件包（DSH bundle）
  package.json      bundle 清单：Host 插件入口 + Client 浏览器模块
  index.js          Host 侧空实现，只为让 Client 模块参与组合
  client.js         浏览器侧：快捷键命令、读选区、写入输入框
  cordis.patch.yml  插入插件行
  locale/           插件页的标题与说明
  icon.svg          插件图标
```
