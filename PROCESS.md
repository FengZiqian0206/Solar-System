设计概述：
我基于太阳系的信息可视化做了一些交互设计和趣味玩法的延伸（我想把一个内容做的更丰富和有趣而不单单只是零散的小作业，这也是我在这个课程一开始的计划）：
1.更新了鼠标的UI显示，玩家双击可以进入全屏的游戏模式
2.进入全屏模式后，玩家可控制的第三人称的奇异星球（玩家可以通过“WASD”键控制移动）
3.奇异星球会不断变换颜色而且周围会有排斥场和拖尾效果（排斥场会将周围的点云推散，自身的色彩和拖尾会给其他星球暂时染色）
4.玩家按下空格键会触发随机事件，即奇异星球会变成黑洞或其他特殊效果（各种效果会对虚拟的太阳系产生巨大改变）
5.所有键位控制都会有实体UI显示，所以移动端打开的用户也能体验

交互设计与玩家体验：

Assignment 2（Previous content）：

The project lasted from September 10 to September 26, about 8 active development days, and currently produced about 75 git submissions.

- Use tools: use Codex to realize three.js/webgl/glsl to realize point cloud; Html/css/svg to achieve UI and charts; Git/github pages manage version and release;

- Reserved content: always use the initial planets planetary data as the data source for tables, orbits and charts.

- Discard content: 1.the first five separate indicator charts. They occupy space and are difficult, so they are finally merged into a five axis planetary parameter spectrum.
- 2.The early echarts desktop solution has also been replaced by the three.js web page solution for sharing through GitHub pages. Repeatedly modify the size relationship of planets to beautify the visual effect.
- 3.Repeatedly modify the details of planetary point clouds, especially Saturn rings, to present a good-looking effect.

- My work content: develop visual direction, scale, point size, transparency, density, planetary details, interaction mode and UI specification.

- Codex's contribution: complete the main code, shaders, Kepler tracks, follow the perspective, charts, compatibility fixes, testing, GIT submission and release.

- Cooperation mode: I am responsible for setting goals, aesthetic judgment and acceptance; AI is responsible for implementation, troubleshooting and iteration, and entering the details of parameter modification.


项目从 9 月 10 日持续到 9 月 26 日，约 8 个活跃开发日，目前共产生大约 75 次 Git 提交。

- 使用工具：用codex来实现Three.js/WebGL/GLSL 实现点云；HTML/CSS/SVG 实现 UI 和图表；Git/GitHub Pages 管理版本和发布；

- 保留内容：始终使用初始的一份 PLANETS 行星数据作为表格、轨道和图表的数据源。

- 抛弃内容：最初分开的五张指标图表。它们占空间、比较困难，因此最终合并为一张五轴行星参数谱线图。早期的 ECharts 桌面方案也被 Three.js 网页方案取代，以便通过 GitHub Pages 分享。
- 反复修改行星的大小关系用来美化视觉效果，反复修改行星点云细节尤其是土星环要呈现好看的效果。

- 我的工作内容：制定视觉方向、比例、点大小、透明度、密度、行星细节、交互方式与 UI 规范。

- codex的贡献：完成主要代码、着色器、开普勒轨道、跟随视角、图表、兼容性修复、测试、Git 提交和发布。

- 合作方式：我负责制定目标、审美判断和验收；AI负责实现、排错和迭代，进入参数修改细节。
