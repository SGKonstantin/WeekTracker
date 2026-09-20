# История изменений

Формат основан на [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), проект использует [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-09-20

### Изменено

- Переработан главный экран WeekTracker
- Навигация, прогресс недели и привычки объединены в компактный верхний dashboard
- Weekly progress chart теперь отображает количество выполненных задач
- Добавлена динамическая шкала графика
- Нативный browser date picker заменён на custom WeekTracker calendar
- Улучшена responsive-вёрстка для desktop, medium и mobile
- Привычки отображаются компактнее

### Исправлено

- Новая пользовательская `/copy` больше не наследует устаревший `APP_Settings.weekStart` из Template
- При первой bound-установке `weekStart` устанавливается на понедельник текущей недели
- Повторный setup сохраняет существующий `weekStart`
- Повторный setup сохраняет существующие задачи и привычки
- Сохранён timezone-safe date-only flow

### Тесты

- Добавлены regression tests для first/repeated bound setup
- Полный suite на момент подготовки релиза: 150/150

## [0.1.0] - 2026-08-20

### Добавлено

- Недельный планировщик задач с навигацией по неделям
- Создание, редактирование, выполнение, soft delete и порядок задач внутри дня
- Дневные и недельные индикаторы прогресса задач
- Привычки с расписанием по дням недели и историей выполнения
- Защита от одинаковых названий активных привычек
- Адаптивный Google Apps Script Web App с optimistic UI
- Установка через собственную копию Google Sheets Template с системными листами приложения
- Standalone-режим для разработки с отдельной таблицей `WeekTracker Data`
- Автоматические тесты, syntax check и project safety/privacy checks
