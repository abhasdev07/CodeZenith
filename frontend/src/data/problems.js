const PROBLEM_DEFINITIONS = {
  "two-sum": {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    category: "Array - Hash Table",
    functionName: "twoSum",
    returnType: "intArray",
    description: {
      text: "Given an array of integers nums and an integer target, return indices of the two numbers in the array such that they add up to target.",
      notes: [
        "You may assume that each input has exactly one solution.",
        "You may not use the same element twice.",
        "You can return the answer in any order.",
      ],
    },
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
      { input: "nums = [3,3], target = 6", output: "[0,1]" },
    ],
    constraints: [
      "2 <= nums.length <= 10000",
      "-1000000000 <= nums[i] <= 1000000000",
      "-1000000000 <= target <= 1000000000",
      "Only one valid answer exists",
    ],
    visibleTestCases: [
      { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { input: [[3, 2, 4], 6], expected: [1, 2] },
      { input: [[3, 3], 6], expected: [0, 1] },
    ],
  },
  "reverse-string": {
    id: "reverse-string",
    title: "Reverse String",
    difficulty: "Easy",
    category: "String - Two Pointers",
    functionName: "reverseString",
    returnType: "string",
    description: {
      text: "Write a function that reverses a string and returns the reversed string.",
      notes: ["Use a two-pointer approach if you want O(1) extra pointer state."],
    },
    examples: [
      { input: 's = "hello"', output: '"olleh"' },
      { input: 's = "Hannah"', output: '"hannaH"' },
    ],
    constraints: ["1 <= s.length <= 100000", "s[i] is a printable ASCII character"],
    visibleTestCases: [
      { input: ["hello"], expected: "olleh" },
      { input: ["Hannah"], expected: "hannaH" },
    ],
  },
  "valid-palindrome": {
    id: "valid-palindrome",
    title: "Valid Palindrome",
    difficulty: "Easy",
    category: "String - Two Pointers",
    functionName: "isPalindrome",
    returnType: "boolean",
    description: {
      text: "Return true if a phrase is a palindrome after converting uppercase letters to lowercase and removing non-alphanumeric characters.",
      notes: ["Alphanumeric characters include letters and numbers."],
    },
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: "true" },
      { input: 's = "race a car"', output: "false" },
      { input: 's = " "', output: "true" },
    ],
    constraints: ["1 <= s.length <= 200000", "s consists only of printable ASCII characters"],
    visibleTestCases: [
      { input: ["A man, a plan, a canal: Panama"], expected: true },
      { input: ["race a car"], expected: false },
      { input: [" "], expected: true },
    ],
  },
  "maximum-subarray": {
    id: "maximum-subarray",
    title: "Maximum Subarray",
    difficulty: "Medium",
    category: "Array - Dynamic Programming",
    functionName: "maxSubArray",
    returnType: "int",
    description: {
      text: "Given an integer array nums, find the contiguous subarray with the largest sum and return that sum.",
      notes: [],
    },
    examples: [
      { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6" },
      { input: "nums = [1]", output: "1" },
      { input: "nums = [5,4,-1,7,8]", output: "23" },
    ],
    constraints: ["1 <= nums.length <= 100000", "-10000 <= nums[i] <= 10000"],
    visibleTestCases: [
      { input: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
      { input: [[1]], expected: 1 },
      { input: [[5, 4, -1, 7, 8]], expected: 23 },
    ],
  },
  "container-with-most-water": {
    id: "container-with-most-water",
    title: "Container With Most Water",
    difficulty: "Medium",
    category: "Array - Two Pointers",
    functionName: "maxArea",
    returnType: "int",
    description: {
      text: "Given an integer array height, find two lines that form a container with the most water.",
      notes: ["Return the maximum amount of water a container can store."],
    },
    examples: [
      { input: "height = [1,8,6,2,5,4,8,3,7]", output: "49" },
      { input: "height = [1,1]", output: "1" },
    ],
    constraints: ["n == height.length", "2 <= n <= 100000", "0 <= height[i] <= 10000"],
    visibleTestCases: [
      { input: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expected: 49 },
      { input: [[1, 1]], expected: 1 },
    ],
  },
};

const javaReturnType = {
  int: "int",
  intArray: "int[]",
  string: "String",
  boolean: "boolean",
};

const cppReturnType = {
  int: "int",
  intArray: "vector<int>",
  string: "string",
  boolean: "bool",
};

const defaultReturn = {
  int: "0",
  intArray: "new int[0]",
  string: '""',
  boolean: "false",
};

const cppDefaultReturn = {
  int: "0",
  intArray: "{}",
  string: '""',
  boolean: "false",
};

function jsArgs(problem) {
  if (problem.id === "two-sum") return "nums, target";
  if (["maximum-subarray"].includes(problem.id)) return "nums";
  if (problem.id === "container-with-most-water") return "height";
  return "s";
}

function javaArgs(problem) {
  if (problem.id === "two-sum") return "int[] nums, int target";
  if (["maximum-subarray"].includes(problem.id)) return "int[] nums";
  if (problem.id === "container-with-most-water") return "int[] height";
  return "String s";
}

function visibleCalls(problem, language) {
  const cppValue = (value) => (Array.isArray(value) ? `vector<int>{${value.join(",")}}` : JSON.stringify(value));
  const javaValue = (value) => (Array.isArray(value) ? `new int[]{${value.join(",")}}` : JSON.stringify(value));
  const displayValue = (problem, expression) =>
    problem.returnType === "intArray" ? `Arrays.toString(${expression})` : expression;

  const calls = problem.visibleTestCases.map((testCase) => {
    const input = testCase.input.map((value) => JSON.stringify(value)).join(", ");
    if (language === "javascript") return `console.log(${problem.functionName}(${input}));`;
    if (language === "python") return `print(sol.${problem.functionName}(${input}))`;
    if (language === "cpp") {
      const cppInput = testCase.input.map(cppValue).join(", ");
      if (problem.returnType === "intArray") {
        return `    // auto result = sol.${problem.functionName}(${cppInput});`;
      }
      return `    cout << sol.${problem.functionName}(${cppInput}) << endl;`;
    }
    if (language === "java") {
      const javaInput = testCase.input.map(javaValue).join(", ");
      const call = `sol.${problem.functionName}(${javaInput})`;
      return `        System.out.println(${displayValue(problem, call)});`;
    }
    return "";
  });

  return calls.join("\n");
}

function buildStarterCode(problem) {
  return {
    javascript: `function ${problem.functionName}(${jsArgs(problem)}) {
  // Write your solution here

}

// visible test cases
${visibleCalls(problem, "javascript")}`,
    python: `class Solution:
    def ${problem.functionName}(self, ${jsArgs(problem).replace(/, /g, ", ")}):
        # Write your solution here
        pass


sol = Solution()

# visible test cases
${visibleCalls(problem, "python")}`,
    java: `import java.util.*;

class Solution {
    public ${javaReturnType[problem.returnType]} ${problem.functionName}(${javaArgs(problem)}) {
        // Write your solution here
        return ${defaultReturn[problem.returnType]};
    }

    public static void main(String[] args) {
        Solution sol = new Solution();

${visibleCalls(problem, "java")}
    }
}`,
    cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    ${cppReturnType[problem.returnType]} ${problem.functionName}(${javaArgs(problem)
      .replace(/int\[\]/g, "vector<int>")
      .replace(/String/g, "string")
      .replace(/boolean/g, "bool")}) {
        // Write your solution here
        return ${cppDefaultReturn[problem.returnType]};
    }
};

int main() {
    Solution sol;

    // visible test cases
${visibleCalls(problem, "cpp")}

    return 0;
}`,
  };
}

export const PROBLEMS = Object.fromEntries(
  Object.entries(PROBLEM_DEFINITIONS).map(([id, problem]) => [
    id,
    {
      ...problem,
      starterCode: buildStarterCode(problem),
    },
  ])
);

export const LANGUAGE_CONFIG = {
  javascript: {
    name: "JavaScript",
    icon: "/javascript.png",
    monacoLang: "javascript",
  },
  cpp: {
    name: "C++",
    icon: "/java.png",
    monacoLang: "cpp",
  },
  java: {
    name: "Java",
    icon: "/java.png",
    monacoLang: "java",
  },
  python: {
    name: "Python",
    icon: "/python.png",
    monacoLang: "python",
  },
};
