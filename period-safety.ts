/**
 * PERIOD & DATE SAFETY UTILITIES
 * 
 * Provides timezone-aware date parsing and period filtering for small business metrics.
 * Uses native Intl.DateTimeFormat to honor the business's configured timezone (e.g. Asia/Kolkata)
 * without assuming UTC or local machine dates.
 */

export interface PeriodDateParts {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 31
  dateStr: string; // YYYY-MM-DD
  yearMonthStr: string; // YYYY-MM
}

/**
 * Extract YYYY, MM, DD in the business's specific timezone
 */
export function getDatePartsInTimezone(dateInput: Date | string | number, timezone: string = 'Asia/Kolkata'): PeriodDateParts {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  
  // Guard against invalid dates
  if (isNaN(d.getTime())) {
    return {
      year: 1970,
      month: 1,
      day: 1,
      dateStr: '1970-01-01',
      yearMonthStr: '1970-01',
    };
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    // en-CA outputs "YYYY-MM-DD"
    const dateStr = formatter.format(d);
    const [yStr, mStr, dStr] = dateStr.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const day = parseInt(dStr, 10);

    return {
      year,
      month,
      day,
      dateStr,
      yearMonthStr: `${yStr}-${mStr}`,
    };
  } catch {
    // Fallback if timezone string is invalid
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const mPadded = m.toString().padStart(2, '0');
    const dPadded = day.toString().padStart(2, '0');
    return {
      year: y,
      month: m,
      day,
      dateStr: `${y}-${mPadded}-${dPadded}`,
      yearMonthStr: `${y}-${mPadded}`,
    };
  }
}

/**
 * Returns current date parts in the given business timezone
 */
export function getNowInTimezone(timezone: string = 'Asia/Kolkata'): PeriodDateParts {
  return getDatePartsInTimezone(new Date(), timezone);
}

/**
 * Checks if a given timestamp occurred "Today" in the business timezone
 */
export function isTodayInTimezone(dateInput: Date | string | number, timezone: string = 'Asia/Kolkata'): boolean {
  const nowParts = getNowInTimezone(timezone);
  const targetParts = getDatePartsInTimezone(dateInput, timezone);
  return targetParts.dateStr === nowParts.dateStr;
}

/**
 * Checks if a given timestamp occurred in the "Current Month" in the business timezone
 */
export function isCurrentMonthInTimezone(dateInput: Date | string | number, timezone: string = 'Asia/Kolkata'): boolean {
  const nowParts = getNowInTimezone(timezone);
  const targetParts = getDatePartsInTimezone(dateInput, timezone);
  return targetParts.yearMonthStr === nowParts.yearMonthStr;
}

/**
 * Checks if a given timestamp occurred in the "Previous Month" in the business timezone
 */
export function isPreviousMonthInTimezone(dateInput: Date | string | number, timezone: string = 'Asia/Kolkata'): boolean {
  const nowParts = getNowInTimezone(timezone);
  const targetParts = getDatePartsInTimezone(dateInput, timezone);
  
  let prevYear = nowParts.year;
  let prevMonth = nowParts.month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevYearMonthStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
  return targetParts.yearMonthStr === prevYearMonthStr;
}

/**
 * Number of days in a given month/year
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Days elapsed in the current month in the business timezone
 */
export function getDaysElapsedInCurrentMonth(timezone: string = 'Asia/Kolkata'): { elapsed: number; total: number } {
  const nowParts = getNowInTimezone(timezone);
  const total = getDaysInMonth(nowParts.year, nowParts.month);
  return {
    elapsed: Math.max(1, nowParts.day),
    total,
  };
}

/**
 * Checks if a given target date string or timestamp is strictly overdue (before today) in the business timezone
 */
export function isOverdueInTimezone(dateInput: Date | string | number, timezone: string = 'Asia/Kolkata'): boolean {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return false;
  const nowParts = getNowInTimezone(timezone);
  const targetParts = getDatePartsInTimezone(d, timezone);
  return targetParts.dateStr < nowParts.dateStr;
}

/**
 * Checks if a given target date string or timestamp is upcoming (in the future, after today) in the business timezone
 */
export function isUpcomingInTimezone(dateInput: Date | string | number, timezone: string = 'Asia/Kolkata'): boolean {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return false;
  const nowParts = getNowInTimezone(timezone);
  const targetParts = getDatePartsInTimezone(d, timezone);
  return targetParts.dateStr > nowParts.dateStr;
}
