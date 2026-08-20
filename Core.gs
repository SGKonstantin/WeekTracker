function isoDate_(date) {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function parseIso_(s) {
  const p = String(s).split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}

// Google Sheets may return a date as:
// - a Date object,
// - a sheet serial number such as 46244,
// - an ISO string,
// - a localized string.
// Internally the app ALWAYS works with yyyy-MM-dd.
function normalizeDateIso_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return isoDate_(value);
  }

  if (typeof value === 'number' && isFinite(value)) {
    // Google Sheets/Excel serial date epoch: 1899-12-30.
    const epoch = Date.UTC(1899, 11, 30);
    return isoDate_(new Date(epoch + Math.round(value) * 86400000));
  }

  const s = String(value == null ? '' : value).trim();
  if (!s) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const ru = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`;

  // Numeric serial accidentally stored as text.
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 1000 && n < 100000) {
      const epoch = Date.UTC(1899, 11, 30);
      return isoDate_(new Date(epoch + Math.round(n) * 86400000));
    }
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return isoDate_(parsed);

  return '';
}

function mondayIso_(value) {
  const iso = normalizeDateIso_(value);
  if (!iso) return todayIso_();

  const d = parseIso_(iso);
  const weekday = d.getUTCDay(); // Sun=0 ... Sat=6
  const shift = (weekday + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return isoDate_(d);
}

function addDaysIso_(iso, n) {
  const d = parseIso_(mondayIso_(iso));
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate_(d);
}

function calculateProgress_(completed, total) {
  return total ? Math.round(completed * 100 / total) : 0;
}

function calculateTaskProgress_(tasks) {
  const completed = tasks.filter(task => task.done).length;
  const total = tasks.length;
  return { completed, total, progress: calculateProgress_(completed, total) };
}

function calculateHabitProgress_(values) {
  const required = values.filter(value => value !== null).length;
  const completed = values.filter(value => value === true).length;
  return { required, completed, progress: calculateProgress_(completed, required) };
}

function calculateWeekTaskProgress_(days) {
  const taskTotal = days.reduce((sum, day) => sum + day.total, 0);
  const taskCompleted = days.reduce((sum, day) => sum + day.completed, 0);
  return {
    taskTotal,
    taskCompleted,
    weekProgress: calculateProgress_(taskCompleted, taskTotal)
  };
}

function calculateHabitSummary_(habits) {
  const habitRequired = habits.reduce((sum, habit) => sum + habit.required, 0);
  const habitCompleted = habits.reduce((sum, habit) => sum + habit.completed, 0);
  return {
    habitRequired,
    habitCompleted,
    habitProgress: calculateProgress_(habitCompleted, habitRequired)
  };
}

function isActive_(value) {
  return value !== false && String(value).toLowerCase() !== 'false';
}

function normalizeTaskText_(text) {
  return String(text || '').trim();
}

function normalizeHabitName_(name) {
  return String(name || '').trim().toLowerCase();
}

function hasActiveHabitWithName_(habits, name) {
  const normalizedName = normalizeHabitName_(name);
  return habits.some(habit =>
    isActive_(habit.active) && normalizeHabitName_(habit.name) === normalizedName
  );
}

function normalizeHabitSchedule_(schedule) {
  return Array.isArray(schedule) && schedule.length === 7
    ? schedule.map(Boolean)
    : [true, true, true, true, true, true, true];
}

function createHabitData_(name, schedule) {
  return {
    name: String(name || '').trim(),
    schedule: normalizeHabitSchedule_(schedule),
    active: true
  };
}

function findLastHabitLogMatch_(records, habitId, date) {
  for (let i = records.length - 1; i >= 0; i--) {
    if (
      normalizeDateIso_(records[i].date) === date &&
      String(records[i].habitId) === String(habitId)
    ) {
      return i;
    }
  }
  return -1;
}

function buildHabitLogMap_(records) {
  const map = {};
  records.forEach(record => {
    const date = normalizeDateIso_(record.date);
    if (!date) return;
    map[date + '|' + String(record.habitId)] = !!record.done;
  });
  return map;
}

function calculateNextTaskPosition_(tasks, weekStart, day) {
  const normalizedWeekStart = normalizeDateIso_(weekStart);
  const targetDay = Number(day);
  let maxPosition = 0;

  tasks.forEach(task => {
    if (
      normalizeDateIso_(task.weekStart) === normalizedWeekStart &&
      Number(task.day) === targetDay &&
      isActive_(task.active)
    ) {
      maxPosition = Math.max(maxPosition, Number(task.position) || 0);
    }
  });

  return maxPosition + 1;
}

function findTaskPositionSwap_(tasks, taskId, direction) {
  const current = tasks.find(task => String(task.id) === String(taskId));
  if (!current) return null;

  const weekStart = normalizeDateIso_(current.weekStart);
  const day = Number(current.day);
  const candidates = tasks
    .filter(task =>
      normalizeDateIso_(task.weekStart) === weekStart &&
      Number(task.day) === day &&
      isActive_(task.active)
    )
    .sort((a, b) => Number(a.position) - Number(b.position));

  const index = candidates.findIndex(task => String(task.id) === String(taskId));
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= candidates.length) return null;

  const target = candidates[targetIndex];
  return {
    currentId: current.id,
    currentPosition: Number(current.position),
    targetId: target.id,
    targetPosition: Number(target.position)
  };
}
