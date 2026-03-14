# 推送代码到GitHub - 最简操作指南

## 你的仓库地址
```
https://github.com/xielele170125-tech/meta-analysis-assistant.git
```

---

## 第1步：找到终端

### 如果你在Vercel/Coze开发环境中

你当前就在终端里！直接看第2步。

### 如果你在本地电脑

- **Windows**：按 `Win + R`，输入 `cmd`，回车
- **Mac**：按 `Cmd + 空格`，输入 `Terminal`，回车
- **VS Code**：按 `Ctrl + `` （反引号键）打开终端

---

## 第2步：进入项目目录

在终端输入：
```bash
cd /workspace/projects
```
然后按回车

---

## 第3步：复制粘贴以下命令（一行一行执行）

### 命令1：添加远程仓库
```bash
git remote add origin https://github.com/xielele170125-tech/meta-analysis-assistant.git
```
复制这行，粘贴到终端，按回车

### 命令2：推送代码
```bash
git push -u origin main
```
复制这行，粘贴到终端，按回车

---

## 如果提示需要登录

当你执行 `git push` 时，可能会提示输入用户名和密码：

```
Username: 输入你的GitHub用户名，按回车
Password: 输入你的GitHub密码或Token，按回车（密码不会显示）
```

### 如何获取Token？

如果密码不工作，需要用Token：

1. 访问 https://github.com/settings/tokens
2. 点击 **"Generate new token"** → **"Generate new token (classic)"**
3. 填写：
   - Note: `meta-analysis`（随便写）
   - Expiration: `No expiration`（不过期）
   - 勾选: `repo`（所有repo相关选项）
4. 点击 **"Generate token"**
5. 复制生成的token（类似 `ghp_xxxxxxxx`）
6. 在终端输入密码时，粘贴这个token

---

## 完整命令（可以直接复制）

```bash
cd /workspace/projects
git remote add origin https://github.com/xielele170125-tech/meta-analysis-assistant.git
git push -u origin main
```

---

## ✅ 成功的标志

你会看到类似这样的输出：
```
Enumerating objects: 1234, done.
Writing objects: 100% (1234/1234), done.
To https://github.com/xielele170125-tech/meta-analysis-assistant.git
 * [new branch]      main -> main
```

然后刷新你的GitHub页面，就能看到代码了！
