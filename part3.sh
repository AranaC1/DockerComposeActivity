#!/usr/bin/env bash
# Part 3 - inject, observe, and fix the three issues. Output goes to part3_log.txt
cd "$(dirname "$0")"
LOG=part3_log.txt
: > "$LOG"
sec(){ echo; echo "################ $* ################"; }
run(){ echo; echo "\$ $*"; eval "$@" 2>&1; }
cp .env .env.orig; cp docker-compose.yml docker-compose.yml.orig
{
sec "BASELINE  $(date -u +%FT%TZ)"
run docker compose up -d
sleep 15
run docker compose ps
run curl -s http://localhost:8083/tasks

sec "ISSUE 1 - DB password mismatch"
run "sed -i 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=oopsy/' .env"
run grep POSTGRES_PASSWORD .env
run docker compose up -d
sleep 25
run docker compose ps
run "docker compose logs api | grep -iE 'password|init_db|error' | head -n 15"
run "docker compose logs db | grep -iE 'password|FATAL' | tail -n 10"
run curl -s http://localhost:8083/health
echo; echo "--- FIX (option B: revert .env, keep data) ---"
run cp .env.orig .env
run grep POSTGRES_PASSWORD .env
run docker compose up -d
sleep 20
run docker compose ps
run curl -s http://localhost:8083/health
run curl -s http://localhost:8083/tasks

sec "ISSUE 2 - port 8083 already in use"
run docker compose down
run "nohup python3 -m http.server 8083 >/tmp/blocker.log 2>&1 &"
sleep 2
run docker compose up -d
sleep 5
run docker compose ps -a
echo; echo "--- find the blocker ---"
run "(command -v ss >/dev/null && ss -lntp | grep 8083) || lsof -i :8083 -sTCP:LISTEN"
echo; echo "--- FIX A: change mapping to 18083 ---"
run "sed -i 's/\"8083:8080\"/\"18083:8080\"/' docker-compose.yml"
run grep -n 8080 docker-compose.yml
run docker compose up -d
sleep 20
run docker compose ps
run curl -s http://localhost:18083/health
echo; echo "--- FIX B: stop the blocker, restore 8083 ---"
run "pkill -f 'http.server 8083'"
run cp docker-compose.yml.orig docker-compose.yml
run docker compose up -d
sleep 20
run docker compose ps
run curl -s http://localhost:8083/health

sec "ISSUE 3 - startup race (no health-gated depends_on)"
python3 - <<'PY'
import re
p="docker-compose.yml"; s=open(p).read()
s=re.sub(r"(  api:.*?)depends_on:\n\s+db:\n\s+condition: service_healthy\n",
         r'\1depends_on: ["db"]\n', s, count=1, flags=re.S)
open(p,"w").write(s)
PY
run "grep -n -A1 'depends_on' docker-compose.yml"
run docker compose down
run docker compose up -d
sleep 25
run "docker compose logs api | head -n 50"
run docker compose ps
echo; echo "--- FIX: restore service_healthy ---"
run cp docker-compose.yml.orig docker-compose.yml
run "grep -n -A2 'depends_on' docker-compose.yml"
run docker compose down
run docker compose up -d
sleep 25
run "docker compose logs api | head -n 20"
run docker compose ps
run curl -s http://localhost:8083/health
run curl -s http://localhost:8083/tasks
sec "DONE  $(date -u +%FT%TZ)"
} 2>&1 | tee "$LOG"
rm -f .env.orig docker-compose.yml.orig
