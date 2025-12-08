import { describe, it, expect } from "@jest/globals";
import { sharedLinksReducer } from "./verify-links-state.js";

describe("sharedLinksReducer", () => {
  it("should place update items first, followed by state items", () => {
    const state = [
      "https://example.com/existing1.png",
      "https://example.com/existing2.png",
      "https://example.com/existing3.png",
    ];
    const update = [
      "https://example.com/new1.png",
      "https://example.com/new2.png",
      "https://example.com/existing1.png",
      "https://example.com/existing2.png",
      "https://example.com/existing3.png",
    ];

    const result = sharedLinksReducer(state, update);

    expect(result?.[0]).toBe("https://example.com/new1.png");
    expect(result?.[1]).toBe("https://example.com/new2.png");
    expect(result).toHaveLength(5);
    expect(result).toEqual([
      "https://example.com/new1.png",
      "https://example.com/new2.png",
      "https://example.com/existing1.png",
      "https://example.com/existing2.png",
      "https://example.com/existing3.png",
    ]);
  });

  it("should put generated images before existing images when mimicking generateImageCandidatesForPost", () => {
    const existingImageOptions = [
      "https://example.com/found1.jpg",
      "https://example.com/screenshot.png",
      "https://example.com/found2.jpg",
    ];

    const generatedUrls = [
      "https://example.com/generated1.jpg",
      "https://example.com/generated2.jpg",
    ];
    const updateFromGenerateNode = [...generatedUrls, ...existingImageOptions];

    const result = sharedLinksReducer(
      existingImageOptions,
      updateFromGenerateNode,
    );

    expect(result?.[0]).toBe("https://example.com/generated1.jpg");
    expect(result?.[1]).toBe("https://example.com/generated2.jpg");
    expect(result?.[2]).toBe("https://example.com/found1.jpg");
    expect(result?.[3]).toBe("https://example.com/screenshot.png");
    expect(result?.[4]).toBe("https://example.com/found2.jpg");
  });

  it("should handle undefined state", () => {
    const result = sharedLinksReducer(undefined, [
      "https://example.com/new1.png",
      "https://example.com/new2.png",
    ]);
    expect(result).toEqual([
      "https://example.com/new1.png",
      "https://example.com/new2.png",
    ]);
  });

  it("should return undefined when update is undefined", () => {
    const result = sharedLinksReducer(
      ["https://example.com/existing.png"],
      undefined,
    );
    expect(result).toBeUndefined();
  });

  it("should deduplicate items", () => {
    const state = ["https://example.com/a.png", "https://example.com/b.png"];
    const update = [
      "https://example.com/b.png",
      "https://example.com/c.png",
      "https://example.com/a.png",
    ];

    const result = sharedLinksReducer(state, update);

    expect(result).toEqual([
      "https://example.com/b.png",
      "https://example.com/c.png",
      "https://example.com/a.png",
    ]);
  });
});
