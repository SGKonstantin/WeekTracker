# Разработка WeekTracker

Для пользовательской установки используйте Google Sheets template flow из [инструкции по установке](INSTALLATION.md). Этот документ описывает локальную разработку и standalone/clasp workflow.

## Архитектура

```text
src/Index.html
    ↓
src/Code.gs
   ↙     ↘
src/Core.gs  src/Repository.gs
             ↓
        Google Sheets

src/Setup.gs — отдельный installation/setup layer
src/Menu.gs — меню bound Google Таблицы и запуск Web App
```

- `src/Index.html` — адаптивный frontend, вызовы `google.script.run` и optimistic UI.
- `src/Code.gs` — публичный backend API, валидация, orchestration и сборка DTO.
- `src/Core.gs` — чистая бизнес-логика без Google Apps Script API.
- `src/Repository.gs` — runtime-доступ к Google Sheets и Script Properties.
- `src/Setup.gs` — подготовка схемы в bound-таблице или создание отдельной таблицы в standalone-режиме.
- `src/Menu.gs` — меню bound-таблицы, регистрация и открытие Web App URL.

## Настройка clasp

Production source находится в каталоге `src/`. Локальный приватный `.clasp.json` для clasp 3.x должен указывать этот каталог как `rootDir`:

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "src"
}
```

Используйте ID собственного development Apps Script-проекта. `.clasp.json` никогда не коммитится.

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

## Обновление WeekTracker Template

Проверенные production-файлы публикуются из `WeekTracker/src/`. Локальный проект `WeekTrackerTemplateBuild` должен либо получать production-файлы из этого каталога, либо использовать собственную source directory с соответствующим `rootDir` в приватном `.clasp.json`. Private Template Script ID в репозитории не хранится.

## Архитектурные границы

Business rules и чистые преобразования размещаются в Core. Доступ к Sheet rows, ranges и Script Properties находится в Repository. Code координирует эти уровни и сохраняет публичные backend contracts. Setup не является runtime repository и отвечает только за установку.

Изменение поведения должно сопровождаться тестами. Исправление регрессии желательно начинать с failing test.

## Как проходит Pull Request

Pull Request не изменяет ветку `main` автоматически. Maintainer изучает diff, проверяет tests и документацию, может запросить исправления и отдельно принимает решение о merge. Изменения попадают в основной проект только после одобрения и merge.

Перед крупной функцией рекомендуется сначала создать Feature Request и согласовать ожидаемое поведение.
