# 🚀 Coze 工作流快速导入教程

## 📋 准备工作

### 方式一：自动导入（推荐）

#### 步骤1：获取 Coze API Key

1. **登录 Coze 平台**
   - 访问：https://www.coze.cn
   - 使用抖音/飞书账号登录

2. **进入 API 管理页面**
   - 点击右上角头像
   - 选择「API管理」或「开发者设置」

3. **创建 API Key**
   - 点击「创建API Key」按钮
   - 复制生成的API Key（格式通常为：`pat_xxxxxxxxxxxxx`）
   
   ![获取API Key](https://p3-hera.feishucdn.com/tos-cn-i-jbbdkfciu3/8b8e8e8e-8e8e-8e8e-8e8e-8e8e8e8e8e8e~tplv-jbbdkfciu3-image.png)

#### 步骤2：创建 Bot 并获取 ID

**选项A：创建新Bot**

1. 点击「创建Bot」
2. 填写信息：
   ```
   名称：文献Meta分析助手
   简介：专业的医学文献Meta分析AI助手
   ```
3. 点击「确定」
4. 从浏览器地址栏获取Bot ID：
   ```
   https://www.coze.cn/bot/7123456789012
                           ↑↑↑↑↑↑↑↑↑↑↑↑
                           这就是Bot ID
   ```

**选项B：使用现有Bot**

1. 进入「我的Bot」页面
2. 选择要使用的Bot
3. 从URL中获取Bot ID

#### 步骤3：配置并导入

1. **编辑配置文件**
   ```bash
   cd coze-workflows
   # 编辑 import-config.env 文件
   ```

2. **填写信息**（用您的实际信息替换）：
   ```env
   # 填写您的API Key
   COZE_API_KEY=pat_abc123def456ghi789
   
   # 填写您的Bot ID
   BOT_ID=7123456789012
   
   # 其他选项保持默认
   CREATE_NEW_BOT=false
   ```

3. **运行导入脚本**
   ```bash
   cd scripts
   node quick-import.js
   ```

4. **等待导入完成**
   
   您将看到类似输出：
   ```
   ✅ API Key验证成功！
   
   开始导入工作流...
   
   ✅ 文献检索式生成
   ✅ 文献AI初筛
   ✅ 文献数据提取
   ✅ 文献质量评估
   ✅ Meta分析计算
   
   成功: 5/5
   
   🎉 导入完成！
   ```

---

### 方式二：手动创建（备用方案）

如果自动导入失败，可以手动创建工作流：

#### 1. 生成手动配置文档

```bash
cd coze-workflows/scripts
node convert-to-coze-format.js --manual
```

这将生成 `MANUAL_CONFIG.md` 文件，包含每个工作流的详细配置。

#### 2. 在 Coze 平台手动创建

以「检索式生成」工作流为例：

**a. 创建工作流**
- 进入Bot配置页 → 工作流 → 创建工作流
- 名称：`search_query_generation`

**b. 添加开始节点**
- 输入变量1：
  - 名称：`research_question`
  - 类型：String
  - 描述：研究问题
  - 必填：是

- 输入变量2：
  - 名称：`search_strategy`
  - 类型：String
  - 默认值：`precise`
  - 描述：检索策略（precise/sensitive/limited）

**c. 添加LLM节点**
- 模型：选择扣子内置模型或配置的DeepSeek
- Temperature：0.3
- System Prompt：（从 `MANUAL_CONFIG.md` 复制）
- User Prompt：（从 `MANUAL_CONFIG.md` 复制）

**d. 添加代码节点**
- 语言：JavaScript
- 代码：（从 `MANUAL_CONFIG.md` 复制）

**e. 添加结束节点**
- 输出变量：result, markdown

**f. 连接节点**
```
开始 → LLM → 代码 → 结束
```

**g. 测试工作流**
- 点击「测试」
- 输入测试数据
- 查看输出结果

---

## ✅ 验证导入结果

### 在 Coze 平台检查

1. 进入Bot配置页
2. 点击「工作流」标签
3. 确认5个工作流都已创建：

| 工作流名称 | 功能 | 状态 |
|-----------|------|------|
| 文献检索式生成 | 生成多数据库检索式 | ✅ |
| 文献AI初筛 | AI筛选相关文献 | ✅ |
| 文献数据提取 | 提取结构化数据 | ✅ |
| 文献质量评估 | RoB 2.0/NOS评分 | ✅ |
| Meta分析计算 | 固定/随机效应模型 | ✅ |

### 测试工作流

**测试检索式生成：**
```json
{
  "research_question": "PGT对IVF结局的影响",
  "search_strategy": "precise"
}
```

预期输出：
```markdown
# 文献检索式生成结果

## 研究框架
类型：PICO

## 检索式
### PubMed
("Preimplantation Genetic Testing"[MeSH] OR "PGT"[TIAB])
AND ("In Vitro Fertilization"[MeSH] OR "IVF"[TIAB])
...
```

---

## 🔧 配置 Bot 人设

### 复制人设配置

打开 `bot-config.json`，复制 `personality` 部分：

```json
{
  "name": "Meta分析专家",
  "role": "你是一位专业的循证医学研究助手...",
  "capabilities": [...],
  "workflow": [...],
  "communication_style": [...]
}
```

### 粘贴到 Coze

1. 进入Bot配置页 → 人设与回复逻辑
2. 粘贴人设内容
3. 点击「保存」

---

## 🎨 后续配置

### 1. 配置 DeepSeek 模型（推荐）

1. 进入Bot配置页 → 模型配置
2. 添加自定义模型：
   ```
   API地址：https://api.deepseek.com/v1
   API Key：your_deepseek_api_key
   模型名称：deepseek-chat
   ```
3. 设置为默认模型

### 2. 连接数据库（可选）

使用 Coze 的 HTTP Request 插件连接 Supabase：

1. 添加「HTTP Request」插件
2. 配置 Supabase API：
   ```
   URL：https://xxx.supabase.co/rest/v1/xxx
   Headers：{
     "apikey": "your-anon-key",
     "Content-Type": "application/json"
   }
   ```

### 3. 发布 Bot

1. 点击「发布」按钮
2. 选择发布平台：
   - ✅ Coze商店（公开）
   - ✅ 飞书机器人（团队）
   - ✅ 微信公众号（大众）
   - ✅ 企业微信（企业）

### 4. 设置变现模式

参考 `bot-config.json` 中的定价：

```json
{
  "free": {
    "daily_limit": 10
  },
  "pro": {
    "price": 99,
    "period": "month"
  },
  "enterprise": {
    "price": "contact"
  }
}
```

---

## 🆘 常见问题

### Q1: API Key 验证失败
**A:** 
- 确认API Key格式正确（以 `pat_` 开头）
- 检查API Key是否有Bot和Workflow的写入权限
- 尝试重新生成API Key

### Q2: 导入失败
**A:**
- 检查网络连接
- 确认Bot ID正确
- 查看 `import-config.env` 配置
- 尝试手动导入方式

### Q3: 工作流运行错误
**A:**
- 检查节点连接是否正确
- 验证输入参数格式
- 查看运行日志定位问题
- 参考原始代码调整配置

### Q4: 模型调用失败
**A:**
- 确认已配置可用模型
- 检查模型API Key是否有效
- 尝试使用Coze内置模型

---

## 📞 获取帮助

- 📖 查看 [README.md](./README.md) 了解详细功能
- 🐛 遇到问题请检查 [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- 💬 在Coze社区寻求帮助：https://www.coze.cn/community

---

## 🎯 快速开始清单

- [ ] 1. 获取 Coze API Key
- [ ] 2. 创建 Bot 并获取 ID
- [ ] 3. 编辑 `import-config.env`
- [ ] 4. 运行 `node scripts/quick-import.js`
- [ ] 5. 验证工作流已导入
- [ ] 6. 配置 Bot 人设
- [ ] 7. 配置 DeepSeek 模型
- [ ] 8. 测试各功能
- [ ] 9. 发布 Bot
- [ ] 10. 设置变现模式

**准备好开始了吗？运行以下命令开始导入：**

```bash
# 1. 编辑配置文件
nano coze-workflows/import-config.env

# 2. 运行导入脚本
cd coze-workflows/scripts
node quick-import.js
```

祝您使用愉快！🎉
