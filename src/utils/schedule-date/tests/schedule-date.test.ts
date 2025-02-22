import { jest, describe, it, expect, afterAll, afterEach } from "@jest/globals";
import { InMemoryStore } from "@langchain/langgraph";

import {
  findAvailableRepurposeDates,
  getScheduledDateSeconds,
  getTakenScheduleDates,
  putTakenScheduleDates,
} from "../index.js";
import { DEFAULT_TAKEN_DATES } from "../constants.js";
import { TakenScheduleDates } from "../types.js";

describe("Priority P1 get scheduled date", () => {
  // Define MOCK_CURRENT_DATE in UTC or as per the mocked timezone
  const MOCK_CURRENT_DATE = new Date("2025-01-03T12:00:00.000Z"); // This aligns with 'America/Los_Angeles'

  jest.useFakeTimers();
  jest.setSystemTime(MOCK_CURRENT_DATE);

  afterAll(() => {
    jest.useRealTimers();
  });

  const EXPECTED_DATE_TIMES = [
    "2025-01-04T16:00:00.000Z",
    "2025-01-04T17:00:00.000Z",
    "2025-01-04T18:00:00.000Z",
    "2025-01-05T16:00:00.000Z",
    "2025-01-05T17:00:00.000Z",
    "2025-01-05T18:00:00.000Z",

    "2025-01-11T16:00:00.000Z",
    "2025-01-11T17:00:00.000Z",
    "2025-01-11T18:00:00.000Z",
    "2025-01-12T16:00:00.000Z",
    "2025-01-12T17:00:00.000Z",
    "2025-01-12T18:00:00.000Z",

    "2025-01-18T16:00:00.000Z",
    "2025-01-18T17:00:00.000Z",
    "2025-01-18T18:00:00.000Z",
    "2025-01-19T16:00:00.000Z",
    "2025-01-19T17:00:00.000Z",
    "2025-01-19T18:00:00.000Z",

    "2025-01-25T16:00:00.000Z",
    "2025-01-25T17:00:00.000Z",
    "2025-01-25T18:00:00.000Z",
    "2025-01-26T16:00:00.000Z",
    "2025-01-26T17:00:00.000Z",
    "2025-01-26T18:00:00.000Z",

    "2025-02-01T16:00:00.000Z",
    "2025-02-01T17:00:00.000Z",
    "2025-02-01T18:00:00.000Z",
    "2025-02-02T16:00:00.000Z",
    "2025-02-02T17:00:00.000Z",
    "2025-02-02T18:00:00.000Z",

    "2025-02-08T16:00:00.000Z",
    "2025-02-08T17:00:00.000Z",
    "2025-02-08T18:00:00.000Z",
    "2025-02-09T16:00:00.000Z",
    "2025-02-09T17:00:00.000Z",
    "2025-02-09T18:00:00.000Z",

    "2025-02-15T16:00:00.000Z",
    "2025-02-15T17:00:00.000Z",
    "2025-02-15T18:00:00.000Z",
    "2025-02-16T16:00:00.000Z",
    "2025-02-16T17:00:00.000Z",
    "2025-02-16T18:00:00.000Z",

    "2025-02-22T16:00:00.000Z",
    "2025-02-22T17:00:00.000Z",
    "2025-02-22T18:00:00.000Z",
    "2025-02-23T16:00:00.000Z",
    "2025-02-23T17:00:00.000Z",
    "2025-02-23T18:00:00.000Z",
  ];

  it("can properly find and schedule dates", async () => {
    const store = new InMemoryStore();
    const config = {
      store,
    };
    // Schedule posts sequentially
    const arrayLen = Array(48).fill(0);

    for await (const _ of arrayLen) {
      await getScheduledDateSeconds({
        scheduleDate: "p1",
        config,
        baseDate: MOCK_CURRENT_DATE,
      });
    }

    const scheduledDates = await getTakenScheduleDates(config);
    expect(scheduledDates.p1.length).toBe(48);

    // Convert both arrays to ISO strings and sort them for comparison
    const normalizedScheduledDates = scheduledDates.p1.map((date) =>
      new Date(date).toISOString(),
    );
    const normalizedExpectedDates = EXPECTED_DATE_TIMES.map((date) =>
      new Date(date).toISOString(),
    );
    expect(normalizedScheduledDates.sort()).toEqual(
      normalizedExpectedDates.sort(),
    );
  });
});

describe("Priority P2 get scheduled date", () => {
  // Define MOCK_CURRENT_DATE in UTC or as per the mocked timezone
  const MOCK_CURRENT_DATE = new Date("2025-01-03T12:00:00.000Z"); // This aligns with 'America/Los_Angeles'

  jest.useFakeTimers();
  jest.setSystemTime(MOCK_CURRENT_DATE);

  afterAll(() => {
    jest.useRealTimers();
  });

  const EXPECTED_DATE_TIMES = [
    // Monday/Friday
    "2025-01-03T16:00:00.000Z",
    "2025-01-03T17:00:00.000Z",
    "2025-01-03T18:00:00.000Z",

    "2025-01-06T16:00:00.000Z",
    "2025-01-06T17:00:00.000Z",
    "2025-01-06T18:00:00.000Z",
    "2025-01-10T16:00:00.000Z",
    "2025-01-10T17:00:00.000Z",
    "2025-01-10T18:00:00.000Z",

    // Saturday/Sunday
    "2025-01-04T19:00:00.000Z",
    "2025-01-04T20:00:00.000Z",
    "2025-01-04T21:00:00.000Z",
    "2025-01-05T19:00:00.000Z",
    "2025-01-05T20:00:00.000Z",
    "2025-01-05T21:00:00.000Z",

    // Monday/Friday
    "2025-01-13T16:00:00.000Z",
    "2025-01-13T17:00:00.000Z",
    "2025-01-13T18:00:00.000Z",
    "2025-01-17T16:00:00.000Z",
    "2025-01-17T17:00:00.000Z",
    "2025-01-17T18:00:00.000Z",

    // Saturday/Sunday
    "2025-01-11T19:00:00.000Z",
    "2025-01-11T20:00:00.000Z",
    "2025-01-11T21:00:00.000Z",
    "2025-01-12T19:00:00.000Z",
    "2025-01-12T20:00:00.000Z",
    "2025-01-12T21:00:00.000Z",

    // Monday/Friday
    "2025-01-20T16:00:00.000Z",
    "2025-01-20T17:00:00.000Z",
    "2025-01-20T18:00:00.000Z",
    "2025-01-24T16:00:00.000Z",
    "2025-01-24T17:00:00.000Z",
    "2025-01-24T18:00:00.000Z",

    // Saturday/Sunday
    "2025-01-18T19:00:00.000Z",
    "2025-01-18T20:00:00.000Z",
    "2025-01-18T21:00:00.000Z",
    "2025-01-19T19:00:00.000Z",
    "2025-01-19T20:00:00.000Z",
    "2025-01-19T21:00:00.000Z",

    // Monday/Friday
    "2025-01-27T16:00:00.000Z",
    "2025-01-27T17:00:00.000Z",
    "2025-01-27T18:00:00.000Z",
    "2025-01-31T16:00:00.000Z",
    "2025-01-31T17:00:00.000Z",
    "2025-01-31T18:00:00.000Z",

    // Saturday/Sunday
    "2025-01-25T19:00:00.000Z",
    "2025-01-25T20:00:00.000Z",
    "2025-01-25T21:00:00.000Z",
    "2025-01-26T19:00:00.000Z",
    "2025-01-26T20:00:00.000Z",
    "2025-01-26T21:00:00.000Z",
  ];

  it("can properly find and schedule dates", async () => {
    const store = new InMemoryStore();
    const config = {
      store,
    };
    // Schedule posts sequentially
    const arrayLen = Array(51).fill(0);

    for await (const _ of arrayLen) {
      await getScheduledDateSeconds({
        scheduleDate: "p2",
        config,
        baseDate: MOCK_CURRENT_DATE,
      });
    }

    const scheduledDates = await getTakenScheduleDates(config);
    expect(scheduledDates.p2.length).toBe(51);

    // Convert both arrays to ISO strings and sort them for comparison
    const normalizedScheduledDates = scheduledDates.p2.map((date) =>
      new Date(date).toISOString(),
    );
    const normalizedExpectedDates = EXPECTED_DATE_TIMES.map((date) =>
      new Date(date).toISOString(),
    );
    expect(normalizedScheduledDates.sort()).toEqual(
      normalizedExpectedDates.sort(),
    );
  });
});

describe("Priority P3 get scheduled date", () => {
  // Define MOCK_CURRENT_DATE in UTC or as per the mocked timezone
  const MOCK_CURRENT_DATE = new Date("2025-01-03T12:00:00.000Z"); // This aligns with 'America/Los_Angeles'

  jest.useFakeTimers();
  jest.setSystemTime(MOCK_CURRENT_DATE);

  afterAll(() => {
    jest.useRealTimers();
  });

  const EXPECTED_DATE_TIMES = [
    // Weekend 1
    "2025-01-04T21:00:00.000Z",
    "2025-01-04T22:00:00.000Z",
    "2025-01-04T23:00:00.000Z",
    "2025-01-05T00:00:00.000Z",
    "2025-01-05T01:00:00.000Z",

    "2025-01-05T21:00:00.000Z",
    "2025-01-05T22:00:00.000Z",
    "2025-01-05T23:00:00.000Z",
    "2025-01-06T00:00:00.000Z",
    "2025-01-06T01:00:00.000Z",

    // Weekend 2
    "2025-01-11T21:00:00.000Z",
    "2025-01-11T22:00:00.000Z",
    "2025-01-11T23:00:00.000Z",
    "2025-01-12T00:00:00.000Z",
    "2025-01-12T01:00:00.000Z",

    "2025-01-12T21:00:00.000Z",
    "2025-01-12T22:00:00.000Z",
    "2025-01-12T23:00:00.000Z",
    "2025-01-13T00:00:00.000Z",
    "2025-01-13T01:00:00.000Z",

    // Weekend 3
    "2025-01-18T21:00:00.000Z",
    "2025-01-18T22:00:00.000Z",
    "2025-01-18T23:00:00.000Z",
    "2025-01-19T00:00:00.000Z",
    "2025-01-19T01:00:00.000Z",

    "2025-01-19T21:00:00.000Z",
    "2025-01-19T22:00:00.000Z",
    "2025-01-19T23:00:00.000Z",
    "2025-01-20T00:00:00.000Z",
    "2025-01-20T01:00:00.000Z",

    // Weekend 4
    "2025-01-25T21:00:00.000Z",
    "2025-01-25T22:00:00.000Z",
    "2025-01-25T23:00:00.000Z",
    "2025-01-26T00:00:00.000Z",
    "2025-01-26T01:00:00.000Z",

    "2025-01-26T21:00:00.000Z",
    "2025-01-26T22:00:00.000Z",
    "2025-01-26T23:00:00.000Z",
    "2025-01-27T00:00:00.000Z",
    "2025-01-27T01:00:00.000Z",
  ];

  it("can properly find and schedule dates", async () => {
    const store = new InMemoryStore();
    const config = {
      store,
    };
    // Schedule posts sequentially
    const arrayLen = Array(40).fill(0);

    for await (const _ of arrayLen) {
      await getScheduledDateSeconds({
        scheduleDate: "p3",
        config,
        baseDate: MOCK_CURRENT_DATE,
      });
    }

    const scheduledDates = await getTakenScheduleDates(config);
    expect(scheduledDates.p3.length).toBe(40);

    // Convert both arrays to ISO strings and sort them for comparison
    const normalizedScheduledDates = scheduledDates.p3.map((date) =>
      new Date(date).toISOString(),
    );
    const normalizedExpectedDates = EXPECTED_DATE_TIMES.map((date) =>
      new Date(date).toISOString(),
    );
    expect(normalizedScheduledDates.sort()).toEqual(
      normalizedExpectedDates.sort(),
    );
  });
});

describe("Get scheduled dates", () => {
  // Reset the timer after each test, but individual tests may set their own timers
  afterEach(() => {
    jest.useRealTimers();
  });

  it("Can schedule for under an hour from the current time", async () => {
    const defaultTakenDates: TakenScheduleDates = {
      ...DEFAULT_TAKEN_DATES,
      p1: [
        new Date("2025-01-18T16:00:00.000Z"),
        new Date("2025-01-18T17:00:00.000Z"),
        new Date("2025-01-18T18:00:00.000Z"),
        new Date("2025-01-19T16:00:00.000Z"),
        new Date("2025-01-19T17:00:00.000Z"),
        new Date("2025-01-19T18:00:00.000Z"),
      ],
      p2: [
        new Date("2025-01-17T17:00:00.000Z"),
        new Date("2025-01-17T18:00:00.000Z"),
        new Date("2025-01-18T19:00:00.000Z"),
        new Date("2025-01-18T20:00:00.000Z"),
        new Date("2025-01-18T21:00:00.000Z"),
        new Date("2025-01-19T19:00:00.000Z"),
        new Date("2025-01-19T20:00:00.000Z"),
        new Date("2025-01-19T21:00:00.000Z"),
        new Date("2025-01-20T16:00:00.000Z"),
      ],
      p3: [
        new Date("2025-01-18T21:00:00.000Z"),
        new Date("2025-01-18T22:00:00.000Z"),
      ],
    };
    const store = new InMemoryStore();
    const config = {
      store,
    };
    await putTakenScheduleDates(defaultTakenDates, config);

    // This is 8:04 AM PST (16:04 UTC)
    const mockCurrentDate = new Date("2025-01-25T16:04:00.000Z");
    jest.useFakeTimers();
    jest.setSystemTime(mockCurrentDate);

    const scheduledDate = await getScheduledDateSeconds({
      scheduleDate: "p1",
      config,
      baseDate: mockCurrentDate,
    });
    expect(scheduledDate).toBeDefined();
    // It should be 9AM, so check it's more than 3300 sec (55 min) and less than 3600 sec (1 hour)
    // If this is true, then it means the post was likely scheduled for 9AM.
    expect(scheduledDate).toBeGreaterThan(3300);
    expect(scheduledDate).toBeLessThan(3600);
  });
});

// TODO: Add tests where base date is after all allowed slots
// TODO: Add tests where base date is 1 min after/before an allowed slot
describe.only("Priority R1 get scheduled date", () => {
  it("returns exact number of requested future dates when none are taken", () => {
    // baseDate is Monday at 15:00 UTC, just before the first allowed slot
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 3;
    const takenDates = DEFAULT_TAKEN_DATES;

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r1",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    }).sort((a, b) => a.getTime() - b.getTime());
    expect(result).toHaveLength(numDates);

    const expectedDateRanges = [
      // After 15:55 and before 16:05 (should be 16:00 but dont want to check for exact seconds.)
      [
        new Date("2025-01-20T15:55:00.000Z"),
        new Date("2025-01-20T16:05:00.000Z"),
      ],
      [
        new Date("2025-01-21T15:55:00.000Z"),
        new Date("2025-01-21T16:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T15:55:00.000Z"),
        new Date("2025-01-22T16:05:00.000Z"),
      ],
    ];

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );

    expect(result[2].getTime()).toBeGreaterThan(
      expectedDateRanges[2][0].getTime(),
    );
    expect(result[2].getTime()).toBeLessThan(
      expectedDateRanges[2][1].getTime(),
    );
  });

  it("skips already taken dates", () => {
    // baseDate is Monday at 15:00 UTC, just before the first allowed slot
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 5;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
      r1: [
        new Date("2025-01-20T16:00:00.000Z"),
        new Date("2025-01-20T17:00:00.000Z"),
      ],
    };

    const expectedDateRanges = [
      [
        new Date("2025-01-20T17:55:00.000Z"),
        new Date("2025-01-20T18:05:00.000Z"),
      ],
      [
        new Date("2025-01-21T15:55:00.000Z"),
        new Date("2025-01-21T16:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T15:55:00.000Z"),
        new Date("2025-01-22T16:05:00.000Z"),
      ],
      [
        new Date("2025-01-23T15:55:00.000Z"),
        new Date("2025-01-23T16:05:00.000Z"),
      ],
      [
        new Date("2025-01-24T15:55:00.000Z"),
        new Date("2025-01-24T16:05:00.000Z"),
      ],
    ];

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r1",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    }).sort((a, b) => a.getTime() - b.getTime());

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );

    expect(result[2].getTime()).toBeGreaterThan(
      expectedDateRanges[2][0].getTime(),
    );
    expect(result[2].getTime()).toBeLessThan(
      expectedDateRanges[2][1].getTime(),
    );

    expect(result[3].getTime()).toBeGreaterThan(
      expectedDateRanges[3][0].getTime(),
    );
    expect(result[3].getTime()).toBeLessThan(
      expectedDateRanges[3][1].getTime(),
    );

    expect(result[4].getTime()).toBeGreaterThan(
      expectedDateRanges[4][0].getTime(),
    );
    expect(result[4].getTime()).toBeLessThan(
      expectedDateRanges[4][1].getTime(),
    );
  });

  it("skips entire days if there are already taken dates", () => {
    // baseDate is Monday at 15:00 UTC, just before the first allowed slot
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 2;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
      r1: [
        new Date("2025-01-20T16:00:00.000Z"),
        new Date("2025-01-20T17:00:00.000Z"),
        new Date("2025-01-20T18:00:00.000Z"),
      ],
    };

    const expectedDateRanges = [
      [
        new Date("2025-01-21T15:55:00.000Z"),
        new Date("2025-01-21T16:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T15:55:00.000Z"),
        new Date("2025-01-22T16:05:00.000Z"),
      ],
    ];

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r1",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    }).sort((a, b) => a.getTime() - b.getTime());

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );
  });

  it("only returns allowed day/hour combos", () => {
    const baseDate = new Date(Date.UTC(2025, 0, 6, 0));
    const numDates = 10;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
    };
    const result = findAvailableRepurposeDates({
      repurposedPriority: "r1",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });

    // Allowed days are Monday(1)-Friday(5) and hours 16-19
    result.forEach((date) => {
      const day = date.getUTCDay();
      const hour = date.getUTCHours();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
      expect(hour).toBe(16); // Since there are no taken slots, each slot should be 16:00
    });
  });

  it("does not return dates in the past", () => {
    // baseDate is mid-week in the afternoon, some allowed slots have passed
    const baseDate = new Date(Date.UTC(2025, 0, 8, 18));
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
    };
    const numDates = 5;
    const result = findAvailableRepurposeDates({
      repurposedPriority: "r1",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });
    // Every returned date should be strictly after baseDate
    result.forEach((d) => {
      expect(d.getTime()).toBeGreaterThan(baseDate.getTime());
    });
  });

  it("ignores weekends entirely", () => {
    // baseDate is set on Saturday
    const baseDate = new Date(Date.UTC(2025, 0, 11, 10));
    const numDates = 2;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
    };
    const result = findAvailableRepurposeDates({
      repurposedPriority: "r1",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });
    // Should push to Monday
    expect(result[0].getUTCDay()).toBe(1);
  });

  it("handles taken dates spanning multiple weeks", () => {
    // Over multiple weeks, ensure skipping taken slots properly
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 8;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
      r1: [
        new Date("2025-01-20T16:00:00.000Z"),
        new Date("2025-01-21T19:00:00.000Z"),
        new Date("2025-01-23T16:00:00.000Z"),
        new Date("2025-01-24T18:00:00.000Z"),
      ],
    };

    const expectedDateRanges = [
      [
        new Date("2025-01-20T16:55:00.000Z"),
        new Date("2025-01-20T17:05:00.000Z"),
      ],
      [
        new Date("2025-01-21T15:55:00.000Z"),
        new Date("2025-01-21T16:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T15:55:00.000Z"),
        new Date("2025-01-22T16:05:00.000Z"),
      ],
      [
        new Date("2025-01-23T16:55:00.000Z"),
        new Date("2025-01-23T17:05:00.000Z"),
      ],
      [
        new Date("2025-01-24T15:55:00.000Z"),
        new Date("2025-01-24T16:05:00.000Z"),
      ],
      // New week
      [
        new Date("2025-01-27T15:55:00.000Z"),
        new Date("2025-01-27T16:05:00.000Z"),
      ],
      [
        new Date("2025-01-28T15:55:00.000Z"),
        new Date("2025-01-28T16:05:00.000Z"),
      ],
      [
        new Date("2025-01-29T15:55:00.000Z"),
        new Date("2025-01-29T16:05:00.000Z"),
      ],
    ];

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r1",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });

    expect(result.length).toBe(numDates);

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );

    expect(result[2].getTime()).toBeGreaterThan(
      expectedDateRanges[2][0].getTime(),
    );
    expect(result[2].getTime()).toBeLessThan(
      expectedDateRanges[2][1].getTime(),
    );

    expect(result[3].getTime()).toBeGreaterThan(
      expectedDateRanges[3][0].getTime(),
    );
    expect(result[3].getTime()).toBeLessThan(
      expectedDateRanges[3][1].getTime(),
    );

    expect(result[4].getTime()).toBeGreaterThan(
      expectedDateRanges[4][0].getTime(),
    );
    expect(result[4].getTime()).toBeLessThan(
      expectedDateRanges[4][1].getTime(),
    );

    expect(result[5].getTime()).toBeGreaterThan(
      expectedDateRanges[5][0].getTime(),
    );
    expect(result[5].getTime()).toBeLessThan(
      expectedDateRanges[5][1].getTime(),
    );

    expect(result[6].getTime()).toBeGreaterThan(
      expectedDateRanges[6][0].getTime(),
    );
    expect(result[6].getTime()).toBeLessThan(
      expectedDateRanges[6][1].getTime(),
    );

    expect(result[7].getTime()).toBeGreaterThan(
      expectedDateRanges[7][0].getTime(),
    );
    expect(result[7].getTime()).toBeLessThan(
      expectedDateRanges[7][1].getTime(),
    );
  });
});

describe.only("Priority R2 get scheduled date", () => {
  it("returns exact number of requested future dates when none are taken", () => {
    // baseDate is Monday at 15:00 UTC, just before the first allowed slot
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 3;
    const takenDates = DEFAULT_TAKEN_DATES;

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r2",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    }).sort((a, b) => a.getTime() - b.getTime());
    expect(result).toHaveLength(numDates);

    const expectedDateRanges = [
      // After 15:55 and before 16:05 (should be 16:00 but dont want to check for exact seconds.)
      [
        new Date("2025-01-20T18:55:00.000Z"),
        new Date("2025-01-20T19:05:00.000Z"),
      ],
      [
        new Date("2025-01-21T18:55:00.000Z"),
        new Date("2025-01-21T19:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T18:55:00.000Z"),
        new Date("2025-01-22T19:05:00.000Z"),
      ],
    ];

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );

    expect(result[2].getTime()).toBeGreaterThan(
      expectedDateRanges[2][0].getTime(),
    );
    expect(result[2].getTime()).toBeLessThan(
      expectedDateRanges[2][1].getTime(),
    );
  });

  it("skips already taken dates", () => {
    // baseDate is Monday at 15:00 UTC, just before the first allowed slot
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 5;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
      r2: [
        new Date("2025-01-20T19:00:00.000Z"),
        new Date("2025-01-20T20:00:00.000Z"),
      ],
    };

    const expectedDateRanges = [
      [
        new Date("2025-01-20T20:55:00.000Z"),
        new Date("2025-01-20T21:05:00.000Z"),
      ],
      [
        new Date("2025-01-21T18:55:00.000Z"),
        new Date("2025-01-21T19:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T18:55:00.000Z"),
        new Date("2025-01-22T19:05:00.000Z"),
      ],
      [
        new Date("2025-01-23T18:55:00.000Z"),
        new Date("2025-01-23T19:05:00.000Z"),
      ],
      [
        new Date("2025-01-24T18:55:00.000Z"),
        new Date("2025-01-24T19:05:00.000Z"),
      ],
    ];

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r2",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    }).sort((a, b) => a.getTime() - b.getTime());

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );

    expect(result[2].getTime()).toBeGreaterThan(
      expectedDateRanges[2][0].getTime(),
    );
    expect(result[2].getTime()).toBeLessThan(
      expectedDateRanges[2][1].getTime(),
    );

    expect(result[3].getTime()).toBeGreaterThan(
      expectedDateRanges[3][0].getTime(),
    );
    expect(result[3].getTime()).toBeLessThan(
      expectedDateRanges[3][1].getTime(),
    );

    expect(result[4].getTime()).toBeGreaterThan(
      expectedDateRanges[4][0].getTime(),
    );
    expect(result[4].getTime()).toBeLessThan(
      expectedDateRanges[4][1].getTime(),
    );
  });

  it("skips entire days if there are already taken dates", () => {
    // baseDate is Monday at 15:00 UTC, just before the first allowed slot
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 2;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
      r2: [
        new Date("2025-01-20T19:00:00.000Z"),
        new Date("2025-01-20T20:00:00.000Z"),
        new Date("2025-01-20T21:00:00.000Z"),
      ],
    };

    const expectedDateRanges = [
      [
        new Date("2025-01-21T18:55:00.000Z"),
        new Date("2025-01-21T19:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T18:55:00.000Z"),
        new Date("2025-01-22T19:05:00.000Z"),
      ],
    ];

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r2",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    }).sort((a, b) => a.getTime() - b.getTime());

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );
  });

  it("only returns allowed day/hour combos", () => {
    const baseDate = new Date(Date.UTC(2025, 0, 6, 0));
    const numDates = 10;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
    };
    const result = findAvailableRepurposeDates({
      repurposedPriority: "r2",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });

    // Allowed days are Monday(1)-Friday(5) and hours 16-19
    result.forEach((date) => {
      const day = date.getUTCDay();
      const hour = date.getUTCHours();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
      expect(hour).toBe(19); // Since there are no taken slots, each slot should be 16:00
    });
  });

  it("does not return dates in the past", () => {
    // baseDate is mid-week in the afternoon, some allowed slots have passed
    const baseDate = new Date(Date.UTC(2025, 0, 8, 18));
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
    };
    const numDates = 5;
    const result = findAvailableRepurposeDates({
      repurposedPriority: "r2",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });
    // Every returned date should be strictly after baseDate
    result.forEach((d) => {
      expect(d.getTime()).toBeGreaterThan(baseDate.getTime());
    });
  });

  it("ignores weekends entirely", () => {
    // baseDate is set on Saturday
    const baseDate = new Date(Date.UTC(2025, 0, 11, 10));
    const numDates = 2;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
    };
    const result = findAvailableRepurposeDates({
      repurposedPriority: "r2",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });
    // Should push to Monday
    expect(result[0].getUTCDay()).toBe(1);
  });

  it("handles taken dates spanning multiple weeks", () => {
    // Over multiple weeks, ensure skipping taken slots properly
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 8;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
      r2: [
        new Date("2025-01-20T19:00:00.000Z"),
        new Date("2025-01-21T20:00:00.000Z"),
        new Date("2025-01-23T19:00:00.000Z"),
        new Date("2025-01-24T21:00:00.000Z"),
      ],
    };

    const expectedDateRanges = [
      [
        new Date("2025-01-20T19:55:00.000Z"),
        new Date("2025-01-20T20:05:00.000Z"),
      ],
      [
        new Date("2025-01-21T18:55:00.000Z"),
        new Date("2025-01-21T19:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T18:55:00.000Z"),
        new Date("2025-01-22T19:05:00.000Z"),
      ],
      [
        new Date("2025-01-23T19:55:00.000Z"),
        new Date("2025-01-23T20:05:00.000Z"),
      ],
      [
        new Date("2025-01-24T18:55:00.000Z"),
        new Date("2025-01-24T19:05:00.000Z"),
      ],
      // New week
      [
        new Date("2025-01-27T18:55:00.000Z"),
        new Date("2025-01-27T19:05:00.000Z"),
      ],
      [
        new Date("2025-01-28T18:55:00.000Z"),
        new Date("2025-01-28T19:05:00.000Z"),
      ],
      [
        new Date("2025-01-29T18:55:00.000Z"),
        new Date("2025-01-29T19:05:00.000Z"),
      ],
    ];

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r2",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });

    expect(result.length).toBe(numDates);

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );

    expect(result[2].getTime()).toBeGreaterThan(
      expectedDateRanges[2][0].getTime(),
    );
    expect(result[2].getTime()).toBeLessThan(
      expectedDateRanges[2][1].getTime(),
    );

    expect(result[3].getTime()).toBeGreaterThan(
      expectedDateRanges[3][0].getTime(),
    );
    expect(result[3].getTime()).toBeLessThan(
      expectedDateRanges[3][1].getTime(),
    );

    expect(result[4].getTime()).toBeGreaterThan(
      expectedDateRanges[4][0].getTime(),
    );
    expect(result[4].getTime()).toBeLessThan(
      expectedDateRanges[4][1].getTime(),
    );

    expect(result[5].getTime()).toBeGreaterThan(
      expectedDateRanges[5][0].getTime(),
    );
    expect(result[5].getTime()).toBeLessThan(
      expectedDateRanges[5][1].getTime(),
    );

    expect(result[6].getTime()).toBeGreaterThan(
      expectedDateRanges[6][0].getTime(),
    );
    expect(result[6].getTime()).toBeLessThan(
      expectedDateRanges[6][1].getTime(),
    );

    expect(result[7].getTime()).toBeGreaterThan(
      expectedDateRanges[7][0].getTime(),
    );
    expect(result[7].getTime()).toBeLessThan(
      expectedDateRanges[7][1].getTime(),
    );
  });
});

describe.only("Priority R3 get scheduled date", () => {
  it("returns exact number of requested future dates when none are taken", () => {
    // baseDate is Monday at 15:00 UTC, just before the first allowed slot
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 3;
    const takenDates = DEFAULT_TAKEN_DATES;

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r3",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    }).sort((a, b) => a.getTime() - b.getTime());
    expect(result).toHaveLength(numDates);

    const expectedDateRanges = [
      // After 15:55 and before 16:05 (should be 16:00 but dont want to check for exact seconds.)
      [
        new Date("2025-01-20T21:55:00.000Z"),
        new Date("2025-01-20T22:05:00.000Z"),
      ],
      [
        new Date("2025-01-21T21:55:00.000Z"),
        new Date("2025-01-21T22:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T21:55:00.000Z"),
        new Date("2025-01-22T22:05:00.000Z"),
      ],
    ];

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );

    expect(result[2].getTime()).toBeGreaterThan(
      expectedDateRanges[2][0].getTime(),
    );
    expect(result[2].getTime()).toBeLessThan(
      expectedDateRanges[2][1].getTime(),
    );
  });

  it("skips already taken dates", () => {
    // baseDate is Monday at 15:00 UTC, just before the first allowed slot
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 5;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
      r3: [
        new Date("2025-01-20T22:00:00.000Z"),
        new Date("2025-01-20T23:00:00.000Z"),
      ],
    };

    const expectedDateRanges = [
      [
        new Date("2025-01-20T23:55:00.000Z"),
        new Date("2025-01-21T00:05:00.000Z"),
      ],
      [
        new Date("2025-01-21T21:55:00.000Z"),
        new Date("2025-01-21T22:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T21:55:00.000Z"),
        new Date("2025-01-22T22:05:00.000Z"),
      ],
      [
        new Date("2025-01-23T21:55:00.000Z"),
        new Date("2025-01-23T22:05:00.000Z"),
      ],
      [
        new Date("2025-01-24T21:55:00.000Z"),
        new Date("2025-01-24T22:05:00.000Z"),
      ],
    ];

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r3",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    }).sort((a, b) => a.getTime() - b.getTime());

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );

    expect(result[2].getTime()).toBeGreaterThan(
      expectedDateRanges[2][0].getTime(),
    );
    expect(result[2].getTime()).toBeLessThan(
      expectedDateRanges[2][1].getTime(),
    );

    expect(result[3].getTime()).toBeGreaterThan(
      expectedDateRanges[3][0].getTime(),
    );
    expect(result[3].getTime()).toBeLessThan(
      expectedDateRanges[3][1].getTime(),
    );

    expect(result[4].getTime()).toBeGreaterThan(
      expectedDateRanges[4][0].getTime(),
    );
    expect(result[4].getTime()).toBeLessThan(
      expectedDateRanges[4][1].getTime(),
    );
  });

  it("skips entire days if there are already taken dates", () => {
    // baseDate is Monday at 15:00 UTC, just before the first allowed slot
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 2;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
      r3: [
        new Date("2025-01-20T22:00:00.000Z"),
        new Date("2025-01-20T23:00:00.000Z"),
        new Date("2025-01-21T00:00:00.000Z"),
      ],
    };

    const expectedDateRanges = [
      [
        new Date("2025-01-21T21:55:00.000Z"),
        new Date("2025-01-21T22:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T21:55:00.000Z"),
        new Date("2025-01-22T22:05:00.000Z"),
      ],
    ];

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r3",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    }).sort((a, b) => a.getTime() - b.getTime());

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );
  });

  it("only returns allowed day/hour combos", () => {
    const baseDate = new Date(Date.UTC(2025, 0, 6, 0));
    const numDates = 10;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
    };
    const result = findAvailableRepurposeDates({
      repurposedPriority: "r3",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });

    // Allowed days are Monday(1)-Friday(5) and hours 22-00
    result.forEach((date) => {
      const day = date.getUTCDay();
      const hour = date.getUTCHours();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
      expect(hour).toBe(22); // Since there are no taken slots, each slot should be 22:00
    });
  });

  it("does not return dates in the past", () => {
    // baseDate is mid-week in the afternoon, some allowed slots have passed
    const baseDate = new Date(Date.UTC(2025, 0, 8, 18));
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
    };
    const numDates = 5;
    const result = findAvailableRepurposeDates({
      repurposedPriority: "r3",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });
    // Every returned date should be strictly after baseDate
    result.forEach((d) => {
      expect(d.getTime()).toBeGreaterThan(baseDate.getTime());
    });
  });

  it("ignores weekends entirely", () => {
    // baseDate is set on Saturday
    const baseDate = new Date(Date.UTC(2025, 0, 11, 10));
    const numDates = 2;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
    };
    const result = findAvailableRepurposeDates({
      repurposedPriority: "r3",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });
    // Should push to Monday
    expect(result[0].getUTCDay()).toBe(1);
  });

  it("handles taken dates spanning multiple weeks", () => {
    // Over multiple weeks, ensure skipping taken slots properly
    const baseDate = new Date("2025-01-20T15:00:00.000Z");
    const numDates = 8;
    const takenDates = {
      ...DEFAULT_TAKEN_DATES,
      r3: [
        new Date("2025-01-20T22:00:00.000Z"),
        new Date("2025-01-21T23:00:00.000Z"),
        new Date("2025-01-23T22:00:00.000Z"),
        new Date("2025-01-25T00:00:00.000Z"),
      ],
    };

    const expectedDateRanges = [
      [
        new Date("2025-01-20T22:55:00.000Z"),
        new Date("2025-01-20T23:05:00.000Z"),
      ],
      [
        new Date("2025-01-21T21:55:00.000Z"),
        new Date("2025-01-21T22:05:00.000Z"),
      ],
      [
        new Date("2025-01-22T21:55:00.000Z"),
        new Date("2025-01-22T22:05:00.000Z"),
      ],
      [
        new Date("2025-01-23T22:55:00.000Z"),
        new Date("2025-01-23T23:05:00.000Z"),
      ],
      [
        new Date("2025-01-24T21:55:00.000Z"),
        new Date("2025-01-24T22:05:00.000Z"),
      ],
      // New week
      [
        new Date("2025-01-27T21:55:00.000Z"),
        new Date("2025-01-27T22:05:00.000Z"),
      ],
      [
        new Date("2025-01-28T21:55:00.000Z"),
        new Date("2025-01-28T22:05:00.000Z"),
      ],
      [
        new Date("2025-01-29T21:55:00.000Z"),
        new Date("2025-01-29T22:05:00.000Z"),
      ],
    ];

    const result = findAvailableRepurposeDates({
      repurposedPriority: "r3",
      baseDate,
      numberOfDates: numDates,
      takenDates,
    });

    expect(result.length).toBe(numDates);

    expect(result[0].getTime()).toBeGreaterThan(
      expectedDateRanges[0][0].getTime(),
    );
    expect(result[0].getTime()).toBeLessThan(
      expectedDateRanges[0][1].getTime(),
    );

    expect(result[1].getTime()).toBeGreaterThan(
      expectedDateRanges[1][0].getTime(),
    );
    expect(result[1].getTime()).toBeLessThan(
      expectedDateRanges[1][1].getTime(),
    );

    expect(result[2].getTime()).toBeGreaterThan(
      expectedDateRanges[2][0].getTime(),
    );
    expect(result[2].getTime()).toBeLessThan(
      expectedDateRanges[2][1].getTime(),
    );

    expect(result[3].getTime()).toBeGreaterThan(
      expectedDateRanges[3][0].getTime(),
    );
    expect(result[3].getTime()).toBeLessThan(
      expectedDateRanges[3][1].getTime(),
    );

    expect(result[4].getTime()).toBeGreaterThan(
      expectedDateRanges[4][0].getTime(),
    );
    expect(result[4].getTime()).toBeLessThan(
      expectedDateRanges[4][1].getTime(),
    );

    expect(result[5].getTime()).toBeGreaterThan(
      expectedDateRanges[5][0].getTime(),
    );
    expect(result[5].getTime()).toBeLessThan(
      expectedDateRanges[5][1].getTime(),
    );

    expect(result[6].getTime()).toBeGreaterThan(
      expectedDateRanges[6][0].getTime(),
    );
    expect(result[6].getTime()).toBeLessThan(
      expectedDateRanges[6][1].getTime(),
    );

    expect(result[7].getTime()).toBeGreaterThan(
      expectedDateRanges[7][0].getTime(),
    );
    expect(result[7].getTime()).toBeLessThan(
      expectedDateRanges[7][1].getTime(),
    );
  });
});
