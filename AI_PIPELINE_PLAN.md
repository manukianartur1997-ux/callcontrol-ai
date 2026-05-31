# AI Pipeline Plan

## Что уже есть

- Mock AI-score по транскрипту.
- Batch-анализ pending-звонков.
- Queue consumer в Cloudflare Worker.
- D1 table `jobs`.
- R2 binding заготовка для аудио.
- File register endpoint: `POST /api/files/register`.

## MVP pipeline

1. Клиент вставляет транскрипт или дает ссылку на аудио.
2. Если это текст, сразу создается call.
3. Если это аудио, сначала регистрируется file.
4. Call попадает в status `queued`.
5. Queue запускает анализ.
6. Analysis пишет score/risk/tags/actionItems.
7. Report берет последние 5-20 calls и собирает mini-audit.

## Реальная транскрибация

Варианты:

- Google AI Studio вручную для первых клиентов.
- OpenAI transcription API позже.
- Whisper локально/self-hosted позже.
- Телефония, которая уже дает транскрипт.

## Что добавить следующим слоем

1. `POST /api/transcriptions` — создать transcription job.
2. `POST /api/files/signed-upload` — signed upload URL в R2.
3. `jobs.type = transcription`.
4. Retry для jobs.
5. Dead-letter queue.
6. Cost tracking:
   - audio minutes;
   - model tokens;
   - estimated cost;
   - margin per invoice.

## Важный принцип

Не продавать “транскрибацию”. Продавать управленческий результат:

- кто теряет лиды;
- где повторяется ошибка;
- какой звонок переслушать;
- что исправить завтра;
- сколько денег под риском.
