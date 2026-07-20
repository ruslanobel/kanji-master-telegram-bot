# Kanji Master Telegram Bot

Публичный inline-бот для поиска кандзи (символ / он / кун / русский перевод) с анимацией порядка черт.

## Быстрый старт

1. Создай бота в [@BotFather](https://t.me/BotFather), включи **Inline Mode**.
2. Скопируй `.env.example` → `.env`, вставь `BOT_TOKEN`.
3. Установи зависимости и собери словарь:

```bash
npm install
npm run build:data
npm run dev
```

Поиск: `@username_бота вода` / `みず` / `水`.

Анимации отдаются с **jsDelivr** (тег GitHub Release `animations-v1`), seed в Telegram не нужен.

## Анимации (Releases + jsDelivr)

| Что | Где |
|-----|-----|
| Код бота | ветка `main` |
| MP4 анимации | ветка `animations` + тег `animations-v1` |
| Release | GitHub Release с тем же тегом + zip для скачивания |
| CDN | `https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@animations-v1/mp4/{codepoint}.mp4` |

Почему так: файлы в **versioned tag** (не в `main`) → jsDelivr кеширует по тегу, Telegram стабильно тянет URL, репо кода остаётся лёгким. Release нужен для версий и bulk zip.

### Обновить / добавить анимации

```bash
npm run build:gifs
chmod +x scripts/publish-animations.sh
./scripts/publish-animations.sh animations-v2
```

Потом обнови `ANIMATIONS_CDN_BASE` в `.env` (или дефолт в `src/animations.ts`) на новый тег.

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run build:data` | Индекс KANJIDIC + JMdict (rus) |
| `npm run build:gifs` | Локальная генерация MP4 из KanjiVG |
| `./scripts/publish-animations.sh TAG` | Пуш тега + GitHub Release |
| `npm run dev` | Long polling |

## Лицензии

- Код: MIT (см. `LICENSE`)
- Анимации: производные от [KanjiVG](https://kanjivg.tagaini.net/) © Ulrich Apel, **CC BY-SA 3.0**
- Словари: KANJIDIC / JMdict (EDRDG)
