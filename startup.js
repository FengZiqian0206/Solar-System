// Keep loading feedback independent of the rendering module and its dependencies.
(() => {
  const status = document.getElementById('status');
  const panel = document.getElementById('webglError');
  const controls = document.querySelectorAll('.controls button, .controls input, #fullscreen');
  controls.forEach(control => control.disabled = true);
  setTimeout(() => document.getElementById('splash')?.classList.add('fade'), 1000);
  setTimeout(() => document.getElementById('splash')?.remove(), 1950);
  function showFailure(message, error) {
    status.textContent = '● 加载失败 · LOAD FAILED';
    panel.hidden = false;
    panel.style.display = 'grid';
    panel.replaceChildren();
    const details = document.createElement('div');
    details.textContent = message;
    const retry = document.createElement('button');
    retry.textContent = '重新加载 · RETRY';
    retry.onclick = () => location.reload();
    panel.append(details);
    if (error) {
      const detail = document.createElement('pre');
      detail.style.cssText = 'max-width:100%;max-height:160px;overflow:auto;white-space:pre-wrap;word-break:break-word;text-align:left;font-size:12px';
      detail.textContent = String(error.code || error.name || 'Error') + ': ' + error.message;
      panel.append(detail);
    }
    panel.append(retry);
  }
  const timeout = setTimeout(() => showFailure('资源加载超时，请检查网络后重试。 · Loading timed out. Please retry.'), 20000);
  // Resolve against the page, not the classic script's possibly opaque origin.
  const appUrl = new URL('./app.js?v=belt-150-2', document.baseURI).href;
  import(appUrl).then(() => {
    clearTimeout(timeout);
    panel.hidden = true;
    panel.style.display = 'none';
    controls.forEach(control => control.disabled = false);
    status.textContent = '● 运行中 · RUNNING';
  }).catch(error => {
    clearTimeout(timeout);
    console.error('Solar System startup failed:', error);
    const message = error.code === 'WEBGL_UNAVAILABLE'
      ? '浏览器的三维绘图功能不可用。请检查 Edge 的图形加速设置并重启浏览器。 · 3D graphics unavailable.'
      : error.code === 'SHADER_FAILED'
      ? '点云绘图程序编译失败，请将下方错误信息反馈给我。 · Shader compilation failed.'
      : error instanceof TypeError && /fetch|module|import|load/i.test(error.message)
      ? '网站程序文件未能加载，请检查网络后重试。 · Application files failed to load.'
      : '点云启动出现错误，请将下方错误信息反馈给我。 · Startup error.';
    showFailure(message, error);
  });
})();
