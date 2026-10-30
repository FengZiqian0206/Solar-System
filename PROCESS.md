Design Overview

I extended my original solar system visualisation with more interactions and playful features. (I wanted to make one project richer and more interesting instead of creating several small and unrelated exercises. This was also my original plan at the beginning of the course.)

1. I updated the cursor UI. Players can double-click to enter full-screen game mode.

2. In full-screen mode, players can control a strange planet from a third-person view using the "WASD" keys.

3. The strange planet constantly changes colour and has a repulsion field and a trail around it. The repulsion field pushes nearby point clouds away, while its colours and trail can temporarily change the colours of other planets.

4. Pressing the "Space" key triggers a random event. The strange planet may turn into a black hole or activate other special effects. These events can cause major changes to the virtual solar system.

5. All controls are also shown on screen, so mobile users can understand and use them too.

Interaction Design and Player Experience

I wanted to create an interactive experience where players can move freely through a point-cloud solar system.

The main loop is:

Move around → Discover the repulsion effect → Observe the movement trail → See how your actions affect other planets → Trigger a random event at any time → Change the solar system → Restore it and start again.

The main idea is to let players explore, experiment and see how their actions can change the whole solar system.

User Feedback and Testing

Tester A:

The instruction about double-clicking was difficult to notice at first. The actual gameplay only started after entering full-screen mode.

My change: I changed the first-time experience so that players enter full-screen mode directly, with clear on-screen instructions. Players can still exit full-screen mode whenever they want.

Tester B:

1. The experience sometimes crashed when opening. I also experienced this during testing, but it happened very rarely. (I have not found the exact cause yet.)
2. The tester suggested adding the A, S and D keys instead of only using W, to make movement smoother. He also suggested using Q and E for vertical movement.

My change: I added A, S and D, but decided not to add Q and E. I wanted to avoid having too many controls, and I think the WASD controls are easier to understand.

AI Use (From September 27)

From September 27 onwards, I continued developing the project with a focus on turning the original solar system visualisation into a more interactive experience. As of October 31, 2026, the main branch has submitted 112 times in total.

Tools: I used Codex to help with the implementation and debugging of the interactive features. Three.js, WebGL and GLSL were used for the point clouds, planet movement, repulsion effects, trails and random events. HTML, CSS and SVG were used for the UI and on-screen controls. Git and GitHub Pages were used to manage versions and publish the project.

What I kept: I kept the original solar system and its point-cloud visual style as the base. Instead of creating a completely separate game, I built the new interactions on top of the existing project. This helped keep the whole experience connected.

What I changed or rejected: I changed the original double-click entry after user testing showed that it was easy to miss. I also considered adding more controls, such as Q and E, but decided to keep the controls simple. I wanted the experience to be easy to understand rather than adding more features just for the sake of it.

My contribution:I made the main design decisions, including the visual direction, planet proportions, point sizes, transparency, density, planet details, interaction methods and UI layout. I also decided how the different effects should look and how players should interact with them. Codex helped with the coding, but I was responsible for the overall design direction and final decisions.


Assignment 2（Previous content）：

The project lasted from September 10 to September 26, about 8 active development days, and currently produced about 75 git submissions.

Use tools: use Codex to realize three.js/webgl/glsl to realize point cloud; Html/css/svg to achieve UI and charts; Git/github pages manage version and release;

Reserved content: always use the initial planets planetary data as the data source for tables, orbits and charts.

Discard content:

1.the first five separate indicator charts. They occupy space and are difficult, so they are finally merged into a five axis planetary parameter spectrum.

2.The early echarts desktop solution has also been replaced by the three.js web page solution for sharing through GitHub pages. Repeatedly modify the size relationship of planets to beautify the visual effect.

3.Repeatedly modify the details of planetary point clouds, especially Saturn rings, to present a good-looking effect.

My work content: develop visual direction, scale, point size, transparency, density, planetary details, interaction mode and UI specification.

Codex's contribution: complete the main code, shaders, Kepler tracks, follow the perspective, charts, compatibility fixes, testing, GIT submission and release.

Cooperation mode: I am responsible for setting goals, aesthetic judgment and acceptance; AI is responsible for implementation, troubleshooting and iteration, and entering the details of parameter modification.

The following contents are Chinese records, please ignore.

设计概述

我基于太阳系的信息可视化做了一些交互设计和趣味玩法的延伸（我想把一个内容做的更丰富和有趣而不单单只是零散的小作业，这也是我在这个课程一开始的计划）：

1.更新了鼠标的UI显示，玩家双击可以进入全屏的游戏模式

2.进入全屏模式后，玩家可控制的第三人称的奇异星球（玩家可以通过“WASD”键控制移动）

3.奇异星球会不断变换颜色而且周围会有排斥场和拖尾效果（排斥场会将周围的点云推散，自身的色彩和拖尾会给其他星球暂时染色）

4.玩家按下空格键会触发随机事件，即奇异星球会变成黑洞或其他特殊效果（各种效果会对虚拟的太阳系产生巨大改变）

5.所有键位控制都会有实体UI显示，所以移动端打开的用户也能体验

交互设计与玩家体验

我想创造一个可以在太阳系点云中穿梭的互动体验：玩家可以控制移动--发现自身的斥力--观察自身移动轨迹--查看自身行动造成的影响--在任何时间触发随机事件--太阳系产生巨大变化--恢复（实现循环）

用户反馈与测试

体验者A：双击进入的字难以第一时间发现，真正的玩法在进入游戏模式后。所以我的更改是:玩家第一次进入时直接进入全屏模式，并且伴有明确的UI提示，玩家依然可以退出全屏

体验者B：1.进入时偶尔会产生崩溃，我测试后也遇到过但很少（未发现原因）2.可以加入ASD键不只是W键可以操作更顺滑，并且可以加入QE键来实现上下运动。我只增加了ASD键没有增加QE键，因为我不想再增加过度按键而且WASD键来操控更容易理解

Assignment 2（Previous content）：

项目从 9 月 10 日持续到 9 月 26 日，约 8 个活跃开发日，目前共产生大约 75 次 Git 提交。

- 使用工具：用codex来实现Three.js/WebGL/GLSL 实现点云；HTML/CSS/SVG 实现 UI 和图表；Git/GitHub Pages 管理版本和发布；

- 保留内容：始终使用初始的一份 PLANETS 行星数据作为表格、轨道和图表的数据源。

- 抛弃内容：最初分开的五张指标图表。它们占空间、比较困难，因此最终合并为一张五轴行星参数谱线图。早期的 ECharts 桌面方案也被 Three.js 网页方案取代，以便通过 GitHub Pages 分享。
- 反复修改行星的大小关系用来美化视觉效果，反复修改行星点云细节尤其是土星环要呈现好看的效果。

- 我的工作内容：制定视觉方向、比例、点大小、透明度、密度、行星细节、交互方式与 UI 规范。

- codex的贡献：完成主要代码、着色器、开普勒轨道、跟随视角、图表、兼容性修复、测试、Git 提交和发布。

- 合作方式：我负责制定目标、审美判断和验收；AI负责实现、排错和迭代，进入参数修改细节。
