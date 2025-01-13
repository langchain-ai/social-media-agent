import { jest, describe, it, expect } from "@jest/globals";
import { InMemoryStore } from "@langchain/langgraph";

import {
  getScheduledDateSeconds,
  getTakenScheduleDates,
} from "../find-date.js";

// Define MOCK_CURRENT_DATE in UTC or as per the mocked timezone
const MOCK_CURRENT_DATE = new Date("2025-01-03T12:00:00.000Z"); // This aligns with 'America/Los_Angeles'
// const MOCK_CURRENT_DATE = new Date()

jest.useFakeTimers();
jest.setSystemTime(MOCK_CURRENT_DATE);

describe("Priority P1 get scheduled date", () => {
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
      await getScheduledDateSeconds("p1", config, MOCK_CURRENT_DATE);
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
      await getScheduledDateSeconds("p2", config, MOCK_CURRENT_DATE);
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
  console.log("EXPECTED_DATE_TIMES", EXPECTED_DATE_TIMES.length);

  it("can properly find and schedule dates", async () => {
    const store = new InMemoryStore();
    const config = {
      store,
    };
    // Schedule posts sequentially
    const arrayLen = Array(40).fill(0);

    for await (const _ of arrayLen) {
      await getScheduledDateSeconds("p3", config, MOCK_CURRENT_DATE);
    }

    const scheduledDates = await getTakenScheduleDates(config);
    console.log("scheduledDates", scheduledDates.p3);
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
