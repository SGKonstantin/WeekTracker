# Разработка WeekTracker

Для пользовательской установки используйте Google Sheets template flow из [инструкции по установке](INSTALLATION.md). Этот документ описывает локальную разработку и standalone/clasp workflow.

## Архитектура

```text
Index.html
    ↓
Code.gs
   ↙     ↘
Core.gs  Repository.gs
             ↓
        Google Sheets

Setup.gs — отдельный installation/setup layer
Menu.gs — меню bound Google Таблицы и запуск Web App
```

- `Index.html` — адаптивный frontend, вызовы `google.script.run` и optimistic UI.
- `Code.gs` — публичный backend API, валидация, orchestration и сборка DTO.
- `Core.gs` — чистая бизнес-логика без Google Apps Script API.
- `Repository.gs` — runtime-доступ к Google Sheets и Script Properties.
- `Setup.gs` — подготовка схемы в bound-таблице или создание отдельной таблицы в standalone-режиме.
- `Menu.gs` — меню bound-таблицы, регистрация и открытие Web App URL.

## Локальная проверка

Требуются Node.js 20+ и npm.

```sh
npm install
npm run check
```

`npm run check` проверяет синтаксис production-файлов, запускает Vitest и выполняет project safety/privacy checks.

## Workflow

```text
изменение → npm run check → clasp push → /dev smoke test → commit → Pull Request
```

- `/dev` запускает последнюю сохранённую версию для разработки.
- Versioned deployment с `/exec` используется для релиза и должен обновляться при публикации новой версии.
- `.clasp.json` и `.clasprc.json` создаются локально и не коммитятся.

## Архитектурные границы

Business rules и чистые преобразования размещаются в Core. Доступ к Sheet rows, ranges и Script Properties находится в Repository. Code координирует эти уровни и сохраняет публичные backend contracts. Setup не является runtime repository и отвечает только за установку.

Изменение поведения должно сопровождаться тестами. Исправление регрессии желательно начинать с failing test.

## Как проходит Pull Request

Pull Request не изменяет ветку `main` автоматически. Maintainer изучает diff, проверяет tests и документацию, может запросить исправления и отдельно принимает решение о merge. Изменения попадают в основной проект только после одобрения и merge.

Перед крупной функцией рекомендуется сначала создать Feature Request и согласовать ожидаемое поведение.
