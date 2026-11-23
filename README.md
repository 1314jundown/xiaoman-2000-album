# 小满的2000年 · 横屏线上画册

周佳仪 作品 · 中南大学出版社。

这是一个横屏大绘本原型：首页用 CSS 3D 做悬浮式实体书封面，封面是一张完整 16:9 的图片；打开后两张 16:9 内页并排组成 32:9 跨页。内页使用 [LeafThrough](https://github.com/dmtrbrl/leafthrough)（MIT）的纸张物理模型，拖住单页时会按抓取点弯曲、随速度惯性落页，并保留书脊与页面堆叠阴影。

## 直接预览

不要用 `file://` 直接打开；内页 WebGL 和图片纹理需要 HTTP 环境。项目自带一个只依赖 Python 标准库的预览脚本：

```bash
python serve.py          # http://127.0.0.1:8099/
python serve.py 9000     # 端口被占用时手动指定
```

启动后打开终端里打印的地址即可。页面本身没有任何构建步骤，改完文件刷新浏览器就能看到。

## 文件结构

```
index.html          页面骨架：顶栏、封面、控制条、页脚
styles.css          全部样式（封面 3D、书脊、翻页纸片、章节标签、自定义光标）
app.js              外层交互：翻页状态、进度、键盘、翻页音效、封面拖拽
inner-book.js       把 LeafThrough 纸页引擎挂到 #innerBookWebgl 上
public/pages/       所有页面图片（cover + scene-01…18 + blank.svg）
public/vendor/leafthrough/  LeafThrough 浏览器构建文件（已改为引用本地 Three.js）
vendor/three.module.js     本地 Three.js，避免依赖 CDN
```

## 替换图片

把图片放进 `public/pages/`，然后修改 `app.js` 顶部的 `pageImages` 数组（阅读顺序）与 `chapters` 数组（章节文案）。

- `cover.png` 是封面
- `scene-01.png` 到 `scene-16.png` 是正文内页
- `blank.svg` 是正文与封底之间的留白页
- `scene-18.png` 是封底（`scene-17.png` 与它内容相同，属于历史遗留，可以删除）

所有页面都是 16:9、2048×1152。新增内页时按阅读顺序往 `pageImages` 里追加即可，页码与进度会自动重算。

## 线上版本与更新

公开地址：<https://1314jundown.github.io/xiaoman-2000-album/>（仓库 <https://github.com/1314jundown/xiaoman-2000-album>，public，默认分支 `main`）。这是纯静态站点，没有构建产物：GitHub Pages 直接发布 `main` 分支根目录，`.nojekyll` 让 Jekyll 不要碰 `public/` 目录。

本地改完后有三种更新方式：

```bash
# A. 有正常网络时，直接 git 推送（最简单）
git add -A && git commit -m "更新文案" && git push        # 推送后 Pages 自动重建，约 30 秒

# B. 网络受限时，用仓库外的 REST 脚本推送（只依赖 Python 标准库，走 git credential 里已有的 token）
python D:\周加一\gh-deploy.py                              # 幂等：重建 tree/commit，再触发 Pages 构建

# C. 只改文字时，可以直接在 GitHub 网页上编辑文件并提交
```

`public/pages/` 里有 38 MB 图片，`git push` 会比纯文本改动慢很多；换成 WebP 之后会明显好转。

## 已知取舍

- 图片是未压缩的 PNG，整本约 38 MB；LeafThrough 默认预加载全部页面，首次打开会有等待。
- 竖屏窄屏下仍按跨页展示，32:9 会被压得很扁。若要做成移动端可读，需要在 `inner-book.js` 里按视口宽度把 `layout` 切到单页，并让 `.book-shell.is-open` 在窄屏改用 16:9 比例。
- 三维纸张的边缘会随弯曲前倾，把靠近页面外沿的文字吃掉几个像素。为了保住页脚旁的旁白，`inner-book.js` 里把 `paper.bulge` 压到 `0.4`、`wrinkles` 压到 `0.5`，跨页接近平摊；翻页时仍有纸张卷曲，只是静态页面更"平"。
- 章节标签在 WebGL 渲染时就位于书的下方；如果之后单独调试无 WebGL 的降级模式，注意 `.spread` 的回退路径不显示该标签。
- `public/pages/scene-04.png` 的黑板写着「2020 年春季学期」，与 2000 年的设定不符，属于原画内容，需要重画才能修。
