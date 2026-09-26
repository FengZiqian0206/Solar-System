# 发布与目录维护

主分支只在根目录保留 `README.md`、`PROCESS.md`、`fetch.py`、`plot.py`、`data/` 和 `out/`。网页文件集中在 `data/`，它们之间的相对路径、渲染代码和样式保持原样。

GitHub Pages 使用 `codex/pages` 分支的根目录。该分支由主分支的 `data/` 子目录生成，原网址仍是 https://fengziqian0206.github.io/Solar-System/ 。不要把 Pages 来源切回主分支根目录，否则首页会变成项目说明。

## 本地运行

在仓库根目录执行：

```sh
python -m http.server 8000 --directory data
```

打开 `http://localhost:8000/`。原有数据脚本仍在根目录执行，不需要更改参数。

## 后续发布网页修改

将 `data/` 内的修改提交后，在仓库根目录执行：

```sh
git push origin main
git subtree push --prefix=data origin codex/pages
```

第二步将已提交的网页内容更新到发布分支；只推送主分支不会更新网站。不需要强制推送或手动复制文件。

## 迁移检查

本次仅调整目录与发布来源。迁移时核对网页资源的 Git 内容标识，确保 HTML、JavaScript、CSS 和 Three.js 依赖与迁移前一致；README、PROCESS、原始数据和作品图保持不变。

数据图表回归检查：进入 `data/` 后执行 `node test-planet-charts.cjs`。Python 数据校验：在根目录执行 `python plot.py --check`。浏览器检查覆盖页面加载、非空点云和数据图表切换；本次不改渲染逻辑，不增加视觉测试框架或游戏机器人。

`data/.gitignore` 只对 `data/` 内的 Python 缓存生效；`data/.gitattributes` 按新目录保护原始数据不被换行转换。这两个文件不是网页运行依赖。`out/main.jpg` 仍是原始二进制图片。
