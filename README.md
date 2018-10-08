DfuFlasher
===========

Tool for automatically flashing multiple Nordic DFU devices at once.

Check this out, then:

```
sudo apt-get install tmux
npm install
```

To run:

```
# edit go.sh to include the DFU updater zip of your choice
./go.sh
```

This will do a quick 2 second scan and will the attempt to program the
first 4 devices found, at once. Programming is slow (around 5 minutes)
so 4 devices at once speeds this up.
