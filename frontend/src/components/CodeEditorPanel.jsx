import Editor from "@monaco-editor/react";
import { CheckCircle2Icon, Loader2Icon, PlayIcon } from "lucide-react";
import { LANGUAGE_CONFIG } from "../data/problems";

function CodeEditorPanel({
  selectedLanguage,
  code,
  isRunning,
  isSubmitting = false,
  canRunCode = true,
  canSubmitCode = true,
  isReadOnly = false,
  onLanguageChange,
  onCodeChange,
  onRunCode,
  onSubmitCode,
  onEditorMount,
}) {
  const handleEditorMount = (editor, monaco) => {
    monaco.editor.defineTheme("codezenith-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#111827",
        "editorLineNumber.foreground": "#6b7280",
        "editorCursor.foreground": "#22c55e",
        "editor.selectionBackground": "#2563eb55",
      },
    });
    monaco.editor.setTheme("codezenith-dark");
    editor.updateOptions({ wordBasedSuggestions: "allDocuments" });
    onEditorMount?.(editor, monaco);
  };

  return (
    <div className="h-full bg-base-300 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-base-100 border-t border-base-300">
        <div className="flex items-center gap-3">
          <img
            src={LANGUAGE_CONFIG[selectedLanguage].icon}
            alt={LANGUAGE_CONFIG[selectedLanguage].name}
            className="size-6"
          />
          <select className="select select-sm" value={selectedLanguage} onChange={onLanguageChange}>
            {Object.entries(LANGUAGE_CONFIG).map(([key, lang]) => (
              <option key={key} value={key}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {canRunCode || canSubmitCode ? (
          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary btn-sm gap-2"
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
              className="btn btn-success btn-sm gap-2"
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
          <span className="badge badge-ghost">Read only</span>
        )}
      </div>

      <div className="flex-1">
        <Editor
          height={"100%"}
          language={LANGUAGE_CONFIG[selectedLanguage].monacoLang}
          value={code}
          onChange={onCodeChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            fontSize: 16,
            fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
            fontLigatures: true,
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
            minimap: { enabled: true, side: "right", size: "proportional" },
            readOnly: isReadOnly,
          }}
        />
      </div>
    </div>
  );
}
export default CodeEditorPanel;
