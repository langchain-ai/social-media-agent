import { test, expect } from "@jest/globals";
import { parseResult } from "../nodes/validate-images.js";

test("Can extract indices from a string", () => {
  const str =
    '```\n<answer>\n1.  <analysis>\n    Image 16: This image is a bar graph showing the "buzziest AI agent applications," with Cursor, Perplexity, and Replit as the top three. This directly relates to the section "Agent success stories: Cursor steals the spotlight" in the text, making it highly relevant.\n    Image 17: This image is a decorative graphic and doesn\'t provide any specific information related to the content of the webpage. It should be excluded.\n    Image 18: This image, similar to image 17, is a decorative graphic and doesn\'t offer any relevant information. It should also be excluded.\n\n2.  <relevant_indices>\n    16\n</answer>\n```\n';

  const indices = parseResult(str);
  expect(indices).toEqual([16]);
});
