# Vercel 部署指南

本文档提供完整的Vercel部署步骤，帮助你将Meta分析助手部署到云端。

---

## 📋 前提条件

### 1. 所需账号
- ✅ GitHub账号（用于代码托管）
- ✅ Vercel账号（可用GitHub登录）
- ✅ Supabase账号（数据库）
- ✅ S3兼容存储（对象存储，可选）

### 2. 所需环境变量
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase项目URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase匿名密钥
- `DEEPSEEK_API_KEY` - DeepSeek API密钥（可选，也可用Coze SDK内置）
- `AWS_ACCESS_KEY_ID` - S3存储访问密钥（可选）
- `AWS_SECRET_ACCESS_KEY` - S3存储密钥（可选）
- `AWS_REGION` - S3区域（可选）
- `S3_BUCKET_NAME` - S3桶名（可选）

---

## 🚀 部署步骤

### 方式一：通过Vercel CLI部署（推荐）

#### 第1步：安装Vercel CLI

```bash
npm install -g vercel
```

#### 第2步：登录Vercel

```bash
vercel login
```

#### 第3步：在项目根目录执行部署

```bash
vercel
```

首次部署会询问：
- Set up and deploy? → **Yes**
- Which scope? → 选择你的账号
- Link to existing project? → **No**
- Project name? → **meta-analysis-assistant** (或自定义)
- In which directory? → **./** (当前目录)
- Want to override settings? → **No**

#### 第4步：配置环境变量

方式A：通过Vercel Dashboard配置
1. 访问 https://vercel.com/dashboard
2. 进入你的项目 → Settings → Environment Variables
3. 添加以下变量：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DEEPSEEK_API_KEY=your_deepseek_api_key
```

方式B：通过命令行配置
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add DEEPSEEK_API_KEY
```

#### 第5步：重新部署

配置环境变量后，重新部署：
```bash
vercel --prod
```

---

### 方式二：通过GitHub自动部署（推荐长期维护）

#### 第1步：将代码推送到GitHub

```bash
# 初始化Git仓库（如果还没有）
git init

# 添加远程仓库
git remote add origin https://github.com/你的用户名/meta-analysis-assistant.git

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Meta Analysis Assistant"

# 推送到GitHub
git push -u origin main
```

#### 第2步：在Vercel导入项目

1. 访问 https://vercel.com/new
2. 点击 "Import Git Repository"
3. 选择你的GitHub仓库
4. 配置项目：
   - Framework Preset: **Next.js**
   - Root Directory: **./**
   - Build Command: **pnpm build** (或保持默认)
   - Output Directory: **.next** (或保持默认)

#### 第3步：配置环境变量

在Import页面或项目设置中添加环境变量（同方式一）

#### 第4步：点击Deploy

等待部署完成，通常需要2-5分钟

---

## ⚙️ 项目配置说明

### 已自动配置的内容

项目已包含以下Vercel兼容配置：

1. **package.json** - 已配置正确的构建脚本
2. **next.config.ts** - 已配置Next.js优化选项
3. **.coze** - 已配置部署脚本

### 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ 是 | Supabase项目URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ 是 | Supabase匿名密钥（公开安全） |
| `DEEPSEEK_API_KEY` | ⚠️ 推荐 | DeepSeek API密钥，也可使用Coze SDK |
| `AWS_ACCESS_KEY_ID` | 可选 | S3存储访问密钥 |
| `AWS_SECRET_ACCESS_KEY` | 可选 | S3存储密钥 |
| `AWS_REGION` | 可选 | S3区域，如`us-east-1` |
| `S3_BUCKET_NAME` | 可选 | S3桶名 |

---

## 🧪 部署后测试

部署成功后，访问Vercel提供的URL（如 `https://meta-analysis-assistant.vercel.app`）

### 测试清单

```
□ 首页正常加载
□ 文献上传功能正常
□ 数据提取功能正常
□ Meta分析功能正常
□ 质量评分功能正常
□ 导出功能正常
```

---

## 🔧 常见问题

### Q1: 构建失败 - "pnpm not found"

**解决方案**：Vercel会自动检测pnpm，如果失败，在项目根目录创建 `.npmrc`：

```ini
shamefully-hoist=true
strict-peer-dependencies=false
```

### Q2: 构建超时

**解决方案**：
1. 检查是否有循环依赖
2. 优化构建脚本
3. 在Vercel项目设置中增加构建超时时间

### Q3: 环境变量不生效

**解决方案**：
1. 确认变量名以`NEXT_PUBLIC_`开头（客户端变量）
2. 重新部署项目（环境变量修改后需重新部署）
3. 清除浏览器缓存

### Q4: API路由返回500错误

**解决方案**：
1. 检查Vercel函数日志（项目 → Functions → Logs）
2. 确认环境变量已正确配置
3. 检查数据库连接

### Q5: 数据库连接失败

**解决方案**：
1. 确认Supabase项目未暂停
2. 检查Supabase连接限制（免费版有限制）
3. 添加Vercel IP到Supabase白名单（通常不需要）

---

## 💰 Vercel费用说明

### 免费套餐（Hobby）
- ✅ 100GB带宽/月
- ✅ 无限次部署
- ✅ 自动HTTPS
- ✅ 自动CI/CD
- ⚠️ 函数执行时间限制10秒
- ⚠️ 静态页面无限制

### Pro套餐（$20/月）
- ✅ 1TB带宽/月
- ✅ 函数执行时间60秒
- ✅ 更多并发
- ✅ 团队协作

**建议**：初期使用免费套餐，流量增大后升级Pro

---

## 🔄 自动部署配置

### GitHub自动部署

连接GitHub后，每次push到main分支会自动部署：

```
git add .
git commit -m "Update features"
git push origin main
# 自动触发Vercel部署
```

### 预览部署

每个Pull Request会自动创建预览链接，方便测试：

```
https://meta-analysis-assistant-abc123.vercel.app
```

---

## 📊 监控与日志

### 查看部署日志
1. 进入项目 → Deployments
2. 点击具体部署记录
3. 查看 Building → Running 日志

### 查看运行日志
1. 进入项目 → Logs
2. 实时查看API请求日志

### 性能监控
1. 进入项目 → Analytics
2. 查看页面加载时间、访问量等

---

## 🔐 安全建议

1. **不要提交敏感信息**到Git仓库
2. **使用环境变量**存储API密钥
3. **启用Vercel的防护功能**（DDoS保护默认开启）
4. **配置CORS策略**（如需限制API访问）
5. **定期更新依赖**（Vercel会提示安全更新）

---

## 📝 部署后配置

### 自定义域名（可选）

1. 进入项目 → Settings → Domains
2. 添加你的域名（如 `meta-analysis.yourdomain.com`）
3. 按提示配置DNS记录
4. 等待SSL证书自动配置（通常几分钟）

### 性能优化

1. 启用Edge Functions（项目设置）
2. 配置缓存策略
3. 优化图片（使用Next.js Image组件）

---

## ✅ 部署成功检查

```
□ 访问 https://你的项目.vercel.app 正常
□ 首页加载速度 < 3秒
□ 所有API功能正常
□ 环境变量配置正确
□ 数据库连接正常
□ 无控制台错误
```

---

## 🆘 获取帮助

- Vercel文档：https://vercel.com/docs
- Vercel社区：https://github.com/vercel/vercel/discussions
- Next.js文档：https://nextjs.org/docs

---

**祝你部署成功！** 🎉
