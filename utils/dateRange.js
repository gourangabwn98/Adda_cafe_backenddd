// ─── utils/dateRange.js ───────────────────────────────────────────────────
// This restaurant operates in IST (UTC+05:30). Computing "today" via
// `new Date().setHours(0,0,0,0)` depends on the Node process's own
// timezone — correct on a local machine already set to IST, but wrong on a
// UTC-hosted production server (e.g. Render), where it silently shifts
// "today" by 5:30 hours (see adminController.getDashboardStats/
// getOrdersSummary, chefController.getChefRevenue — all previously hit
// this). These helpers anchor to IST explicitly instead, independent of
// wherever the process actually runs.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// "YYYY-MM-DD" for the current IST calendar date.
export function todayIST() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// UTC instants for the start/end of the given IST calendar date
// ("YYYY-MM-DD"; defaults to today in IST).
export function getISTDayRange(dateStr = todayIST()) {
  return {
    start: new Date(`${dateStr}T00:00:00.000+05:30`),
    end: new Date(`${dateStr}T23:59:59.999+05:30`),
  };
}
