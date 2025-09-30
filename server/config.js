/**
 * Настройка призов
 * type: уникальный идентификатор; 0 — плейсхолдер для специального приза
 * count: количество призов
 * title: описание приза
 * text: название приза
 * img: путь к изображению
 * displayTotal: число для отображения во фракции (правый знаменатель)
 */
const prizes = [
  {
    type: 0,
    count: 1000,
    title: "",
    text: "Специальный приз"
  },
  {
    type: 1,
    count: 2,
    text: "1000 красивых номеров",
    title: "",
    img: "../img/secrit.jpg",
    displayTotal: 1000
  },
  {
    type: 2,
    count: 5,
    text: "100 000 000 дополнительных гигабайтов",
    title: "",
    img: "../img/mbp.jpg",
    displayTotal: 100000000
  },
  {
    type: 3,
    count: 6,
    text: "100 000 000 дополнительных минут",
    title: "",
    img: "../img/huawei.png",
    displayTotal: 100000000
  },
  {
    type: 4,
    count: 7,
    text: "50 000 000 мегабайт в роуминге",
    title: "",
    img: "../img/ipad.jpg",
    displayTotal: 50000000
  },
  {
    type: 5,
    count: 8,
    text: "1000 уникальных аватаров с фирменным стилем T-Mobile",
    title: "",
    img: "../img/spark.jpg",
    displayTotal: 1000
  },
  {
    type: 6,
    count: 8,
    text: "Эксклюзивный номер, который совпадает с датой твоего дня рождения",
    title: "",
    img: "../img/kindle.jpg",
    displayTotal: 100000
  },
  {
    type: 7,
    count: 11,
    text: "Фирменные T-Mobile облики для аватара в метавселенной",
    title: "",
    img: "../img/edifier.jpg",
    displayTotal: 100000
  }
];

/**
 * Количество призов за один розыгрыш (по порядку из prizes)
 */
const EACH_COUNT = [1, 1, 5, 6, 7, 8, 9, 10];

/**
 * Название компании на карточке
 */
const COMPANY = "TiMobile";

module.exports = {
  prizes,
  EACH_COUNT,
  COMPANY
};
