// One optional camera mode; the overview's orbit, zoom and follow state stay untouched.
export function createRoaming({ THREE, scene, camera, viewport, getEarth, onStart }) {
  const hologram = document.querySelector('#hologram');
  const cursor = document.createElement('div');
  cursor.id = 'rainbowCursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<i></i><span>Double-click to start</span>';
  document.body.append(cursor);
  const hud = document.createElement('div');
  hud.id = 'roamHud';
  hud.hidden = true;
  hud.innerHTML = '<span>移动鼠标环顾 · MOVE MOUSE TO LOOK<br>滚轮缩放 · SCROLL TO ZOOM</span><button id="roamExit" type="button">退出漫游 · EXIT <kbd>Esc</kbd></button>';
  hologram.append(hud);
  const notice = document.createElement('div');
  notice.id = 'roamNotice';
  notice.setAttribute('role', 'status');
  hologram.append(notice);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uSize: { value: 28 * Math.min(devicePixelRatio, 2) } },
    vertexShader: `uniform float uSize; void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=uSize;}`,
    fragmentShader: `uniform float uTime;
      void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.)discard;
      float z=sqrt(max(0.,1.-r));float hue=atan(p.y,p.x)/6.28318+uTime*.045+p.x*.18;
      vec3 color=.55+.45*cos(6.28318*(hue+vec3(0.,.333,.667)));
      color*=.52+.48*z;float shine=pow(max(0.,dot(normalize(vec3(-.4,-.5,1.)),vec3(p,z))),22.);
      gl_FragColor=vec4(mix(color,vec3(1.),shine*.7),1.-smoothstep(.88,1.,r));}`
  });
  const ball = new THREE.Points(geometry, material);
  ball.visible = false;
  ball.frustumCulled = false;
  ball.renderOrder = 10;
  scene.add(ball);
  const offset = new THREE.Vector3(), target = new THREE.Vector3(), up = new THREE.Vector3();
  let active = false, pending = false, locked = false, yaw = Math.PI / 4, pitch = .24, distance = 12;
  let pointer = null, noticeTimer;

  function notify(text) {
    notice.textContent = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.textContent = ''; }, 6000);
  }
  function leave() {
    if (!active) return;
    active = false; locked = false; pointer = null;
    ball.visible = false; hud.hidden = true;
    document.body.classList.remove('is-roaming', 'has-rainbow-cursor');
    hologram.classList.remove('is-roaming');
    camera.position.set(0, 0, 78);
    camera.rotation.set(0, 0, 0);
    if (document.pointerLockElement === viewport) document.exitPointerLock();
    if (document.fullscreenElement === hologram) document.exitFullscreen().catch(() => {});
  }
  async function enter() {
    if (active || pending || !getEarth()) return;
    pending = true;
    try {
      // Called directly by double-click: retain the browser's user-activation permission.
      if (document.fullscreenElement !== hologram) await hologram.requestFullscreen();
      if (document.fullscreenElement !== hologram) return;
      onStart();
      active = true; pointer = null; yaw = Math.PI / 4; pitch = .24;
      distance = Math.max(10, getEarth().radius * 4.5);
      ball.visible = true; hud.hidden = false;
      document.body.classList.add('is-roaming');
      hologram.classList.add('is-roaming');
      notice.textContent = '';
      // Pointer lock is optional; ordinary mouse movement still works if it is refused.
      try { await viewport.requestPointerLock?.(); } catch (_) {}
    } catch (_) {
      notify('无法进入全屏，请再次双击。 · Full screen unavailable. Double-click to retry.');
    } finally { pending = false; }
  }
  document.addEventListener('dblclick', event => {
    if (event.target.closest('#roamExit')) return;
    event.preventDefault();
    enter();
  });
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    if (active) {
      const dx = document.pointerLockElement === viewport ? event.movementX : pointer ? event.clientX - pointer.x : 0;
      const dy = document.pointerLockElement === viewport ? event.movementY : pointer ? event.clientY - pointer.y : 0;
      pointer = { x: event.clientX, y: event.clientY };
      yaw += Math.max(-120, Math.min(120, dx)) * .002;
      pitch = Math.max(-1.35, Math.min(1.35, pitch + Math.max(-120, Math.min(120, dy)) * .002));
      return;
    }
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.toggle('tip-left', event.clientX > innerWidth - 180);
    cursor.classList.toggle('tip-below', event.clientY < 42);
    document.body.classList.add('has-rainbow-cursor');
  });
  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) { pointer = null; document.body.classList.remove('has-rainbow-cursor'); }
  });
  window.addEventListener('blur', () => { pointer = null; document.body.classList.remove('has-rainbow-cursor'); });
  document.addEventListener('fullscreenchange', () => {
    // Keep the custom cursor visible in the existing, non-roaming fullscreen mode too.
    (document.fullscreenElement || document.body).append(cursor);
    if (active && document.fullscreenElement !== hologram) leave();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === viewport) {
      if (!active) { document.exitPointerLock(); return; }
      locked = true;
    } else if (active && locked) leave();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') leave(); });
  hud.querySelector('button').addEventListener('click', leave);
  return {
    get active() { return active; },
    get zoom() { return 78 / distance; },
    wheel(delta) {
      const minimum = Math.max(2, getEarth().radius * 1.4);
      distance = Math.max(minimum, Math.min(90, distance * (delta < 0 ? .9 : 1.1)));
    },
    update(time) {
      const earth = getEarth();
      ball.position.copy(earth.pos);
      material.uniforms.uTime.value = time;
      offset.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(distance);
      camera.position.copy(earth.pos).add(offset);
      camera.zoom = 1;
      camera.lookAt(earth.pos);
      // Shoulder framing: the visible player point sits below the viewing centre.
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      target.copy(earth.pos).addScaledVector(up, distance * .13);
      camera.lookAt(target);
    }
  };
}
