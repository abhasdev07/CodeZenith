import Editor from "@monaco-editor/react";
import { CheckCircle2Icon, Loader2Icon, PlayIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { LANGUAGE_CONFIG } from "../data/problems";

function CodeEditorPanel({
  selectedLanguage,
  code,
  isRunning,
  isSubmitting = false,
  canRunCode = true,
  canSubmitCode = true,
  isReadOnly = false,
  syncCodeFromProps = true,
  onLanguageChange,
  onCodeChange,
  onRunCode,
  onSubmitCode,
  onEditorMount,
}) {
  const contentDisposableRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    if (!syncCodeFromProps) return;

    const editor = editorRef.current;
    const model = editor?.getModel?.();
    if (!model || code === model.getValue()) return;

    const selection = editor.getSelection();
    const scrollTop = editor.getScrollTop();
    const scrollLeft = editor.getScrollLeft();

    model.pushEditOperations(
      selection ? [selection] : [],
      [
        {
          range: model.getFullModelRange(),
          text: code,
          forceMoveMarkers: true,
        },
      ],
      () => (selection ? [selection] : null)
    );
    if (selection) editor.setSelection(selection);
    editor.setScrollTop(scrollTop);
    editor.setScrollLeft(scrollLeft);
  }, [code, selectedLanguage, syncCodeFromProps]);

  useEffect(() => {
    return () => {
      contentDisposableRef.current?.dispose();
      contentDisposableRef.current = null;
      editorRef.current = null;
    };
  }, []);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.defineTheme("codezenith-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0b0f14",
        "editorGutter.background": "#0b0f14",
        "editorLineNumber.foreground": "#5f6878",
        "editorLineNumber.activeForeground": "#d1d5db",
        "editorCursor.foreground": "#34d399",
        "editor.selectionBackground": "#2563eb44",
        "editor.inactiveSelectionBackground": "#2563eb24",
        "editorIndentGuide.background1": "#1f2937",
        "editorIndentGuide.activeBackground1": "#4b5563",
      },
    });
    monaco.editor.setTheme("codezenith-dark");
    editor.updateOptions({ wordBasedSuggestions: "allDocuments" });
    contentDisposableRef.current?.dispose();
    contentDisposableRef.current = editor.onDidChangeModelContent(() => {
      onCodeChange?.(editor.getValue());
    });
    onEditorMount?.(editor, monaco);
  };

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0e1117] shadow-[0_16px_40px_rgba(0,0,0,0.22)] flex flex-col">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-[#151820] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <img
              src={LANGUAGE_CONFIG[selectedLanguage].icon}
              alt={LANGUAGE_CONFIG[selectedLanguage].name}
              className="size-6"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Code</p>
            <select
              className="select select-sm mt-1 min-h-9 rounded-lg border-white/10 bg-[#0d1016] text-sm"
              value={selectedLanguage}
              onChange={onLanguageChange}
            >
              {Object.entries(LANGUAGE_CONFIG).map(([key, lang]) => (
                <option key={key} value={key}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canRunCode || canSubmitCode ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-primary btn-sm min-h-9 rounded-lg border-0 px-4"
              disabled={isRunning || isSubmitting || !canRunCode}
              onClick={onRunCode}
            >
              {isRunning ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayIcon className="size-4" />
                  Run
                </>
              )}
            </button>
            <button
              className="btn btn-success btn-sm min-h-9 rounded-lg border-0 px-4"
              disabled={isRunning || isSubmitting || !canSubmitCode}
              onClick={onSubmitCode}
            >
              {isSubmitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2Icon className="size-4" />
                  Submit
                </>
              )}
            </button>
          </div>
        ) : (
          <span className="badge badge-ghost rounded-full px-3">Read only</span>
        )}
      </div>

      <div className="min-h-0 flex-1 bg-[#0b0f14]">
        <Editor
          height={"100%"}
          language={LANGUAGE_CONFIG[selectedLanguage].monacoLang}
          defaultValue={code}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            fontSize: 16,
            fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
            fontLigatures: true,
            lineHeight: 24,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            autoIndent: "full",
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            tabCompletion: "on",
            parameterHints: { enabled: true },
            minimap: { enabled: false },
            padding: { top: 16, bottom: 16 },
            readOnly: isReadOnly,
          }}
        />
      </div>
    </div>
  );
}
export default CodeEditorPanel;
