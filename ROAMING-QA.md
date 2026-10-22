# Rainbow cursor / Earth-centred roaming

- Overview and roaming are fixed at 50³ (125,000 grid points). The disabled density slider stays disabled after startup; old density events cannot rebuild the scene.
- Desktop mouse cursor: procedural rainbow sphere, “Double-click to start” fades on a five-second cycle after an initial five-second delay.
- Double-click enters fullscreen and hides all names and leader lines. The rainbow point follows Earth's centre; the camera orbits that point without dragging. Wheel changes distance. Esc or Exit restores the overview.
- This is Earth-centred viewing, not keyboard-controlled flight. Existing overview appearance, orbital data, charts and saved overview camera/follow state remain unchanged.
- Uses existing Three.js and native fullscreen/pointer lock; no additional runtime dependency. Pointer-lock refusal falls back to ordinary mouse movement. Fullscreen refusal leaves overview usable and displays retry guidance.

## Verification (2026-10-22)

Run a static server for `data/`, then `node data/test-roaming.cjs <URL>` with Playwright available. The test uses an isolated headless Edge profile and software WebGL; screenshots are saved to a new temporary directory printed in its report. Also run `node test-planet-charts.cjs` from `data/`.

Passed on default renderer and `?renderer=webgl1`: fixed density, prompt fade timing, double-click outside canvas, fullscreen, hidden labels, mouse-look without button, zoom, Esc, repeated entry/exit, denied pointer lock, denied fullscreen, original fullscreen cursor, original chart toggle. No page errors or failed asset responses. Original chart regression passed (one SVG, eight paths, five metrics, selection/filtering).

Inspected cursor and active third-person screenshots at 1280×900. Corrected oversized foreground particles with a roaming-only point-size limit; overview shader sizing is unchanged. New visual assets are procedural CSS/GLSL, not downloaded media.

Scope: desktop mouse interactions. Software rendering validates shader compatibility, not physical-device frame rate or all browsers' fullscreen policies. No mobile navigation or performance claim is made.

Deployment retains the existing `codex/pages` root publishing configuration; its contents are the `data/` subtree. README.md and PROCESS.md are not changed.
