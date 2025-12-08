import { describe, it, expect } from "@jest/globals";

const sharedLinksReducer = (
  state: string[] | undefined,
  update: string[] | undefined,
) => {
  if (update === undefined) return undefined;
  const resultSet = new Set<string>();
  update.filter((u): u is string => !!u).forEach((link) => resultSet.add(link));
  (state || []).forEach((link) => resultSet.add(link));
  return Array.from(resultSet);
};

describe("sharedLinksReducer", () => {
  it("should place update items first, followed by state items", () => {
    const state = ["existing1", "existing2", "existing3"];
    const update = ["new1", "new2", "existing1", "existing2", "existing3"];
    
    const result = sharedLinksReducer(state, update);
    
    expect(result?.[0]).toBe("new1");
    expect(result?.[1]).toBe("new2");
    expect(result).toHaveLength(5);
    expect(result).toEqual(["new1", "new2", "existing1", "existing2", "existing3"]);
  });

  it("should put generated images before existing images when mimicking generateImageCandidatesForPost", () => {
    const existingImageOptions = ["found1.jpg", "screenshot.png", "found2.jpg"];
    
    const generatedUrls = ["generated1.jpg", "generated2.jpg"];
    const updateFromGenerateNode = [...generatedUrls, ...existingImageOptions];
    
    const result = sharedLinksReducer(existingImageOptions, updateFromGenerateNode);
    
    expect(result?.[0]).toBe("generated1.jpg");
    expect(result?.[1]).toBe("generated2.jpg");
    expect(result?.[2]).toBe("found1.jpg");
    expect(result?.[3]).toBe("screenshot.png");
    expect(result?.[4]).toBe("found2.jpg");
  });

  it("should handle undefined state", () => {
    const result = sharedLinksReducer(undefined, ["new1", "new2"]);
    expect(result).toEqual(["new1", "new2"]);
  });

  it("should return undefined when update is undefined", () => {
    const result = sharedLinksReducer(["existing"], undefined);
    expect(result).toBeUndefined();
  });

  it("should deduplicate items", () => {
    const state = ["a", "b"];
    const update = ["b", "c", "a"];
    
    const result = sharedLinksReducer(state, update);
    
    expect(result).toEqual(["b", "c", "a"]);
  });
});

