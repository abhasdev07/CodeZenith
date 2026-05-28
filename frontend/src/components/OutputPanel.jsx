import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  CpuIcon,
  XCircleIcon,
} from "lucide-react";

function formatValue(value) {
  if (value === undefined) return "undefined";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function VerdictIcon({ output }) {
  if (!output) return null;
  if (output.success) return <CheckCircle2Icon className="size-5 text-success" />;
  if (output.type === "wrong_answer") return <XCircleIcon className="size-5 text-error" />;
  return <AlertTriangleIcon className="size-5 text-warning" />;
}

function OutputPanel({ output }) {
  const cases = output?.cases || [];
  const failedCase = cases.find((testCase) => !testCase.passed);

  return (
    <div className="h-full bg-base-100 flex flex-col">
      <div className="px-4 py-2 bg-base-200 border-b border-base-300 font-semibold text-sm">
        Results
      </div>
      <div className="flex-1 overflow-auto p-4">
        {output === null ? (
          <p className="text-base-content/50 text-sm">Run or submit code to see verdicts here.</p>
        ) : (
          <div className="space-y-4">
            <div
              className={`rounded-lg border p-4 ${
                output.success
                  ? "bg-success/10 border-success/30"
                  : "bg-error/10 border-error/30"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <VerdictIcon output={output} />
                  <div>
                    <p className="font-bold text-lg">{output.verdict || "Execution Result"}</p>
                    <p className="text-sm opacity-75">
                      Passed: {output.passedCount ?? 0}/{output.totalCases ?? 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs opacity-80">
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="size-4" />
                    {output.runtimeMs ?? 0}ms
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CpuIcon className="size-4" />
                    {output.memoryKb ?? 0}KB
                  </span>
                </div>
              </div>
            </div>

            {failedCase && (
              <div className="rounded-lg border border-error/30 bg-base-200 p-4 space-y-2">
                <p className="font-semibold text-error">Failed testcase #{failedCase.index + 1}</p>
                <div className="grid gap-2 text-sm">
                  <pre className="whitespace-pre-wrap">
                    <span className="font-semibold">Input: </span>
                    {formatValue(failedCase.input)}
                  </pre>
                  <pre className="whitespace-pre-wrap">
                    <span className="font-semibold">Expected: </span>
                    {formatValue(failedCase.expected)}
                  </pre>
                  <pre className="whitespace-pre-wrap">
                    <span className="font-semibold">Received: </span>
                    {formatValue(failedCase.actual)}
                  </pre>
                  {failedCase.error && (
                    <pre className="text-error whitespace-pre-wrap">{failedCase.error}</pre>
                  )}
                </div>
              </div>
            )}

            {cases.length > 0 && (
              <div className="grid gap-2">
                {cases.map((testCase) => (
                  <div
                    key={testCase.index}
                    className={`rounded-md border px-3 py-2 text-sm flex items-center justify-between ${
                      testCase.passed ? "border-success/30" : "border-error/30"
                    }`}
                  >
                    <span>Case {testCase.index + 1}</span>
                    <span className={testCase.passed ? "text-success" : "text-error"}>
                      {testCase.passed ? "Passed" : "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {output.output && (
              <div>
                <p className="font-semibold mb-2">Stdout</p>
                <pre className="text-sm font-mono bg-base-200 rounded-lg p-3 whitespace-pre-wrap">
                  {output.output}
                </pre>
              </div>
            )}

            {output.error && output.type !== "wrong_answer" && (
              <pre className="text-sm font-mono text-error bg-error/10 rounded-lg p-3 whitespace-pre-wrap">
                {output.error}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default OutputPanel;
