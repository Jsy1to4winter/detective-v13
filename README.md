# detective-v13 · V13.17 刑侦互动主页

保留交接包中的布局、原始样式、七张图片、默认背景音乐和烟雾视频。网页无需构建。

## 网站发布

GitHub 仓库 Settings → Pages → Source 选择 **Deploy from a branch**，Branch 选择 **main**，目录选择 **/(root)**，点击 Save。等待 Pages 部署完成，再使用 Pages 页面给出的正式地址。

发布后点击“编辑主页”，使用在 Supabase 创建的管理员邮箱和密码登录。访客可直接浏览，只有指定管理员能修改。密码仅输入网站登录表单，不写入代码或仓库。

## 云端存储

- 项目：`https://uzjvnbaspmnxmzdjwgtl.supabase.co`。
- 表：`detective_v13_page`，保存证词、标签和素材引用。
- 桶：`detective-v13-media`，保存新上传的照片、封面、卷宗图片及自定义音乐。
- `js/cloud.js` 只包含公开 Publishable key，不包含管理员密码或服务端密钥。
- `supabase/01-install.sql` 已由项目所有者执行成功；保留文件便于维护，无需再次执行。
- RLS 和列权限限制写入；所有访客可读公开资料，其他登录用户不能编辑。

默认素材仍随网页发布。单个新上传文件上限 50 MB，只上传准备公开展示的内容。音乐保留原有循环与首次交互解锁逻辑；浏览器可能阻止有声自动播放。

保存成功后才更新界面。多设备编辑使用 revision 防止覆盖；发生冲突时先复制未保存文字，再重新读取。文件上传后保存引用，再清理旧文件；网络错误导致保存结果不确定时，可能保留未引用文件，以免误删已经成功保存的文件。

## 原浏览器资料

旧版 localStorage/IndexedDB 不会自动发布。管理员可在编辑页选择“迁移本浏览器旧资料到云端”；确认后替换云端同名项目，保留本地原件。迁移失败时会说明部分项目可能已经完成。

只有相同网址、相同浏览器下的原本地数据可直接读取；换网址、端口或浏览器不能自动继承。仓库不包含原浏览器未导出的私人资料。

## 验证记录和限制

已使用真实 Chromium、随站点发布的 Supabase SDK、模拟 Auth/REST/Storage，以及嵌入式 PostgreSQL，验证登录、公开读取、素材上传、音乐播放、保存失败、版本冲突、重试、退出登录和旧资料迁移。样式和默认素材保持不变。

本执行环境到 Supabase 项目的网络请求被代理拒绝，尚未在真实项目登录、上传或保存。SQL 安装成功由项目所有者提供的控制台结果确认。正式发布后仍需管理员验收真实读写：保存一段证词，再用无痕窗口读取，随后验证图片和音乐。没有进行微信、Safari 真机或人工听音验证。

## 开发测试

在仓库根目录运行：

```sh
python -m http.server 8019 --bind 127.0.0.1
```

另一个终端运行：

```sh
node tests/cloud-browser.cjs
node tests/sql.cjs
```

浏览器测试使用 `/usr/bin/chromium`。默认依赖安装在仓库外 `/tmp/homepage-validation/node_modules/`；可通过 `PLAYWRIGHT_MODULE` 和 `PGLITE_MODULE` 指定相应模块路径，`TEST_URL` 指定本地服务地址。

测试访问模拟服务和内存数据库，不操作真实 Supabase。

Supabase SDK 以 MIT 许可发布，见 `vendor/SUPABASE-LICENSE`。
