const WEEKTRACKER_DATA_FILE_NAME = 'WeekTracker Data';

/**
 * Run this function once after copying the project.
 * It creates a private Google Sheets data store in the current user's Drive
 * and saves only its ID in Apps Script Script Properties.
 *
 * The template is intentionally empty: no tasks and no habits are preloaded.
 */
function setupProject() {
  const props = PropertiesService.getScriptProperties();
  const boundSpreadsheet = getBoundSpreadsheet_();

  if (boundSpreadsheet) {
    ensureWeekTrackerSchema_(boundSpreadsheet, true);

    props.setProperties({
      SPREADSHEET_ID: boundSpreadsheet.getId(),
      WEEKTRACKER_VERSION: WEEKTRACKER_VERSION
    });

    initializeWeekTrackerSettings_(boundSpreadsheet);
    SpreadsheetApp.flush();

    console.log('WeekTracker bound setup complete: ' + boundSpreadsheet.getUrl());
    return boundSpreadsheet.getUrl();
  }

  const existingId = props.getProperty('SPREADSHEET_ID');

  if (existingId) {
    try {
      const existing = SpreadsheetApp.openById(existingId);
      ensureWeekTrackerSchema_(existing, false);
      console.log('WeekTracker is already configured: ' + existing.getUrl());
      return existing.getUrl();
    } catch (e) {
      props.deleteProperty('SPREADSHEET_ID');
    }
  }

  const spreadsheet = SpreadsheetApp.create(WEEKTRACKER_DATA_FILE_NAME);
  ensureWeekTrackerSchema_(spreadsheet, false);

  props.setProperties({
    SPREADSHEET_ID: spreadsheet.getId(),
    WEEKTRACKER_VERSION: WEEKTRACKER_VERSION
  });

  initializeWeekTrackerSettings_(spreadsheet);
  SpreadsheetApp.flush();

  console.log('WeekTracker setup complete. Data spreadsheet: ' + spreadsheet.getUrl());
  return spreadsheet.getUrl();
}

function getBoundSpreadsheet_() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet() || null;
  } catch (error) {
    return null;
  }
}

function ensureWeekTrackerSchema_(spreadsheet, isBoundInstallation) {
  const cover = getOrCreateSheet_(spreadsheet, 'WeekTracker');
  const settings = getOrCreateSheet_(spreadsheet, 'APP_Settings');
  const tasks = getOrCreateSheet_(spreadsheet, 'APP_Tasks');
  const habits = getOrCreateSheet_(spreadsheet, 'APP_Habits');
  const habitLog = getOrCreateSheet_(spreadsheet, 'APP_HabitLog');

  writeHeaderIfEmpty_(settings, ['key', 'value']);
  writeHeaderIfEmpty_(tasks, ['weekStart', 'day', 'position', 'task', 'done', 'category', 'active']);
  writeHeaderIfEmpty_(habits, ['habitId', 'name', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'active']);
  writeHeaderIfEmpty_(habitLog, ['date', 'habitId', 'done', 'updatedAt']);

  // Keep date-only ISO values as text so Sheets does not convert them to
  // timezone-sensitive Date objects. Legacy Date values remain supported
  // by the Repository read path.
  settings.getRange('B:B').setNumberFormat('@');
  tasks.getRange('A:A').setNumberFormat('@');
  habitLog.getRange('A:A').setNumberFormat('@');

  [settings, tasks, habits, habitLog].forEach(sheet => {
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
    if (!sheet.isSheetHidden()) sheet.hideSheet();
  });

  cover.showSheet();

  if (isBoundInstallation) {
    if (getWeekTrackerWebAppUrl_()) {
      renderWeekTrackerLandingReady_(cover);
    } else {
      renderWeekTrackerLandingPending_(cover);
    }
  } else {
    cover.clear();
    cover.getRange('A1').setValue('WeekTracker');
    cover.getRange('A2').setValue('This spreadsheet is the private data store for your WeekTracker web app.');
    cover.getRange('A3').setValue('Use the web app for daily work. The APP_* sheets are managed automatically.');
    cover.getRange('A5').setValue('Version');
    cover.getRange('B5').setValue(WEEKTRACKER_VERSION);
    styleWeekTrackerLanding_(cover, 'A1:B5');
  }
}

function renderWeekTrackerLandingPending_(cover) {
  cover.showSheet();
  cover.clear();
  cover.getRange('A1').setValue('WeekTracker');
  cover.getRange('A3').setValue('Недельный планировщик и трекер привычек');
  cover.getRange('A5').setValue('Для первого запуска:');
  cover.getRange('A7').setValue('1. WeekTracker → Первоначальная настройка');
  cover.getRange('A9').setValue(
    '2. Расширения → Apps Script → Начать развертывание\n' +
    '   → Новое развертывание → шестерёнка\n' +
    '   → Веб-приложение → Начать развертывание'
  );
  cover.getRange('A11').setValue(
    '3. Откройте полученную ссылку WeekTracker один раз\n' +
    '   и вернитесь в Google Таблицы'
  );
  cover.getRange('A13').setValue('После установки:\nWeekTracker → Открыть приложение');
  cover.getRange('A15').setValue('Ваши данные хранятся только в этой копии таблицы.');
  styleWeekTrackerLanding_(cover, 'A1:A15');
}

function renderWeekTrackerLandingReady_(cover) {
  cover.showSheet();
  cover.clear();
  cover.getRange('A1').setValue('WeekTracker');
  cover.getRange('A3').setValue('Недельный планировщик и трекер привычек');
  cover.getRange('A5').setValue('✓ WeekTracker настроен и готов к работе.');
  cover.getRange('A7').setValue('Чтобы открыть приложение:\nWeekTracker → Открыть приложение');
  cover.getRange('A9').setValue(
    'Ваши данные хранятся только в этой копии таблицы.\n' +
    'Не удаляйте эту таблицу, если хотите сохранить данные.'
  );
  styleWeekTrackerLanding_(cover, 'A1:A9');
}

function styleWeekTrackerLanding_(cover, rangeA1) {
  cover.getRange('A1').setFontSize(24).setFontWeight('bold');
  cover.getRange(rangeA1).setWrap(true);
  cover.setColumnWidth(1, 560);
  cover.setColumnWidth(2, 160);
}

function updateWeekTrackerLandingReady_() {
  try {
    const spreadsheet = getDataSpreadsheet_();
    const cover = spreadsheet.getSheetByName('WeekTracker');
    if (!cover) return false;

    renderWeekTrackerLandingReady_(cover);
    return true;
  } catch (error) {
    return false;
  }
}

function initializeWeekTrackerSettings_(spreadsheet) {
  const settings = spreadsheet.getSheetByName('APP_Settings');
  if (!settings) throw new Error('APP_Settings sheet is missing.');

  const rows = settings.getDataRange().getValues();
  const existingKeys = new Set(rows.slice(1).map(r => String(r[0])));
  const defaults = [
    ['weekStart', mondayIso_(todayIso_())],
    ['title', 'WeekTracker'],
    ['subtitle', 'Недельный планер и трекер привычек'],
    ['theme', 'warm']
  ].filter(([key]) => !existingKeys.has(key));

  if (defaults.length) {
    settings.getRange(settings.getLastRow() + 1, 1, defaults.length, 2).setValues(defaults);
    settings.getRange(2, 2, Math.max(settings.getLastRow() - 1, 1), 1).setNumberFormat('@');
  }
}

function getOrCreateSheet_(spreadsheet, name) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    const allSheets = spreadsheet.getSheets();
    if (name === 'WeekTracker' && allSheets.length === 1 && allSheets[0].getName() === 'Sheet1') {
      sheet = allSheets[0];
      sheet.setName(name);
    } else {
      sheet = spreadsheet.insertSheet(name);
    }
  }
  return sheet;
}

function writeHeaderIfEmpty_(sheet, headers) {
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

/** Returns the private data spreadsheet URL for the current installation. */
function getDataSpreadsheetUrl() {
  const url = getDataSpreadsheetUrl_();
  console.log(url);
  return url;
}
