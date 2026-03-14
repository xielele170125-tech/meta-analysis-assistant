# 方式一：命令行推送代码 - 超详细步骤

## 📋 整体流程

```
第1步：下载项目代码到你的电脑
第2步：安装Git（如果没有）
第3步：打开命令行
第4步：进入项目目录
第5步：登录GitHub
第6步：推送代码
```

---

## 第1步：下载项目代码到你的电脑

### 1.1 下载项目压缩包

我帮你把项目打包成zip文件，你可以下载。

### 1.2 解压到桌面

下载后，解压到你的桌面，文件夹应该叫 `projects`

---

## 第2步：检查/安装Git

### Windows用户

1. 打开命令提示符（按 `Win + R`，输入 `cmd`，回车）
2. 输入：`git --version`
3. 如果显示版本号（如 `git version 2.x.x`），说明已安装
4. 如果提示"不是内部或外部命令"，需要安装Git：
   - 访问 https://git-scm.com/download/win
   - 下载并安装（一直点"下一步"即可）
   - 安装完成后，**关闭并重新打开命令提示符**

### Mac用户

1. 打开终端（按 `Cmd + 空格`，输入 `Terminal`，回车）
2. 输入：`git --version`
3. 如果显示版本号，说明已安装
4. 如果提示安装，按提示安装Xcode Command Line Tools

---

## 第3步：打开命令行

### Windows

1. 按 `Win + R`
2. 输入 `cmd`
3. 按回车

### Mac

1. 按 `Cmd + 空格`
2. 输入 `Terminal`
3. 按回车

---

## 第4步：进入项目目录

### Windows（假设你解压到桌面）

```cmd
cd %USERPROFILE%\Desktop\projects
```

### Mac（假设你解压到桌面）

```bash
cd ~/Desktop/projects
```

**验证**：输入 `dir`（Windows）或 `ls`（Mac），应该能看到项目文件（如 `package.json`、`src` 文件夹等）

---

## 第5步：登录GitHub

### 5.1 配置你的GitHub信息

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的GitHub邮箱"
```

例如：
```bash
git config --global user.name "xielele170125-tech"
git config --global user.email "你的邮箱@example.com"
```

### 5.2 创建Personal Access Token（重要！）

GitHub现在不能用密码登录，必须用Token：

1. 打开浏览器，访问：https://github.com/settings/tokens
2. 点击 **"Generate new token"** → **"Generate new token (classic)"**
3. 填写：
   - **Note**：`meta-analysis-assistant`（随便写，备注用途）
   - **Expiration**：`No expiration`（不过期）或选一个时间
   - **Select scopes**：勾选 **`repo`**（第一个选项，会自动勾选下面所有repo相关的）
4. 点击页面底部的 **"Generate token"** 按钮
5. **复制生成的token**（类似 `ghp_XXXXXXXXXXXXXXXXXXXX`）
   - ⚠️ 只显示一次，务必复制保存！
   - 如果忘记了，需要重新生成

---

## 第6步：推送代码

### 6.1 初始化Git仓库（如果还没有）

```bash
git init
```

### 6.2 添加所有文件

```bash
git add .
```

### 6.3 创建第一次提交

```bash
git commit -m "Initial commit: Meta Analysis Assistant"
```

### 6.4 添加远程仓库

```bash
git remote add origin https://github.com/xielele170125-tech/meta-analysis-assistant.git
```

### 6.5 推送代码

```bash
git push -u origin main
```

**这时候会提示输入用户名和密码**：

```
Username: 输入你的GitHub用户名（如：xielele170125-tech），按回车
Password: 粘贴刚才生成的Token（ghp_开头的），按回车
         （注意：密码不会显示任何字符，这是正常的）
```

如果成功，你会看到：
```
Enumerating objects: XXXX, done.
Writing objects: 100% (XXXX/XXXX), done.
To https://github.com/xielele170125-tech/meta-analysis-assistant.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

---

## 📋 完整命令清单（复制粘贴）

```bash
# 进入项目目录（Windows）
cd %USERPROFILE%\Desktop\projects

# 或（Mac）
cd ~/Desktop/projects

# 初始化
git init

# 配置用户信息
git config --global user.name "xielele170125-tech"
git config --global user.email "你的邮箱@example.com"

# 添加文件
git add .

# 提交
git commit -m "Initial commit: Meta Analysis Assistant"

# 添加远程仓库
git remote add origin https://github.com/xielele170125-tech/meta-analysis-assistant.git

# 推送
git push -u origin main
```

---

## ⚠️ 常见问题

### Q1: 提示 "fatal: not a git repository"

**解决**：先执行 `git init`

### Q2: 提示 "fatal: remote origin already exists"

**解决**：执行 `git remote remove origin`，然后重新添加

### Q3: 推送时提示 "fatal: Authentication failed"

**解决**：Token可能输入错误或过期，重新生成一个Token

### Q4: 推送时提示 "fatal: 'main' not found"

**解决**：
```bash
# 查看当前分支名
git branch

# 如果是master，重命名为main
git branch -M main

# 再推送
git push -u origin main
```

---

## ✅ 推送成功后

1. 打开浏览器访问：https://github.com/xielele170125-tech/meta-analysis-assistant
2. 你应该能看到所有代码文件
3. 然后就可以去Vercel部署了！

---

## 📸 截图示例

### Token生成页面
```
Note: meta-analysis-assistant
Expiration: No expiration
☑ repo - Full control of private repositories
[Generate token]
```

### 推送成功
```
$ git push -u origin main
Enumerating objects: 1234, done.
Counting objects: 100% (1234/1234), done.
Writing objects: 100% (1234/1234), 2.5 MiB | 1.2 MiB/s, done.
To https://github.com/xielele170125-tech/meta-analysis-assistant.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

---

**如果还有不清楚的地方，随时问我！**
