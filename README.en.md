# 📅 WeekTracker

[![CI](https://github.com/SGKonstantin/WeekTracker/actions/workflows/ci.yml/badge.svg)](https://github.com/SGKonstantin/WeekTracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Русская версия](README.md)

## What is WeekTracker?

WeekTracker is a free, open-source weekly planner and habit tracker delivered as a Google Apps Script Web App. It uses a private Google Sheet in the user's account, needs no separate server, and starts with 0 tasks and 0 habits.

![WeekTracker weekly planner and habit tracker](docs/images/weektracker-overview.png)

## Features

- Monday–Sunday planning and week navigation
- Task creation, inline editing, completion, soft deletion, and ordering within one day
- Daily and weekly task progress
- Habits with weekday schedules, completion tracking, and soft deletion
- Protection against duplicate active habit names
- Responsive interface with optimistic UI updates

Tasks cannot currently be moved between days.

## Screenshots

<p align="center">
  <img src="docs/images/weektracker-task.png" width="49%" alt="Adding a task in WeekTracker">
  <img src="docs/images/weektracker-habit.png" width="49%" alt="Adding a habit in WeekTracker">
</p>

WeekTracker runs in a browser and can also be used from a mobile device.

<p align="center">
  <img src="docs/images/weektracker-mobile.png" width="340" alt="WeekTracker in a mobile browser">
</p>

## Installation

The primary end-user installation flow uses a Google Sheets template:

[Create your own WeekTracker copy](https://docs.google.com/spreadsheets/d/%317T7ZwIzmjOS9dhjkvPIkf44EyPINVzOCXXwXz6E1wIs/copy)

This link opens Google's page for creating your personal copy of the template.

1. Copy the WeekTracker Google Sheets template.
2. Run **WeekTracker → Initial setup** in your copy.
3. Deploy its Apps Script project as a Web App.
4. Open the deployed Web App URL once to register it.
5. Afterwards, use **WeekTracker → Open application** from the Google Sheet menu.

See the [detailed Russian installation guide](docs/INSTALLATION.md). English step-by-step documentation may be added later.

## Usage

Choose a week, add tasks to day cards, edit their text, toggle completion, and reorder them with the up/down controls. Create habits with selected weekdays and mark their completion in the habit grid. See the [Russian user guide](docs/USER_GUIDE.md) for detailed UI instructions.

## Development

Production source lives in `src/`. Local development, testing, and the standalone/clasp workflow are documented in the [developer guide](docs/DEVELOPMENT.md).

## Data & Privacy

Application data stays in the user's Google Sheet. Tasks and habits are soft-deleted, HabitLog history is retained, and there is no automatic permanent cleanup. Users control their Google account and deployment access settings.

## Feedback

After the repository is published, use GitHub Issues for bug reports and feature ideas. Sanitize logs and screenshots first.

## Contributing

Focused pull requests are welcome. Run `npm run check`, update tests for behavior changes, and preserve the Core/Repository/Code boundaries. See [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) (Russian).

For help and feedback, see [docs/SUPPORT.md](docs/SUPPORT.md) (Russian).

## Troubleshooting

Common issues include missing setup, Google authorization, disabled Apps Script API, clasp login or binding problems, and stale versioned deployments. See the [Russian troubleshooting guide](docs/TROUBLESHOOTING.md).

## License

WeekTracker is licensed under the [MIT License](LICENSE).
