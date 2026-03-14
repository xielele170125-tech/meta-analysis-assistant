# 推送代码到GitHub - 详细图文指南

## 📋 你需要先做的事

### 1. 确保你有GitHub账号
- 如果没有，访问 **https://github.com** 注册一个
- 记住你的用户名（比如：`zhangsan`）

### 2. 确保你有Git工具
- 已安装Git，可以在终端使用 `git` 命令

---

## 第一步：在GitHub网站创建仓库

### 1.1 登录GitHub
打开浏览器，访问 **https://github.com** 并登录

### 1.2 创建新仓库
1. 点击右上角的 **"+"** 号
2. 选择 **"New repository"**（新建仓库）

### 1.3 填写仓库信息
```
Repository name（仓库名称）: meta-analysis-assistant
Description（描述）: 文献Meta分析智能助手
Visibility（可见性）: ✅ Public（公开，可以部署到Vercel）
                   或 Private（私有，只有你能看到）

⚠️ 重要：不要勾选以下选项（因为本地已有代码）：
[ ] Add a README file
[ ] Add .gitignore
[ ] Choose a license
```

### 1.4 点击 "Create repository"

---

## 第二步：获取仓库地址

创建成功后，GitHub会显示一个页面，上面有仓库地址，类似：

```
https://github.com/你的用户名/meta-analysis-assistant.git
```

或者（如果你配置了SSH）：
```
git@github.com:你的用户名/meta-analysis-assistant.git
```

**复制这个地址**，后面要用！

---

## 第三步：在终端执行命令

打开终端，进入你的项目目录，然后按顺序执行：

### 3.1 添加远程仓库

```bash
# 替换成你的仓库地址
git remote add origin https://github.com/你的用户名/meta-analysis-assistant.git
```

### 3.2 检查远程仓库是否添加成功

```bash
git remote -v
```

应该显示类似：
```
origin  https://github.com/你的用户名/meta-analysis-assistant.git (fetch)
origin  https://github.com/你的用户名/meta-analysis-assistant.git (push)
```

### 3.3 推送代码到GitHub

```bash
git push -u origin main
```

---

## 📸 可能遇到的问题

### 问题1：提示 "fatal: 'origin' already exists"

**原因**：已经配置过远程仓库了

**解决**：
```bash
# 先删除旧的配置
git remote remove origin

# 重新添加
git remote add origin https://github.com/你的用户名/meta-analysis-assistant.git
```

---

### 问题2：提示需要登录GitHub

**解决方案A（推荐）**：使用GitHub CLI
```bash
# 安装GitHub CLI（如果没有）
# Mac: brew install gh
# Windows: winget install GitHub.cli
# Linux: sudo apt install gh

# 登录
gh auth login

# 然后再推送
git push -u origin main
```

**解决方案B**：使用Personal Access Token
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选 `repo` 权限
4. 点击 "Generate token"
5. 复制生成的token（类似：`ghp_xxxxxxxx`）
6. 推送时用token作为密码：
   ```
   Username: 你的GitHub用户名
   Password: ghp_xxxxxxxx（你的token）
   ```

**解决方案C**：使用SSH密钥
```bash
# 生成SSH密钥
ssh-keygen -t ed25519 -C "你的邮箱@example.com"

# 查看公钥
cat ~/.ssh/id_ed25519.pub

# 复制公钥，添加到GitHub：
# Settings → SSH and GPG keys → New SSH key

# 使用SSH地址
git remote set-url origin git@github.com:你的用户名/meta-analysis-assistant.git

# 推送
git push -u origin main
```

---

### 问题3：提示 "fatal: couldn't find remote ref main"

**原因**：分支名称可能不对

**解决**：
```bash
# 查看当前分支
git branch

# 如果分支叫 master 而不是 main，重命名
git branch -M main

# 再推送
git push -u origin main
```

---

## ✅ 成功的标志

推送成功后，你会看到类似：
```
Enumerating objects: 1234, done.
Counting objects: 100% (1234/1234), done.
Delta compression using up to 8 threads
Compressing objects: 100% (789/789), done.
Writing objects: 100% (1234/1234), 2.5 MiB | 1.2 MiB/s, done.
Total 1234 (delta 456), reused 1200 (delta 400), pack-reused 0
remote: Resolving deltas: 100% (456/456), done.
To https://github.com/你的用户名/meta-analysis-assistant.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

然后刷新GitHub页面，你应该能看到你的代码了！

---

## 🎯 完整操作命令（复制粘贴）

```bash
# 1. 进入项目目录（如果还没进入）
cd /workspace/projects

# 2. 添加远程仓库（替换成你的地址）
git remote add origin https://github.com/你的用户名/meta-analysis-assistant.git

# 3. 推送代码
git push -u origin main
```

---

## 📌 推送后下一步

代码推送到GitHub后，就可以部署到Vercel了：

1. 访问 **https://vercel.com/new**
2. 点击 **"Import Git Repository"**
3. 选择你刚创建的仓库
4. 配置环境变量
5. 点击 **Deploy**

---

## 🆘 还是不明白？

如果你告诉我：
1. 你的GitHub用户名是什么？
2. 你想用什么仓库名？

我可以帮你生成**可以直接复制粘贴的完整命令**！
