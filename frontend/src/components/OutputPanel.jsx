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

function Metric({ icon, label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-base-content/70">
      {icon}
      <span>{label}:</span>
      <span className="font-semibold text-base-content/90">{value}</span>
    </span>
  );
}

function ValueBlock({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "expected"
      ? "text-sky-300"
      : tone === "actual"
        ? "text-amber-300"
        : "text-emerald-300";

  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-3">
      <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.14em] ${toneClass}`}>
        {label}
      </p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-base-content/80">
        {formatValue(value)}
      </pre>
    </div>
  );
}

function OutputPanel({ output }) {
  const cases = output?.cases || [];
  const failedCase = cases.find((testCase) => !testCase.passed && !testCase.hidden);
  const isSubmit = output?.mode === "submit";
  const hiddenSummary = output?.hiddenSummary;
  const visiblePassedCount = output?.visiblePassedCount ?? cases.filter((testCase) => testCase.passed).length;
  const visibleCaseCount = output?.visibleCaseCount ?? cases.length;

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0e1117] shadow-[0_16px_40px_rgba(0,0,0,0.2)] flex flex-col">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#151820] px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Run results</p>
          <h2 className="text-sm font-semibold text-base-content/90">Test cases and logs</h2>
        </div>
        {output && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              output.success
                ? "bg-success/15 text-success border border-success/30"
                : "bg-error/15 text-error border border-error/30"
            }`}
          >
            {output.success ? "Passed" : "Needs review"}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {output === null ? (
          <div className="flex h-full min-h-36 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="max-w-sm text-sm leading-6 text-base-content/55">
              Run or submit code to see verdicts, testcase comparisons, and logs here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`rounded-2xl border p-4 ${
                output.success
                  ? "bg-success/10 border-success/30"
                  : "bg-error/10 border-error/30"
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl border border-white/10 bg-black/20 p-2">
                    <VerdictIcon output={output} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{output.verdict || "Execution Result"}</p>
                    <p className="mt-1 text-sm text-base-content/70">
                      Visible testcases: {visiblePassedCount}/{visibleCaseCount} passed
                    </p>
                    {isSubmit && hiddenSummary && (
                      <p className="text-sm text-base-content/70">
                        Hidden verification: {hiddenSummary.passedCount}/{hiddenSummary.totalCases}{" "}
                        {hiddenSummary.verified ? "verified" : "passed"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Metric icon={<ClockIcon className="size-4" />} label="Runtime" value={`${output.runtimeMs ?? 0}ms`} />
                  <Metric icon={<CpuIcon className="size-4" />} label="Memory" value={`${output.memoryKb ?? 0}KB`} />
                </div>
              </div>
            </div>

            {failedCase && (
              <div className="rounded-2xl border border-error/30 bg-error/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-semibold text-error">Failed testcase #{failedCase.index + 1}</p>
                  <span className="rounded-full bg-error/15 px-3 py-1 text-xs font-semibold text-error">
                    Failed
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <ValueBlock label="Input" value={failedCase.input} />
                  <ValueBlock label="Expected" value={failedCase.expected} tone="expected" />
                  <ValueBlock label="Received" value={failedCase.actual} tone="actual" />
                </div>
                {failedCase.error && (
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-error/25 bg-black/25 p-3 font-mono text-xs leading-5 text-error">
                    {failedCase.error}
                  </pre>
                )}
              </div>
            )}

            {isSubmit && hiddenSummary && (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  hiddenSummary.verified
                    ? "border-success/30 bg-success/10"
                    : "border-warning/30 bg-warning/10"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold">Hidden testcases</span>
                  <span className={hiddenSummary.verified ? "text-success" : "text-warning"}>
                    {hiddenSummary.passedCount}/{hiddenSummary.totalCases} verified
                  </span>
                </div>
                <p className="mt-2 leading-6 text-base-content/65">
                  Inputs and expected outputs are hidden, but every hidden case is checked on submit.
                </p>
              </div>
            )}

            {cases.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
                  Visible testcases
                </p>
                {cases.map((testCase) => (
                  <div
                    key={testCase.index}
                    className={`rounded-2xl border p-4 text-sm ${
                      testCase.passed ? "border-success/25 bg-success/5" : "border-error/25 bg-error/5"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-semibold">Case {testCase.index + 1}</span>
                      <span className={testCase.passed ? "text-success" : "text-error"}>
                        {testCase.passed ? "Correct" : "Failed"}
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <ValueBlock label="Input" value={testCase.input} />
                      <ValueBlock label="Expected" value={testCase.expected} tone="expected" />
                      <ValueBlock label="Output" value={testCase.actual} tone="actual" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {output.output && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Stdout</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-xs leading-5 text-base-content/80">
                  {output.output}
                </pre>
              </div>
            )}

            {output.error && output.type !== "wrong_answer" && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-error/80">Error</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-error/25 bg-error/10 p-3 font-mono text-xs leading-5 text-error">
                  {output.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default OutputPanel;
