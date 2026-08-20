const WEEKTRACKER_VERSION = '0.1.0';

function doGet() {
  registerWeekTrackerWebAppUrl_();

  if (!getSpreadsheetId_()) {
    return HtmlService.createHtmlOutput(`
      <div style="font-family:Arial,sans-serif;max-width:720px;margin:60px auto;padding:28px;line-height:1.55">
        <h1>WeekTracker ещё не настроен.</h1>
        <p>Для обычной установки:</p>
        <ol>
          <li>Вернитесь в свою Google Таблицу WeekTracker.</li>
          <li>Выберите <strong>WeekTracker → Первоначальная настройка</strong>.</li>
          <li>После завершения настройки обновите эту страницу или продолжите установку по инструкции.</li>
        </ol>
        <p><small>Если вы используете standalone development setup, <code>setupProject()</code> также можно запустить из редактора Apps Script.</small></p>
      </div>
    `).setTitle('WeekTracker — Setup required');
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('WeekTracker — Недельный планер')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function todayIso_() {
  const tz = Session.getScriptTimeZone() || 'Etc/UTC';
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function habitDefinitions_() {
  return getHabitRecords_()
    .filter(h => isActive_(h.active))
    .map(h => ({
      id: String(h.habitId),
      name: String(h.name),
      schedule: normalizeHabitSchedule_([
        h.mon, h.tue, h.wed, h.thu, h.fri, h.sat, h.sun
      ])
    }));
}

function habitLogMap_() {
  return buildHabitLogMap_(getHabitLogRecords_());
}

function getAppData() {
  const rawWeekStart = getSetting_('weekStart');
  const weekStart = mondayIso_(rawWeekStart || todayIso_());

  if (String(rawWeekStart || '') !== weekStart) {
    setSetting_('weekStart', weekStart);
  }

  const taskRows = getTaskRecords_().filter(r =>
    isActive_(r.active) && normalizeDateIso_(r.weekStart) === weekStart
  );

  const habitDefs = habitDefinitions_();
  const habitLog = habitLogMap_();

  const dayNames = ['ПОНЕДЕЛЬНИК','ВТОРНИК','СРЕДА','ЧЕТВЕРГ','ПЯТНИЦА','СУББОТА','ВОСКРЕСЕНЬЕ'];
  const dayShort = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysIso_(weekStart, i);
    const tasks = taskRows
      .filter(t => Number(t.day) === i + 1)
      .sort((a,b) => Number(a.position) - Number(b.position))
      .map(t => ({
        row: t._row,
        position: Number(t.position),
        task: String(t.task),
        done: !!t.done,
        category: String(t.category || '')
      }));

    const taskProgress = calculateTaskProgress_(tasks);
    days.push({
      index: i,
      name: dayNames[i],
      short: dayShort[i],
      date,
      tasks,
      completed: taskProgress.completed,
      total: taskProgress.total,
      progress: taskProgress.progress
    });
  }

  const habits = habitDefs.map(h => {
    const values = h.schedule.map((enabled, i) => {
      const date = days[i].date;
      if (!enabled) return null;
      return habitLog[date + '|' + h.id] === true;
    });
    const habitProgress = calculateHabitProgress_(values);
    return {
      id: h.id,
      name: h.name,
      schedule: h.schedule,
      values,
      required: habitProgress.required,
      completed: habitProgress.completed
    };
  });

  const habitSummary = calculateHabitSummary_(habits);
  const weekTaskProgress = calculateWeekTaskProgress_(days);

  return {
    title: String(getSetting_('title') || 'WeekTracker'),
    subtitle: String(getSetting_('subtitle') || ''),
    weekStart,
    weekEnd: addDaysIso_(weekStart, 6),
    days,
    habits,
    habitProgress: habitSummary.habitProgress,
    habitCompleted: habitSummary.habitCompleted,
    habitRequired: habitSummary.habitRequired,
    weekProgress: weekTaskProgress.weekProgress,
    taskCompleted: weekTaskProgress.taskCompleted,
    taskTotal: weekTaskProgress.taskTotal
  };
}

function setWeekStart(weekStart) {
  const normalized = normalizeDateIso_(weekStart);
  if (!normalized) throw new Error('Неверная дата.');

  const monday = mondayIso_(normalized);
  setSetting_('weekStart', monday);
  return getAppData();
}

function toggleTask(row, done) {
  setTaskDone_(row, done);
  return {ok:true};
}

function updateTaskText(row, text) {
  const clean = normalizeTaskText_(text);
  if (!clean) throw new Error('Название задачи не может быть пустым.');
  setTaskText_(row, clean);
  return {ok:true};
}

function addTask(weekStart, day, text) {
  weekStart = mondayIso_(weekStart);
  const clean = normalizeTaskText_(text);
  if (!clean) throw new Error('Введите название задачи.');

  const tasks = getTaskRecords_();
  const position = calculateNextTaskPosition_(tasks, weekStart, day);
  const row = appendTask_({
    weekStart,
    day,
    position,
    task: clean,
    done: false,
    category: 'Custom',
    active: true
  });

  return {
    ok: true,
    task: {
      row: row,
      position: position,
      task: clean,
      done: false,
      category: 'Custom'
    }
  };
}

function deleteTask(row) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < 2 || r > getTaskLastRow_()) {
    throw new Error('Не удалось найти задачу для удаления.');
  }

  setTaskActive_(r, false);
  return {ok:true};
}

function moveTask(row, direction) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < 2 || r > getTaskLastRow_()) {
    throw new Error('Не удалось найти задачу для перемещения.');
  }

  const tasks = getTaskRecords_().map(task => ({
    id: task._row,
    weekStart: task.weekStart,
    day: task.day,
    position: task.position,
    active: task.active
  }));
  const swap = findTaskPositionSwap_(tasks, r, direction);
  if (!swap) return {ok:true};

  setTaskPosition_(swap.currentId, swap.targetPosition);
  setTaskPosition_(swap.targetId, swap.currentPosition);

  return {ok:true};
}

function toggleHabit(date, habitId, done) {
  date = normalizeDateIso_(date);
  if (!date) throw new Error('Некорректная дата привычки.');

  const habits = getHabitRecords_();
  const habit = habits.find(record =>
    String(record.habitId) === String(habitId) && isActive_(record.active)
  );
  if (!habit) {
    return {ok:false, code:'HABIT_NOT_FOUND'};
  }

  // Берём последнюю подходящую запись, чтобы корректно работать
  // и с legacy-дубликатами в журнале привычек.
  const records = getHabitLogRecords_();
  const matchIndex = findLastHabitLogMatch_(records, habitId, date);
  if (matchIndex >= 0) {
    updateHabitLog_(records[matchIndex]._row, done, new Date());
    return {ok:true};
  }

  appendHabitLog_({ date, habitId, done, updatedAt: new Date() });
  return {ok:true};
}

function addHabit(name, schedule) {
  const habit = createHabitData_(name, schedule);
  if (!habit.name) throw new Error('Введите название привычки.');

  if (!habit.schedule.some(Boolean)) throw new Error('Выбери хотя бы один день недели.');

  const habits = getHabitRecords_();

  if (hasActiveHabitWithName_(habits, habit.name)) {
    return {
      ok: false,
      code: 'DUPLICATE_HABIT_NAME',
      message: 'Привычка с таким названием уже существует'
    };
  }

  const id = 'h_' + Date.now();
  appendHabit_(id, habit);
  return {ok:true, id:id};
}

function deleteHabit(habitId) {
  const habits = getHabitRecords_();
  const habit = habits.find(record => String(record.habitId) === String(habitId));
  if (habit) {
    setHabitActive_(habit._row, false);
    return {ok:true};
  }
  throw new Error('Не удалось найти привычку для удаления.');
}
