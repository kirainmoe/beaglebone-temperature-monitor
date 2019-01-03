const express = require("express"),
  exec = require("child_process").exec,
  path = require("path"),
  app = express();

const config = require("./config");

const init = () => {
  /* 初始化程序，导出指定的 GPIO 口并设置方向为 out、高电平 */
  exec("echo " + config.gpio + " > /sys/class/gpio/export", function() {});
  exec("echo out > /sys/class/gpio/gpio" + config.gpio + "/direction", function() {});
  exec("echo 1 > /sys/class/gpio/gpio" + config.gpio + "/value", function() {});

  /* 运行 i2cdetect，通过正则表达式获取 TMP75 的 i2c 总线地址 */
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
app.use(express.static("public"));

app.get("/", function(req, res) {
  res.render("index");
});

/* 获取温度数据的接口，返回 code(状态), info(信息), temperature(温度) */
app.get("/temperature", function(req, res) {
  res.header("Access-Control-Allow-Origin", "*"); // 设置跨域
  const interface = req.query.interface || config.i2c_interface;
  if (typeof interface === "undefined") {
    res.send(
      JSON.stringify({
        code: 400,
        info: "can't detect i2c interface number!"
      })
    );
  }
  // 通过 i2cget 获取温度数据，并将获取的十六进制数据转为二进制数
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

/* 接收加热指令的接口 */
app.get("/heat", function(req, res) {
  res.header("Access-Control-Allow-Origin", "*");

  // 加热定时器
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

// 监听指定端口，启动 Web Server
app.listen(config.port, function() {
  console.log("Monitor server is running on 192.168.7.2:" + config.port);
});
