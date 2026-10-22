# Colour-cycling cursor / lattice roaming

- Overview and roaming are fixed at 50³ (125,000 grid points). The disabled density slider stays disabled after startup; old density events cannot rebuild the scene.
- Desktop mouse cursor: 16px flat colour-cycling dot, 70% opacity and a four-second colour cycle; “Double-click to start” fades on a five-second cycle after an initial five-second delay.
- Double-click enters fullscreen and hides names and leader lines. Spawn snaps to the existing grid vertex nearest Earth's current centre. Earth is sampled only on entry; subsequent orbital motion does not move the player.
- Hold W to move along the camera's viewing direction at 3 world units/second (half the previous speed). Continuous travel drives a smooth third-person camera; the highlighted position is always snapped to an existing lattice vertex. Travel is clamped to the cube's ±26 bounds. Keyup, blur, hidden tab and exit clear movement.
- The selected point remains 18 CSS pixels, with 70% opacity and a four-second colour cycle. Surrounding lattice points receive a distance-faded colour tint (maximum 55%, zero at 3.5 grid steps; previously 28% and 1.8 steps), without changing their size or opacity. Previous points automatically return to their normal appearance. There is no extra sphere, glow, moved vertex, deleted point or persistent trail.
- Horizontal rotation is reversed in both overview dragging and roaming mouse-look; vertical rotation is unchanged.
- Camera starts 32 units behind the player (previously about 12), mouse movement turns without dragging, wheel changes distance between 6 and 90, and Esc/Exit restores overview. Existing overview appearance, orbital data, charts and saved overview camera/follow state remain unchanged.
- Uses existing Three.js and native fullscreen/pointer lock; no additional runtime dependency. Pointer-lock refusal falls back to ordinary mouse movement. Fullscreen refusal leaves overview usable and displays retry guidance.

## Verification (2026-10-22)

Run a static server for `data/`, then `node data/test-roaming.cjs <URL>` with Playwright available. The test uses an isolated headless Edge profile and software WebGL; screenshots are saved to a new temporary directory printed in its report. Also run `node test-planet-charts.cjs` from `data/`.

Passed on default renderer and `?renderer=webgl1`: fixed density, flat cursor size, prompt fade timing, double-click outside canvas, fullscreen, hidden labels, mouse-look, zoom, 32-unit starting distance, Earth spawn without following, W movement in the viewing direction, grid alignment and boundary clamp, keyup/blur stop, unchanged geometry, Esc, repeated entry/exit, denied pointer lock/fullscreen, original fullscreen cursor and chart toggle. No page errors or failed asset responses. Original chart regression passed (one SVG, eight paths, five metrics, selection/filtering).

Inspected entry and moving screenshots at 1280×900. Replaced the previous small roaming-specific sizing formula with the original perspective/zoom sizing, bounded only at extreme close range (space 14px, bodies 48px at DPR 1; 2.4px minimum). Overview sizing is unchanged. New visuals are procedural CSS/GLSL, not downloaded media.

Measured active rendering: 1 draw call and 125,000 points, down from the previous extra player object's second draw call and 125,001 points. No new geometry or texture; DPR remains capped at 2. Browser tests compare the complete position buffer before/after movement and verify the selected coordinate matches an existing vertex on every rendered frame.

Additional tuning checks: horizontal reversal and unchanged vertical input tested separately; measured W speed is at most 3 units/second (frame-delta clamping can slow it on software rendering). An isolated render-target check using the production shader reads centre alpha 178/255 (~70%), different colours after one second and identical colours after four seconds. Adjacent-point RGB changes more strongly; points two grid steps away are now also tinted. Their alpha stays identical. A point four grid steps away is pixel-identical with and without the player tint.

Scope: desktop mouse interactions. Software rendering validates shader compatibility, not physical-device frame rate or all browsers' fullscreen policies. No mobile navigation or performance claim is made.

Deployment retains the existing `codex/pages` root publishing configuration; its contents are the `data/` subtree. README.md and PROCESS.md are not changed.
