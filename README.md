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
music.js            背景音乐：用 Web Audio 现场合成的八音盒 + 和弦垫，无音频文件
inner-book.js       把 LeafThrough 纸页引擎挂到 #innerBookWebgl 上
public/pages/       所有页面图片（cover + scene-01…16 + blank.svg + scene-18，均为 WebP）
public/vendor/leafthrough/  LeafThrough 浏览器构建文件（已改为引用本地 Three.js）
vendor/three.module.js     本地 Three.js，避免依赖 CDN
```

## 替换图片

把图片放进 `public/pages/`，然后修改 `app.js` 顶部的 `pageImages` 数组（阅读顺序）与 `chapters` 数组（章节文案）；`inner-book.js` 顶部另有一份同样的内页列表，两处要一起改。

- `cover.webp` 是封面
- `scene-01.webp` 到 `scene-16.webp` 是正文内页
- `blank.svg` 是正文与封底之间的留白页
- `scene-18.webp` 是封底

页面统一按 **1600×900（16:9）WebP，质量 85** 导出：19 张合计约 1.8 MB。原始美术是 2048×1152 的 PNG（约 36 MB），PNG 只在需要重新压图时使用，不放进站点。

用 Pillow 重新压一张图：

```python
from PIL import Image
Image.open("scene-05.png").convert("RGB").resize((1600, 900), Image.LANCZOS) \
     .save("public/pages/scene-05.webp", "WEBP", quality=85, method=6)
```

新增内页时按阅读顺序往两处 `pageImages` 里追加即可，页码与进度会自动重算。

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

`public/pages/` 里是 19 张 WebP（合计约 1.8 MB），推送很快；如果临时放回了原始 PNG，`git push` 会明显变慢。

## 背景音乐

`music.js` 里没有任何音频文件，音乐是浏览器用 Web Audio 现场合成的：八音盒音色（正弦波 + 2/3/5 倍频泛音、快速衰减）、三和弦的长音垫、每小节一个低频根音，F 大调、62 BPM、八小节循环（Fmaj7 → C → Dm7 → Bb → F → C → Bb → C），再挂一个程序生成的混响。

- 从点「打开画册」开始播放（浏览器要求用户手势才允许出声），控制条左上角 `♪` 可随时开关，选择会记在 `localStorage` 的 `xiaoman.music` 里
- 切到别的标签页会自动静音淡出，回来再淡入；离开页面就停止排期
- 想换和弦或旋律：改 `music.js` 顶部的 `BARS`（`pad` 是和弦 MIDI，`bass` 是根音，`mel` 是八个八分音符槽，`0` 表示休止），音量在 `VOLUME` 里

## 已知取舍

- 页面图片压到 1600×900 WebP q85，整本约 1.8 MB（原 2048×1152 PNG 约 36 MB）。LeafThrough 仍会预加载全部页面，但总下载量已经很小；代价是 4K 显示器全屏时纸面纹理不如原图锐利。
- 首次翻页会有一次约 300 ms 的停顿（着色器与纹理首次上传），之后稳定 60 fps。封面 3D 的 `filter: drop-shadow` 已换成 `box-shadow`，拖动封面不再逐帧重算模糊。
- 纸页引擎（LeafThrough + Three.js，约 2 MB）改成延迟加载：首屏只下载封面（约 140 KB）和样式脚本，读者第一次移动鼠标/按键或停留 2.5 秒后才在后台拉引擎。若点「打开画册」时引擎还没到，先用轻量的平面跨页显示，就绪后自动切到 3D 翻页（`app.js` 的 `warmUpInnerBook()` / `loadInnerBook()`，`innerbookready` 里用 `setSpread(leftIndex)` 对齐当前这一组）。
- 竖屏窄屏下仍按跨页展示，32:9 会被压得很扁。若要做成移动端可读，需要在 `inner-book.js` 里按视口宽度把 `layout` 切到单页，并让 `.book-shell.is-open` 在窄屏改用 16:9 比例。
- 三维纸张的边缘会随弯曲前倾，把靠近页面外沿的文字吃掉几个像素。为了保住页脚旁的旁白，`inner-book.js` 里把 `paper.bulge` 压到 `0.4`、`wrinkles` 压到 `0.5`，跨页接近平摊；翻页时仍有纸张卷曲，只是静态页面更"平"。
- 章节标签是 `.book-shell` 的直接子节点，3D 与降级两种模式都会显示，只有封面态淡出。
- 第 4 页（`scene-04`）的黑板写着「2020 年春季学期」，与 2000 年的设定不符，属于原画内容，需要重画才能修。
