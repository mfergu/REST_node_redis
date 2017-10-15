#!/bin/bash
redis-server &
node app.js

# to monitor redis logs use redis-cli monitor

# to stop any background process or server
# https://unix.stackexchange.com/questions/104821/how-to-terminate-a-background-process
