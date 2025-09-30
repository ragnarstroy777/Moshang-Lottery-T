// Gesture detection: open hand to request smooth stop
// Uses MediaPipe Hands via CDN script tags from index.html

let started = false;
let stopCoolDown = false;
let spinCoolDown = false;
let openFrames = 0;
const OPEN_THRESHOLD = 4; // подтверждаем жест быстрее, чтобы стоп срабатывал
let overlayCanvas, overlayCtx, pane, videoEl;
let palmSign = null; // авто-калибровка знака нормали ладони
let calibrating = true;
const PALM_SAMPLES_TARGET = 12;
let palmSamples = [];
let selfieMode = false; // по умолчанию не зеркалим вход, только предпросмотр по запросу
let openButPalmMismatchFrames = 0; // авто-инверсия знака при заметном рассогласовании

const SPIN_READY_FRAMES = 6;
const SPIN_MAX_FRAMES = 60;
const SPIN_TRIGGER_DELTA = 0.18;
const SPIN_MIN_VELOCITY = 0.015;
const SPIN_COOLDOWN_MS = 2000;

let spinPrimed = false;
let spinFrames = 0;
let spinStartX = null;
let lastCenterX = null;

let stopHandler = null;
let spinHandler = null;

function readPersistedPalmSign() {
  try {
    const stored =
      (typeof window !== 'undefined' && window.PALM_NORMAL_SIGN) ||
      (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('PALM_NORMAL_SIGN'));
    if (stored === '1' || stored === 1) return 1;
    if (stored === '-1' || stored === -1) return -1;
  } catch (e) {}
  return null;
}

function persistPalmSign(sign) {
  try {
    if (typeof window !== 'undefined') {
      window.PALM_NORMAL_SIGN = sign;
      if (window.localStorage) {
        window.localStorage.setItem('PALM_NORMAL_SIGN', String(sign));
        window.localStorage.setItem('PALM_SELFIE_MODE', String(selfieMode ? 1 : 0));
      }
    }
  } catch (e) {}
}

function readSelfieModePref() {
  try {
    if (typeof window !== 'undefined') {
      if (typeof window.SELFIE_MODE === 'boolean') return window.SELFIE_MODE;
      if (window.localStorage) {
        const v = window.localStorage.getItem('PALM_SELFIE_MODE');
        if (v === '1') return true;
        if (v === '0') return false;
      }
    }
  } catch (e) {}
  return false;
}

// Determine if palm faces the camera using world landmarks
function computePalmNormalZ(results) {
  try {
    const world = results.multiHandWorldLandmarks;
    if (!world || world.length === 0) return null;
    const lm = world[0];
    const wrist = lm[0];
    const idx = lm[5]; // index_mcp
    const pky = lm[17]; // pinky_mcp
    const v1 = { x: idx.x - wrist.x, y: idx.y - wrist.y, z: idx.z - wrist.z };
    const v2 = { x: pky.x - wrist.x, y: pky.y - wrist.y, z: pky.z - wrist.z };
    const n = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    };
    return n.z;
  } catch (e) {
    return null;
  }
}

function isOpenHand(landmarks) {
  // landmarks: array of 21 points with x,y,z normalized
  // Heuristic: for 4 non-thumb fingers, tip (8,12,16,20) should be above PIP (6,10,14,18)
  // y goes downwards in image coords, so tip.y < pip.y
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let extended = 0;
  for (let i = 0; i < tips.length; i++) {
    if (landmarks[tips[i]].y < landmarks[pips[i]].y) extended++;
  }
  return extended >= 4;
}

function getHandCenterX(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;
  const ids = [0, 5, 9, 13, 17]; // запястье и основания пальцев
  let sum = 0;
  for (let i = 0; i < ids.length; i++) {
    sum += landmarks[ids[i]].x;
  }
  return sum / ids.length;
}

function resetSpinTracking() {
  spinPrimed = false;
  spinFrames = 0;
  spinStartX = null;
  lastCenterX = null;
}

function allowImmediateSpin() {
  spinCoolDown = false;
  resetSpinTracking();
}

function initGestureStopper(arg, maybeOptions) {
  let options = {};
  if (typeof arg === 'function') {
    options.onStop = arg;
  } else if (arg && typeof arg === 'object') {
    options = Object.assign({}, arg);
  }
  if (maybeOptions && typeof maybeOptions === 'object') {
    options = Object.assign(options, maybeOptions);
  }

  stopHandler = typeof options.onStop === 'function' ? options.onStop : null;
  spinHandler = typeof options.onSpin === 'function' ? options.onSpin : null;

  if (started) return;
  started = true;

  try {
    const Hands = window.Hands;
    const Camera = window.Camera;
    if (!Hands || !Camera) {
      console.warn("MediaPipe Hands not available; gesture stop disabled.");
      return;
    }

    // Read prefs and reset calibration if selfie mode changed since last run
    selfieMode = readSelfieModePref();
    const prevSign = readPersistedPalmSign();
    try {
      const prevMode = (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('PALM_SELFIE_MODE'));
      if (prevMode != null && (prevMode === '1') !== selfieMode) {
        // режим зеркала изменился — сбросим калибровку, чтобы избежать инверсии
        palmSign = null;
        calibrating = true;
        palmSamples = [];
      } else {
        palmSign = prevSign;
      }
    } catch (e) {
      palmSign = prevSign;
    }

    // Create camera pane with overlay
    pane = document.querySelector('.camera-pane');
    if (!pane) {
      pane = document.createElement('div');
      pane.className = 'camera-pane';
      document.body.appendChild(pane);
    }
    // визуально отзеркалим предпросмотр при включенном режиме
    try {
      if (selfieMode) pane.classList.add('mirror');
      else pane.classList.remove('mirror');
    } catch (e) {}

    const video = document.createElement("video");
    videoEl = video;
    video.setAttribute("playsinline", "");
    pane.appendChild(video);

    overlayCanvas = document.createElement('canvas');
    overlayCtx = overlayCanvas.getContext('2d');
    pane.appendChild(overlayCanvas);

    const hands = new Hands({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
      selfieMode
    });

    const { drawConnectors, drawLandmarks } = window;
    hands.onResults(results => {
      // resize overlay to video size
      if (video.videoWidth && video.videoHeight) {
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
      }
      // draw current frame
      if (overlayCtx && video) {
        overlayCtx.save();
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        try {
          overlayCtx.drawImage(video, 0, 0, overlayCanvas.width, overlayCanvas.height);
        } catch (e) {}
      }

      const lm = results.multiHandLandmarks;
      if (lm && lm.length > 0) {
        // draw landmarks
        try {
          const HC = window.HAND_CONNECTIONS || (window.hands && window.hands.HAND_CONNECTIONS);
          if (drawConnectors && HC) drawConnectors(overlayCtx, lm[0], HC, { color: '#ff007a', lineWidth: 2 });
          if (drawLandmarks) drawLandmarks(overlayCtx, lm[0], { color: '#00bcd4', lineWidth: 1, radius: 3 });
        } catch (e) {}
        const nz = computePalmNormalZ(results);
        // авто-калибровка по первым образцам открытой ладони
        if (calibrating && nz != null && isOpenHand(lm[0])) {
          palmSamples.push(nz);
          if (palmSamples.length >= PALM_SAMPLES_TARGET) {
            const avg = palmSamples.reduce((a,b)=>a+b,0)/palmSamples.length;
            palmSign = avg < 0 ? -1 : 1;
            try {
              if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('PALM_NORMAL_SIGN', String(palmSign));
              }
            } catch (e) {}
            calibrating = false;
            palmSamples = [];
          }
        }
        // Приоритет знака: ручной override > авто-калибровка > дефолт (-1)
        let sign = -1;
        try {
          const override =
            (typeof window !== 'undefined' && window.PALM_NORMAL_SIGN) ||
            (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('PALM_NORMAL_SIGN'));
          if (override) sign = parseInt(override,10) === 1 ? 1 : -1;
        } catch(e) {}
        if (palmSign) sign = palmSign;
        if (typeof window !== 'undefined' && window.PALM_FLIP === true) sign *= -1;
        const palm = nz == null ? true : sign * nz <= 0;
        const open = isOpenHand(lm[0]);
        const centerX = getHandCenterX(lm[0]);

        if (open && palm && !stopCoolDown) {
          openFrames++;
          if (openFrames >= OPEN_THRESHOLD) {
            stopCoolDown = true;
            openFrames = 0;
            stopHandler && stopHandler();
            setTimeout(() => {
              stopCoolDown = false;
            }, 2000);
          }
        } else if (!open || !palm) {
          openFrames = 0;
        }

        if (open && palm && centerX != null && !spinCoolDown && spinHandler) {
          spinFrames++;
          if (!spinPrimed) {
            if (spinFrames >= SPIN_READY_FRAMES) {
              spinPrimed = true;
              spinStartX = centerX;
              lastCenterX = centerX;
            }
          } else {
            // В пользовательской перспективе (как в зеркале) жест "влево" должен запускать вращение.
            // Если selfieMode включён (изображение зеркалится), MediaPipe уже инвертирует ось X,
            // поэтому используем положительный коэффициент. Иначе (обычная камера) инвертируем знак.
            const directionFactor = selfieMode ? 1 : -1;
            const delta = (spinStartX - centerX) * directionFactor;
            const velocity = (lastCenterX - centerX) * directionFactor;
            lastCenterX = centerX;

            if (delta > SPIN_TRIGGER_DELTA && velocity > SPIN_MIN_VELOCITY) {
              resetSpinTracking();
              spinCoolDown = true;
              try {
                spinHandler();
              } catch (e) {
                console.warn('Gesture spin handler error', e);
              }
              setTimeout(() => {
                spinCoolDown = false;
              }, SPIN_COOLDOWN_MS);
            } else if (spinFrames >= SPIN_MAX_FRAMES) {
              resetSpinTracking();
            }
          }
        } else if (!open || !palm) {
          resetSpinTracking();
        }

        // Авто-инверсия знака: если кисть явно открыта, но "ладонь" не подтверждается
        // в течение заметного числа кадров — переворачиваем sign и запоминаем.
        if (lm[0] && nz != null) {
          if (open && !palm) {
            openButPalmMismatchFrames++;
          } else {
            openButPalmMismatchFrames = 0;
          }
          if (openButPalmMismatchFrames >= 12) { // ~0.4s @30fps
            palmSign = (palmSign === 1) ? -1 : 1;
            persistPalmSign(palmSign);
            calibrating = false;
            openButPalmMismatchFrames = 0;
          }
        }
        // optional tiny HUD
        try {
          overlayCtx.fillStyle = 'rgba(0,0,0,0.6)';
          overlayCtx.font = '12px sans-serif';
          overlayCtx.fillText(`palm:${palm ? 'yes' : 'no'} nz:${nz!==null?nz.toFixed(2):'na'} sign:${(palmSign!=null)?palmSign:'def'}` , 8, 16);
        } catch (e) {}
      }
      if (overlayCtx) overlayCtx.restore();
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      // Lower input resolution to reduce CPU usage/lag
      width: 160,
      height: 120
    });
    camera.start();

    // Горячая клавиша 'M' — переключить зеркальный режим предпросмотра и входа
    // Меняет как визуальную сторону, так и selfieMode в Hands
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'm' || ev.key === 'M') {
        selfieMode = !selfieMode;
        try {
          if (selfieMode) pane.classList.add('mirror');
          else pane.classList.remove('mirror');
        } catch (e) {}
        hands.setOptions({ selfieMode });
        // смена режима потенциально инвертирует знак нормали — сбросим калибровку
        palmSign = null;
        calibrating = true;
        palmSamples = [];
        persistPalmSign(palmSign == null ? -1 : palmSign); // сохранить текущий режим
      }
    });
  } catch (e) {
    console.warn("Gesture init failed:", e);
  }
}

export { initGestureStopper, allowImmediateSpin };
