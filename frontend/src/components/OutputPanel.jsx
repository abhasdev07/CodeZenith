import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  CpuIcon,
  XCircleIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";

function formatValue(value) {
  if (value === undefined) return "undefined";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Returns config for the top-level verdict card based on the result type */
function getVerdictConfig(output) {
  if (!output) return null;

  const type = output.type;
  if (output.success || type === "success") {
    return {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/35",
      icon: <CheckCircle2Icon className="size-6 text-emerald-400" />,
      label: "Accepted",
      labelClass: "text-emerald-400",
      badge: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    };
  }
  if (type === "wrong_answer" || type === "visible_case_failed") {
    return {
      bg: "bg-red-500/10",
      border: "border-red-500/35",
      icon: <XCircleIcon className="size-6 text-red-400" />,
      label: "Wrong Answer",
      labelClass: "text-red-400",
      badge: "bg-red-500/20 text-red-300 border border-red-500/30",
    };
  }
  if (type === "runtime_error" || type === "time_limit_exceeded") {
    return {
      bg: "bg-orange-500/10",
      border: "border-orange-500/35",
      icon: <AlertTriangleIcon className="size-6 text-orange-400" />,
      label: type === "time_limit_exceeded" ? "Time Limit Exceeded" : "Runtime Error",
      labelClass: "text-orange-400",
      badge: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
    };
  }
  if (type === "compile_error") {
    return {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/35",
      icon: <ZapIcon className="size-6 text-yellow-400" />,
      label: "Compilation Error",
      labelClass: "text-yellow-400",
      badge: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
    };
  }
  // provider_error or unknown
  return {
    bg: "bg-orange-500/10",
    border: "border-orange-500/35",
    icon: <AlertTriangleIcon className="size-6 text-orange-400" />,
    label: output.verdict || "Execution Error",
    labelClass: "text-orange-400",
    badge: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  };
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

function OutputPanel({ output, onClose }) {
  const cases = output?.cases || [];
  const failedCase = cases.find((tc) => !tc.passed && !tc.hidden);
  const isSubmit = output?.mode === "submit";
  const hiddenSummary = output?.hiddenSummary;
  const visiblePassedCount = output?.visiblePassedCount ?? cases.filter((tc) => tc.passed).length;
  const visibleCaseCount = output?.visibleCaseCount ?? cases.length;

  // For the total testcase count shown in the verdict card
  const totalCases = output?.totalCases ?? visibleCaseCount;
  const passedCount = output?.passedCount ?? visiblePassedCount;

  const verdictConfig = getVerdictConfig(output);

  return (
    <div
      className="h-full min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0e1117] shadow-[0_16px_40px_rgba(0,0,0,0.2)] flex flex-col"
      style={{ animation: output ? "fadeSlideUp 0.22s ease-out" : undefined }}
    >
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes verdictPop {
          0%   { transform: scale(0.96); opacity: 0; }
          60%  { transform: scale(1.01); }
          100% { transform: scale(1); opacity: 1; }
        }
        .verdict-pop { animation: verdictPop 0.28s cubic-bezier(.34,1.56,.64,1) both; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#151820] px-4 py-3 shrink-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            {isSubmit ? "Submission Results" : "Run Results"}
          </p>
          <h2 className="text-sm font-semibold text-base-content/90">Test cases and logs</h2>
        </div>
        <div className="flex items-center gap-2">
          {output && verdictConfig && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${verdictConfig.badge}`}>
              {verdictConfig.label}
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-base-content/50 transition-colors hover:bg-white/10 hover:text-base-content"
              title="Close results"
              id="close-output-panel-btn"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {output === null ? (
          <div className="flex h-full min-h-36 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="max-w-sm text-sm leading-6 text-base-content/55">
              Run or submit code to see verdicts, testcase comparisons, and logs here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main verdict card */}
            {verdictConfig && (
              <div
                className={`verdict-pop rounded-2xl border p-4 ${verdictConfig.bg} ${verdictConfig.border}`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl border border-white/10 bg-black/20 p-2 shrink-0">
                      {verdictConfig.icon}
                    </div>
                    <div>
                      <p className={`text-xl font-bold ${verdictConfig.labelClass}`}>
                        {verdictConfig.label}
                      </p>
                      {isSubmit ? (
                        <p className="mt-1 text-sm font-medium text-base-content/70">
                          {passedCount}/{totalCases} testcases passed
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-base-content/70">
                          {visiblePassedCount}/{visibleCaseCount} visible testcases passed
                        </p>
                      )}
                      {isSubmit && hiddenSummary && (
                        <p className="text-xs text-base-content/55 mt-0.5">
                          Hidden: {hiddenSummary.passedCount}/{hiddenSummary.totalCases}{" "}
                          {hiddenSummary.verified ? "✓ verified" : "passed"}
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
            )}

            {/* Failed visible testcase detail */}
            {failedCase && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-semibold text-red-400">Failed testcase #{failedCase.index + 1}</p>
                  <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
                    Failed
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <ValueBlock label="Input" value={failedCase.input} />
                  <ValueBlock label="Expected" value={failedCase.expected} tone="expected" />
                  <ValueBlock label="Received" value={failedCase.actual} tone="actual" />
                </div>
                {failedCase.error && (
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-red-500/25 bg-black/25 p-3 font-mono text-xs leading-5 text-red-300">
                    {failedCase.error}
                  </pre>
                )}
              </div>
            )}

            {/* Hidden testcase summary card */}
            {isSubmit && hiddenSummary && (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  hiddenSummary.verified
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-orange-500/30 bg-orange-500/10"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold">Hidden testcases</span>
                  <span className={hiddenSummary.verified ? "text-emerald-400 font-semibold" : "text-orange-400 font-semibold"}>
                    {hiddenSummary.passedCount}/{hiddenSummary.totalCases}{" "}
                    {hiddenSummary.verified ? "✓ all passed" : "passed"}
                  </span>
                </div>
                <p className="mt-2 leading-6 text-base-content/65">
                  Inputs and expected outputs are hidden, but every hidden case is checked on submit.
                </p>
              </div>
            )}

            {/* Visible testcases list */}
            {cases.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
                  Visible testcases
                </p>
                {cases.map((testCase) => (
                  <div
                    key={testCase.index}
                    className={`rounded-2xl border p-4 text-sm ${
                      testCase.passed ? "border-emerald-500/25 bg-emerald-500/5" : "border-red-500/25 bg-red-500/5"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-semibold">Case {testCase.index + 1}</span>
                      <span className={testCase.passed ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                        {testCase.passed ? "✓ Correct" : "✗ Failed"}
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

            {/* Compilation error detail */}
            {output.type === "compile_error" && output.error && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-yellow-400/80">
                  Compiler Output
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-3 font-mono text-xs leading-5 text-yellow-200">
                  {output.error}
                </pre>
              </div>
            )}

            {/* Stdout */}
            {output.output && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Stdout</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-xs leading-5 text-base-content/80">
                  {output.output}
                </pre>
              </div>
            )}

            {/* Runtime/generic error (not wrong answer, not compile error) */}
            {output.error && output.type !== "wrong_answer" && output.type !== "compile_error" && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-400/80">Error</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 font-mono text-xs leading-5 text-orange-200">
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
