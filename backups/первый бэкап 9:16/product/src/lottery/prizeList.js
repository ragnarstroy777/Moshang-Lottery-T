const MAX_TOP = 300,
  MAX_WIDTH = document.body.clientWidth;

let defaultType = 0;

let prizes;
const DEFAULT_MESS = [
  "Выиграть бы мне первый приз или первый приз? Вот дилемма...",
  "Говорят, месяц вегетарианства — и сорвёшь джекпот!",
  "Очень хочу первый приз!!!",
  "Кому-нибудь нужен первый приз?",
  "И пятая награда тоже неплоха — лишь бы повезло",
  "С Новым годом всем!",
  "Главное — не выигрыш, а хорошо поесть и повеселиться.",
  "В новом году пусть всё ладится!",
  "Я профессиональный сопровождающий — посмотрим, кто со мной за компанию",
  "Пусть в новом году всё становится лучше и лучше!",
  "В следующем году — реванш!!!"
];

let lastDanMuList = [];

let prizeElement = {},
  lasetPrizeIndex = null;
// Извлекаем числовой показатель из названия приза (например, "100 000 000 ..." -> 100000000)
function parseNumberFromText(text) {
  if (!text || typeof text !== "string") return null;
  const m = text.match(/(\d[\d\s]*)/);
  if (!m) return null;
  const num = parseInt(m[1].replace(/\s+/g, ""), 10);
  return isNaN(num) ? null : num;
}
class DanMu {
  constructor(option) {
    if (typeof option !== "object") {
      option = {
        text: option
      };
    }

    this.position = {};
    this.text = option.text;
    this.onComplete = option.onComplete;

    this.init();
  }

  init() {
    this.element = document.createElement("div");
    this.element.className = "dan-mu";
    document.body.appendChild(this.element);

    this.start();
  }

  setText(text) {
    this.text = text || this.text;
    this.element.textContent = this.text;
    this.width = this.element.clientWidth + 100;
  }

  start(text) {
    let speed = ~~(Math.random() * 10000) + 6000;
    this.position = {
      x: MAX_WIDTH
    };
    let delay = speed / 10;

    this.setText(text);
    this.element.style.transform = "translateX(" + this.position.x + "px)";
    this.element.style.top = ~~(Math.random() * MAX_TOP) + 10 + "px";
    this.element.classList.add("active");
    this.tween = new TWEEN.Tween(this.position)
      .to(
        {
          x: -this.width
        },
        speed
      )
      .onUpdate(() => {
        this.render();
      })
      .onComplete(() => {
        this.onComplete && this.onComplete();
      })
      .start();
  }

  render() {
    this.element.style.transform = "translateX(" + this.position.x + "px)";
  }
}

class Qipao {
  constructor(option) {
    if (typeof option !== "object") {
      option = {
        text: option
      };
    }

    this.text = option.text;
    this.onComplete = option.onComplete;
    this.$par = document.querySelector(".qipao-container");
    if (!this.$par) {
      this.$par = document.createElement("div");
      this.$par.className = "qipao-container";
      document.body.appendChild(this.$par);
    }

    this.init();
  }

  init() {
    this.element = document.createElement("div");
    this.element.className = "qipao animated";
    this.$par.appendChild(this.element);

    this.start();
  }

  setText(text) {
    this.text = text || this.text;
    this.element.textContent = this.text;
  }

  start(text) {
    this.setText(text);
    this.element.classList.remove("bounceOutRight");
    this.element.classList.add("bounceInRight");

    setTimeout(() => {
      this.element.classList.remove("bounceInRight");
      this.element.classList.add("bounceOutRight");
      this.onComplete && this.onComplete();
    }, 4000);
  }
}

let addQipao = (() => {
  let qipaoList = [];
  return function (text) {
    let qipao;
    if (qipaoList.length > 0) {
      qipao = qipaoList.shift();
    } else {
      qipao = new Qipao({
        onComplete() {
          qipaoList.push(qipao);
        }
      });
    }

    qipao.start(text);
  };
})();

function setPrizes(pri) {
  prizes = pri;
  defaultType = prizes[0]["type"];
  lasetPrizeIndex = null;
}

function showPrizeList(currentPrizeIndex) {
  let currentPrize = null;
  const hasIndex =
    typeof currentPrizeIndex === "number" && currentPrizeIndex >= 0;
  if (hasIndex) {
    currentPrize = prizes[currentPrizeIndex];
    if (currentPrize && currentPrize.type === defaultType) {
      currentPrize = null;
    }
  }

  let htmlCode = `<ul class="prize-list">`;
  prizes.forEach(item => {
    if (item.type === defaultType) {
      return;
    }
    const displayTotal = (typeof item.displayTotal === 'number' && isFinite(item.displayTotal) && item.displayTotal > 0)
      ? item.displayTotal
      : (parseNumberFromText(item.text) || item.count);
    htmlCode += `<li id="prize-item-${item.type}" class="prize-item ${
      currentPrize && item.type == currentPrize.type ? "shine" : ""
    }">
                        <span></span><span></span><span></span><span></span>
                        <div class="prize-img">
                            <img src="${item.img}" alt="${item.title}">
                        </div>
                        <div class="prize-text">
                            <h5 class="prize-title">${item.text} ${
      item.title
    }</h5>
                            <div class="prize-count">
                                <div class="progress">
                                    <div id="prize-bar-${
                                      item.type
                                    }" class="progress-bar progress-bar-danger progress-bar-striped active" style="width: 100%;">
                                    </div>
                                </div>
                                <div id="prize-count-${
                                  item.type
                                }" class="prize-count-left">
                                    ${item.count + "/" + displayTotal}
                                </div>
                            </div>
                        </div>
                    </li>`;
  });
  htmlCode += `</ul>`;

  document.querySelector("#prizeBar").innerHTML = htmlCode;
}

function resetPrize(currentPrizeIndex) {
  prizeElement = {};
  lasetPrizeIndex =
    typeof currentPrizeIndex === "number" && currentPrizeIndex >= 0
      ? currentPrizeIndex
      : null;
  showPrizeList(lasetPrizeIndex);
}

let setPrizeData = (function () {
  function clearShine(except) {
    if (except === undefined || except === null) {
      lasetPrizeIndex = null;
    }
    Object.keys(prizeElement).forEach(key => {
      const el = prizeElement[key];
      if (el && el.box && key !== except) {
        el.box.classList.remove("shine");
      }
    });
  }

  return function (currentPrizeIndex, count, options) {
    if (
      typeof currentPrizeIndex !== "number" ||
      currentPrizeIndex < 0 ||
      currentPrizeIndex >= prizes.length
    ) {
      return;
    }

    const currentPrize = prizes[currentPrizeIndex];
    if (!currentPrize || currentPrize.type === defaultType) {
      return;
    }

    const type = currentPrize.type;
    let elements = prizeElement[type];
    const totalCount = Number(currentPrize.count) || 0;

    if (!elements) {
      elements = {
        box: document.querySelector(`#prize-item-${type}`),
        bar: document.querySelector(`#prize-bar-${type}`),
        text: document.querySelector(`#prize-count-${type}`)
      };
      prizeElement[type] = elements;
    }

    const opts =
      typeof options === "boolean" ? { fromInit: options } : options || {};

    if (opts.highlight) {
      clearShine(String(type));
      elements.box && elements.box.classList.add("shine");
      lasetPrizeIndex = currentPrizeIndex;
    } else if (opts.clearHighlight) {
      if (lasetPrizeIndex === currentPrizeIndex) {
        lasetPrizeIndex = null;
      }
      elements.box && elements.box.classList.remove("shine");
    }

    if (elements.box) {
      if (totalCount > 0 && count >= totalCount) {
        elements.box.classList.add("done");
        elements.box.classList.remove("shine");
        if (lasetPrizeIndex === currentPrizeIndex) {
          lasetPrizeIndex = null;
        }
      } else {
        elements.box.classList.remove("done");
      }
    }

    const awarded = Math.min(Math.max(Number(count) || 0, 0), totalCount);
    const percent = totalCount === 0 ? 1 : awarded / totalCount;
    if (elements.bar) {
      elements.bar.style.width = percent * 100 + "%";
    }
    const displayTotal = (typeof currentPrize.displayTotal === 'number' && isFinite(currentPrize.displayTotal) && currentPrize.displayTotal > 0)
      ? currentPrize.displayTotal
      : (parseNumberFromText(currentPrize.text) || totalCount);
    if (elements.text) {
      elements.text.textContent = `${awarded}/${displayTotal}`;
    }
  };
})();

function startMaoPao() {
  let len = DEFAULT_MESS.length,
    count = 5,
    index = ~~(Math.random() * len),
    danmuList = [],
    total = 0;

  function restart() {
    total = 0;
    danmuList.forEach(item => {
      let text =
        lastDanMuList.length > 0
          ? lastDanMuList.shift()
          : DEFAULT_MESS[index++];
      item.start(text);
      index = index > len ? 0 : index;
    });
  }

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      danmuList.push(
        new DanMu({
          text: DEFAULT_MESS[index++],
          onComplete: function () {
            setTimeout(() => {
              this.start(DEFAULT_MESS[index++]);
              index = index > len ? 0 : index;
            }, 1000);
          }
        })
      );
      index = index > len ? 0 : index;
    }, 1500 * i);
  }
}

function addDanMu(text) {
  lastDanMuList.push(text);
}

export {
  startMaoPao,
  showPrizeList,
  setPrizeData,
  addDanMu,
  setPrizes,
  resetPrize,
  addQipao
};
