const PROBLEMS = {
  "Two Sum": {
    slug: "two-sum",
    functionName: "twoSum",
    returnType: "intArray",
    visibleTestCases: [
      { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { input: [[3, 2, 4], 6], expected: [1, 2] },
      { input: [[3, 3], 6], expected: [0, 1] },
    ],
    hiddenTestCases: [
      { input: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
      { input: [[0, 4, 3, 0], 0], expected: [0, 3] },
      { input: [[5, 75, 25], 100], expected: [1, 2] },
    ],
  },
  "Reverse String": {
    slug: "reverse-string",
    functionName: "reverseString",
    returnType: "string",
    visibleTestCases: [
      { input: ["hello"], expected: "olleh" },
      { input: ["Hannah"], expected: "hannaH" },
    ],
    hiddenTestCases: [
      { input: ["CodeZenith"], expected: "htineZedoC" },
      { input: ["a"], expected: "a" },
      { input: ["racecar"], expected: "racecar" },
      { input: ["12345"], expected: "54321" },
    ],
  },
  "Valid Palindrome": {
    slug: "valid-palindrome",
    functionName: "isPalindrome",
    returnType: "boolean",
    visibleTestCases: [
      { input: ["A man, a plan, a canal: Panama"], expected: true },
      { input: ["race a car"], expected: false },
      { input: [" "], expected: true },
    ],
    hiddenTestCases: [
      { input: ["0P"], expected: false },
      { input: ["No lemon, no melon"], expected: true },
      { input: ["ab_a"], expected: true },
    ],
  },
  "Maximum Subarray": {
    slug: "maximum-subarray",
    functionName: "maxSubArray",
    returnType: "int",
    visibleTestCases: [
      { input: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
      { input: [[1]], expected: 1 },
      { input: [[5, 4, -1, 7, 8]], expected: 23 },
    ],
    hiddenTestCases: [
      { input: [[-1]], expected: -1 },
      { input: [[-2, -1]], expected: -1 },
      { input: [[8, -19, 5, -4, 20]], expected: 21 },
    ],
  },
  "Container With Most Water": {
    slug: "container-with-most-water",
    functionName: "maxArea",
    returnType: "int",
    visibleTestCases: [
      { input: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expected: 49 },
      { input: [[1, 1]], expected: 1 },
    ],
    hiddenTestCases: [
      { input: [[4, 3, 2, 1, 4]], expected: 16 },
      { input: [[1, 2, 1]], expected: 2 },
      { input: [[2, 3, 4, 5, 18, 17, 6]], expected: 17 },
    ],
  },
};

export function getProblemByTitle(title) {
  return PROBLEMS[title] || null;
}

export function getProblemBySlug(slug) {
  return Object.values(PROBLEMS).find((problem) => problem.slug === slug) || null;
}
