#!/bin/bash
cd /Users/chace/Desktop/MLB
/usr/local/bin/node server.mjs > /dev/null 2>&1 &
echo "MLB Server started on port 8072"
echo "Visit http://localhost:8072/roster.html"
