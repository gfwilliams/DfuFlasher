#!/bin/bash

FILENAME=espruino_1v99_pixljs.zip

echo ================================================================
echo   Updating to $FILENAME
echo ================================================================

node find_dfutarg.js > devices.txt
exec 5< devices.txt
read DEV1 <&5
read DEV2 <&5
read DEV3 <&5
read DEV4 <&5


if [ -n "${DEV1}" ]; then
 tmux new-session -d -s dfu "exec node dfusingle.js $FILENAME $DEV1 0"
 tmux rename-window 'Auto DFU'
 if [ -n "${DEV2}" ]; then
  sleep 1s
  tmux select-window -t dfu:0
  tmux split-window -h "exec node dfusingle.js $FILENAME $DEV2 1000"
  if [ -n "${DEV3}" ]; then
  sleep 1s
  tmux split-window -v -t 0 "exec node dfusingle.js $FILENAME $DEV3 2000"
  if [ -n "${DEV4}" ]; then
   sleep 1s
   tmux split-window -v -t 1 "exec node dfusingle.js $FILENAME $DEV4 3000"
  fi
 fi
fi
rm devices.txt
tmux -2 attach-session -t dfu

else
    echo "No DfuTarg devices found"
fi
