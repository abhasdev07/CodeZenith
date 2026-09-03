export const DEFAULT_PROBLEMS = {
  "Two Sum": {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "easy",
    category: "Array - Hash Table",
    functionName: "twoSum",
    returnType: "intArray",
    parameterSignature: [
      { name: "nums", type: "intArray" },
      { name: "target", type: "int" },
    ],
    description: {
      text: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
      notes: [
        "Each input has exactly one solution.",
        "You may not use the same element twice.",
        "Return the answer in any order.",
      ],
    },
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    constraints: ["2 <= nums.length <= 10000", "-1000000000 <= nums[i], target <= 1000000000"],
    tags: ["array", "hash-table"],
    visibleTestCases: [
      { input: [[2, 7, 11, 15], 9], expectedOutput: [0, 1] },
      { input: [[3, 2, 4], 6], expectedOutput: [1, 2] },
      { input: [[3, 3], 6], expectedOutput: [0, 1] },
    ],
    hiddenTestCases: [
      { input: [[-1, -2, -3, -4, -5], -8], expectedOutput: [2, 4] },
      { input: [[0, 4, 3, 0], 0], expectedOutput: [0, 3] },
      { input: [[5, 75, 25], 100], expectedOutput: [1, 2] },
    ],
  },
  "Reverse String": {
    slug: "reverse-string",
    title: "Reverse String",
    difficulty: "easy",
    category: "String - Two Pointers",
    functionName: "reverseString",
    returnType: "string",
    parameterSignature: [{ name: "s", type: "string" }],
    description: { text: "Write a function that reverses a string and returns the reversed string.", notes: [] },
    examples: [{ input: 's = "hello"', output: '"olleh"' }],
    constraints: ["1 <= s.length <= 100000"],
    tags: ["string"],
    visibleTestCases: [
      { input: ["hello"], expectedOutput: "olleh" },
      { input: ["Hannah"], expectedOutput: "hannaH" },
    ],
    hiddenTestCases: [
      { input: ["CodeZenith"], expectedOutput: "htineZedoC" },
      { input: ["a"], expectedOutput: "a" },
      { input: ["racecar"], expectedOutput: "racecar" },
      { input: ["12345"], expectedOutput: "54321" },
    ],
  },
  "Valid Palindrome": {
    slug: "valid-palindrome",
    title: "Valid Palindrome",
    difficulty: "easy",
    category: "String - Two Pointers",
    functionName: "isPalindrome",
    returnType: "boolean",
    parameterSignature: [{ name: "s", type: "string" }],
    description: {
      text: "Return true if a phrase is a palindrome after lowercasing and removing non-alphanumeric characters.",
      notes: [],
    },
    examples: [{ input: 's = "A man, a plan, a canal: Panama"', output: "true" }],
    constraints: ["1 <= s.length <= 200000"],
    tags: ["string", "two-pointers"],
    visibleTestCases: [
      { input: ["A man, a plan, a canal: Panama"], expectedOutput: true },
      { input: ["race a car"], expectedOutput: false },
      { input: [" "], expectedOutput: true },
    ],
    hiddenTestCases: [
      { input: ["0P"], expectedOutput: false },
      { input: ["No lemon, no melon"], expectedOutput: true },
      { input: ["ab_a"], expectedOutput: true },
    ],
  },
  "Maximum Subarray": {
    slug: "maximum-subarray",
    title: "Maximum Subarray",
    difficulty: "medium",
    category: "Array - Dynamic Programming",
    functionName: "maxSubArray",
    returnType: "int",
    parameterSignature: [{ name: "nums", type: "intArray" }],
    description: {
      text: "Given an integer array nums, find the contiguous subarray with the largest sum and return that sum.",
      notes: [],
    },
    examples: [{ input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6" }],
    constraints: ["1 <= nums.length <= 100000", "-10000 <= nums[i] <= 10000"],
    tags: ["array", "dynamic-programming"],
    visibleTestCases: [
      { input: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expectedOutput: 6 },
      { input: [[1]], expectedOutput: 1 },
      { input: [[5, 4, -1, 7, 8]], expectedOutput: 23 },
    ],
    hiddenTestCases: [
      { input: [[-1]], expectedOutput: -1 },
      { input: [[-2, -1]], expectedOutput: -1 },
      { input: [[8, -19, 5, -4, 20]], expectedOutput: 21 },
    ],
  },
  "Container With Most Water": {
    slug: "container-with-most-water",
    title: "Container With Most Water",
    difficulty: "medium",
    category: "Array - Two Pointers",
    functionName: "maxArea",
    returnType: "int",
    parameterSignature: [{ name: "height", type: "intArray" }],
    description: {
      text: "Given an integer array height, find two lines that form a container with the most water.",
      notes: ["Return the maximum amount of water a container can store."],
    },
    examples: [{ input: "height = [1,8,6,2,5,4,8,3,7]", output: "49" }],
    constraints: ["2 <= height.length <= 100000", "0 <= height[i] <= 10000"],
    tags: ["array", "two-pointers"],
    visibleTestCases: [
      { input: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expectedOutput: 49 },
      { input: [[1, 1]], expectedOutput: 1 },
    ],
    hiddenTestCases: [
      { input: [[4, 3, 2, 1, 4]], expectedOutput: 16 },
      { input: [[1, 2, 1]], expectedOutput: 2 },
      { input: [[2, 3, 4, 5, 18, 17, 6]], expectedOutput: 17 },
    ],
  },
};

export function getProblemByTitle(title) {
  return DEFAULT_PROBLEMS[title] || null;
}

export function getProblemBySlug(slug) {
  return Object.values(DEFAULT_PROBLEMS).find((problem) => problem.slug === slug) || null;
}
