import { addDays, isSaturday, isFriday, isMonday, isSunday } from "date-fns";

export function getNextSaturday(date: Date): Date {
  let isDateSaturday = false;
  while (!isDateSaturday) {
    date = addDays(date, 1);
    isDateSaturday = isSaturday(date);
  }
  return new Date(date.setUTCHours(0, 0, 0, 0));
}

export function getNextFriday(date: Date): Date {
  let isDateFriday = false;
  while (!isDateFriday) {
    date = addDays(date, 1);
    isDateFriday = isFriday(date);
  }
  return new Date(date.setUTCHours(0, 0, 0, 0));
}

export function getNextMonday(date: Date): Date {
  let isDateMonday = false;
  while (!isDateMonday) {
    date = addDays(date, 1);
    isDateMonday = isMonday(date);
  }
  return new Date(date.setUTCHours(0, 0, 0, 0));
}

export function isWeekend(date: Date): boolean {
  return isSaturday(date) || isSunday(date);
}

export function isMondayOrFriday(date: Date): boolean {
  return isMonday(date) || isFriday(date);
}
