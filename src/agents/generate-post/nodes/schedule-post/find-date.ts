import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  isValid,
  addDays,
  isSunday,
  isFriday,
  isMonday,
  isSaturday,
} from "date-fns";
import {
  getNextFriday,
  getNextMonday,
  getNextSaturday,
  isMondayOrFriday,
  isWeekend,
} from "./utils.js";
import { DateType } from "../../../types.js";

export function validateAfterSeconds(afterSeconds: number) {
  // If after seconds is negative, throw an error
  if (afterSeconds < 0) {
    throw new Error(
      `Schedule date must be in the future. Instead, received: ${afterSeconds} seconds.`,
    );
  }
}

export const ALLOWED_P1_DAY_AND_TIMES_IN_UTC = [
  // Sunday 16:00 UTC (8AM PST)
  {
    day: 0,
    hour: 16,
  },
  // Sunday 17:00 UTC (9AM PST)
  {
    day: 0,
    hour: 17,
  },
  // Sunday 18:00 UTC (10AM PST)
  {
    day: 0,
    hour: 18,
  },
  // Saturday 16:00 UTC (8AM PST)
  {
    day: 6,
    hour: 16,
  },
  // Saturday 17:00 UTC (9AM PST)
  {
    day: 6,
    hour: 17,
  },
  // Saturday 18:00 UTC (10AM PST)
  {
    day: 6,
    hour: 18,
  },
];

const LAST_ALLOWED_P1_HOUR = 18;
const FIRST_ALLOWED_P1_HOUR = 16;

export const ALLOWED_P2_DAY_AND_TIMES_IN_UTC = [
  // Monday 16:00 UTC (8AM PST)
  {
    day: 1,
    hour: 16,
  },
  // Monday 17:00 UTC (9AM PST)
  {
    day: 1,
    hour: 17,
  },
  // Monday 18:00 UTC (10AM PST)
  {
    day: 1,
    hour: 18,
  },
  // Friday 16:00 UTC (8AM PST)
  {
    day: 5,
    hour: 16,
  },
  // Friday 17:00 UTC (9AM PST)
  {
    day: 5,
    hour: 17,
  },
  // Friday 18:00 UTC (10AM PST)
  {
    day: 5,
    hour: 18,
  },
  // Sunday 19:00 UTC (11AM PST)
  {
    day: 0,
    hour: 19,
  },
  // Sunday 20:00 UTC (12PM PST)
  {
    day: 0,
    hour: 20,
  },
  // Sunday 21:00 UTC (1PM PST)
  {
    day: 0,
    hour: 21,
  },
  // Saturday 19:00 UTC (11AM PST)
  {
    day: 6,
    hour: 19,
  },
  // Saturday 20:00 UTC (12PM PST)
  {
    day: 6,
    hour: 20,
  },
  // Saturday 21:00 UTC (1PM PST)
  {
    day: 6,
    hour: 21,
  },
];

const FIRST_ALLOWED_P2_HOUR_WEEKDAY = 16;
const LAST_ALLOWED_P2_HOUR_WEEKDAY = 18;
const FIRST_ALLOWED_P2_HOUR_WEEKEND = 19;
const LAST_ALLOWED_P2_HOUR_WEEKEND = 21;

export const ALLOWED_P3_DAY_AND_TIMES_IN_UTC = [
  // Saturday: 21, 22, 23
  { day: 6, hour: 21 },
  { day: 6, hour: 22 },
  { day: 6, hour: 23 },
  // Sunday: 0, 1, 21, 22, 23
  { day: 0, hour: 0 },
  { day: 0, hour: 1 },
  { day: 0, hour: 21 },
  { day: 0, hour: 22 },
  { day: 0, hour: 23 },
  // Monday: 0, 1
  { day: 1, hour: 0 },
  { day: 1, hour: 1 },
];

export type TakenScheduleDates = {
  p1: Date[];
  p2: Date[];
  p3: Date[];
};

export const DEFAULT_TAKEN_DATES: TakenScheduleDates = {
  p1: [],
  p2: [],
  p3: [],
};

export const SCHEDULE_DATES_NAMESPACE = ["taken_schedule_dates"];
export const SCHEDULE_DATES_KEY = "dates";
export const TAKEN_DATES_KEY = "taken_dates";

/**
 * Searches the store for all taken schedule dates
 * @param config
 * @returns {Promise<TakenScheduleDates>} The taken schedule dates, or DEFAULT_TAKEN_DATES if no dates are taken
 */
export async function getTakenScheduleDates(
  config: LangGraphRunnableConfig,
): Promise<TakenScheduleDates> {
  const { store } = config;
  if (!store) {
    throw new Error("No store provided");
  }
  const takenDates = await store.get(SCHEDULE_DATES_NAMESPACE, SCHEDULE_DATES_KEY);
  if (!takenDates) {
    return DEFAULT_TAKEN_DATES;
  }
  const storedDates = takenDates.value?.[TAKEN_DATES_KEY];
  // Convert stored string dates back to Date objects
  return {
    p1: storedDates?.p1?.map((d: string) => new Date(d)) || [],
    p2: storedDates?.p2?.map((d: string) => new Date(d)) || [],
    p3: storedDates?.p3?.map((d: string) => new Date(d)) || [],
  };
}

/**
 * Updates the store with a new taken scheduled date
 * @param {TakenScheduleDates} takenDates The new taken schedule dates
 * @param {LangGraphRunnableConfig} config
 * @returns {Promise<void>}
 */
export async function putTakenScheduleDates(
  takenDates: TakenScheduleDates,
  config: LangGraphRunnableConfig,
): Promise<void> {
  const { store } = config;
  if (!store) {
    throw new Error("No store provided");
  }
  // Convert Date objects to ISO strings for storage
  const serializedDates = {
    p1: takenDates.p1.map((d) => d.toISOString()),
    p2: takenDates.p2.map((d) => d.toISOString()),
    p3: takenDates.p3.map((d) => d.toISOString()),
  };
  await store.put(SCHEDULE_DATES_NAMESPACE, SCHEDULE_DATES_KEY, {
    [TAKEN_DATES_KEY]: serializedDates,
  });
}

function getAfterSeconds(date: Date, baseDate: Date = new Date()): number {
  return Math.floor((date.getTime() - baseDate.getTime()) / 1000);
}

/**
 * Given an input date, priority level, and taken dates,
 * returns an available date on that day, or undefined if
 * no times are available that day.
 */
function getNextAvailableDate(
  dateToCheck: Date,
  priority: "p1" | "p2" | "p3",
  takenDates: TakenScheduleDates,
): Date {
  const takenDatesForPriority = takenDates[priority];
  // No times taken yet
  if (!takenDatesForPriority.length) {
    const dateToCheckDay = dateToCheck.getUTCDay();
    if (priority === "p1") {
      return new Date(
        Date.UTC(
          dateToCheck.getUTCFullYear(),
          dateToCheck.getUTCMonth(),
          dateToCheck.getUTCDate(),
          FIRST_ALLOWED_P1_HOUR,
          0,
          0,
          0,
        ),
      );
    }
    if (priority === "p2") {
      const allowedHour = ALLOWED_P2_DAY_AND_TIMES_IN_UTC.find(
        (d) => d.day === dateToCheckDay,
      )?.hour;
      if (allowedHour === undefined) {
        throw new Error("Unreachable code");
      }
      return new Date(
        Date.UTC(
          dateToCheck.getUTCFullYear(),
          dateToCheck.getUTCMonth(),
          dateToCheck.getUTCDate(),
          allowedHour,
          0,
          0,
          0,
        ),
      );
    }
    if (priority === "p3") {
      const allowedHour = ALLOWED_P3_DAY_AND_TIMES_IN_UTC.find(
        (d) => d.day === dateToCheckDay,
      )?.hour;
      if (allowedHour === undefined) {
        throw new Error("Unreachable code");
      }
      return new Date(
        Date.UTC(
          dateToCheck.getUTCFullYear(),
          dateToCheck.getUTCMonth(),
          dateToCheck.getUTCDate(),
          allowedHour,
          0,
          0,
          0,
        ),
      );
    }
  }
  const lastTakenDate = takenDatesForPriority[takenDatesForPriority.length - 1];
  const lastTakenHour = lastTakenDate.getUTCHours();

  if (priority === "p1") {
    // If the last taken date hour is before the last allowed hour, then simply add one hour to the last taken date
    if (lastTakenHour < LAST_ALLOWED_P1_HOUR) {
      // Add one hour to the last taken date
      return new Date(
        Date.UTC(
          lastTakenDate.getUTCFullYear(),
          lastTakenDate.getUTCMonth(),
          lastTakenDate.getUTCDate(),
          lastTakenHour + 1,
          0,
          0,
          0,
        ),
      );
    } else {
      // The last taken date is the last allowed hour, so we can't add one hour to it
      // Check if the next day is Sunday
      const nextDay = addDays(lastTakenDate, 1);
      if (isSunday(nextDay)) {
        // The next day is sunday, meaning we can return the first allowed hour for P1
        return new Date(
          Date.UTC(
            nextDay.getUTCFullYear(),
            nextDay.getUTCMonth(),
            nextDay.getUTCDate(),
            FIRST_ALLOWED_P1_HOUR,
            0,
            0,
            0,
          ),
        );
      } else {
        // The next day is not sunday, so we can find the next saturday and return the first allowed hour for P1
        const nextSaturday = getNextSaturday(lastTakenDate);
        return new Date(
          Date.UTC(
            nextSaturday.getUTCFullYear(),
            nextSaturday.getUTCMonth(),
            nextSaturday.getUTCDate(),
            FIRST_ALLOWED_P1_HOUR,
            0,
            0,
            0,
          ),
        );
      }
    }
  }

  if (priority === "p2") {
    // Find the first available day
    if (isMondayOrFriday(lastTakenDate)) {
      if (lastTakenHour < LAST_ALLOWED_P2_HOUR_WEEKDAY) {
        // Add one hour to the last taken date
        return new Date(
          Date.UTC(
            lastTakenDate.getUTCFullYear(),
            lastTakenDate.getUTCMonth(),
            lastTakenDate.getUTCDate(),
            lastTakenHour + 1,
            0,
            0,
            0,
          ),
        );
      } else {
        // No more available times that day. Check if the current day is Monday. If it is, then we can return the first allowed weekday hour for p2 for the next friday
        if (isMonday(lastTakenDate)) {
          const nextFriday = getNextFriday(lastTakenDate);
          return new Date(
            Date.UTC(
              nextFriday.getUTCFullYear(),
              nextFriday.getUTCMonth(),
              nextFriday.getUTCDate(),
              FIRST_ALLOWED_P2_HOUR_WEEKDAY,
              0,
              0,
              0,
            ),
          );
        } else {
          // It's not a Monday, likely meaning it's a Friday. We can get the first allowed weekend hour and the next saturday and use that
          const nextSaturday = getNextSaturday(lastTakenDate);
          return new Date(
            Date.UTC(
              nextSaturday.getUTCFullYear(),
              nextSaturday.getUTCMonth(),
              nextSaturday.getUTCDate(),
              FIRST_ALLOWED_P2_HOUR_WEEKEND,
              0,
              0,
              0,
            ),
          );
        }
      }
    } else if (isWeekend(lastTakenDate)) {
      if (lastTakenHour < LAST_ALLOWED_P2_HOUR_WEEKEND) {
        // Add one hour to the last taken date
        return new Date(
          Date.UTC(
            lastTakenDate.getUTCFullYear(),
            lastTakenDate.getUTCMonth(),
            lastTakenDate.getUTCDate(),
            lastTakenHour + 1,
            0,
            0,
            0,
          ),
        );
      } else {
        // No more available times that day. Check if next day is sunday, and if so, return the first allowed hour for p2
        const nextDay = addDays(lastTakenDate, 1);
        if (isSunday(nextDay)) {
          return new Date(
            Date.UTC(
              nextDay.getUTCFullYear(),
              nextDay.getUTCMonth(),
              nextDay.getUTCDate(),
              FIRST_ALLOWED_P2_HOUR_WEEKEND,
              0,
              0,
              0,
            ),
          );
        } else {
          // Next day is not sunday, so we can find the next monday and return the first allowed hour for p2
          const nextMonday = getNextMonday(lastTakenDate);
          return new Date(
            Date.UTC(
              nextMonday.getUTCFullYear(),
              nextMonday.getUTCMonth(),
              nextMonday.getUTCDate(),
              FIRST_ALLOWED_P2_HOUR_WEEKDAY,
              0,
              0,
              0,
            ),
          );
        }
      }
    } else {
      // It's not a Monday, Friday, or Weekend, so it must be a weekday. Get the next friday and return the first allowed hour for p2
      const nextFriday = getNextFriday(lastTakenDate);
      return new Date(
        Date.UTC(
          nextFriday.getUTCFullYear(),
          nextFriday.getUTCMonth(),
          nextFriday.getUTCDate(),
          FIRST_ALLOWED_P2_HOUR_WEEKDAY,
          0,
          0,
          0,
        ),
      );
    }
  }

  if (priority === "p3") {
    const lastDay = lastTakenDate.getUTCDay();
    const lastHour = lastTakenDate.getUTCHours();

    // Try next slot in the same day
    const sameDaySlots = ALLOWED_P3_DAY_AND_TIMES_IN_UTC.filter(
      (slot) => slot.day === lastDay && slot.hour > lastHour,
    ).sort((a, b) => a.hour - b.hour);

    if (sameDaySlots.length) {
      // Pick the earliest hour that’s > lastHour
      const nextHour = sameDaySlots[0].hour;
      return new Date(
        Date.UTC(
          lastTakenDate.getUTCFullYear(),
          lastTakenDate.getUTCMonth(),
          lastTakenDate.getUTCDate(),
          nextHour,
          0,
          0,
          0,
        ),
      );
    }

    // Else, no more slots in this day. Move forward day-by-day until you find a valid day.
    let candidate = new Date(
      Date.UTC(
        lastTakenDate.getUTCFullYear(),
        lastTakenDate.getUTCMonth(),
        lastTakenDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    candidate = addDays(candidate, 1); // move to next day, 00:00

    for (let i = 0; i < 14; i++) {
      const candidateDay = candidate.getUTCDay();
      // All valid hours for that day
      const validSlots = ALLOWED_P3_DAY_AND_TIMES_IN_UTC.filter(
        (slot) => slot.day === candidateDay,
      ).sort((a, b) => a.hour - b.hour);

      if (validSlots.length) {
        // pick earliest hour for this new day
        const nextHour = validSlots[0].hour;
        return new Date(
          Date.UTC(
            candidate.getUTCFullYear(),
            candidate.getUTCMonth(),
            candidate.getUTCDate(),
            nextHour,
            0,
            0,
            0,
          ),
        );
      }

      // otherwise, keep searching
      candidate = addDays(candidate, 1);
    }

    throw new Error("Couldn't find a valid p3 slot within 2 weeks!");
  }

  throw new Error("Unreachable code");
}

function validateScheduleDate(date: Date, baseDate: Date): void {
  const afterSeconds = getAfterSeconds(date, baseDate);
  if (afterSeconds <= 0) {
    throw new Error(
      `Schedule date must be in the future. Instead, received: ${date.toISOString()}`,
    );
  }
}

export async function getScheduledDateSeconds(
  scheduleDate: DateType,
  config: LangGraphRunnableConfig,
  baseDate: Date = new Date(),
): Promise<number> {
  if (isValid(scheduleDate)) {
    const afterSeconds = getAfterSeconds(scheduleDate as Date, baseDate);
    validateAfterSeconds(afterSeconds);
    return afterSeconds;
  }

  const priority = scheduleDate as "p1" | "p2" | "p3";
  if (!["p1", "p2", "p3"].includes(priority)) {
    throw new Error(
      `Invalid priority level. Expected p1, p2, or p3, but received: ${priority}`,
    );
  }

  const takenScheduleDates = await getTakenScheduleDates(config);
  let currentTime = baseDate;
  const currentDayUTCHours = baseDate.getUTCHours();

  if (priority === "p1") {
    // Check if the current date is a saturday/sunday
    if (isWeekend(baseDate)) {
      // Check if there are available slots for the current date
      if (currentDayUTCHours >= LAST_ALLOWED_P1_HOUR) {
        // If the current hour is 6PM (UTC) or later, advance to the next day
        currentTime = addDays(baseDate, 1);
        // Reset the hour to midnight UTC
        currentTime = new Date(currentTime.setUTCHours(0, 0, 0, 0));
        if (!isSunday(currentTime)) {
          // After adding one day, we must check if the day is Sunday. If not, we must assign
          // the next Saturday at midnight
          currentTime = getNextSaturday(currentTime);
        }
      } else {
        // This means the current time is before 6PM (UTC), and it's a weekend. We can do nothing and get the next available time.
      }
    } else {
      // If the current date is not a Saturday or Sunday, assign the next Saturday at midnight
      currentTime = getNextSaturday(currentTime);
    }
  }

  if (priority === "p2") {
    // Find the first available day
    if (isMondayOrFriday(baseDate)) {
      // Current date is a weekday, so check if the current hour is before the last allowed hour
      if (currentDayUTCHours >= LAST_ALLOWED_P2_HOUR_WEEKDAY) {
        // If the current hour is 5PM (UTC) or later, advance to the next day. To do this, check if the current day is a Friday.
        // If it's not a friday, we can assume it's a monday and we can find the next friday
        if (isFriday(baseDate)) {
          currentTime = addDays(baseDate, 1);
          currentTime = new Date(currentTime.setUTCHours(0, 0, 0, 0));
        } else {
          // base date is likely a monday
          currentTime = getNextFriday(currentTime);
        }
      } else {
        // This means the current time is before 5PM (UTC), and it's a weekday. We can do nothing and get the next available time.
      }
    } else if (isWeekend(baseDate)) {
      if (currentDayUTCHours >= LAST_ALLOWED_P2_HOUR_WEEKEND) {
        // If the current hour is 5PM (UTC) or later, advance to the next day and check if it's a Sunday. If not, get the next monday
        const nextDay = addDays(baseDate, 1);
        if (isSunday(nextDay)) {
          currentTime = new Date(nextDay.setUTCHours(0, 0, 0, 0));
        } else {
          currentTime = getNextMonday(currentTime);
        }
      } else {
        // This means the current time is before 5PM (UTC), and it's a weekend. We can do nothing and get the next available time.
      }
    } else {
      // The date is not a Monday/Friday, or weekend. We can assume it's a weekday and get the next friday
      currentTime = getNextFriday(currentTime);
    }
  }

  if (priority === "p3") {
    const hour = baseDate.getUTCHours();

    if (isSaturday(baseDate)) {
      if (hour >= 23) {
        // Next day @ midnight
        let tmp = addDays(baseDate, 1);
        tmp = new Date(tmp.setUTCHours(0, 0, 0, 0));
        if (!isSunday(tmp) && !isMonday(tmp)) {
          tmp = getNextSaturday(tmp);
        }
        currentTime = tmp;
      }
      // else do nothing, we’re still on Saturday < 23
    } else if (isSunday(baseDate)) {
      if (hour >= 23) {
        let tmp = addDays(baseDate, 1);
        tmp = new Date(tmp.setUTCHours(0, 0, 0, 0));
        if (!isMonday(tmp)) {
          tmp = getNextSaturday(tmp);
        }
        currentTime = tmp;
      }
    } else if (isMonday(baseDate)) {
      // Monday is valid only at hour=0 in your updated config
      if (hour >= 0) {
        // If it’s already Monday 0:00 or later, you might allow that single slot,
        // but if your code sees hour=0 as "already used up," it can jump to Tuesday:
        //     let tmp = addDays(baseDate, 1);
        //     tmp = new Date(tmp.setUTCHours(0, 0, 0, 0));
        //     tmp = getNextSaturday(tmp);
        //     currentTime = tmp;
        //
        // BUT probably you do "do nothing" if hour=0,
        // else jump to next Saturday if hour>0
        if (hour > 1) {
          // Jump to next Saturday
          let tmp = addDays(baseDate, 1); // Tuesday
          tmp = new Date(tmp.setUTCHours(0, 0, 0, 0));
          tmp = getNextSaturday(tmp);
          currentTime = tmp;
        }
      }
    } else {
      // If not Sat/Sun/Mon, jump to next Saturday @ 00:00
      currentTime = getNextSaturday(baseDate);
    }
  }

  const nextAvailDate = getNextAvailableDate(
    currentTime,
    priority,
    takenScheduleDates,
  );
  if (!nextAvailDate) {
    throw new Error("Received no available times");
  }

  validateScheduleDate(nextAvailDate, baseDate);
  takenScheduleDates[priority].push(nextAvailDate);
  await putTakenScheduleDates(takenScheduleDates, config);
  return getAfterSeconds(nextAvailDate, baseDate);
}
