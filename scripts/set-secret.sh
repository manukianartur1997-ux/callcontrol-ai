#!/usr/bin/env bash
# Записывает значение из буфера обмена в .env.local, не показывая его.
#
# Зачем: копипаст ключей через чат — это их публикация (история переписки
# остаётся). Копипаст руками в редактор — источник ошибок. Здесь ключ идёт
# из системного буфера прямо в gitignore-файл, и на экран попадает только
# маска вида "sb_secret_…a1b2".
#
#   ./scripts/set-secret.sh SUPABASE_SECRET_KEY
set -euo pipefail

VAR="${1:?использование: ./scripts/set-secret.sh ИМЯ_ПЕРЕМЕННОЙ}"
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local"

[ -f "$ENV_FILE" ] || { echo "нет файла $ENV_FILE"; exit 1; }

# Обрезаем пробелы и переводы строк: браузеры часто копируют с хвостом,
# а лишний \n в значении ломает подпись запроса без внятной ошибки.
VALUE="$(pbpaste | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

if [ -z "$VALUE" ]; then
  echo "буфер обмена пуст — скопируй ключ и запусти снова"; exit 1
fi
if [ "${#VALUE}" -lt 20 ]; then
  echo "в буфере всего ${#VALUE} символов — это не похоже на ключ"; exit 1
fi
case "$VALUE" in
  *" "*) echo "в значении есть пробел — скопирован лишний текст"; exit 1 ;;
esac

# Заменяем строку целиком. Значение пишем через переменную окружения, чтобы
# спецсимволы в ключе не пытались интерпретироваться как sed-подстановка.
VALUE="$VALUE" VAR="$VAR" python3 - "$ENV_FILE" <<'PY'
import os, sys, pathlib
path = pathlib.Path(sys.argv[1])
var, value = os.environ["VAR"], os.environ["VALUE"]
lines = path.read_text(encoding="utf-8").splitlines()
found = False
for i, line in enumerate(lines):
    if line.startswith(f"{var}="):
        lines[i] = f"{var}={value}"
        found = True
        break
if not found:
    lines.append(f"{var}={value}")
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

MASKED="${VALUE:0:10}…${VALUE: -4}"
echo "записано: $VAR = $MASKED (${#VALUE} символов)"
