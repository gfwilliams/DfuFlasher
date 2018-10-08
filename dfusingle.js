// Flash a sinlge DFU device
/*
* Web Bluetooth DFU
* Copyright (c) 2018 Rob Moran
*
* The MIT License (MIT)
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/

var fs = require("fs");
var http = require("http");
var https = require("https");
var readline = require("readline");
var crc = require("crc-32");
var progress = require("progress");
var webbluetooth = require("webbluetooth");
var Package = require("./lib/package"); // zip package opener
var SecureDfu = require("web-bluetooth-dfu");

var bluetooth;

console.log(JSON.stringify(process.argv));

var FILENAME;
var DEVICEADDR;
var DELAY = 0;
if (process.argv.length>=3) FILENAME = process.argv[2];
if (process.argv.length>=4) DEVICEADDR = process.argv[3];
if (process.argv.length>=5) DELAY = parseInt(DELAY);
if (process.argv.length<3 || process.argv.length>5) {
  console.log("USAGE: dfusingle.js FILENAME [aa:bb:cc:dd:ee:ff [delay_in_ms]]");
  process.exit(1);
}


// Use a custom Bluetooth instance to control device selection
function findDevices() {
  if (DEVICEADDR) console.log("Scanning for "+DEVICEADDR);
  else console.log("Scanning for any device...");

  var devices = [];
  function handleDeviceFound(device, selectFn) {
    if (!DEVICEADDR) return true;
    return device.id==DEVICEADDR;
  }

  var bluetooth = new webbluetooth.Bluetooth({
      deviceFound: handleDeviceFound
  });
  bluetooth.requestDevice({ filters:[{ name: "DfuTarg" }]}).then(function(bluetoothDevice) {
    if (DELAY) console.log("Waiting "+DELAY+" msec");
    setTimeout(function() {
      updateDevice(bluetoothDevice);
    }, DELAY);
  }).catch(function(e) {
    console.log(e);
    console.log("Not found.");
  });
}

// Load a file, returning a buffer
function loadFile(fileName) {
    var file = fs.readFileSync(fileName);
    return new Uint8Array(file).buffer;
}

// Download a file, returning a buffer
function downloadFile(url) {
    return new Promise((resolve, reject) => {
        console.log("Downloading file...");
        var scheme = (url.indexOf("https") === 0) ? https : http;

        scheme.get(url, response => {
            var data = [];
            response.on("data", chunk => {
                data.push(chunk);
            });
            response.on("end", () => {
                if (response.statusCode !== 200) return reject(response.statusMessage);

                var download = Buffer.concat(data);
                resolve(new Uint8Array(download).buffer);
            });
        })
        .on("error", error => {
            reject(error);
        });
    });
}

// Update device using image containing init packet and data
function updateFirmware(progressBar, dfu, device, image) {
  progressBar.fmt = "uploading [:bar] :percent :etas";
  progressBar.total = image.imageData.byteLength;
  progressBar.update(0);
  dfu.addEventListener(SecureDfu.EVENT_PROGRESS, event => {
      if (event.object === "firmware") {
          progressBar.update(event.currentBytes / event.totalBytes);
      }
  });

  return dfu.update(device, image.initData, image.imageData);
}


function updateDevice(selectedDevice) {
  var progressBar = new progress("Connecting ", {
      complete: "=",
      incomplete: " ",
      width: 20, total: 100,
  });
  return Promise.resolve(selectedDevice)
  .then(selectedDevice => {
    // Use default bluetooth instance
    dfu = new SecureDfu(crc.buf, webbluetooth.bluetooth);
    return dfu.setDfuMode(selectedDevice);
  })
  .then(selectedDevice => {
      device = selectedDevice;
      return package.getBaseImage();
  })
  .then(image => {
    if (image) {
      return updateFirmware(progressBar, dfu, device, image);
    }
  })
  .then(() => package.getAppImage())
  .then(image => {
    if (image) {
      return updateFirmware(progressBar, dfu, device, image);
    }
  })
  .then(() => {
    console.log(selectedDevice.id+" Complete");
    done(0);
  }).catch(error => {
    console.log(selectedDevice.id+" ERROR: "+error.message || error);
    done(1);
  });
}

function done(errcode) {
  setTimeout(function() {
    process.exit(errcode);
  }, 1500);
}

var package = null;
var device = null;
var dfu = null;

console.log("Using "+FILENAME);
Promise.resolve(FILENAME)
.then(fileName => {
    if (!fileName) throw new Error("No file name specified");
    if (fileName.indexOf("http") === 0) return downloadFile(fileName);
    return loadFile(fileName);
})
.then(file => {
    package = new Package(file);
    return package.load();
})
.then(() => {
    findDevices();
});
