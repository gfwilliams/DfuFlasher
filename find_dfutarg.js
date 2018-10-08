/* Get a list of DfuTarg devices */

var noble = require('noble');
var devices = [];
var SCANTIME = 2;

function onDiscovery(peripheral) {
  if (!peripheral.advertisement ||
      peripheral.advertisement.localName!="DfuTarg") return;

  if (devices.indexOf(peripheral.address)<0)
    devices.push(peripheral.address);
}

noble.on('stateChange',  function(state) {
  if (state!="poweredOn") return;
  process.stderr.write("Starting scan ("+SCANTIME+" sec)...\n");
  noble.startScanning([], true);
});
noble.on('discover', onDiscovery);
noble.on('scanStart', function() { process.stderr.write("Scanning started.\n"); });
noble.on('scanStop', function() { process.stderr.write("Scanning stopped.\n");});

setTimeout(function() {
  console.log(devices.join("\n"));
  process.exit(0);
}, SCANTIME*1000);
