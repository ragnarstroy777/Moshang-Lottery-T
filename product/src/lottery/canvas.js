(function () {
  //based on an Example by @curran
  window.requestAnimFrame = (function () {
    return window.requestAnimationFrame;
  })();
  var canvas = document.getElementById("canvas");

  ~~(function setSize() {
    // Задаём размеры canvas как у окна браузера
    window.onresize = arguments.callee;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
  })();

  var c = canvas.getContext("2d");

  var numStars = 800;
  var radius = "0." + Math.floor(Math.random() * 9) + 1;
  var focalLength = canvas.width * 2;
  var warp = 0;
  var centerX, centerY;

  var stars = [],
    star;
  var i;

  var animate = true;

  initializeStars();

  function executeFrame() {
    if (animate) requestAnimFrame(executeFrame);
    moveStars();
    drawStars();
  }

  function initializeStars() {
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;

    stars = [];
    for (i = 0; i < numStars; i++) {
      star = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * canvas.width,
        o: "0." + Math.floor(Math.random() * 99) + 1,
        a: Math.random() * Math.PI * 2, // angle for rotation
        w: 0.01 + Math.random() * 0.03 // angular velocity
      };
      stars.push(star);
    }
  }

  function moveStars() {
    for (i = 0; i < numStars; i++) {
      star = stars[i];
      star.z--;
      star.a += star.w; // rotate while flying

      if (star.z <= 0) {
        star.z = canvas.width;
        star.x = Math.random() * canvas.width;
        star.y = Math.random() * canvas.height;
        star.a = Math.random() * Math.PI * 2;
      }
    }
  }

  function drawStars() {
    var pixelX, pixelY, pixelRadius;

    // Resize to the screen
    if (
      canvas.width != window.innerWidth ||
      canvas.width != window.innerWidth
    ) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initializeStars();
    }
    if (warp == 0) {
      // white background to keep UI bright
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    // draw stars as dark-blue rotating diamonds on white background
    for (i = 0; i < numStars; i++) {
      star = stars[i];

      pixelX = (star.x - centerX) * (focalLength / star.z);
      pixelX += centerX;
      pixelY = (star.y - centerY) * (focalLength / star.z);
      pixelY += centerY;
      pixelRadius = 1 * (focalLength / star.z);
      // make them ~50% larger and diamond shaped
      var size = pixelRadius * 1.5;

      c.save();
      c.translate(pixelX, pixelY);
      c.rotate(star.a + Math.PI / 4);
      c.fillStyle = "rgba(10, 42, 107, " + star.o + ")"; // dark blue
      c.fillRect(-size / 2, -size / 2, size, size);
      c.restore();
    }
  }

  // document.getElementById('warp').addEventListener("click", function(e) {
  //     window.c.beginPath();
  //     window.c.clearRect(0, 0, window.canvas.width, window.canvas.height);
  //     window.warp = warp ? 0 : 1;
  //     executeFrame();
  // });

  executeFrame();
})();
