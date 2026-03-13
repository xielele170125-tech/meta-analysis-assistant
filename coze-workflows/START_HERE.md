# 🎯 立即开始 - 3步完成导入

## 📦 您已拥有的文件

```
coze-workflows/
├── 📄 工作流配置（5个）
│   ├── 01-search-query-generation.json    # 检索式生成
│   ├── 02-literature-screening.json       # 文献初筛
│   ├── 03-data-extraction.json            # 数据提取
│   ├── 04-quality-assessment.json         # 质量评估
│   └── 05-meta-analysis.json              # Meta分析
│
├── 📄 配置文件
│   ├── bot-config.json                    # Bot完整配置
│   └── import-config.env                  # 导入配置（需编辑）
│
├── 📄 使用指南
│   ├── IMPORT_TUTORIAL.md                 # ⭐ 详细教程（推荐先看）
│   ├── SETUP_GUIDE.md                     # 环境配置指南
│   ├── README.md                          # 功能说明
│   ├── MANUAL_CONFIG.md                   # 手动创建指南
│   └── PROMPTS.md                         # Prompt快速复制
│
└── 📜 导入脚本
    ├── quick-import.js                    # ⭐ 快速导入（推荐）
    ├── interactive-import.js              # 交互式导入
    └── convert-to-coze-format.js         # 格式转换工具
```

---

## 🚀 3步完成导入

### 第1步：获取API Key和Bot ID（5分钟）

**获取API Key：**
1. 登录 https://www.coze.cn
2. 右上角头像 → API管理
3. 复制您的API Key（格式：`pat_xxxxx`）

**获取Bot ID：**
1. 创建新Bot 或 选择现有Bot
2. 从URL获取Bot ID：
   ```
   https://www.coze.cn/bot/7123456789012
                           ↑↑↑↑↑↑↑↑↑↑↑↑
                           Bot ID
   ```

### 第2步：编辑配置文件（1分钟）

编辑 `import-config.env`：

```env
# 填写您的实际信息
COZE_API_KEY=pat_您的API_Key
BOT_ID=您的Bot_ID

# 其他选项保持默认
CREATE_NEW_BOT=false
```

### 第3步：执行导入（1分钟）

```bash
cd coze-workflows/scripts
node quick-import.js
```

**预期输出：**
```
✅ API Key验证成功！
✅ 文献检索式生成
✅ 文献AI初筛
✅ 文献数据提取
✅ 文献质量评估
✅ Meta分析计算

🎉 导入完成！
成功: 5/5
```

---

## 📖 详细教程

如果上述步骤遇到问题，请查看：

- **[IMPORT_TUTORIAL.md](./IMPORT_TUTORIAL.md)** - 完整图文教程
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - 环境配置详解
- **[MANUAL_CONFIG.md](./MANUAL_CONFIG.md)** - 手动创建方案

---

## ✅ 导入后必做

### 1. 配置Bot人设（2分钟）

复制 `bot-config.json` 中的 `personality` 部分到Coze平台

### 2. 配置DeepSeek模型（3分钟）

推荐使用DeepSeek获得更好的医学推理能力：
- API地址：`https://api.deepseek.com/v1`
- 需要您自己的DeepSeek API Key

### 3. 测试工作流（5分钟）

在Coze平台测试每个工作流功能

### 4. 发布Bot（2分钟）

选择发布平台：
- Coze商店（公开）
- 飞书机器人（团队）
- 微信公众号（大众）

### 5. 设置变现（5分钟）

参考 `bot-config.json` 设置付费模式：
- 免费版：每日10次
- 专业版：¥99/月
- 企业版：私有化部署

---

## 🎁 额外资源

- **[PROMPTS.md](./PROMPTS.md)** - 所有Prompt可快速复制
- **[README.md](./README.md)** - 功能详细说明
- **[bot-config.json](./bot-config.json)** - 完整Bot配置

---

## 💡 快速命令

```bash
# 查看工作流预览
cd coze-workflows/scripts
node convert-to-coze-format.js --preview

# 生成手动配置文档
node convert-to-coze-format.js --manual

# 生成Prompt文档
node generate-prompts.js

# 执行导入
node quick-import.js
```

---

## 🆘 需要帮助？

1. 查看 [IMPORT_TUTORIAL.md](./IMPORT_TUTORIAL.md) 详细教程
2. 检查 [SETUP_GUIDE.md](./SETUP_GUIDE.md) 环境配置
3. 参考 [MANUAL_CONFIG.md](./MANUAL_CONFIG.md) 手动方案

---

## ⏱️ 预计时间

- 首次配置：**10分钟**
- 熟练后：**3分钟**

---

**准备好开始了吗？**

```bash
# 1. 编辑配置
nano coze-workflows/import-config.env

# 2. 运行导入
cd coze-workflows/scripts
node quick-import.js
```

祝您使用愉快！🎉
