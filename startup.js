// Keep loading feedback independent of the rendering module and its dependencies.
(() => {
  const status = document.getElementById('status');
  const panel = document.getElementById('webglError');
  const controls = document.querySelectorAll('.controls button, .controls input, #fullscreen');
  controls.forEach(control => control.disabled = true);
  setTimeout(() => document.getElementById('splash')?.classList.add('fade'), 1000);
  setTimeout(() => document.getElementById('splash')?.remove(), 1950);
  function showFailure(message) {
    status.textContent = '● 加载失败 · LOAD FAILED';
    panel.hidden = false;
    panel.style.display = 'grid';
    panel.replaceChildren();
    const details = document.createElement('div');
    details.textContent = message;
    const retry = document.createElement('button');
    retry.textContent = '重新加载 · RETRY';
    retry.onclick = () => location.reload();
    panel.append(details, retry);
  }
  const timeout = setTimeout(() => showFailure('资源加载超时，请检查网络后重试。 · Loading timed out. Please retry.'), 20000);
  import('./app.js?v=local-three-1').then(() => {
    clearTimeout(timeout);
    panel.hidden = true;
    panel.style.display = 'none';
    controls.forEach(control => control.disabled = false);
    status.textContent = '● 运行中 · RUNNING';
  }).catch(error => {
    clearTimeout(timeout);
    console.error('Solar System startup failed:', error);
    showFailure('点云启动失败，请确认浏览器支持 WebGL 2 并开启硬件加速，然后重试。 · Unable to start. Check WebGL 2 and hardware acceleration.');
  });
})();
