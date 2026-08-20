function getSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '';
}

function getDataSpreadsheet_() {
  const id = getSpreadsheetId_();
  if (!id) throw new Error('WeekTracker не настроен. Запустите setupProject().');
  return SpreadsheetApp.openById(id);
}

function getAppSheet_(name) {
  const sheet = getDataSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Не найден лист: ' + name);
  return sheet;
}

function formatSheetDateOnly_(value) {
  if (!(value instanceof Date) || isNaN(value.getTime())) return value;
  const timeZone = getDataSpreadsheet_().getSpreadsheetTimeZone();
  return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
}

function readSheetRecords_(name) {
  const values = getAppSheet_(name).getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(String);
  return values.slice(1).map((row, index) => {
    const record = {};
    headers.forEach((header, column) => record[header] = row[column]);
    record._row = index + 2;
    return record;
  }).filter(record => headers.some(header => record[header] !== ''));
}

function getDataSpreadsheetUrl_() {
  return getDataSpreadsheet_().getUrl();
}

function getSetting_(key) {
  const records = readSheetRecords_('APP_Settings');
  const setting = records.find(record => String(record.key) === key);
  if (!setting) return '';
  return key === 'weekStart' ? formatSheetDateOnly_(setting.value) : setting.value;
}

function setSetting_(key, value) {
  const sheet = getAppSheet_('APP_Settings');
  const records = readSheetRecords_('APP_Settings');
  const setting = records.find(record => String(record.key) === key);
  if (setting) {
    const cell = sheet.getRange(setting._row, 2);
    cell.setNumberFormat('@');
    cell.setValue(String(value));
    return;
  }
  sheet.appendRow([key, String(value)]);
  sheet.getRange(sheet.getLastRow(), 2).setNumberFormat('@');
}

function getTaskRecords_() {
  return readSheetRecords_('APP_Tasks').map(task => ({
    ...task,
    weekStart: formatSheetDateOnly_(task.weekStart)
  }));
}

function appendTask_(task) {
  const sheet = getAppSheet_('APP_Tasks');
  sheet.appendRow([
    task.weekStart,
    Number(task.day),
    task.position,
    task.task,
    !!task.done,
    task.category,
    isActive_(task.active)
  ]);
  return sheet.getLastRow();
}

function getTaskLastRow_() {
  return getAppSheet_('APP_Tasks').getLastRow();
}

function setTaskDone_(row, done) {
  getAppSheet_('APP_Tasks').getRange(Number(row), 5).setValue(!!done);
}

function setTaskText_(row, text) {
  getAppSheet_('APP_Tasks').getRange(Number(row), 4).setValue(text);
}

function setTaskActive_(row, active) {
  getAppSheet_('APP_Tasks').getRange(Number(row), 7).setValue(!!active);
}

function setTaskPosition_(row, position) {
  getAppSheet_('APP_Tasks').getRange(Number(row), 3).setValue(position);
}

function getHabitRecords_() {
  return readSheetRecords_('APP_Habits');
}

function appendHabit_(id, habit) {
  getAppSheet_('APP_Habits').appendRow([
    id,
    habit.name,
    ...habit.schedule,
    isActive_(habit.active)
  ]);
}

function setHabitActive_(row, active) {
  getAppSheet_('APP_Habits').getRange(Number(row), 10).setValue(!!active);
}

function getHabitLogRecords_() {
  return readSheetRecords_('APP_HabitLog').map(record => ({
    ...record,
    date: formatSheetDateOnly_(record.date)
  }));
}

function updateHabitLog_(row, done, updatedAt) {
  getAppSheet_('APP_HabitLog')
    .getRange(Number(row), 3, 1, 2)
    .setValues([[!!done, updatedAt]]);
}

function appendHabitLog_(record) {
  getAppSheet_('APP_HabitLog').appendRow([
    record.date,
    record.habitId,
    !!record.done,
    record.updatedAt
  ]);
}
