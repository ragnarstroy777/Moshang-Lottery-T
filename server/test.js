const fs = require("fs");

// Проверка корректности результатов розыгрыша
var selected = {},
  repeat = [],
  luckyData = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, "../product/dist/temp.json"), 'utf8')),
  errorData = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, "../product/dist/error.json"), 'utf8'));

for (let key in luckyData) {
  let item = luckyData[key];
  item.forEach(user => {
    let id = user[0];
    if (selected[id]) {
      repeat.push(user[1]);
      return;
    }
    selected[id] = true;
  });
}

errorData.forEach(user => {
  let id = user[0];
  if (selected[id]) {
    repeat.push(user[1]);
    return;
  }
  selected[id] = true;
});

if (repeat.length > 0) {
  console.log(repeat);
  return;
}
console.log("Дубликаты отсутствуют");
