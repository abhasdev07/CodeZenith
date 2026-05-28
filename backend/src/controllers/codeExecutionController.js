import { resolveQuestionForExecution } from "./questionController.js";
import { normalizeTestCases } from "../lib/questionSerializer.js";
import Session from "../models/Session.js";

const PISTON_API_URL = "https://emkc.org/api/v2/piston";
const OUTPUT_LIMIT = 12000;

const LANGUAGE_RUNTIME = {
  javascript: { language: "javascript", version: "18.15.0", file: "main.js" },
  python: { language: "python", version: "3.10.0", file: "main.py" },
  java: { language: "java", version: "15.0.2", file: "Main.java" },
  cpp: { language: "cpp", version: "10.2.0", file: "main.cpp" },
};

function asPlainProblem(problem) {
  return problem?.toObject ? problem.toObject() : problem;
}

function normalizeSessionRole(session, userId) {
  if (session.participant?.toString() === userId.toString()) return "candidate";
  if (session.host?.toString() === userId.toString()) return "interviewer";
  return "viewer";
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value;
  return value;
}

function json(value) {
  return JSON.stringify(value);
}

function cppString(value) {
  return JSON.stringify(value);
}

function cppVector(values) {
  return `{${values.join(",")}}`;
}

function javaString(value) {
  return JSON.stringify(value);
}

function javaIntArray(values) {
  return `new int[]{${values.join(",")}}`;
}

function buildJsHarness(sourceCode, problem, testCases) {
  return `${sourceCode}

const __czTests = ${json(testCases)};
const __czExpected = __czTests.map((test) => test.expectedOutput);
const __czResults = [];
const __czStart = Date.now();
for (let i = 0; i < __czTests.length; i += 1) {
  let actual;
  let error = null;
  try {
    actual = ${problem.functionName}(...__czTests[i].input);
  } catch (err) {
    error = err && err.stack ? err.stack : String(err);
  }
    const expected = __czExpected[i];
    const passed = !error && JSON.stringify(actual) === JSON.stringify(expected);
  __czResults.push({ index: i, input: __czTests[i].input, expected, actual, passed, error });
}
process.stdout.write("__CZ_RESULT__" + JSON.stringify({
  results: __czResults,
  runtimeMs: Date.now() - __czStart,
  memoryKb: 0
}) + "\\n");`;
}

function buildPythonHarness(sourceCode, problem, testCases) {
  return `${sourceCode}

import json as __cz_json
import sys as __cz_sys
import time as __cz_time
__cz_tests = ${json(testCases)}
__cz_results = []
__cz_start = __cz_time.time()
__cz_callable = None
if "Solution" in globals():
    __cz_solution = Solution()
    __cz_callable = getattr(__cz_solution, "${problem.functionName}", None)
if __cz_callable is None:
    __cz_callable = globals().get("${problem.functionName}")
for __cz_index, __cz_test in enumerate(__cz_tests):
    __cz_error = None
    __cz_actual = None
    try:
        __cz_actual = __cz_callable(*__cz_test["input"])
    except Exception as __cz_exc:
        __cz_error = str(__cz_exc)
    __cz_expected = __cz_test["expectedOutput"]
    __cz_passed = __cz_error is None and __cz_actual == __cz_expected
    __cz_results.append({
        "index": __cz_index,
        "input": __cz_test["input"],
        "expected": __cz_expected,
        "actual": __cz_actual,
        "passed": __cz_passed,
        "error": __cz_error,
    })
__cz_sys.stdout.write("__CZ_RESULT__" + __cz_json.dumps({
    "results": __cz_results,
    "runtimeMs": int((__cz_time.time() - __cz_start) * 1000),
    "memoryKb": 0,
}) + "\\n")`;
}

function cppCall(problem, input) {
  const [first, second] = input;
  if (problem.slug === "two-sum") return `sol.${problem.functionName}(vector<int>${cppVector(first)}, ${second})`;
  if (problem.returnType === "int" && Array.isArray(first)) {
    return `sol.${problem.functionName}(vector<int>${cppVector(first)})`;
  }
  if (problem.returnType === "boolean" || problem.returnType === "string") {
    return `sol.${problem.functionName}(${cppString(first)})`;
  }
  return `sol.${problem.functionName}()`;
}

function buildCppHarness(sourceCode, problem, testCases) {
  const sanitizedSource = sourceCode.replace(/\bint\s+main\s*\(/g, "int __codezenith_user_main_disabled(");
  const cases = testCases
    .map((testCase, index) => {
      const actualExpression = cppCall(problem, testCase.input);
      const expected = json(normalizeValue(testCase.expectedOutput));
      const input = json(testCase.input);
      const serialize =
        problem.returnType === "intArray"
          ? "__cz_serialize_vector(actual)"
          : problem.returnType === "string"
            ? "__cz_serialize_string(actual)"
            : problem.returnType === "boolean"
              ? "(actual ? \"true\" : \"false\")"
              : "to_string(actual)";

      return `try {
    auto actual = ${actualExpression};
    string actualJson = ${serialize};
    string expectedJson = R"cz(${expected})cz";
    __cz_results += __cz_case(${index}, R"cz(${input})cz", expectedJson, actualJson, actualJson == expectedJson, "");
  } catch (const exception& error) {
    __cz_results += __cz_case(${index}, R"cz(${input})cz", R"cz(${expected})cz", "null", false, error.what());
  }`;
    })
    .join("\n");

  return `${sanitizedSource}

string __cz_escape(const string& value) {
  string escaped;
  for (char ch : value) {
    if (ch == '\\\\') escaped += "\\\\\\\\";
    else if (ch == '"') escaped += "\\\\\\"";
    else if (ch == '\\n') escaped += "\\\\n";
    else escaped += ch;
  }
  return escaped;
}
string __cz_serialize_string(const string& value) { return "\\"" + __cz_escape(value) + "\\""; }
string __cz_serialize_vector(const vector<int>& values) {
  string out = "[";
  for (size_t i = 0; i < values.size(); i++) {
    if (i) out += ",";
    out += to_string(values[i]);
  }
  out += "]";
  return out;
}
string __cz_case(int index, const string& inputJson, const string& expectedJson, const string& actualJson, bool passed, const string& error) {
  return string(index ? "," : "") + "{\\"index\\":" + to_string(index) +
    ",\\"input\\":" + inputJson +
    ",\\"expected\\":" + expectedJson +
    ",\\"actual\\":" + actualJson +
    ",\\"passed\\":" + (passed ? "true" : "false") +
    ",\\"error\\":\\"" + __cz_escape(error) + "\\"}";
}
int main() {
  Solution sol;
  auto __cz_start = chrono::high_resolution_clock::now();
  string __cz_results = "";
  ${cases}
  auto __cz_end = chrono::high_resolution_clock::now();
  auto __cz_runtime = chrono::duration_cast<chrono::milliseconds>(__cz_end - __cz_start).count();
  cout << "__CZ_RESULT__{\\"results\\":[" << __cz_results << "],\\"runtimeMs\\":" << __cz_runtime << ",\\"memoryKb\\":0}" << endl;
  return 0;
}`;
}

function javaCall(problem, input) {
  const [first, second] = input;
  if (problem.slug === "two-sum") return `sol.${problem.functionName}(${javaIntArray(first)}, ${second})`;
  if (problem.returnType === "int" && Array.isArray(first)) {
    return `sol.${problem.functionName}(${javaIntArray(first)})`;
  }
  if (problem.returnType === "boolean" || problem.returnType === "string") {
    return `sol.${problem.functionName}(${javaString(first)})`;
  }
  return `sol.${problem.functionName}()`;
}

function buildJavaHarness(sourceCode, problem, testCases) {
  const cases = testCases
    .map((testCase, index) => {
      const actualExpression = javaCall(problem, testCase.input);
      const expected = json(normalizeValue(testCase.expectedOutput));
      const input = json(testCase.input);
      const serialize =
        problem.returnType === "intArray"
          ? "__czSerialize(actual)"
          : problem.returnType === "string"
            ? "__czString(actual)"
            : problem.returnType === "boolean"
              ? "String.valueOf(actual)"
              : "String.valueOf(actual)";

      return `try {
            var actual = ${actualExpression};
            String actualJson = ${serialize};
            String expectedJson = ${javaString(expected)};
            __czResults.append(__czCase(${index}, ${javaString(input)}, expectedJson, actualJson, actualJson.equals(expectedJson), ""));
        } catch (Exception error) {
            __czResults.append(__czCase(${index}, ${javaString(input)}, ${javaString(expected)}, "null", false, error.toString()));
        }`;
    })
    .join("\n");

  return `${sourceCode}

class Main {
    static String __czEscape(String value) {
        return value.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"").replace("\\n", "\\\\n");
    }
    static String __czString(String value) {
        return "\\"" + __czEscape(value) + "\\"";
    }
    static String __czSerialize(int[] values) {
        StringBuilder out = new StringBuilder("[");
        for (int i = 0; i < values.length; i++) {
            if (i > 0) out.append(",");
            out.append(values[i]);
        }
        out.append("]");
        return out.toString();
    }
    static String __czCase(int index, String inputJson, String expectedJson, String actualJson, boolean passed, String error) {
        return (index > 0 ? "," : "") + "{\\"index\\":" + index +
            ",\\"input\\":" + inputJson +
            ",\\"expected\\":" + expectedJson +
            ",\\"actual\\":" + actualJson +
            ",\\"passed\\":" + passed +
            ",\\"error\\":\\"" + __czEscape(error) + "\\"}";
    }
    public static void main(String[] args) {
        Solution sol = new Solution();
        long started = System.currentTimeMillis();
        StringBuilder __czResults = new StringBuilder();
        ${cases}
        long runtime = System.currentTimeMillis() - started;
        System.out.println("__CZ_RESULT__{\\"results\\":[" + __czResults + "],\\"runtimeMs\\":" + runtime + ",\\"memoryKb\\":0}");
    }
}`;
}

export function buildHarness(language, sourceCode, problem, testCases) {
  if (language === "javascript") return buildJsHarness(sourceCode, problem, testCases);
  if (language === "python") return buildPythonHarness(sourceCode, problem, testCases);
  if (language === "cpp") return buildCppHarness(sourceCode, problem, testCases);
  if (language === "java") return buildJavaHarness(sourceCode, problem, testCases);
  return sourceCode;
}

async function executeOnPiston(language, sourceCode) {
  const runtime = LANGUAGE_RUNTIME[language];
  if (!runtime) throw new Error(`Unsupported language: ${language}`);

  const response = await fetch(`${PISTON_API_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: runtime.language,
      version: runtime.version,
      files: [{ name: runtime.file, content: sourceCode }],
      compile_timeout: 10000,
      run_timeout: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Execution provider failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

function parseExecutionResult(providerResult, mode, totalCases) {
  const compileError = providerResult.compile?.stderr || "";
  const runtimeError = providerResult.run?.stderr || "";
  const stdout = (providerResult.run?.stdout || "").slice(0, OUTPUT_LIMIT);
  const signal = providerResult.run?.signal;
  const code = providerResult.run?.code;

  if (compileError) {
    return {
      success: false,
      type: "compile_error",
      verdict: "Compilation Error",
      output: stdout,
      error: compileError,
      passedCount: 0,
      totalCases,
      cases: [],
    };
  }

  if (signal || (code !== undefined && code !== 0 && !stdout.includes("__CZ_RESULT__"))) {
    return {
      success: false,
      type: signal === "SIGKILL" ? "time_limit_exceeded" : "runtime_error",
      verdict: signal === "SIGKILL" ? "Time Limit Exceeded" : "Runtime Error",
      output: stdout,
      error: runtimeError || `Process exited with code ${code}`,
      passedCount: 0,
      totalCases,
      cases: [],
    };
  }

  const markerLine = stdout
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.startsWith("__CZ_RESULT__"));

  if (!markerLine) {
    return {
      success: false,
      type: "runtime_error",
      verdict: "Runtime Error",
      output: stdout,
      error: runtimeError || "The solution did not produce a structured CodeZenith result.",
      passedCount: 0,
      totalCases,
      cases: [],
    };
  }

  const parsed = JSON.parse(markerLine.replace("__CZ_RESULT__", ""));
  const rawCases = parsed.results || [];
  const passedCount = rawCases.filter((testCase) => testCase.passed).length;
  const accepted = passedCount === totalCases;
  const cases = mode === "submit" ? [] : rawCases;

  return {
    success: accepted,
    type: accepted ? "success" : mode === "submit" ? "wrong_answer" : "visible_case_failed",
    verdict: mode === "run" ? "Run Complete" : accepted ? "Accepted" : "Wrong Answer",
    output: stdout
      .split(/\r?\n/)
      .filter((line) => !line.startsWith("__CZ_RESULT__"))
      .join("\n")
      .trim(),
    error: accepted ? "" : "One or more test cases failed.",
    runtimeMs: parsed.runtimeMs || 0,
    memoryKb: parsed.memoryKb || 0,
    passedCount,
    totalCases,
    cases,
  };
}

export async function executeCode(req, res) {
  try {
    const { sessionId, language, sourceCode, problemTitle, questionId, problemSlug, mode = "run" } = req.body;

    if (!language || !sourceCode || (!problemTitle && !questionId && !problemSlug)) {
      return res.status(400).json({ message: "language, sourceCode, and a question identifier are required" });
    }

    if (!LANGUAGE_RUNTIME[language]) {
      return res.status(400).json({ message: `Unsupported language: ${language}` });
    }

    if (!["run", "submit"].includes(mode)) {
      return res.status(400).json({ message: "mode must be run or submit" });
    }

    if (sessionId) {
      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (!["waiting", "active"].includes(session.status)) {
        return res.status(400).json({ message: "Cannot execute code on ended session" });
      }

      const sessionRole = normalizeSessionRole(session, req.user._id);
      if (sessionRole !== "candidate") {
        return res.status(403).json({ message: "Only the session candidate can run or submit code" });
      }
    }

    const resolvedProblem = await resolveQuestionForExecution({
      questionId,
      problemTitle,
      slug: problemSlug,
    });
    if (!resolvedProblem) return res.status(400).json({ message: `Unknown problem: ${problemTitle || questionId || problemSlug}` });
    const problem = asPlainProblem(resolvedProblem);
    const visibleTestCases = normalizeTestCases(problem.visibleTestCases);
    const hiddenTestCases = normalizeTestCases(problem.hiddenTestCases);

    const testCases =
      mode === "submit"
        ? [...visibleTestCases, ...hiddenTestCases]
        : visibleTestCases;

    if (testCases.length === 0) {
      return res.status(400).json({ message: "This question has no testcases configured" });
    }

    const harnessedSource = buildHarness(language, sourceCode, problem, testCases);

    console.log("Code execution requested", {
      sessionId,
      problemTitle,
      questionId: problem._id?.toString?.(),
      language,
      mode,
      testCases: testCases.length,
      userId: req.user._id.toString(),
    });

    const providerResult = await executeOnPiston(language, harnessedSource);
    const result = parseExecutionResult(providerResult, mode, testCases.length);

    return res.status(200).json({
      ...result,
      mode,
      hiddenCasesIncluded: mode === "submit",
      casesAreRedacted: mode === "submit",
    });
  } catch (error) {
    console.log("Error in executeCode controller:", error.message);
    res.status(502).json({
      success: false,
      type: "provider_error",
      verdict: "Execution Provider Error",
      message: "Execution provider failed",
      error: error.message,
    });
  }
}
