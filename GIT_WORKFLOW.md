协作开发时，可以先给ai设定约束边界：

你正在参与一个多人协作的网页产品项目。请严格遵守以下规则：

一、修改边界
1. 你只能修改我明确授权的文件和目录。
2. 如果任务需要改共享文件，先列出原因，不要直接修改。
3. 不要重命名、移动、删除不属于你模块的文件。

二、设计一致性
4. 必须复用现有设计系统：颜色、字体、圆角、阴影、间距、按钮样式保持统一。
5. 不允许私自引入新的视觉风格，不要做成 SaaS 后台风、AI 科技风、医疗宣传风。

三、任务边界
6. 一次只做当前模块的一件事，不要顺手做大范围重构。
7. 不要修改全局路由、共享类型、公共 mock 数据，除非这些文件在授权范围内。

四、验证与回报
8.每次作出改动前，都必须深思熟虑地plan，规划清楚，有任何不明确的点都要及时与我确认清楚
9. 改动完成后至少保证 build 通过。
10. 输出时必须说明：改了哪些文件、实现了什么、有没有潜在影响。
11. 如果发现现有结构和任务冲突，不要自己重定规则，先指出冲突。

协作开发流程，共有两个分支，main和dev，main作为测试过的成熟上线的分支，dev作为开发分支，平常主要在dev上开发。

每次想去开发时：
# 同步dev分支
git switch dev
git pull --rebase origin dev

# 新个人分支，基于dev
git switch -c tzc_fix_bug（分支名字）
# 如果分支已存在可用：git switch tzc_fix_bug

在本地开发完成后。。。。本地的代码有了更新

# 开发提交
git add .
git commit -m "修复前端的一些bug（提交说明）"
git push -u origin tzc_fix_bug

# 合并到dev中
git switch dev
git pull origin dev
git merge tzc_fix_bug

# 更新dev分支到github仓库中
git push origin dev








# Git Workflow Notes（完整版）

## 1. 进入项目目录

```powershell
cd "。。。。。。"
```

## 2. 初始化仓库

如果当前目录还没有初始化 Git：

```powershell
git init
```

## 3. 查看当前状态

```powershell
git status
```

## 4. 添加并提交代码

```powershell
git add .
git commit -m "本次提交的版本说明"
```

## 5. 配置远程仓库

查看当前远程：

```powershell
git remote -v
```

添加远程仓库：

```powershell
git remote add origin https://github.com/tzcinhust/Kinloop.git
```

如果远程已经存在，更新地址：

```powershell
git remote set-url origin https://github.com/tzcinhust/Kinloop.git
```

## 6. 首次推送到 main

把本地分支设为 `main`：

```powershell
git branch -M main
```

如果远程 `main` 已经有内容，先拉取并 rebase：

```powershell
git pull --rebase origin main
```

然后推送：

```powershell
git push -u origin main
```

## 7. 如果 push 提示远程有内容

常见报错：

```text
! [rejected] main -> main (fetch first)
```

处理方式：

```powershell
git pull --rebase origin main
git push -u origin main
```

如果 `pull --rebase` 过程中出现冲突，先查看状态：

```powershell
git status
```

处理完冲突后继续：

```powershell
git add .
git rebase --continue
git push -u origin main
```

## 8. 推荐协作方式：main + dev

- `main`：稳定、可展示版本
- `dev`：日常开发主分支

### 8.1 从 main 创建 dev

```powershell
git pull --rebase origin main
git checkout -b dev
git push -u origin dev
```

### 8.2 以后你主要在 dev 上开发

切到 `dev`：

```powershell
git checkout dev
```

拉最新：

```powershell
git pull --rebase origin dev
```

提交并推送：

```powershell
git add .
git commit -m "本次提交版本说明"
git push origin dev
```

## 9. 加入协作推荐流程

### 9.1 克隆仓库

```powershell
git clone https://github.com/tzcinhust/Kinloop.git
cd Kinloop
```

### 9.2 切到 dev

```powershell
git checkout dev
```

### 9.3 从 dev 新建自己的功能分支

```powershell
git checkout -b feature/family-home
```

或者：

```powershell
git checkout -b feature/elder-home
```

### 9.4 提交并推送自己的分支

```powershell
git add .
git commit -m "一些说明"
git push -u origin feature/family-home
```

## 10. 查看当前分支

```powershell
git branch
```

## 11. 查看提交历史

```powershell
git log --oneline --decorate --graph -20
```
