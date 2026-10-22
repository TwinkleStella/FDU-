# 学科资料库 · 复旦经院学术科创中心

部门内部的学术资料共享网站：课程资料 / 实习面试 / 职业考试 / 比赛资料。
手机、电脑都能用，可以「添加到主屏幕」当 App 用，国内不需要 VPN。

- **网站本体**：放在 GitHub Pages（免费）
- **登录、数据库、文件存储**：Supabase（免费版即可起步）

---

## 一、第一次部署（约 10 分钟，只做一次）

### 1. 注册 Supabase 并建项目
1. 打开 <https://supabase.com>，点 **Start your project**，用 GitHub 账号登录
2. **New project**
   - Name：随意，如 `fdse-hub`
   - Database Password：点 Generate 生成一个，**保存好**
   - Region：选 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**，离上海近、速度快
3. 等 1–2 分钟项目创建完成

### 2. 建数据库（运行一段脚本）
1. 左侧菜单 **SQL Editor** → **New query**
2. 打开本仓库的 [`supabase/setup.sql`](supabase/setup.sql)，全选复制，粘贴进去，点 **Run**
3. 底部结果里会出现一行 **「部长邀请码」**（10 位字母数字）——**复制保存**，等下用它注册第一个账号，这个账号自动成为管理员

> 脚本可以重复运行，不会删数据。

### 3. 关掉邮箱验证 & 填网址
1. 左侧 **Authentication** → **Sign In / Providers**（旧版叫 Providers）→ **Email**
   - 保持 **Enable Email provider** 打开
   - 把 **Confirm email** 关掉 → Save
   （大家用学号登录，不需要收验证邮件）
2. **Authentication** → **URL Configuration**
   - **Site URL** 填你的网站地址，如 `https://你的用户名.github.io/仓库名/`
   - **Redirect URLs** 里也添加同一个地址（用于「忘记密码」邮件跳回网站）

### 4. 把 Supabase 连到网站
1. 左侧 **Project Settings**（齿轮）→ **API**（或 **Data API / API Keys**）
2. 复制两样东西：
   - **Project URL**（形如 `https://xxxx.supabase.co`）
   - **anon public** key（或新版的 **publishable** key，`sb_publishable_` 开头）
3. 回到 GitHub 仓库，打开 `config.js`，点右上角铅笔 ✏️ 编辑，填进去：
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi....",
   ```
   点 **Commit changes** 保存
   > 这个 key 本来就是公开的，放在网页里是安全的。**千万不要**填 `service_role` / `secret` key。

### 5. 打开 GitHub Pages
1. 仓库 **Settings** → **Pages**
2. Source 选 **Deploy from a branch**，Branch 选 **main**，文件夹 **/(root)** → Save
3. 等 1–2 分钟，页面顶部会显示网址：`https://你的用户名.github.io/仓库名/`

### 6. 注册部长账号
打开网址 → **邀请码注册** → 填第 2 步拿到的部长邀请码、你的姓名、学号、密码 → 进入。
底部出现 **「管理」** 就说明你是管理员了。

---

## 二、日常使用

### 拉人进来（一人一码）
**管理 → 邀请码**：填对方 **姓名 + 学号** → 生成 → 点「复制邀请消息」发给 TA。
- 这个码 **只能被这个学号用一次**，转给别人也没用
- 可以设有效期；没用掉的码随时「作废」

### 成员怎么用
- 登录账号 = 学号，登录一次后 **一直保持登录**（不主动退出就不会掉）
- **课程资料**：只能在线预览，不能下载，画面铺满查看者的「姓名 + 学号 + 时间」水印
- **实习面试 / 职业考试 / 比赛资料**：可以预览和下载
- **上传**：课程资料只收 PDF 和图片（PPT / Word 先「另存为 PDF」，这样才能在线预览）；其它板块任意格式。超大文件（录屏、整套题库）选「网盘链接」，贴百度网盘 / 复旦网盘链接即可
- **忘记密码**：登录页点「忘记密码」，重置链接会发到 `学号@m.fudan.edu.cn` 复旦邮箱

### 添加到手机主屏幕（当 App 用）
- **iPhone**：用 Safari 打开网址 → 底部「分享」→「添加到主屏幕」（微信里打开的话先点右上角「在浏览器打开」）
- **安卓**：用 Chrome / 系统浏览器打开 → 右上角菜单 →「添加到主屏幕 / 安装应用」
- 桌面 App 第一次打开需要再登录一次

---

## 三、防外泄是怎么做的

| 风险 | 对策 |
|---|---|
| 有人没邀请码乱注册 | 没用邀请码的账号看不到任何资料 |
| 邀请码转卖给外人 | 码绑定学号，别人的学号用不了 |
| 把账号密码借/卖给别人 | 每个账号最多自动绑定 3 台设备（可在「设置」调），超出要部长批准；「设备审批」里能看到谁在加新设备 |
| 把课程资料下载转发 | 课程资料不提供下载按钮，文件只在页面里逐页画出来，不给原文件链接 |
| 截图、录屏外传 | 每一页都印着 **查看者本人** 的姓名学号，流出去一眼就知道是谁 |
| 批量搬运 | 「访问记录」里所有查看/下载都有记录，24 小时超过 60 次会标红 |
| 发现泄露 | 「成员」里一键停用，立即失效 |

**要坦白的一点**：网页技术上无法 100% 阻止截图和录屏。这套设计的思路是「让泄露一定能追到人」，从而让人不敢卖。

---

## 四、容量与费用

| | 免费版 | Pro（$25/月） |
|---|---|---|
| 文件总容量 | 1 GB | 100 GB（可再加） |
| 单个文件 | 50 MB | 可调到 5 GB+ |
| 数据库 | 500 MB（存几万条资料没问题） | 8 GB |

- 「管理」页顶部会显示已用空间
- 不够用时：Supabase 升级 Pro 后，把 `config.js` 里的 `MAX_UPLOAD_MB` 和 `STORAGE_QUOTA_GB` 改大，并在 Supabase **Storage → Settings** 里调大单文件上限
- 大文件优先用「网盘链接」，网站只做索引，这样实际上没有容量上限
- ⚠️ **免费版项目 7 天没人访问会自动暂停**。正常使用不会遇到；寒暑假如果被暂停，登录 Supabase 后台点 **Restore** 即可，数据不会丢

---

## 五、换届交接（部长卸任时做这 3 件事）

1. **网站里**：让新部长先用邀请码注册 → **管理 → 成员** → 找到 TA → **移交部长**（输入对方姓名确认）。你会变回普通成员
2. **GitHub**：仓库 **Settings → General → 最底部 Transfer ownership**，转给新部长的 GitHub 账号（或在 **Collaborators** 里加 TA 为协作者）
   - 注意：转移后网址会变成 `新用户名.github.io/仓库名`，需要在群里通知新网址，并改 Supabase 的 Site URL
3. **Supabase**：左上角组织 → **Team** → **Invite** 新部长邮箱，角色选 **Owner**；TA 接受后你可以退出组织

---

## 六、国内访问说明

- 网站和资料库都 **不需要 VPN**
- `github.io` 在国内个别网络下偶尔偏慢，一般刷新即可；如果长期不稳定，可以以后买一个域名绑定到 GitHub Pages（Settings → Pages → Custom domain）
- 所有 JS 组件都放在仓库自己的 `vendor/` 里，不依赖境外 CDN

---

## 七、文件说明

```
index.html            网站入口
app.js                全部功能逻辑
styles.css            样式
config.js             ← 唯一需要你改的配置文件
manifest.webmanifest  主屏幕 App 配置
sw.js                 离线缓存（更新网站后把里面的 VERSION 改一下）
icons/                App 图标
vendor/               supabase-js、pdf.js（本地化，不走 CDN）
supabase/setup.sql    数据库初始化脚本
```

想改板块或分类（比如给「职业考试」加一个「ACCA」）：编辑 `app.js` 顶部的 `SECTIONS`，加进 `cats` 数组即可。
