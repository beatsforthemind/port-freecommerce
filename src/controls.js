/**
 * First-person station navigation. Pointer lock is an enhancement: embedded
 * browsers that decline it still support click-and-drag look and keyboard input.
 */
export function createFirstPersonControls(camera, canvas, {
  canWalk = () => true,
  heightAt = () => 0,
  onLockChange = () => {},
  onInteract = () => {},
} = {}) {
  camera.rotation.order = 'YXZ';

  let yaw = camera.rotation.y;
  let pitch = camera.rotation.x;
  let active = false;
  let locked = document.pointerLockElement === canvas;
  let moving = false;
  let baseHeight = 1.75;
  let groundHeight = 0;
  let velocityX = 0;
  let velocityZ = 0;
  let bobPhase = 0;
  let dragPointer = null;
  let previousX = 0;
  let previousY = 0;
  let joystickPointer = null;
  let joystickX = 0;
  let joystickY = 0;
  let disposed = false;
  let reducedMotionOverride = null;
  let ride = null;

  const keys = new Set();
  const removeListeners = [];
  const joystick = document.getElementById('joystick');
  const joystickThumb = document.getElementById('joystick-thumb');
  const lookSurfaces = [...new Set([canvas, document.getElementById('look-pad')].filter(Boolean))];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const walkKeys = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
    'ShiftLeft', 'ShiftRight',
  ]);

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    removeListeners.push(() => target.removeEventListener(type, handler, options));
  }

  function clearInput() {
    keys.clear();
    velocityX = 0;
    velocityZ = 0;
    joystickX = 0;
    joystickY = 0;
    joystickPointer = null;
    dragPointer = null;
    moving = false;
    if (joystickThumb) joystickThumb.style.transform = 'translate(-50%, -50%)';
  }

  function look(dx, dy, touch = false) {
    const sensitivity = touch ? 0.004 : 0.0021;
    yaw -= dx * sensitivity;
    pitch -= dy * sensitivity;
    pitch = Math.max(-1.42, Math.min(1.42, pitch));
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  function isTyping(event) {
    const target = event.target;
    return target instanceof HTMLElement &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  }

  listen(document, 'keydown', event => {
    if (!active || isTyping(event) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (walkKeys.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
    if (event.code === 'KeyE' && !event.repeat) {
      event.preventDefault();
      onInteract();
    }
  });
  listen(document, 'keyup', event => keys.delete(event.code));
  listen(window, 'blur', clearInput);
  listen(document, 'visibilitychange', () => {
    if (document.hidden) clearInput();
  });
  listen(document, 'pointerlockchange', () => {
    const next = document.pointerLockElement === canvas;
    if (next && !active) {
      document.exitPointerLock?.();
      return;
    }
    if (next !== locked) {
      locked = next;
      // Acquisition is asynchronous: a new movement key can arrive while the
      // browser grants the lock. Keep that held key; losing lock resets input.
      if (!locked) clearInput();
      onLockChange(locked);
    }
  });
  listen(document, 'mousemove', event => {
    if (active && locked) look(event.movementX || 0, event.movementY || 0);
  });

  const endDrag = event => {
    if (dragPointer === event.pointerId) dragPointer = null;
  };
  for (const lookSurface of lookSurfaces) {
    listen(lookSurface, 'pointerdown', event => {
      if (!active || locked || dragPointer !== null ||
        (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (event.target instanceof Element && event.target.closest('button, a, input, #joystick')) return;
      dragPointer = event.pointerId;
      previousX = event.clientX;
      previousY = event.clientY;
      lookSurface.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    listen(lookSurface, 'pointermove', event => {
      if (!active || locked || dragPointer !== event.pointerId) return;
      look(event.clientX - previousX, event.clientY - previousY, event.pointerType !== 'mouse');
      previousX = event.clientX;
      previousY = event.clientY;
      event.preventDefault();
    });
    listen(lookSurface, 'pointerup', endDrag);
    listen(lookSurface, 'pointercancel', endDrag);
    listen(lookSurface, 'lostpointercapture', endDrag);
  }

  if (joystick) {
    function updateJoystick(event) {
      const rect = joystick.getBoundingClientRect();
      const radius = Math.max(12, Math.min(rect.width, rect.height) * 0.34);
      let x = (event.clientX - rect.left - rect.width / 2) / radius;
      let y = (event.clientY - rect.top - rect.height / 2) / radius;
      const length = Math.hypot(x, y);
      if (length > 1) { x /= length; y /= length; }
      joystickX = Math.abs(x) > 0.06 ? x : 0;
      joystickY = Math.abs(y) > 0.06 ? y : 0;
      if (joystickThumb) {
        joystickThumb.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
      }
    }
    listen(joystick, 'pointerdown', event => {
      if (!active || joystickPointer !== null) return;
      event.stopPropagation();
      event.preventDefault();
      joystickPointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      updateJoystick(event);
    });
    listen(joystick, 'pointermove', event => {
      if (event.pointerId !== joystickPointer) return;
      event.preventDefault();
      updateJoystick(event);
    });
    const endJoystick = event => {
      if (event.pointerId !== joystickPointer) return;
      joystickPointer = null;
      joystickX = 0;
      joystickY = 0;
      if (joystickThumb) joystickThumb.style.transform = 'translate(-50%, -50%)';
    };
    listen(joystick, 'pointerup', endJoystick);
    listen(joystick, 'pointercancel', endJoystick);
    listen(joystick, 'lostpointercapture', endJoystick);
  }

  const api = {
    update(dt) {
      if (!active || disposed) return;
      if (ride) {
        camera.position.set(ride.x,ride.height+baseHeight,ride.z);
        moving=false;
        return;
      }
      const delta = Math.min(0.05, Math.max(0, dt));
      let strafe = Number(keys.has('KeyD') || keys.has('ArrowRight')) -
        Number(keys.has('KeyA') || keys.has('ArrowLeft')) + joystickX;
      let forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) -
        Number(keys.has('KeyS') || keys.has('ArrowDown')) - joystickY;
      const length = Math.hypot(strafe, forward);
      if (length > 1) { strafe /= length; forward /= length; }
      const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const speed = sprint ? 11 : 6.3;
      const damping = 1 - Math.exp(-12 * delta);
      const targetX = (Math.cos(yaw) * strafe - Math.sin(yaw) * forward) * speed;
      const targetZ = (-Math.sin(yaw) * strafe - Math.cos(yaw) * forward) * speed;
      velocityX += (targetX - velocityX) * damping;
      velocityZ += (targetZ - velocityZ) * damping;

      // Small steps prevent tunnelling through narrow kiosks at sprint speed.
      const distance = Math.hypot(velocityX, velocityZ) * delta;
      const steps = Math.max(1, Math.ceil(distance / 0.2));
      const dx = velocityX * delta / steps;
      const dz = velocityZ * delta / steps;
      const oldX = camera.position.x;
      const oldZ = camera.position.z;
      const currentFloor = heightAt(oldX,oldZ,groundHeight);
      if (Number.isFinite(currentFloor)) groundHeight = currentFloor;
      for (let i = 0; i < steps; i++) {
        if (canWalk(camera.position.x + dx, camera.position.z,groundHeight)) {
          camera.position.x += dx;
          groundHeight = heightAt(camera.position.x,camera.position.z,groundHeight);
        }
        else velocityX = 0;
        if (canWalk(camera.position.x, camera.position.z + dz,groundHeight)) {
          camera.position.z += dz;
          groundHeight = heightAt(camera.position.x,camera.position.z,groundHeight);
        }
        else velocityZ = 0;
      }
      moving = Math.hypot(camera.position.x - oldX, camera.position.z - oldZ) > 0.0001;
      if (moving) bobPhase += delta * (sprint ? 12 : 8.5);
      const reduceMotion = reducedMotionOverride ?? reducedMotion.matches;
      const bob = moving && !reduceMotion ? Math.sin(bobPhase) * 0.022 : 0;
      camera.position.y += (groundHeight + baseHeight + bob - camera.position.y) * (1 - Math.exp(-14 * delta));
    },
    requestLock() {
      if (disposed) return;
      active = true;
      if (document.pointerLockElement === canvas || !canvas.requestPointerLock) return;
      // Pointer lock can be denied in a sandbox. Drag look remains available.
      try {
        const result = canvas.requestPointerLock();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch { /* Browser permissions do not prevent exploration. */ }
    },
    unlock() {
      active = false;
      clearInput();
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    },
    teleport(position, nextYaw = 0) {
      clearInput();
      ride=null;
      baseHeight = 1.75;
      const requestedFloor = Number.isFinite(position[1]) ? position[1] - baseHeight : 0;
      const floor = heightAt(position[0],position[2],requestedFloor);
      groundHeight = Number.isFinite(floor) ? floor : requestedFloor;
      camera.position.set(position[0], groundHeight + baseHeight, position[2]);
      yaw = nextYaw;
      pitch = 0;
      camera.rotation.set(0, yaw, 0, 'YXZ');
    },
    beginRide({x=camera.position.x,z=camera.position.z,height=groundHeight}={}) {
      if(disposed||![x,z,height].every(Number.isFinite))return false;
      clearInput();ride={x,z,height};groundHeight=height;
      camera.position.set(x,height+baseHeight,z);
      return true;
    },
    setRideHeight(height) {
      if(disposed||!ride||!Number.isFinite(height))return false;
      ride.height=height;groundHeight=height;moving=false;
      // Carry remains exact while a pause/menu has disabled ordinary controls.
      camera.position.set(ride.x,height+baseHeight,ride.z);
      return true;
    },
    endRide({height=ride?.height??groundHeight}={}) {
      if(!Number.isFinite(height))return false;
      clearInput();groundHeight=height;
      if(ride)camera.position.set(ride.x,height+baseHeight,ride.z);
      ride=null;return true;
    },
    cancelRide() { return api.endRide(); },
    setActive(value) {
      active = Boolean(value) && !disposed;
      if (!active) api.unlock();
    },
    setReducedMotion(value) {
      reducedMotionOverride = Boolean(value);
    },
    dispose() {
      api.unlock();
      ride=null;
      disposed = true;
      removeListeners.forEach(remove => remove());
    },
    get yaw() { return yaw; },
    get moving() { return moving; },
    get locked() { return locked; },
    get riding() { return Boolean(ride); },
  };
  return api;
}
