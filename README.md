# Kanji Master Telegram Bot

Публичный inline-бот для поиска кандзи (символ / он / кун / ромадзи / русская транскрипция / перевод) с анимацией порядка черт.

## Локально (long polling)

1. [@BotFather](https://t.me/BotFather): создай бота, включи **Inline Mode** (+ желательно Inline Feedback 100%).
2. `.env.example` → `.env`, вставь `BOT_TOKEN`.
3. Если раньше деплоил на Vercel: `npm run delete-webhook`.
4. Запуск:

```bash
npm install
npm run build:data
npm run seed:gifs   # опционально: кэш file_id для анимаций
npm run dev
```

Поиск: `@бот вода` / `мизу` / `mizu` / `みず` / `水`.

## Прод на Vercel (webhook) — рекомендовано для MVP

Long polling на Vercel **нельзя**. Используется webhook + Fluid Compute.

### Один раз

1. Закоммить `data/index.json` и (по возможности) `data/mp4-file-ids.json` — они нужны в деплое.
2. Сгенерируй секрет: `openssl rand -hex 24` → в `.env` как `WEBHOOK_SECRET`.
3. Создай проект в Vercel (Git import или `npx vercel`).
4. Environment Variables (Production):
   - `BOT_TOKEN`
   - `WEBHOOK_SECRET` (тот же)
5. Deploy (`npx vercel --prod` или push в main).
6. Привяжи webhook:

```bash
npm run set-webhook -- https://YOUR_APP.vercel.app
```

Проверка: `@бот вода` без локального `npm run dev`.

### Важно на Vercel

- Анимации только из задеплоенного `mp4-file-ids.json` (+ CDN превью). On-the-fly генерация MP4 **отключена**.
- Чтобы добавить анимации: локально `seed:gifs` → закоммитить обновлённый `mp4-file-ids.json` → redeploy.
- Локально и прод **нельзя** крутить одновременно с одним токеном (polling vs webhook). Перед `npm run dev` — `delete-webhook`.

## Анимации (jsDelivr)

| Что | Где |
|-----|-----|
| MP4 / preview | тег `animations-v4` на GitHub |
| CDN MP4 | `…@animations-v4/mp4/{codepoint}.mp4` |
| CDN preview | `…@animations-v4/preview/{codepoint}.jpg` |

```bash
npm run build:gifs
./scripts/publish-animations.sh animations-v5
```

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Long polling (локально) |
| `npm run set-webhook -- URL` | Привязать Vercel webhook |
| `npm run delete-webhook` | Снять webhook (для локальной разработки) |
| `npm run build:data` | Индекс словаря |
| `npm run seed:gifs` | Кэш Telegram `file_id` для анимаций |

## Лицензии

- Код: MIT (см. `LICENSE`)
- Анимации: производные от [KanjiVG](https://kanjivg.tagaini.net/) © Ulrich Apel, **CC BY-SA 3.0**
- Словари: KANJIDIC / JMdict (EDRDG)
