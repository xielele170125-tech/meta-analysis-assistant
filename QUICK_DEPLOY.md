# 🚀 5分钟快速部署到Vercel

## 前提条件

- GitHub账号
- Vercel账号（可用GitHub登录）
- Supabase项目（数据库）

---

## 第一步：推送代码到GitHub

```bash
# 如果还没有初始化Git
git init

# 添加远程仓库
git remote add origin https://github.com/你的用户名/meta-analysis-assistant.git

# 添加所有文件
git add .

# 提交
git commit -m "feat: Meta Analysis Assistant"

# 推送
git push -u origin main
```

---

## 第二步：在Vercel导入项目

1. 访问 **https://vercel.com/new**
2. 点击 **"Import Git Repository"**
3. 选择你的GitHub仓库
4. 点击 **"Import"**

---

## 第三步：配置环境变量

在导入页面的 "Environment Variables" 区域添加：

| 变量名 | 值 |
|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | 你的Supabase项目URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的Supabase匿名密钥 |
| `DEEPSEEK_API_KEY` | 你的DeepSeek API密钥（可选） |

**获取Supabase密钥**：
1. 登录 https://supabase.com
2. 进入你的项目 → Settings → API
3. 复制 `URL` 和 `anon public` 密钥

---

## 第四步：点击Deploy

点击 **"Deploy"** 按钮，等待2-5分钟部署完成。

---

## 第五步：访问你的应用

部署成功后，Vercel会提供一个URL：
```
https://meta-analysis-assistant.vercel.app
```

点击访问即可！

---

## 常见问题

### Q: 部署失败？
检查环境变量是否正确配置，特别是Supabase的URL和密钥。

### Q: 页面加载空白？
检查浏览器控制台是否有错误，确认环境变量已正确设置。

### Q: API调用失败？
检查Vercel函数日志（项目 → Functions → Logs），查看具体错误信息。

---

## 下一步

1. **配置自定义域名**（可选）
2. **设置Coze Bot**，引导用户到你的Web应用
3. **配置支付系统**（如需付费功能）

---

**详细文档**：查看 `VERCEL_DEPLOYMENT.md`
