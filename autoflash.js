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
var webbluetooth = require("webbluetooth");
var Package = require("./package"); // zip package opener
var SecureDfu = require("web-bluetooth-dfu");
var Multiprogress = require("multi-progress");
var multiprogress;

var bluetooth;

var MAX_DEVICES = 1;
var SCAN_TIMEOUT = 2;

function startProgress() {
  multiprogress = new Multiprogress(process.stderr);
}
function endProgress() {
  multiprogress.terminate();
  multiprogress = undefined;
}

function setStatus(s) {
  console.log(s);
}


// Use a custom Bluetooth instance to control device selection
function findDevices() {
  setStatus("Scanning ("+SCAN_TIMEOUT+"s)...");

  var devices = [];
  function handleDeviceFound(device, selectFn) {
    if (device.name && device.name === "DfuTarg") {
      if (!devices.find(d=>d.id==device.id))
        devices.push(device);
    }
  }

  var bluetooth = new webbluetooth.Bluetooth({
      deviceFound: handleDeviceFound
  });
  bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SecureDfu.SERVICE_UUID]
  });
  setTimeout(function() {
    if (devices) {
      console.log("Found:");
      devices.forEach(x=>console.log(" "+x.id));
      if (devices.length>MAX_DEVICES) {
        console.log("Updating first "+MAX_DEVICES);
        devices = devices.slice(0,MAX_DEVICES);
      }
      startProgress();

      Promise.all( devices.map( function(device, idx) {
        return new Promise(function(resolve) {
          setTimeout(function() {
            return updateDevice(device);
          }, 2000*idx);
        });
      } )).then(function() {
        endProgress();
        console.log("All done");
        findDevices();
      });
    } else {
      console.log("Found no devices.");
      findDevices();
    }
  }, SCAN_TIMEOUT*1000);
/*
  startProgress();
  bluetooth.requestDevice({ filters:[{ name: "DfuTarg" }]}).then(function(bluetoothDevice) {
    setStatus("Waiting random time period");
    setTimeout(function() {
      updateDevice(bluetoothDevice);
    }, 1000*Math.random());
  }).catch(function(e) {
    console.log(e);
    setStatus("Not found - trying again...");
    setTimeout(findDevice, 500+2000*Math.random());
  });*/
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
  var progressBar = multiprogress.newBar("Connecting ", {
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
    setStatus(selectedDevice.id+" Complete");
    setStatus("Finished "+updater.id);
  })
  /*.catch(error => {
    setStatus(selectedDevice.id+" ERROR: "+error.message || error);
  });*/
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
    findDevices();
});
