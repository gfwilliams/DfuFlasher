DfuFlasher
===========

Tool for automatically flashing multiple Nordif DFU devices at once.

Currently work in progress.



Check this out, then:

```
sudo apt-get install tmux
npm install
```

To run:


```
# Get a list of DFU devices - useless currently
node getDfuTarg.js

# AUtomatically find some DfuTarg devices, flash the first one
node autoflash.js
```
