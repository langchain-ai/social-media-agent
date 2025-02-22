import { TakenScheduleDates } from "./types.js";

export const DEFAULT_TAKEN_DATES: TakenScheduleDates = {
  p1: [],
  p2: [],
  p3: [],
  r1: [],
  r2: [],
  r3: [],
};

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

export const LAST_ALLOWED_P1_HOUR = 18;
export const FIRST_ALLOWED_P1_HOUR = 16;

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

export const FIRST_ALLOWED_P2_HOUR_WEEKDAY = 16;
export const LAST_ALLOWED_P2_HOUR_WEEKDAY = 18;
export const FIRST_ALLOWED_P2_HOUR_WEEKEND = 19;
export const LAST_ALLOWED_P2_HOUR_WEEKEND = 21;

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

export const ALLOWED_R1_DAY_AND_TIMES_IN_UTC = [
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

  // Tuesday 16:00 UTC (8AM PST)
  {
    day: 2,
    hour: 16,
  },
  // Tuesday 17:00 UTC (9AM PST)
  {
    day: 2,
    hour: 17,
  },
  // Tuesday 18:00 UTC (10AM PST)
  {
    day: 2,
    hour: 18,
  },

  // Wednesday 16:00 UTC (8AM PST)
  {
    day: 3,
    hour: 16,
  },
  // Wednesday 17:00 UTC (9AM PST)
  {
    day: 3,
    hour: 17,
  },
  // Wednesday 18:00 UTC (10AM PST)
  {
    day: 3,
    hour: 18,
  },

  // Thursday 16:00 UTC (8AM PST)
  {
    day: 4,
    hour: 16,
  },
  // Thursday 17:00 UTC (9AM PST)
  {
    day: 4,
    hour: 17,
  },
  // Thursday 18:00 UTC (10AM PST)
  {
    day: 4,
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
];

export const ALLOWED_R2_DAY_AND_TIMES_IN_UTC = [
  // Monday 19:00 UTC (11AM PST)
  {
    day: 1,
    hour: 19,
  },
  // Monday 20:00 UTC (12PM PST)
  {
    day: 1,
    hour: 20,
  },
  // Monday 21:00 UTC (1PM PST)
  {
    day: 1,
    hour: 21,
  },

  // Tuesday 19:00 UTC (11AM PST)
  {
    day: 2,
    hour: 19,
  },
  // Tuesday 20:00 UTC (12PM PST)
  {
    day: 2,
    hour: 20,
  },
  // Tuesday 21:00 UTC (1PM PST)
  {
    day: 2,
    hour: 21,
  },

  // Wednesday 19:00 UTC (11AM PST)
  {
    day: 3,
    hour: 19,
  },
  // Wednesday 20:00 UTC (12PM PST)
  {
    day: 3,
    hour: 20,
  },
  // Wednesday 21:00 UTC (1PM PST)
  {
    day: 3,
    hour: 21,
  },

  // Thursday 19:00 UTC (11AM PST)
  {
    day: 4,
    hour: 19,
  },
  // Thursday 20:00 UTC (12PM PST)
  {
    day: 4,
    hour: 20,
  },
  // Thursday 21:00 UTC (1PM PST)
  {
    day: 4,
    hour: 21,
  },

  // Friday 19:00 UTC (11AM PST)
  {
    day: 5,
    hour: 19,
  },
  // Friday 20:00 UTC (12PM PST)
  {
    day: 5,
    hour: 20,
  },
  // Friday 21:00 UTC (1PM PST)
  {
    day: 5,
    hour: 21,
  },
];

export const ALLOWED_R3_DAY_AND_TIMES_IN_UTC = [
  // Monday 22:00 UTC (2PM PST)
  {
    day: 1,
    hour: 22,
  },
  // Monday 23:00 UTC (3PM PST)
  {
    day: 1,
    hour: 23,
  },
  // Monday 00:00 UTC (4PM PST)
  {
    day: 2,
    hour: 0,
  },

  // Tuesday 22:00 UTC (2PM PST)
  {
    day: 2,
    hour: 22,
  },
  // Tuesday 23:00 UTC (3PM PST)
  {
    day: 2,
    hour: 23,
  },
  // Tuesday 00:00 UTC (4PM PST)
  {
    day: 3,
    hour: 0,
  },

  // Wednesday 22:00 UTC (2PM PST)
  {
    day: 3,
    hour: 22,
  },
  // Wednesday 23:00 UTC (3PM PST)
  {
    day: 3,
    hour: 23,
  },
  // Wednesday 00:00 UTC (4PM PST)
  {
    day: 4,
    hour: 0,
  },

  // Thursday 22:00 UTC (2PM PST)
  {
    day: 4,
    hour: 22,
  },
  // Thursday 23:00 UTC (3PM PST)
  {
    day: 4,
    hour: 23,
  },
  // Thursday 00:00 UTC (4PM PST)
  {
    day: 5,
    hour: 0,
  },

  // Friday 22:00 UTC (2PM PST)
  {
    day: 5,
    hour: 22,
  },
  // Friday 23:00 UTC (3PM PST)
  {
    day: 5,
    hour: 23,
  },
  // Friday 00:00 UTC (4PM PST)
  {
    day: 6,
    hour: 0,
  },
];
