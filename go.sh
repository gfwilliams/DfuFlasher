#!/bin/bash
echo "Starting..."
echo "4"
tmux new-session -d -s dfu 'exec ./dfusingle.sh'
tmux rename-window 'Auto DFU'
sleep 1s
echo "3"
tmux select-window -t dfu:0
tmux split-window -h 'exec ./dfusingle.sh'
sleep 1s
echo "2"
tmux split-window -v -t 0 'exec ./dfusingle.sh'
sleep 1s
echo "1"
tmux split-window -v -t 1 'exec ./dfusingle.sh'
sleep 1s
tmux -2 attach-session -t dfu
