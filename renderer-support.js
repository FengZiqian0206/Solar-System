const canvas = document.getElementById('canvas');
const options = { alpha: false, antialias: true, powerPreference: 'default' };
let context = null;
let contextReason = '';
canvas.addEventListener('webglcontextcreationerror', event => {
  contextReason = event.statusMessage || '';
});
// This optional URL setting also allows testing the compatibility path.
if (new URLSearchParams(location.search).get('renderer') !== 'webgl1') {
  try { context = canvas.getContext('webgl2', options); } catch (_) {}
}
const webgl2 = !!context;
if (!context) {
  try { context = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options); } catch (_) {}
}
if (!context) {
  const error = new Error('浏览器未能创建 WebGL 2 或 WebGL 1 绘图环境。' + (contextReason ? '\n' + contextReason : ''));
  error.code = 'WEBGL_UNAVAILABLE';
  throw error;
}
const THREE = await import(webgl2 ? './vendor/three/three.module.js' : './vendor/three-r162/three.module.js');
export { THREE, context, webgl2 };
