import { useEffect, useId, useRef, useState } from "react";
import { DAILY_LAUNCH_DATE, addDailyDays, parseDateKey } from "../utils/dailyDate.js";
import { canSelectDailyDate, formatDailyDate, getCalendarMonth, shiftCalendarMonth } from "../utils/dailyRetention.js";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DailyCalendar({ dateKey, today, records, loading, error, schedule, onSelect, onOpen }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(dateKey.slice(0, 7));
  const [focusedDate, setFocusedDate] = useState(dateKey);
  const root = useRef(null);
  const trigger = useRef(null);
  const dayButtons = useRef(new Map());
  const id = useId();
  const completed = new Set(records.filter(record => record.completed).map(record => record.dateKey));
  const cells = getCalendarMonth(month);

  useEffect(() => {
    if (!open) return;
    dayButtons.current.get(focusedDate)?.focus({ preventScroll: true });
  }, [open, focusedDate, month]);

  useEffect(() => {
    if (!open) return;
    const onOutside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const onEscape = event => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  function close() { setOpen(false); trigger.current?.focus(); }
  function focusDate(next) {
    if (!canSelectDailyDate(next, today, schedule)) return;
    setMonth(next.slice(0, 7));
    setFocusedDate(next);
  }
  function changeMonth(offset) {
    const next = shiftCalendarMonth(month, offset);
    if (next < DAILY_LAUNCH_DATE.slice(0, 7) || next > today.slice(0, 7)) return;
    const firstAvailable = getCalendarMonth(next).find(date => date && canSelectDailyDate(date, today, schedule));
    if (firstAvailable) focusDate(firstAvailable);
  }
  function handleDayKey(event, date) {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (Object.hasOwn(offsets, event.key)) {
      event.preventDefault();
      focusDate(addDailyDays(date, offsets[event.key]));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const weekday = new Date(parseDateKey(date)).getUTCDay();
      const next = addDailyDays(date, event.key === "Home" ? -weekday : 6 - weekday);
      focusDate(next < DAILY_LAUNCH_DATE ? DAILY_LAUNCH_DATE : next > today ? today : next);
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      changeMonth(event.key === "PageUp" ? -1 : 1);
    }
  }

  return (
    <div className="dailyDatePicker" ref={root} onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button type="button" className="dailyDateButton" ref={trigger} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined} onClick={() => {
        if (open) { close(); return; }
        setMonth(dateKey.slice(0, 7));
        setFocusedDate(dateKey);
        setOpen(true);
        onOpen();
      }}>{formatDailyDate(dateKey)} <span aria-hidden="true">▾</span></button>

      {open && <div className="dailyCalendar" id={id} role="dialog" aria-label="Daily puzzle calendar">
        <div className="dailyCalendarHeading">
          <button type="button" aria-label="Previous month" disabled={month <= DAILY_LAUNCH_DATE.slice(0, 7)} onClick={() => changeMonth(-1)}>←</button>
          <strong id={`${id}-month`} aria-live="polite">{formatDailyDate(`${month}-01`, { month: "long", year: "numeric" })}</strong>
          <button type="button" aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => changeMonth(1)}>→</button>
        </div>
        <div role="grid" aria-labelledby={`${id}-month`} aria-describedby={`${id}-help`} className="dailyCalendarGrid">
          <div role="row">{weekdays.map(day => <span key={day} role="columnheader">{day}</span>)}</div>
          {Array.from({ length: cells.length / 7 }, (_, row) => <div role="row" key={row}>
            {cells.slice(row * 7, row * 7 + 7).map((date, column) => <div role="gridcell" key={date ?? `blank-${column}`}>
              {date && <button type="button" ref={element => { if (element) dayButtons.current.set(date, element); else dayButtons.current.delete(date); }}
                disabled={!canSelectDailyDate(date, today, schedule)} tabIndex={focusedDate === date ? 0 : -1}
                data-date={date} className={`${completed.has(date) ? "calendarCompleted" : ""} ${date === today ? "calendarToday" : ""}`}
                aria-current={date === today ? "date" : undefined} aria-pressed={date === dateKey}
                aria-label={`${formatDailyDate(date)}${date === today ? ", Today" : ""}, ${!canSelectDailyDate(date, today, schedule) ? "Unavailable" : loading ? "Loading result" : error ? "Result unavailable" : completed.has(date) ? "Completed" : date < today ? "Missed" : "Not completed yet"}`}
                onFocus={() => setFocusedDate(date)} onKeyDown={event => handleDayKey(event, date)} onClick={() => {
                  if (!canSelectDailyDate(date, today, schedule)) return;
                  onSelect(date);
                  close();
                }}>
                <span>{Number(date.slice(-2))}</span>{completed.has(date) && <span className="calendarCheck" aria-hidden="true">✓</span>}
              </button>}
            </div>)}
          </div>)}
        </div>
        <p className="dailyCalendarLegend">✓ Completed · Unmarked past dates are missed</p>
        <p id={`${id}-help`} className="dailyCalendarHelp">Arrow keys move between days. Escape closes.</p>
        {loading && <p role="status">Loading saved results…</p>}
        {error && <p role="status">{error}</p>}
        <button type="button" className="dailyCalendarClose" onClick={close}>Close calendar</button>
      </div>}
    </div>
  );
}

export default DailyCalendar;
