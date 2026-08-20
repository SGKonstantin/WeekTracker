# Участие в разработке WeekTracker

Помочь проекту можно несколькими способами.

## 1. Bug Report

Создайте Issue с описанием ошибки, шагами воспроизведения и ожидаемым поведением. Для regression fix желательно сначала добавить failing test.

## 2. Feature Request

Опишите проблему пользователя, предлагаемое поведение и возможные альтернативы. Перед крупной функцией сначала создайте Feature Request.

## 3. Документация

Полезны исправления инструкций, улучшение формулировок, переводы, accessibility-рекомендации и очищенные от приватных данных скриншоты.

## 4. Тесты

Можно добавлять characterization, unit и regression tests. Изменение поведения должно сопровождаться обновлением тестов.

## 5. Изменение кода

Типичный процесс:

```text
fork → branch → change → npm run check → Pull Request → review → merge после approval
```

Pull Request не меняет основной проект автоматически. Maintainer проверяет diff и tests и решает, можно ли выполнить merge.

Делайте небольшие сфокусированные изменения и не объединяйте несвязанные refactor и product features.

## Безопасность

- Не коммитьте `.clasp.json` и `.clasprc.json`.
- Не публикуйте tokens, credentials, Spreadsheet IDs, deployment URLs и персональные данные.
- Очищайте logs и screenshots перед добавлением в Issue или PR.

## Архитектурные границы

- Чистые business rules находятся в `Core.gs` без GAS API.
- Google Sheets и Script Properties доступны через `Repository.gs`.
- Публичный backend API и orchestration находятся в `Code.gs`.
- Первоначальная схема создаётся в `Setup.gs`.
- Google Sheets custom menu, launcher и работа с Web App URL находятся в `Menu.gs`.

Перед Pull Request обязательно выполните `npm install` и `npm run check`.
