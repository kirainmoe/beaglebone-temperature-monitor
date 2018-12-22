const express = require("express"),
  fs = require("fs"),
  exec = require("child_process").exec,
  path = require("path"),
  app = express();

const config = require("./config");

const init = () => {
  // export gpio
  exec("echo " + config.gpio + " > /sys/class/gpio/export", function(
    err,
    stdout,
    stderr
  ) {});
  exec("echo out > /sys/class/gpio/gpio" + config.gpio + "/direction", function(
    err,
    stdout,
    stderr
  ) {});
  exec("echo 1 > /sys/class/gpio/gpio" + config.gpio + "/value", function(
    err,
    stdout,
    stderr
  ) {});
  // find i2c_interface automatically
  exec("i2cdetect -y -r 1", function(err, stdout, stderr) {
    const arr = stdout.match(/([0-9][0-9])/g);
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] % 10 != 0 || arr[i] == arr[i - 1]) {
        config.i2c_interface = parseInt(arr[i]);
        console.log("Find i2c interface at address 0x" + arr[i] + ".");
        break;
      }
    }
  });
};

let currentTemperature = 0;

init();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static('public'));

app.get("/", function(req, res) {
  res.render("index");
});

app.get("/temperature", function(req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  const interface = req.query.interface || config.i2c_interface;
  if (typeof interface === "undefined") {
    res.send(
      JSON.stringify({
        code: 400,
        info: "request i2c interface number!"
      })
    );
  }

  exec("i2cget -y 1 0x" + interface, function(error, stdout, stderr) {
    if (error) {
      res.send(JSON.stirngify({ code: 500, info: "error encountered :(" }));
    } else {
      temperature = parseInt(stdout, 16);
      res.send(
        JSON.stringify({
          code: 200,
          info: "OK",
          temperature: parseInt(stdout, 16)
        })
      );
    }
  });
});

app.get("/heat", function(req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  if (temperature <= config.temperatureLimit) {
    exec("echo 0 > /sys/class/gpio/gpio" + config.gpio + "/value");
    setTimeout(() => {
      exec("echo 1 > /sys/class/gpio/gpio" + config.gpio + "/value");
    }, 10000);
    res.send(JSON.stringify({ code: 200, info: "success" }));
  } else {
    res.send(
      JSON.stringify({ code: 403, info: "limit temperature exceeded." })
    );
  }
});

app.listen(config.port, function() {
  console.log("Monitor server is running on port:" + config.port);
});
