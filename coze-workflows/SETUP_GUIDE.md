# Coze 自动导入配置指南

## 第一步：获取 Coze API Key

### 方法1：从Coze平台获取（推荐）

1. 登录 [Coze平台](https://www.coze.cn)
2. 点击右上角头像 → 「API管理」
3. 点击「创建API Key」
4. 复制生成的API Key

### 方法2：使用个人访问令牌

1. 登录Coze平台
2. 进入「设置」→「开发者设置」
3. 创建Personal Access Token
4. 选择权限：`bot:write`, `workflow:write`

## 第二步：创建Bot并获取Bot ID

### 创建Bot

1. 在Coze平台点击「创建Bot」
2. 填写基本信息：
   - 名称：`文献Meta分析助手`
   - 简介：`专业的医学文献Meta分析AI助手`
   - 图标：选择医学/科研图标

3. 点击「确定」创建

### 获取Bot ID

方法1：从URL获取
```
创建Bot后，浏览器地址栏会显示：
https://www.coze.cn/bot/XXXXXXXXXX
                           ↑
                      这就是Bot ID
```

方法2：从API获取
```bash
curl -X GET "https://api.coze.cn/v1/bots" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 第三步：配置环境变量

在终端执行以下命令：

```bash
# 设置API Key
export COZE_API_KEY=pat_xxxxxxxxxxxxxxxx

# 或者添加到配置文件（永久保存）
echo 'export COZE_API_KEY=pat_xxxxxxxxxxxxxxxx' >> ~/.bashrc
source ~/.bashrc
```

## 第四步：执行导入

```bash
cd coze-workflows/scripts

# 执行导入（替换YOUR_BOT_ID为实际的Bot ID）
node convert-to-coze-format.js --import --bot-id YOUR_BOT_ID
```

## 验证导入结果

导入成功后，在Coze平台：

1. 进入Bot配置页
2. 点击「工作流」标签
3. 查看5个工作流是否都已创建：
   - ✅ 文献检索式生成
   - ✅ 文献AI初筛
   - ✅ 文献数据提取
   - ✅ 文献质量评估
   - ✅ Meta分析计算

## 故障排除

### 错误：401 Unauthorized
- 检查API Key是否正确
- 确认API Key有Bot和Workflow的写入权限

### 错误：404 Not Found
- 检查Bot ID是否正确
- 确认Bot已创建

### 错误：429 Too Many Requests
- API调用频率超限
- 等待1分钟后重试

## 手动导入方案

如果自动导入失败，可以手动创建：

1. 查看工作流配置：
```bash
node convert-to-coze-format.js --preview
```

2. 生成手动配置文档：
```bash
node convert-to-coze-format.js --manual
```

3. 按照生成的 `MANUAL_CONFIG.md` 文档手动创建工作流

## 配置完成后

1. **测试工作流**
   - 在Coze平台点击「测试」
   - 输入测试数据验证功能

2. **配置模型**
   - 建议配置DeepSeek模型以获得更好的医学推理能力
   - API地址：`https://api.deepseek.com/v1`

3. **发布Bot**
   - 点击「发布」
   - 选择发布平台（商店/飞书/微信等）

4. **设置变现**
   - 在发布配置中设置付费模式
   - 参考bot-config.json中的定价策略

---

## 快速开始（一键执行）

如果您已有API Key和Bot ID，直接执行：

```bash
# 设置变量
export COZE_API_KEY=your_api_key_here
BOT_ID=your_bot_id_here

# 执行导入
cd coze-workflows/scripts
node convert-to-coze-format.js --import --bot-id $BOT_ID
```
