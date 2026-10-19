# detective-v13 · V13.17 刑侦互动主页

保留交接包中的布局、原始样式、七张图片、默认背景音乐和烟雾视频。网页无需构建。

## 网站发布

GitHub 仓库 Settings → Pages → Source 选择 **Deploy from a branch**，Branch 选择 **main**，目录选择 **/(root)**，点击 Save。等待 Pages 部署完成，再使用 Pages 页面给出的正式地址。

发布后点击“编辑主页”，使用在 Supabase 创建的管理员邮箱和密码登录。访客可直接浏览，只有指定管理员能修改。密码仅输入网站登录表单，不写入代码或仓库。

## 主链接与独立子链接

主链接不带 `?profile=`。主账号在“编辑主页 → 分发专属子链接”创建编号和独立编辑密码；其他使用者打开 `?profile=编号`，点击“编辑主页”后只输入对应密码。

子链接从原始模板开始，不复制主链接个人资料。布局、配色、烟雾和默认素材固定；可填写证词、最多三个标签、三个卷宗标题，更换证人照片和入口封面、管理三个卷宗内的图片以及背景音乐。

卷宗标题在“编辑主页 → 02 / 三份调查卷宗”填写，每个最多 12 字，点击“保存卷宗标题”。主页入口、编辑页切换按钮、封面编辑标签和打开后的档案标题同步更新。标题与各自资料保存在云端，不影响其他子链接；旧资料未设置时继续使用“话术 / 评价 / 须知”。已经安装早期子链接 SQL 的项目，需要在 SQL Editor 执行 `supabase/03-section-titles.sql`，允许该字段通过模板校验；无需重新部署密码验证函数。新安装的 `02-children.sql` 已包含此规则。

子链接持有人不能修改主链接/其他子链接，不能修改归属或创建下一级链接。界面不显示分发管理和主链接本地迁移；服务端验证主账号身份，数据库撤销所有浏览器调用管理 RPC 的权限。每份子链接使用独立登录存储与素材目录。

主账号可读取编号列表及重置密码。密码不供事后查询，创建/重置时自行保管。重置会轮换编辑身份，让旧密码和旧 access token 立即失去写入权限；现有资料、素材目录和公开链接保持不变。

### 启用子链接服务（项目所有者操作）

1. 在同一个 Supabase 项目的 SQL Editor 新建查询，执行 **`supabase/02-children.sql` 全部内容**。成功结果为 `detective-v13 child links installed`。该升级可重复执行，不清空现有主链接资料。
2. 进入 Edge Functions，创建函数，名称为 **`smart-service`**（当前项目已按此名称部署，无需重建）。使用网页编辑器，将 **`supabase/detective-access-dashboard.ts` 全部内容**粘贴到 `index.ts`，替换示例，部署。
3. 在该函数设置中关闭 **Verify JWT / Verify JWT with legacy secret**。子链接解锁在登录前调用；创建、读取列表和重置在函数内部通过 Supabase Auth 验证 Bearer token 并核对固定主账号 UID，子账号会收到 403。
4. 无需在网页或聊天中填写服务端密钥。函数使用 Supabase 平台内置的 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。
5. 返回主链接，刷新后登录，在“分发专属子链接”创建一份测试链接。无痕窗口打开子链接，使用它的编辑密码保存，再核对其他链接未变化。

也可在已授权的 Supabase CLI 中执行 `supabase functions deploy smart-service --no-verify-jwt`。测试所用 Edge Function 真实处理器位于 `supabase/functions/detective-access/handler.mjs`，网页粘贴版由 `python scripts/prepare-deployment.py` 同步生成。

在后端升级完成前，主链接既有编辑功能继续使用原表；新分发功能会提示服务尚未安装。网站代码的 Git 提交不会替用户执行真实项目 SQL 或部署 Edge Function。网页调用 `/functions/v1/smart-service`；函数源文件仍保留 detective-access 命名，由 config.toml 的 entrypoint 指定。修改控制台显示名称不会改变实际接口路径。

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

本执行环境到 Supabase 项目的网络请求被代理拒绝。项目所有者已确认初始 SQL 安装、真实主账号登录、证词保存后无痕读取及图片上传后无痕读取成功。新增子链接服务尚需在真实项目安装并验收；当前通过的是模拟接口和嵌入式数据库测试。没有进行微信、Safari 真机或人工听音验证。

## 微信弱网读取与图片重试

公开资料读取与登录 SDK 分离。短暂网络错误、408/429 或常见 5xx 最多尝试三次；每次的 8 秒超时包含 JSON 响应体读取。最终失败保留“重新读取”入口，恢复联网或从后台返回时可重新读取。已有资料刷新失败时明确提示显示的是上次读取结果，不能视为最新云端确认；没有读到资料时不把卷宗显示为空资料。

读取合并并发请求，相同版本不重建图片，避免微信前后台事件打断已有加载。卷宗快速切换使用渲染版本号隔离，资料未读完就打开时保留六个等待位置，读到后自动显示。

卷宗图片、头像、封面和图片预览增加加载反馈，每次图片请求超过 12 秒或失败后有限重试，最后提供单张重载按钮。重试参数只用于下载，数据库中的文件 URL 不变。图片失败不会删除云端资料。

Google 字体从阻塞式 CSS import 改为非阻塞加载，字体与主题样式声明保持原样；云端资料读到前不启动音乐和烟雾下载。脚本与样式增加版本参数，避免微信刷新后混用旧代码。本次更新不需要执行 SQL 或重新部署 Edge Function。

`tests/loading-browser.cjs` 使用真实 Chromium、受控网络响应和虚拟时钟，覆盖外部字体不响应、先点卷宗后收到资料、短暂 503、永久图片失败后手动重试、图片/JSON 响应卡住、网络恢复、同版本刷新保留图片及错误链接。该测试不能证明真机微信或用户所在网络的 GitHub Pages/Supabase 连通性；执行环境对真实地址的请求仍被代理返回 403。

## 开发测试

在仓库根目录运行：

```sh
python -m http.server 8019 --bind 127.0.0.1
```

另一个终端运行：

```sh
node tests/cloud-browser.cjs
node tests/sql.cjs
node tests/children-browser.cjs
node tests/sql-children.cjs
node tests/loading-browser.cjs
```

浏览器测试使用 `/usr/bin/chromium`。默认依赖安装在仓库外 `/tmp/homepage-validation/node_modules/`；可通过 `PLAYWRIGHT_MODULE` 和 `PGLITE_MODULE` 指定相应模块路径，`TEST_URL` 指定本地服务地址。

测试访问模拟服务和内存数据库，不操作真实 Supabase。

新增测试覆盖主账号创建两份空白子链接、密码一一对应、同浏览器独立会话、独立文字/图片/音乐、未登录读取播放、编号错误、不允许子账号创建下级链接、密码重置后的旧会话拒绝和文件保留、创建失败回收、解锁限流。SQL 测试执行真实升级 SQL 两次，并直接尝试越权修改表/归属/版本、访问私有目录、调用后端 RPC、跨目录写删、写入布局字段及外部素材引用，确认均被拒绝。

Supabase SDK 以 MIT 许可发布，见 `vendor/SUPABASE-LICENSE`。
