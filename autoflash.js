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
var Package = require("./package");
var SecureDfu = require("web-bluetooth-dfu");

var currentStatus = "";
var progressBar = new progress("...", {
    complete: "=",
    incomplete: " ",
    width: 20,
    total: 100
});

function setStatus(s) {
  currentStatus = s;
  progressBar.fmt = currentStatus;
  progressBar.update(0);
}


// Use a custom Bluetooth instance to control device selection
function findDevice() {
  setStatus("Scanning...");

  function handleDeviceFound(bluetoothDevice, selectFn) {
    // We only care about DfuTarg
    if (!bluetoothDevice.name || bluetoothDevice.name!="DfuTarg")
      return;
    setStatus("Starting update");
    var updater = {
      id : bluetoothDevice.id
    };
    console.log(bluetoothDevice.id);
    updater.promise = updateDevice(updater, bluetoothDevice);
  }

  var bluetooth = new webbluetooth.Bluetooth({
      deviceFound: handleDeviceFound
  });

  return bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SecureDfu.SERVICE_UUID]
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
        setStatus("Downloading file...");
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
function updateFirmware(updater, dfu, device, image) {

  progressBar.fmt = `${currentStatus} [:bar] :percent :etas`;
  progressBar.total = image.imageData.byteLength;
  progressBar.update(0);
  dfu.addEventListener(SecureDfu.EVENT_PROGRESS, event => {
      if (event.object === "firmware") {
          progressBar.update(event.currentBytes / event.totalBytes);
      }
  });

  return dfu.update(device, image.initData, image.imageData);
}


function updateDevice(updater, selectedDevice) {
  return Promise.resolve(selectedDevice)
  .then(selectedDevice => {
    setStatus("connecting...");

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
      setStatus("base image");
      return updateFirmware(updater, dfu, device, image);
    }
  })
  .then(() => package.getAppImage())
  .then(image => {
    if (image) {
      setStatus("app image");
      return updateFirmware(updater, dfu, device, image);
    }
  })
  .then(() => {
    setStatus("complete");
    updater.done = true;
    setStatus("Finished "+updater.id);
    setTimeout(findDevice, 1000);
  })
  .catch(error => {
    updater.done = true;
    setStatus("ERROR: "+error.message || error);
    setTimeout(findDevice, 1000);
  });
}

//var FILENAME = "http://www.espruino.com/binaries/espruino_1v98_puckjs.zip";
var FILENAME = "http://www.espruino.com/binaries/espruino_1v99_pixljs.zip";
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
    setStatus("Scanning for DFU devices...");
    findDevice();
});
