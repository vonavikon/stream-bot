#!/usr/bin/env bash
# Деплой stream-bot на skrime-main (Сервис-стандарт W2, паттерн deploy.sh v2)
# Заливка только закоммиченного (git ls-files), снапшот прода до заливки,
# сверка серверных хотфиксов (md5), build --pull, up -d, verify.
# Запуск: с раннера GH Actions (ключ SKRIME_DEPLOY_KEY, юзер deploy) или локально.
# Репо публичный: адрес сервера в коде запрещён — только ssh-алиас skrime-main
# (на раннере настраивается workflow'ом через секрет SKRIME_DEPLOY_HOST).
set -euo pipefail

HOST="${HOST:-deploy@skrime-main}"
REMOTE=/opt/stream-bot
SERVICE=stream-bot
KEEP_SNAPSHOTS=5
EXCLUDE='^(tests/)$'

cd "$(git rev-parse --show-toplevel)"
FILES=$(git ls-files | grep -vE "$EXCLUDE")
SHA=$(git rev-parse --short HEAD)

echo "==> [1/4] hotfix-детект: сверяю $REMOTE с репо ($SHA)"
SUMS=$(md5sum $FILES)
DIFF=$(ssh "$HOST" "cd $REMOTE && md5sum -c - --quiet 2>/dev/null || true" <<<"$SUMS" || true)
if [ -n "$DIFF" ]; then
  echo "!! На сервере файлы отличаются от репо (возможные хотфиксы):"
  echo "$DIFF"
  echo "!! Они будут перезаписаны; снапшот ниже их сохранит. Ctrl+C для отмены."
else
  echo "    сервер совпадает с репо"
fi

echo "==> [2/4] снапшот прода"
STAMP=$(date +%Y%m%d-%H%M%S)
ssh "$HOST" "cd $REMOTE && mkdir -p backups && tar czf backups/pre-deploy-${STAMP}.tar.gz --exclude='backups' --exclude='data' --exclude='logs' . \
  && ls -1t backups/pre-deploy-*.tar.gz | tail -n +$((KEEP_SNAPSHOTS + 1)) | xargs -r rm -f && echo snapshot ok"

echo "==> [3/4] заливка -> $HOST:$REMOTE"
tar czf - --files-from=- <<<"$FILES" | ssh "$HOST" "tar xzf - -C $REMOTE"

echo "==> [4/4] build + up + verify"
ssh "$HOST" "cd $REMOTE && docker compose build --pull && docker compose up -d $SERVICE \
  && sleep 5 && docker compose ps --format '{{.Name}}\t{{.Status}}' \
  && echo '--- logs ---' && docker compose logs --tail=15 --no-color $SERVICE 2>&1"
echo "Деплой $SHA завершён."
