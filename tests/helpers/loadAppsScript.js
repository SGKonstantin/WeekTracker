const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function formatDate(date, timeZone, pattern) {
  if (pattern !== 'yyyy-MM-dd') {
    throw new Error(`Unsupported date pattern in test stub: ${pattern}`);
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function loadAppsScript(globals = {}) {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const sourcePaths = ['Core.gs', 'Repository.gs', 'Code.gs', 'Setup.gs', 'Menu.gs']
    .map(file => path.join(projectRoot, file));
  const context = vm.createContext({
    console,
    Date,
    Utilities: { formatDate },
    Session: { getScriptTimeZone: () => 'Etc/UTC' },
    ...globals,
  });

  for (const sourcePath of sourcePaths) {
    const source = fs.readFileSync(sourcePath, 'utf8');
    new vm.Script(source, { filename: sourcePath }).runInContext(context);
  }

  return {
    normalizeDateIso_: context.normalizeDateIso_,
    mondayIso_: context.mondayIso_,
    addDaysIso_: context.addDaysIso_,
    calculateProgress_: context.calculateProgress_,
    calculateTaskProgress_: context.calculateTaskProgress_,
    calculateHabitProgress_: context.calculateHabitProgress_,
    calculateWeekTaskProgress_: context.calculateWeekTaskProgress_,
    calculateHabitSummary_: context.calculateHabitSummary_,
    normalizeTaskText_: context.normalizeTaskText_,
    calculateNextTaskPosition_: context.calculateNextTaskPosition_,
    findTaskPositionSwap_: context.findTaskPositionSwap_,
    normalizeHabitName_: context.normalizeHabitName_,
    hasActiveHabitWithName_: context.hasActiveHabitWithName_,
    normalizeHabitSchedule_: context.normalizeHabitSchedule_,
    createHabitData_: context.createHabitData_,
    findLastHabitLogMatch_: context.findLastHabitLogMatch_,
    buildHabitLogMap_: context.buildHabitLogMap_,
    getSpreadsheetId_: context.getSpreadsheetId_,
    formatSheetDateOnly_: context.formatSheetDateOnly_,
    getDataSpreadsheet_: context.getDataSpreadsheet_,
    getAppSheet_: context.getAppSheet_,
    getSetting_: context.getSetting_,
    setSetting_: context.setSetting_,
    getTaskRecords_: context.getTaskRecords_,
    appendTask_: context.appendTask_,
    setTaskDone_: context.setTaskDone_,
    setTaskText_: context.setTaskText_,
    setTaskActive_: context.setTaskActive_,
    setTaskPosition_: context.setTaskPosition_,
    getHabitRecords_: context.getHabitRecords_,
    appendHabit_: context.appendHabit_,
    setHabitActive_: context.setHabitActive_,
    getHabitLogRecords_: context.getHabitLogRecords_,
    updateHabitLog_: context.updateHabitLog_,
    appendHabitLog_: context.appendHabitLog_,
    getAppData: context.getAppData,
    doGet: context.doGet,
    setWeekStart: context.setWeekStart,
    addTask: context.addTask,
    toggleTask: context.toggleTask,
    updateTaskText: context.updateTaskText,
    deleteTask: context.deleteTask,
    moveTask: context.moveTask,
    addHabit: context.addHabit,
    toggleHabit: context.toggleHabit,
    deleteHabit: context.deleteHabit,
    setupProject: context.setupProject,
    onOpen: context.onOpen,
    openWeekTrackerFromMenu: context.openWeekTrackerFromMenu,
    setupWeekTrackerFromMenu: context.setupWeekTrackerFromMenu,
    showWeekTrackerAbout: context.showWeekTrackerAbout,
    setWeekTrackerWebAppUrlFromMenu: context.setWeekTrackerWebAppUrlFromMenu,
    isValidWeekTrackerWebAppUrl_: context.isValidWeekTrackerWebAppUrl_,
    saveWeekTrackerWebAppUrl_: context.saveWeekTrackerWebAppUrl_,
  };
}

module.exports = { loadAppsScript };
