import "./index.css";
import "../css/animate.min.css";
import "./canvas.js";
import {
  addQipao,
  setPrizes,
  showPrizeList,
  setPrizeData,
  resetPrize
} from "./prizeList";
import { NUMBER_MATRIX } from "./config.js";
import { buildPhoneMap, getPhoneByUser } from "./phone.js";
import { initGestureStopper } from "./gesture.js";

const ROTATE_TIME = 3000;
const ROTATE_LOOP = 1000;
const MIN_SPIN_MS = 1000; // минимум 1s до допуска жеста стоп
const SPIN_SPEED = 0.124; // ~на 30% медленнее, чем было (0.176 * 0.7)
const BASE_HEIGHT = 1080;

let TOTAL_CARDS,
  btns = {
    enter: document.querySelector("#enter"),
    lotteryBar: document.querySelector("#lotteryBar"),
    lottery: document.querySelector("#lottery")
  },
  prizes,
  EACH_COUNT,
  ROW_COUNT = 7,
  COLUMN_COUNT = 17,
  COMPANY,
  HIGHLIGHT_CELL = [],
  // Текущий коэффициент масштабирования
  Resolution = 1;

let camera,
  scene,
  renderer,
  controls,
  threeDCards = [],
  targets = {
    table: [],
    sphere: []
  };

let rotateObj;
let requestSmoothStop;
let rotateScene = false;
let spinStartedAt = 0;

let selectedCardIndex = [],
  rotate = false,
  basicData = {
    prizes: [], // Информация о призах
    users: [], // Все участники
    luckyUsers: {}, // Победители
    leftUsers: [] // Не выигравшие
  },
  interval,
  // Текущий разыгрываемый приз: от меньшего к большому
  currentPrizeIndex,
  currentPrize,
  // Идёт розыгрыш
  isLotting = false,
  currentLuckys = [];

initAll();

/**
 * Инициализация DOM
 */
function initAll() {
  window.AJAX({
    url: "/getTempData",
    success(data) {
      // Получение базовых данных
      prizes = data.cfgData.prizes;
      EACH_COUNT = data.cfgData.EACH_COUNT;
      // Allow client-side override via window.COMPANY or localStorage.COMPANY
      try {
        const override =
          (typeof window !== "undefined" && window.COMPANY) ||
          (typeof window !== "undefined" &&
            window.localStorage &&
            window.localStorage.getItem("COMPANY"));
        let srvCompany = data.cfgData.COMPANY;
        // Принудительно меняем MoShang -> TiMobile по требованию
        if (srvCompany === "MoShang") srvCompany = "TiMobile";
        COMPANY = override || srvCompany || "TiMobile";
      } catch (e) {
        COMPANY = data.cfgData.COMPANY || "TiMobile";
      }
      HIGHLIGHT_CELL = createHighlight();
      basicData.prizes = prizes;
      setPrizes(prizes);

      TOTAL_CARDS = ROW_COUNT * COLUMN_COUNT;

      // Загрузка сохранённых результатов
      basicData.leftUsers = data.leftUsers;
      basicData.luckyUsers = data.luckyData;

      let prizeIndex = basicData.prizes.length - 1;
      for (; prizeIndex > -1; prizeIndex--) {
        if (
          data.luckyData[prizeIndex] &&
          data.luckyData[prizeIndex].length >=
            basicData.prizes[prizeIndex].count
        ) {
          continue;
        }
        currentPrizeIndex = prizeIndex;
        currentPrize = basicData.prizes[currentPrizeIndex];
        break;
      }

      showPrizeList(currentPrizeIndex);
      let curLucks = basicData.luckyUsers[currentPrize.type];
      setPrizeData(currentPrizeIndex, curLucks ? curLucks.length : 0, true);
    }
  });

  window.AJAX({
    url: "/getUsers",
    success(data) {
      basicData.users = data;
      // Установить количество участников в статусной строке
      try {
        const pc = document.querySelector("#participantsCount");
        if (pc) pc.textContent = `Количество участиников: ${basicData.users.length}`;
      } catch (e) {}
      // Инициализируем соответствие участник -> телефон
      buildPhoneMap(
        basicData.users,
        (typeof window !== "undefined" && window.PHONE_LIST) || undefined,
        (typeof window !== "undefined" && window.PHONE_CSV) || undefined
      );

      initCards();
      // startMaoPao();
      animate();
      shineCard();
    }
  });
}

function initCards() {
  let member = basicData.users.slice(),
    showCards = [],
    length = member.length;

  let isBold = false,
    showTable = basicData.leftUsers.length === basicData.users.length,
    index = 0,
    totalMember = member.length,
    position = {
      x: (140 * COLUMN_COUNT - 20) / 2,
      y: (180 * ROW_COUNT - 20) / 2
    };

  camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  camera.position.z = 3000;

  scene = new THREE.Scene();

  for (let i = 0; i < ROW_COUNT; i++) {
    for (let j = 0; j < COLUMN_COUNT; j++) {
      isBold = HIGHLIGHT_CELL.includes(j + "-" + i);
      var element = createCard(
        member[index % length],
        isBold,
        index,
        showTable
      );

      var object = new THREE.CSS3DObject(element);
      object.position.x = Math.random() * 4000 - 2000;
      object.position.y = Math.random() * 4000 - 2000;
      object.position.z = Math.random() * 4000 - 2000;
      scene.add(object);
      threeDCards.push(object);
      //

      var object = new THREE.Object3D();
      object.position.x = j * 140 - position.x;
      object.position.y = -(i * 180) + position.y;
      targets.table.push(object);
      index++;
    }
  }

  // sphere

  var vector = new THREE.Vector3();

  for (var i = 0, l = threeDCards.length; i < l; i++) {
    var phi = Math.acos(-1 + (2 * i) / l);
    var theta = Math.sqrt(l * Math.PI) * phi;
    var object = new THREE.Object3D();
    object.position.setFromSphericalCoords(800 * Resolution, phi, theta);
    vector.copy(object.position).multiplyScalar(2);
    object.lookAt(vector);
    targets.sphere.push(object);
  }

  renderer = new THREE.CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("container").appendChild(renderer.domElement);

  //

  controls = new THREE.TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = 0.5;
  controls.minDistance = 500;
  controls.maxDistance = 6000;
  controls.addEventListener("change", render);

  bindEvent();

  if (showTable) {
    switchScreen("enter");
  } else {
    switchScreen("lottery");
  }
}

function setLotteryStatus(status = false) {
  isLotting = status;
}

/**
 * Привязка событий
 */
function bindEvent() {
  document.querySelector("#menu").addEventListener("click", function (e) {
    e.stopPropagation();
    // Во время розыгрыша действия запрещены
    if (isLotting) {
      if (e.target.id === "lottery") {
        requestSmoothStop && requestSmoothStop();
        btns.lottery.innerHTML = "Начать розыгрыш";
      } else {
        addQipao("Идёт розыгрыш, подождите немного…");
      }
      return false;
    }

    let target = e.target.id;
    switch (target) {
      // Показать цифровую стену
      case "welcome":
        switchScreen("enter");
        rotate = false;
        break;
      // Перейти к розыгрышу
      case "enter":
        removeHighlight();
        addQipao(`Скоро разыгрываем [${currentPrize.title}], не уходите.`);
        // rotate = !rotate;
        rotate = true;
        switchScreen("lottery");
        break;
      // Сброс
      case "reset":
        let doREset = window.confirm(
          "Вы уверены, что хотите сбросить данные? Все текущие результаты будут очищены?"
        );
        if (!doREset) {
          return;
        }
        addQipao("Данные сброшены, начинаем заново");
        addHighlight();
        resetCard();
        // Сбросить все данные
        currentLuckys = [];
        basicData.leftUsers = Object.assign([], basicData.users);
        basicData.luckyUsers = {};
        currentPrizeIndex = basicData.prizes.length - 1;
        currentPrize = basicData.prizes[currentPrizeIndex];

        resetPrize(currentPrizeIndex);
        reset();
        switchScreen("enter");
        break;
      // Розыгрыш
      case "lottery":
        setLotteryStatus(true);
        // Перед новым розыгрышем сохранить прошлый результат
        saveData();
        // Обновить отображение оставшегося количества
        changePrize();
        resetCard().then(res => {
          // Розыгрыш
          rotateScene = true;
          spinStartedAt = Date.now();
          lottery();
        });
        addQipao(`Разыгрываем [${currentPrize.title}], приготовьтесь`);
        // Включаем жест "Стоп" один раз, колбэк вызывает плавную остановку
        initGestureStopper(() => {
          // игнорируем слишком ранний жест стоп (например, открытая ладонь уже в кадре)
          if (isLotting && Date.now() - spinStartedAt > MIN_SPIN_MS) {
            requestSmoothStop && requestSmoothStop();
            btns.lottery.innerHTML = "Начать розыгрыш";
          }
        });
        break;
      // Переразыграть
      case "reLottery":
        if (currentLuckys.length === 0) {
          addQipao(`Ещё не было розыгрыша, переразыграть нельзя.`);
          return;
        }
        setErrorData(currentLuckys);
        addQipao(`Переразыгрываем [${currentPrize.title}], приготовьтесь`);
        setLotteryStatus(true);
        // При переразыгрыше не сохранять предыдущий результат
        // Розыгрыш
        resetCard().then(res => {
          // Розыгрыш
          lottery();
        });
        break;
      // Экспорт результатов
      case "save":
        saveData().then(res => {
          resetCard().then(res => {
            // Очистить предыдущие записи
            currentLuckys = [];
          });
          exportData();
          addQipao(`Данные сохранены в Excel.`);
        });
        break;
    }
  });

  window.addEventListener("resize", onWindowResize, false);
}

function switchScreen(type) {
  switch (type) {
    case "enter":
      btns.enter.classList.remove("none");
      btns.lotteryBar.classList.add("none");
      transform(targets.table, 2000);
      break;
    default:
      btns.enter.classList.add("none");
      btns.lotteryBar.classList.remove("none");
      transform(targets.sphere, 2000);
      break;
  }
}

/**
 * Создание элемента
 */
function createElement(css, text) {
  let dom = document.createElement("div");
  dom.className = css || "";
  dom.innerHTML = text || "";
  return dom;
}

/**
 * Создание карточки
 */
function createCard(user, isBold, id, showTable) {
  var element = createElement();
  element.id = "card-" + id;

  if (isBold) {
    element.className = "element lightitem";
    if (showTable) {
      element.classList.add("highlight");
    }
  } else {
    element.className = "element";
    element.style.backgroundColor =
      "rgba(253,105,0," + (Math.random() * 0.35 + 0.15) + ")";
  }
  // Добавить логотип компании
  element.appendChild(createElement("company", COMPANY));

  element.appendChild(createElement("name", getPhoneByUser(user)));

  element.appendChild(createElement("details", user[0] + "<br/>" + user[2]));
  return element;
}

function removeHighlight() {
  document.querySelectorAll(".highlight").forEach(node => {
    node.classList.remove("highlight");
  });
}

function addHighlight() {
  document.querySelectorAll(".lightitem").forEach(node => {
    node.classList.add("highlight");
  });
}

/**
 * Рендер шара и прочего
 */
function transform(targets, duration) {
  // TWEEN.removeAll();
  for (var i = 0; i < threeDCards.length; i++) {
    var object = threeDCards[i];
    var target = targets[i];

    new TWEEN.Tween(object.position)
      .to(
        {
          x: target.position.x,
          y: target.position.y,
          z: target.position.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to(
        {
          x: target.rotation.x,
          y: target.rotation.y,
          z: target.rotation.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  }

  new TWEEN.Tween(this)
    .to({}, duration * 2)
    .onUpdate(render)
    .start();
}

// function rotateBall() {
//   return new Promise((resolve, reject) => {
//     scene.rotation.y = 0;
//     new TWEEN.Tween(scene.rotation)
//       .to(
//         {
//           y: Math.PI * 8
//         },
//         ROTATE_TIME
//       )
//       .onUpdate(render)
//       .easing(TWEEN.Easing.Exponential.InOut)
//       .start()
//       .onComplete(() => {
//         resolve();
//       });
//   });
// }

function rotateBall() {
  return new Promise(resolve => {
    // Простое стабильное вращение за счёт рендера
    rotateScene = true;
    let stopped = false;

    // Плавная остановка к ближайшему полному обороту
    requestSmoothStop = () => {
      if (stopped) return;
      stopped = true;
      const twoPi = Math.PI * 2;
      const currentY = scene.rotation.y;
      const target = Math.ceil(currentY / twoPi) * twoPi;
      rotateScene = false; // перестаём подкручивать сцену в animate()
      new TWEEN.Tween(scene.rotation)
        .to({ y: target }, 1000)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(render)
        .onComplete(() => {
          scene.rotation.y = target;
          resolve();
        })
        .start();
    };
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

function animate() {
  // Вращение сцены по оси X/Y
  if (rotateScene) {
    // fallback rotation to ensure visible motion even if tween is interrupted
    scene.rotation.y += SPIN_SPEED;
  }

  requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();

  // Цикл рендеринга
  render();
}

function render() {
  renderer.render(scene, camera);
}

function selectCard(duration = 600) {
  rotate = false;
  let width = 140,
    tag = -(currentLuckys.length - 1) / 2,
    locates = [];

  // Вычисление позиций; >5 — в два ряда
  if (currentLuckys.length > 5) {
    let yPosition = [-87, 87],
      l = selectedCardIndex.length,
      mid = Math.ceil(l / 2);
    tag = -(mid - 1) / 2;
    for (let i = 0; i < mid; i++) {
      locates.push({
        x: tag * width * Resolution,
        y: yPosition[0] * Resolution
      });
      tag++;
    }

    tag = -(l - mid - 1) / 2;
    for (let i = mid; i < l; i++) {
      locates.push({
        x: tag * width * Resolution,
        y: yPosition[1] * Resolution
      });
      tag++;
    }
  } else {
    for (let i = selectedCardIndex.length; i > 0; i--) {
      locates.push({
        x: tag * width * Resolution,
        y: 0 * Resolution
      });
      tag++;
    }
  }

  let text = currentLuckys.map(item => item[1]);
  addQipao(
    `Поздравляем ${text.join(", ")} с выигрышем ${currentPrize.title}! В новом году — удачи!`
  );

  selectedCardIndex.forEach((cardIndex, index) => {
    changeCard(cardIndex, currentLuckys[index]);
    var object = threeDCards[cardIndex];
    new TWEEN.Tween(object.position)
      .to(
        {
          x: locates[index].x,
          y: locates[index].y * Resolution,
          z: 2200
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to(
        {
          x: 0,
          y: 0,
          z: 0
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    object.element.classList.add("prize");
    // Пишем поздравление в нижней части карточки
    try {
      const details = object.element.querySelector('.details');
      if (details) {
        details.textContent = 'Поздравляем!';
        details.style.display = 'block';
      }
    } catch (e) {}
    tag++;
  });

  new TWEEN.Tween(this)
    .to({}, duration * 2)
    .onUpdate(render)
    .start()
    .onComplete(() => {
      // После окончания анимации можно управлять
      setLotteryStatus();
    });
}

/**
 * Сброс содержимого карточек
 */
function resetCard(duration = 500) {
  if (currentLuckys.length === 0) {
    return Promise.resolve();
  }

  selectedCardIndex.forEach(index => {
    let object = threeDCards[index],
      target = targets.sphere[index];

    new TWEEN.Tween(object.position)
      .to(
        {
          x: target.position.x,
          y: target.position.y,
          z: target.position.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to(
        {
          x: target.rotation.x,
          y: target.rotation.y,
          z: target.rotation.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  });

  return new Promise((resolve, reject) => {
    new TWEEN.Tween(this)
      .to({}, duration * 2)
      .onUpdate(render)
      .start()
      .onComplete(() => {
        selectedCardIndex.forEach(index => {
          let object = threeDCards[index];
          object.element.classList.remove("prize");
        });
        resolve();
      });
  });
}

/**
 * Розыгрыш
 */
function lottery() {
  // if (isLotting) {
  //   rotateObj.stop();
  //   btns.lottery.innerHTML = "Начать розыгрыш";
  //   return;
  // }
  btns.lottery.innerHTML = "Закончить розыгрыш";
  rotateBall().then(() => {
    // Очистить предыдущие записи
    currentLuckys = [];
    selectedCardIndex = [];
    // Количество одновременно разыгрываемых; после исчерпания можно продолжать без записи
    let perCount = EACH_COUNT[currentPrizeIndex],
      luckyData = basicData.luckyUsers[currentPrize.type],
      leftCount = basicData.leftUsers.length,
      leftPrizeCount = currentPrize.count - (luckyData ? luckyData.length : 0);

    if (leftCount < perCount) {
      addQipao("Недостаточно участников, список участников обновлён для повторного розыгрыша!");
      basicData.leftUsers = basicData.users.slice();
      leftCount = basicData.leftUsers.length;
    }

    for (let i = 0; i < perCount; i++) {
      let luckyId = random(leftCount);
      currentLuckys.push(basicData.leftUsers.splice(luckyId, 1)[0]);
      leftCount--;
      leftPrizeCount--;

      let cardIndex = random(TOTAL_CARDS);
      while (selectedCardIndex.includes(cardIndex)) {
        cardIndex = random(TOTAL_CARDS);
      }
      selectedCardIndex.push(cardIndex);

      if (leftPrizeCount === 0) {
        break;
      }
    }

    // console.log(currentLuckys);
    selectCard();
  });
}

/**
 * Сохранить предыдущий результат
 */
function saveData() {
  if (!currentPrize) {
    // Если призов не осталось, данные не записываются, но розыгрыш возможен
    return;
  }

  let type = currentPrize.type,
    curLucky = basicData.luckyUsers[type] || [];

  curLucky = curLucky.concat(currentLuckys);

  basicData.luckyUsers[type] = curLucky;

  if (currentPrize.count <= curLucky.length) {
    currentPrizeIndex--;
    if (currentPrizeIndex <= -1) {
      currentPrizeIndex = 0;
    }
    currentPrize = basicData.prizes[currentPrizeIndex];
  }

  if (currentLuckys.length > 0) {
    // todo: добавить механизм автосохранения на случай падения сервера
    return setData(type, currentLuckys);
  }
  return Promise.resolve();
}

function changePrize() {
  let luckys = basicData.luckyUsers[currentPrize.type];
  let luckyCount = (luckys ? luckys.length : 0) + EACH_COUNT[currentPrizeIndex];
  // Обновить число и процент слева
  setPrizeData(currentPrizeIndex, luckyCount);
}

/**
 * Случайный выбор
 */
function random(num) {
  // Равномерное распределение чисел 0..num-1
  return Math.floor(Math.random() * num);
}

/**
 * Смена данных на карточке
 */
function changeCard(cardIndex, user) {
  let card = threeDCards[cardIndex].element;

  card.innerHTML = `<div class="company">${COMPANY}</div><div class="name">${getPhoneByUser(
    user
  )}</div><div class="details">${user[0] || ""}<br/>${user[2] || "PSST"}</div>`;
}

/**
 * Смена фона карточки
 */
function shine(cardIndex, color) {
  let card = threeDCards[cardIndex].element;
  card.style.backgroundColor =
    color || "rgba(253,105,0," + (Math.random() * 0.35 + 0.15) + ")";
}

/**
 * Случайная смена фона и данных
 */
function shineCard() {
  let maxCard = 10,
    maxUser;
  let shineCard = 10 + random(maxCard);

  setInterval(() => {
    // Во время розыгрыша останавливаем мигание
    if (isLotting) {
      return;
    }
    maxUser = basicData.leftUsers.length;
    for (let i = 0; i < shineCard; i++) {
      let index = random(maxUser),
        cardIndex = random(TOTAL_CARDS);
      // Не менять случайно уже показанные карточки победителей
      if (selectedCardIndex.includes(cardIndex)) {
        continue;
      }
      shine(cardIndex);
      changeCard(cardIndex, basicData.leftUsers[index]);
    }
  }, 500);
}

function setData(type, data) {
  return new Promise((resolve, reject) => {
    window.AJAX({
      url: "/saveData",
      data: {
        type,
        data
      },
      success() {
        resolve();
      },
      error() {
        reject();
      }
    });
  });
}

function setErrorData(data) {
  return new Promise((resolve, reject) => {
    window.AJAX({
      url: "/errorData",
      data: {
        data
      },
      success() {
        resolve();
      },
      error() {
        reject();
      }
    });
  });
}

function exportData() {
  window.AJAX({
    url: "/export",
    success(data) {
      if (data.type === "success") {
        location.href = data.url;
      }
    }
  });
}

function reset() {
  window.AJAX({
    url: "/reset",
    success(data) {
      console.log("Сброс выполнен");
    }
  });
}

function createHighlight() {
  let year = new Date().getFullYear() + "";
  let step = 4,
    xoffset = 1,
    yoffset = 1,
    highlight = [];

  year.split("").forEach(n => {
    highlight = highlight.concat(
      NUMBER_MATRIX[n].map(item => {
        return `${item[0] + xoffset}-${item[1] + yoffset}`;
      })
    );
    xoffset += step;
  });

  return highlight;
}

let onload = window.onload;

window.onload = function () {
  onload && onload();

  let music = document.querySelector("#music");

  let rotated = 0,
    stopAnimate = false,
    musicBox = document.querySelector("#musicBox");

  function animate() {
    requestAnimationFrame(function () {
      if (stopAnimate) {
        return;
      }
      rotated = rotated % 360;
      musicBox.style.transform = "rotate(" + rotated + "deg)";
      rotated += 1;
      animate();
    });
  }

  musicBox.addEventListener(
    "click",
    function (e) {
      if (music.paused) {
        music.play().then(
          () => {
            stopAnimate = false;
            animate();
          },
          () => {
            addQipao("Не удалось автоматически запустить музыку. Запустите вручную!");
          }
        );
      } else {
        music.pause();
        stopAnimate = true;
      }
    },
    false
  );

  setTimeout(function () {
    musicBox.click();
  }, 1000);
};
