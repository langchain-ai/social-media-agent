// import * as ls from "langsmith/jest";
// import { type SimpleEvaluator } from "langsmith/jest";
// import { GeneratePostAnnotation } from "../../agents/generate-post/generate-post-state.js";
// import { TEST_EACH_INPUTS_OUTPUTS } from "./inputs.js";
// import { validateImages } from "../../agents/find-and-generate-images/nodes/validate-images.js";

// const checkCorrectImages: SimpleEvaluator = ({ expected, actual }) => {
//   const expectedImageOptions = expected.imageOptions as string[];
//   const actualImageOptions = actual.imageOptions as string[];
//   let numCorrect = 0;
//   for (const expectedUrl of expectedImageOptions) {
//     if (actualImageOptions.find((actualUrl) => actualUrl === expectedUrl)) {
//       numCorrect += 1;
//     }
//   }
//   const score = numCorrect / expectedImageOptions.length;

//   return {
//     key: "correct_images",
//     score,
//   };
// };

// ls.describe("SMA - Validate Images", () => {
//   ls.test.each(TEST_EACH_INPUTS_OUTPUTS)(
//     "Should validate images",
//     async ({ inputs }) => {
//       // Import and run your app, or some part of it here
//       const result = await validateImages(
//         inputs as typeof GeneratePostAnnotation.State,
//       );
//       console.log("result!", result);
//       const evalResult = ls.expect(result).evaluatedBy(checkCorrectImages);
//       // Ensure the result is greater than 0.8 and less than or equal to 1
//       // CHECK IF THIS RUNS THE EVALUATOR TWICE
//       await evalResult.toBeGreaterThanOrEqual(0.8);
//       await evalResult.toBeLessThanOrEqual(1);
//       return result;
//     },
//   );
// });
