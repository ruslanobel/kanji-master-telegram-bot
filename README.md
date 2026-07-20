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

Анимации отдаются с **jsDelivr** (тег `animations-v3`): в списке поиска — статичный JPEG, после выбора — MP4.

## Анимации (Releases + jsDelivr)

| Что | Где |
|-----|-----|
| Код бота | ветка `main` |
| MP4 анимации | ветка `animations` + тег `animations-v3` |
| Превью (JPEG) | тот же тег, папка `preview/` |
| Release | GitHub Release с тем же тегом + zip |
| CDN MP4 | `…@animations-v3/mp4/{codepoint}.mp4` |
| CDN preview | `…@animations-v3/preview/{codepoint}.jpg` |

Почему так: файлы в **versioned tag** (не в `main`) → jsDelivr кеширует по тегу, Telegram стабильно тянет URL, репо кода остаётся лёгким. Release нужен для версий и bulk zip.

### Обновить / добавить анимации

```bash
npm run build:gifs
chmod +x scripts/publish-animations.sh
./scripts/publish-animations.sh animations-v3
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
