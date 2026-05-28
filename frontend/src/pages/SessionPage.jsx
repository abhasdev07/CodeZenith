import { useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  useEndSession,
  useJoinSessionWithInvite,
  useSessionById,
  useUpdateActiveProblem,
  useUpdateCodeState,
} from "../hooks/useSessions";
import { PROBLEMS } from "../data/problems";
import { executeCode } from "../lib/codeExecution";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { getDifficultyBadgeClass } from "../lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, LogOutIcon, PhoneOffIcon } from "lucide-react";
import CodeEditorPanel from "../components/CodeEditorPanel";
import OutputPanel from "../components/OutputPanel";

import useStreamClient from "../hooks/useStreamClient";
import { StreamCall, StreamVideo } from "@stream-io/video-react-sdk";
import VideoCallUI from "../components/VideoCallUI";
import { clearSessionLeft, markSessionLeft } from "../lib/sessionLifecycle";
import { getSocket } from "../lib/socket";

const CODE_PATCH_FLUSH_MS = 16;
const CODE_SYNC_DEBOUNCE_MS = 30;
const CODE_SAVE_DEBOUNCE_MS = 900;
const CURSOR_SYNC_DEBOUNCE_MS = 25;
const CODE_SNAPSHOT_INTERVAL_MS = 3000;
const PERSISTED_CODE_FALLBACK_GRACE_MS = 2500;
const DEBUG_EDITOR_SYNC = false;

function debugEditorSync(...args) {
  if (DEBUG_EDITOR_SYNC) console.log(...args);
}

function getFullModelRange(model) {
  return model.getFullModelRange();
}

function applyCodeToEditor(editor, nextCode, suppressChangeRef) {
  const model = editor?.getModel?.();
  if (!model) return false;

  const currentCode = model.getValue();
  if (nextCode === currentCode) return false;

  const selection = editor.getSelection();
  const scrollTop = editor.getScrollTop();
  const scrollLeft = editor.getScrollLeft();
  const viewState = editor.saveViewState();

  suppressChangeRef.current = true;
  try {
    debugEditorSync("Applying remote patch");
    try {
      model.pushEditOperations(
        selection ? [selection] : [],
        [
          {
            range: getFullModelRange(model),
            text: nextCode,
            forceMoveMarkers: true,
          },
        ],
        () => (selection ? [selection] : null)
      );
    } catch (error) {
      console.error("Model patch failed; falling back to setValue", error);
      model.setValue(nextCode);
    }
    if (viewState) editor.restoreViewState(viewState);
    if (selection) editor.setSelection(selection);
    editor.setScrollTop(scrollTop);
    editor.setScrollLeft(scrollLeft);
    return true;
  } finally {
    suppressChangeRef.current = false;
  }
}

function serializeSelection(selection) {
  if (!selection) return null;

  return {
    startLineNumber: selection.startLineNumber,
    startColumn: selection.startColumn,
    endLineNumber: selection.endLineNumber,
    endColumn: selection.endColumn,
    positionLineNumber: selection.positionLineNumber,
    positionColumn: selection.positionColumn,
  };
}

function serializeRange(range) {
  return {
    startLineNumber: range.startLineNumber,
    startColumn: range.startColumn,
    endLineNumber: range.endLineNumber,
    endColumn: range.endColumn,
  };
}

function serializeModelChanges(event) {
  return event.changes.map((change) => ({
    range: serializeRange(change.range),
    text: change.text,
    rangeLength: change.rangeLength,
    rangeOffset: change.rangeOffset,
  }));
}

function applyPatchToEditor(editor, patches, fallbackCode, suppressChangeRef) {
  const model = editor?.getModel?.();
  if (!model) return false;

  const selection = editor.getSelection();
  const scrollTop = editor.getScrollTop();
  const scrollLeft = editor.getScrollLeft();
  const viewState = editor.saveViewState();

  suppressChangeRef.current = true;
  try {
    patches.forEach((patch) => {
      if (!patch?.changes?.length) return;

      model.pushEditOperations(
        selection ? [selection] : [],
        patch.changes.map((change) => ({
          range: change.range,
          text: change.text,
          forceMoveMarkers: true,
        })),
        () => (selection ? [selection] : null)
      );
    });

    if (typeof fallbackCode === "string" && model.getValue() !== fallbackCode) {
      console.warn("Patch result diverged; applying authoritative fallback", {
        currentLength: model.getValueLength(),
        fallbackLength: fallbackCode.length,
      });
      model.setValue(fallbackCode);
    }

    if (viewState) editor.restoreViewState(viewState);
    if (selection) editor.setSelection(selection);
    editor.setScrollTop(scrollTop);
    editor.setScrollLeft(scrollLeft);
    return true;
  } catch (error) {
    console.error("Patch apply failed; falling back to full content", error);
    if (typeof fallbackCode === "string") {
      model.setValue(fallbackCode);
      return true;
    }
    return false;
  } finally {
    suppressChangeRef.current = false;
  }
}

function getStoredCode(candidateCode, codeKey) {
  if (!candidateCode || !codeKey) return undefined;
  if (candidateCode instanceof Map) {
    return candidateCode.has(codeKey) ? candidateCode.get(codeKey) : undefined;
  }
  return Object.prototype.hasOwnProperty.call(candidateCode, codeKey)
    ? candidateCode[codeKey]
    : undefined;
}

function SessionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteCursor, setRemoteCursor] = useState(null);
  const inviteToken = searchParams.get("invite") || "";

  const { data: sessionData, isLoading: loadingSession, refetch } = useSessionById(id);

  const joinSessionMutation = useJoinSessionWithInvite();
  const endSessionMutation = useEndSession();
  const updateActiveProblemMutation = useUpdateActiveProblem();
  const updateCodeStateMutation = useUpdateCodeState();
  const attemptedAutoJoinRef = useRef(null);

  const session = sessionData?.session;
  const sessionRole = sessionData?.sessionRole || sessionData?.roleInSession;

  const isHost = sessionRole === "interviewer";
  const isParticipant = sessionRole === "candidate";
  const isEnded = ["ended", "completed", "cancelled"].includes(session?.status);
  const canManageSession = isHost && !isEnded;
  const canEditCode = isParticipant;
  const canRunCode = isParticipant;
  const shouldLockCandidateNavigation = isParticipant && !isHost && !isEnded;

  const { call, channel, chatClient, isInitializingCall, streamClient, callError } = useStreamClient(
    session,
    loadingSession,
    isHost,
    isParticipant
  );

  const sessionProblems =
    session?.problems?.length > 0
      ? session.problems
      : session?.problem
        ? [{ title: session.problem, difficulty: session.difficulty }]
        : [];
  const activeProblemIndex = session?.activeProblemIndex ?? 0;
  const activeProblem = sessionProblems[activeProblemIndex];

  const fallbackProblemData = activeProblem?.title
    ? Object.values(PROBLEMS).find((p) => p.title === activeProblem.title)
    : null;
  const problemData = activeProblem?.question || fallbackProblemData || activeProblem || null;

  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [code, setCode] = useState(problemData?.starterCode?.[selectedLanguage] || "");
  const saveTimeoutRef = useRef(null);
  const syncTimeoutRef = useRef(null);
  const cursorTimeoutRef = useRef(null);
  const snapshotIntervalRef = useRef(null);
  const patchFlushTimeoutRef = useRef(null);
  const pendingPatchesRef = useRef([]);
  const editorRef = useRef(null);
  const editorDisposablesRef = useRef([]);
  const codeRef = useRef(code);
  const suppressEditorChangeRef = useRef(false);
  const clientIdRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
  );
  const localVersionRef = useRef(0);
  const lastAppliedRemoteRef = useRef({ clientId: "", sequence: 0, timestamp: 0 });
  const activeProblemIndexRef = useRef(activeProblemIndex);
  const selectedLanguageRef = useRef(selectedLanguage);
  const sessionIdRef = useRef(null);
  const canEditCodeRef = useRef(false);
  const socketRef = useRef(null);
  const updateCodeStateMutationRef = useRef(updateCodeStateMutation);
  const loadedCodeKeyRef = useRef("");

  const currentCodeKey = `${activeProblemIndex}:${selectedLanguage}`;

  useEffect(() => {
    activeProblemIndexRef.current = activeProblemIndex;
    selectedLanguageRef.current = selectedLanguage;
    sessionIdRef.current = session?._id || null;
    canEditCodeRef.current = canEditCode;
    updateCodeStateMutationRef.current = updateCodeStateMutation;
  }, [
    activeProblemIndex,
    selectedLanguage,
    session?._id,
    canEditCode,
    updateCodeStateMutation,
  ]);

  // auto-join session if user is not already a participant and not the host
  useEffect(() => {
    if (!session || !user || loadingSession) return;
    if (isHost || isParticipant) return;
    if (!inviteToken) return;
    const joinAttemptKey = `${session._id}:${inviteToken}`;
    if (attemptedAutoJoinRef.current === joinAttemptKey) return;

    attemptedAutoJoinRef.current = joinAttemptKey;
    joinSessionMutation.mutate(
      { id, inviteToken },
      {
        onSuccess: refetch,
      }
    );
  }, [
    session,
    user,
    loadingSession,
    isHost,
    isParticipant,
    id,
    inviteToken,
    refetch,
    joinSessionMutation,
  ]);

  // redirect when session ends
  useEffect(() => {
    if (!session || loadingSession) return;

    if (isEnded) navigate("/dashboard");
  }, [isEnded, session, loadingSession, navigate]);

  useEffect(() => {
    if (!isHost || !session?.inviteToken || inviteToken) return;

    navigate(`/session/${id}?invite=${session.inviteToken}`, { replace: true });
  }, [id, inviteToken, isHost, navigate, session?.inviteToken]);

  useEffect(() => {
    if (!isParticipant || !session?._id) return;
    clearSessionLeft(session._id);
  }, [isParticipant, session?._id]);

  // update code when problem loads or changes
  useEffect(() => {
    const codeKey = `${activeProblemIndex}:${selectedLanguage}`;
    const persistedCode = getStoredCode(session?.candidateCode, codeKey);
    const starterCode =
      problemData?.starterCode?.[selectedLanguage] || problemData?.boilerplates?.[selectedLanguage];
    const nextCode = persistedCode ?? starterCode ?? "";
    const isNewEditorContext = loadedCodeKeyRef.current !== codeKey;

    if (!isNewEditorContext) return;

    loadedCodeKeyRef.current = codeKey;
    codeRef.current = nextCode;
    setCode(nextCode);
    applyCodeToEditor(editorRef.current, nextCode, suppressEditorChangeRef);
  }, [
    problemData,
    selectedLanguage,
    session?.candidateCode,
    activeProblemIndex,
  ]);

  useEffect(() => {
    if (canEditCode) return;

    const codeKey = `${activeProblemIndex}:${selectedLanguage}`;
    const persistedCode = getStoredCode(session?.candidateCode, codeKey);
    if (typeof persistedCode !== "string" || persistedCode === codeRef.current) return;

    const lastRemoteAt = lastAppliedRemoteRef.current.timestamp || 0;
    const hasRecentRealtimeUpdate = Date.now() - lastRemoteAt < PERSISTED_CODE_FALLBACK_GRACE_MS;
    if (hasRecentRealtimeUpdate) return;

    console.warn("Applying persisted code fallback after realtime gap", {
      codeKey,
      length: persistedCode.length,
      lastRemoteAt,
    });
    codeRef.current = persistedCode;
    setCode(persistedCode);
    applyCodeToEditor(editorRef.current, persistedCode, suppressEditorChangeRef);
  }, [canEditCode, session?.candidateCode, activeProblemIndex, selectedLanguage]);

  useEffect(() => {
    if (!session?._id || (!isHost && !isParticipant) || isEnded) return undefined;

    const socket = getSocket();
    socketRef.current = socket;

    const joinRoom = () => {
      socket.emit("join-session", {
        sessionId: session._id,
        userId: user?.id,
        role: sessionRole,
      });

      if (canEditCodeRef.current) {
        setTimeout(() => {
          const latestCode = editorRef.current?.getValue?.() ?? codeRef.current;
          emitCodeSync(latestCode, "snapshot");
        }, 50);
      }
    };

    const handleCodeEvent = (event = {}) => {
      if (event.clientId && event.clientId === clientIdRef.current) return;

      if (event.type === "code-patch" || event.type === "code-update") {
        const incomingCodeKey = event.codeKey || `${event.activeProblemIndex}:${event.language}`;
        if (incomingCodeKey !== `${activeProblemIndexRef.current}:${selectedLanguageRef.current}`) return;

        const incomingTimestamp = Number(event.timestamp || 0);
        const incomingSequence = Number(event.sequence || event.version || 0);
        const incomingClientId = event.clientId || event.userId || "";
        const lastRemote = lastAppliedRemoteRef.current;

        if (
          incomingSequence &&
          incomingClientId &&
          incomingClientId === lastRemote.clientId &&
          incomingSequence < lastRemote.sequence
        ) {
          console.warn("Dropped stale code update", {
            incomingTimestamp,
            incomingSequence,
            lastRemote,
          });
          return;
        }

        const hasIncomingCode = typeof event.code === "string";
        const incomingCode = hasIncomingCode ? event.code : undefined;
        debugEditorSync("Received remote update", {
          codeKey: incomingCodeKey,
          language: event.language,
          timestamp: incomingTimestamp,
          sequence: incomingSequence,
          reason: event.reason,
          length: hasIncomingCode ? incomingCode.length : event.codeLength,
        });

        if (event.type === "code-patch") {
          const patches = Array.isArray(event.patches) ? event.patches : [];
          const appliedPatches = [];
          let expectedSequence = lastRemote.sequence || 0;
          let hasGap = false;

          patches.forEach((patch) => {
            const patchSequence = Number(patch.sequence || 0);
            if (patchSequence && patchSequence <= lastRemote.sequence) return;
            if (
              patchSequence &&
              incomingClientId &&
              incomingClientId === lastRemote.clientId &&
              expectedSequence &&
              patchSequence !== expectedSequence + 1
            ) {
              hasGap = true;
            }
            expectedSequence = patchSequence || expectedSequence;
            appliedPatches.push(patch);
          });

          if (hasGap) {
            console.warn("Patch sequence gap detected; applying authoritative fallback", {
              incomingSequence,
              lastRemote,
            });
            if (hasIncomingCode) {
              codeRef.current = incomingCode;
              applyCodeToEditor(editorRef.current, incomingCode, suppressEditorChangeRef);
            } else {
              return;
            }
          } else if (appliedPatches.length > 0) {
            applyPatchToEditor(editorRef.current, appliedPatches, incomingCode, suppressEditorChangeRef);
            codeRef.current = editorRef.current?.getValue?.() ?? codeRef.current;
          }

          lastAppliedRemoteRef.current = {
            clientId: incomingClientId,
            timestamp: incomingTimestamp || Date.now(),
            sequence: Math.max(incomingSequence, lastRemote.sequence),
          };
          return;
        }

        if (!hasIncomingCode) return;

        lastAppliedRemoteRef.current = {
          clientId: incomingClientId,
          timestamp: incomingTimestamp || Date.now(),
          sequence: Math.max(incomingSequence, lastRemote.sequence),
        };
        codeRef.current = incomingCode;
        setCode(incomingCode);
        applyCodeToEditor(editorRef.current, incomingCode, suppressEditorChangeRef);
      }
    };
    const handleCodeUpdate = (event = {}) => handleCodeEvent({ ...event, type: "code-update" });
    const handleCodePatch = (event = {}) => handleCodeEvent({ ...event, type: "code-patch" });

    const handleLanguageUpdate = (event = {}) => {
      if (event.clientId && event.clientId === clientIdRef.current) return;
      if (event.language) {
        setSelectedLanguage(event.language);
        if (typeof event.code === "string") {
          codeRef.current = event.code;
          setCode(event.code);
          applyCodeToEditor(editorRef.current, event.code, suppressEditorChangeRef);
        }
        setOutput(null);
      }
    };

    const handleExecutionResult = (event = {}) => {
      setOutput(event.result || null);
      setIsRunning(false);
      setIsSubmitting(false);
    };

    const handleRunCode = () => {
      setOutput(null);
      setIsRunning(true);
    };

    const handleSubmitCode = () => {
      setOutput(null);
      setIsSubmitting(true);
    };

    const handleQuestionSwitched = () => {
      setOutput(null);
      refetch();
    };

    const handleCursorUpdate = (event = {}) => {
      if (event.clientId && event.clientId === clientIdRef.current) return;
      setRemoteCursor(event.selection || event.position || null);
    };

    const handleParticipantJoined = () => {
      if (canEditCodeRef.current) {
        const latestCode = editorRef.current?.getValue?.() ?? codeRef.current;
        emitCodeSync(latestCode, "snapshot");
      }
    };

    const handleDisconnect = (reason) => {
      console.warn("[socket] disconnected", reason);
    };

    socket.on("connect", joinRoom);
    socket.on("disconnect", handleDisconnect);
    socket.on("code-update", handleCodeUpdate);
    socket.on("code-patch", handleCodePatch);
    socket.on("language-update", handleLanguageUpdate);
    socket.on("execution-result", handleExecutionResult);
    socket.on("submission-result", handleExecutionResult);
    socket.on("run-code", handleRunCode);
    socket.on("submit-code", handleSubmitCode);
    socket.on("question-switched", handleQuestionSwitched);
    socket.on("cursor-update", handleCursorUpdate);
    socket.on("participant-joined", handleParticipantJoined);

    if (!socket.connected) socket.connect();
    else joinRoom();

    return () => {
      socket.emit("leave-session", { sessionId: session._id });
      socket.off("connect", joinRoom);
      socket.off("disconnect", handleDisconnect);
      socket.off("code-update", handleCodeUpdate);
      socket.off("code-patch", handleCodePatch);
      socket.off("language-update", handleLanguageUpdate);
      socket.off("execution-result", handleExecutionResult);
      socket.off("submission-result", handleExecutionResult);
      socket.off("run-code", handleRunCode);
      socket.off("submit-code", handleSubmitCode);
      socket.off("question-switched", handleQuestionSwitched);
      socket.off("cursor-update", handleCursorUpdate);
      socket.off("participant-joined", handleParticipantJoined);
    };
    // emitCodeSync reads live refs; adding it here would recreate socket listeners every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?._id, isHost, isParticipant, isEnded, user?.id, sessionRole, refetch]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
      if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
      if (patchFlushTimeoutRef.current) clearTimeout(patchFlushTimeoutRef.current);
      editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
      editorDisposablesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!canEditCode || !session?._id || !socketRef.current) return undefined;

    if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
    snapshotIntervalRef.current = setInterval(() => {
      const latestCode = editorRef.current?.getValue?.() ?? codeRef.current;
      codeRef.current = latestCode;
      emitCodeSync(latestCode, "snapshot");
    }, CODE_SNAPSHOT_INTERVAL_MS);

    return () => {
      if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    };
    // emitCodeSync reads live refs; adding it here would reset the snapshot interval every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditCode, session?._id]);

  useEffect(() => {
    if (!shouldLockCandidateNavigation) return undefined;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [shouldLockCandidateNavigation]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setSelectedLanguage(newLang);
    // use problem-specific starter code
    const codeKey = `${activeProblemIndex}:${newLang}`;
    const storedCode = getStoredCode(session?.candidateCode, codeKey);
    const starterCode =
      storedCode ??
      problemData?.starterCode?.[newLang] ??
      problemData?.boilerplates?.[newLang] ??
      "";
    loadedCodeKeyRef.current = codeKey;
    codeRef.current = starterCode;
    setCode(starterCode);
    setOutput(null);

    if (isParticipant && session?._id) {
      socketRef.current?.emit("language-change", {
        sessionId: session._id,
        language: newLang,
        code: starterCode,
        codeKey,
        activeProblemIndex,
        timestamp: Date.now(),
        clientId: clientIdRef.current,
      });
    }
  };

  const handleExecuteCode = async (mode) => {
    if (!canRunCode || !session?._id) return;
    if (mode === "submit") setIsSubmitting(true);
    else setIsRunning(true);
    setOutput(null);
    socketRef.current?.emit(mode === "submit" ? "submit-code" : "run-code", {
      sessionId: session._id,
      language: selectedLanguage,
      problemTitle: activeProblem?.title,
      questionId: activeProblem?.questionId || problemData?._id,
      problemSlug: activeProblem?.slug || problemData?.slug,
      timestamp: Date.now(),
      clientId: clientIdRef.current,
    });

    const result = await executeCode({
      sessionId: session._id,
      language: selectedLanguage,
      sourceCode: codeRef.current,
      problemTitle: activeProblem?.title,
      questionId: activeProblem?.questionId || problemData?._id,
      problemSlug: activeProblem?.slug || problemData?.slug,
      mode,
    });
    setOutput(result);
    socketRef.current?.emit(mode === "submit" ? "submission-result" : "execution-result", {
      sessionId: session._id,
      result,
      language: selectedLanguage,
      problemTitle: activeProblem?.title,
      timestamp: Date.now(),
      clientId: clientIdRef.current,
    });
    if (mode === "submit") setIsSubmitting(false);
    else setIsRunning(false);
  };

  const handleRunCode = () => handleExecuteCode("run");
  const handleSubmitCode = () => handleExecuteCode("submit");

  const handleEndSession = () => {
    if (sessionRole !== "interviewer") return;
    if (confirm("Are you sure you want to end this session? All participants will be notified.")) {
      // this will navigate the INTERVIEWER to dashboard
      endSessionMutation.mutate(id, { onSuccess: () => navigate("/dashboard") });
    }
  };

  const handleLeaveMeeting = () => {
    if (session?._id) markSessionLeft(session._id);
    navigate("/dashboard", { replace: true });
  };

  const handleChangeActiveProblem = (nextIndex) => {
    if (sessionRole !== "interviewer" || updateActiveProblemMutation.isPending) return;
    updateActiveProblemMutation.mutate(
      { id, activeProblemIndex: nextIndex },
      {
        onSuccess: () => {
          setOutput(null);
          socketRef.current?.emit("question-switched", {
            sessionId: id,
            activeProblemIndex: nextIndex,
            timestamp: Date.now(),
            clientId: clientIdRef.current,
          });
          refetch();
        },
      }
    );
  };

  const emitCodeSync = (value, reason = "edit") => {
    if (pendingPatchesRef.current.length) flushPatchSync();

    const sessionId = sessionIdRef.current;
    const activeIndex = activeProblemIndexRef.current;
    const language = selectedLanguageRef.current;
    const codeKey = `${activeIndex}:${language}`;
    const timestamp = Date.now();
    const sequence = localVersionRef.current;

    if (!canEditCodeRef.current || !sessionId) {
      console.warn("Dropped code sync because editor is not writable or session is missing", {
        canEditCode: canEditCodeRef.current,
        hasSession: !!sessionId,
        reason,
      });
      return;
    }

    debugEditorSync("Syncing code...", {
      sessionId,
      codeKey,
      language,
      timestamp,
      sequence,
      reason,
      length: value.length,
      connected: !!socketRef.current?.connected,
    });

    socketRef.current?.emit(reason === "snapshot" ? "code-snapshot" : "code-change", {
      sessionId,
      codeKey,
      code: value,
      language,
      activeProblemIndex: activeIndex,
      timestamp,
      version: sequence,
      sequence,
      reason,
      clientId: clientIdRef.current,
    });
  };

  const flushPatchSync = () => {
    if (patchFlushTimeoutRef.current) {
      clearTimeout(patchFlushTimeoutRef.current);
      patchFlushTimeoutRef.current = null;
    }

    const patches = pendingPatchesRef.current;
    pendingPatchesRef.current = [];
    if (!patches.length) return;

    const sessionId = sessionIdRef.current;
    const activeIndex = activeProblemIndexRef.current;
    const language = selectedLanguageRef.current;
    const codeKey = `${activeIndex}:${language}`;
    const latestCode = editorRef.current?.getValue?.() ?? codeRef.current;
    const sequence = patches[patches.length - 1]?.sequence || localVersionRef.current;
    const timestamp = Date.now();

    if (!canEditCodeRef.current || !sessionId) return;

    socketRef.current?.emit("code-patch", {
      sessionId,
      codeKey,
      language,
      activeProblemIndex: activeIndex,
      patches,
      codeLength: latestCode.length,
      timestamp,
      version: sequence,
      sequence,
      reason: "patch",
      clientId: clientIdRef.current,
    });
  };

  const schedulePatchSync = (patch) => {
    pendingPatchesRef.current.push(patch);
    if (patchFlushTimeoutRef.current) return;
    patchFlushTimeoutRef.current = setTimeout(flushPatchSync, CODE_PATCH_FLUSH_MS);
  };

  const scheduleCodeSync = (value, options = {}) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    if (patchFlushTimeoutRef.current) flushPatchSync();

    if (options.immediate) {
      emitCodeSync(value, options.reason || "immediate-edit");
      return;
    }

    syncTimeoutRef.current = setTimeout(
      () => emitCodeSync(value, options.reason || "edit"),
      CODE_SYNC_DEBOUNCE_MS
    );
  };

  const scheduleCodeSave = (value) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      const sessionId = sessionIdRef.current;
      const codeKey = `${activeProblemIndexRef.current}:${selectedLanguageRef.current}`;
      if (!canEditCodeRef.current || !sessionId) return;

      updateCodeStateMutationRef.current.mutate({
        id: sessionId,
        codeKey,
        code: value,
      });
    }, CODE_SAVE_DEBOUNCE_MS);
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
    editorDisposablesRef.current = [];

    const mountedCode = editor.getValue();
    const currentCode = codeRef.current;
    if (currentCode !== mountedCode) {
      applyCodeToEditor(editor, currentCode, suppressEditorChangeRef);
    }

    debugEditorSync("Editor mounted", {
      sessionId: sessionIdRef.current,
      codeKey: currentCodeKey,
      contentLength: editor.getValue().length,
    });

    editorDisposablesRef.current.push(
      editor.onDidChangeModelContent((event) => {
        const latestCode = editor.getValue();
        codeRef.current = latestCode;

        if (suppressEditorChangeRef.current) {
          debugEditorSync("Editor change detected from remote patch", {
            length: latestCode.length,
          });
          return;
        }

        localVersionRef.current += 1;
        const isLargeOrDestructiveChange = event.changes.some((change) => {
          const insertedLength = change.text?.length || 0;
          const removedLength = change.rangeLength || 0;
          return latestCode.length === 0 || removedLength > 50 || Math.abs(insertedLength - removedLength) > 50;
        });

        debugEditorSync("Editor change detected");
        debugEditorSync("Editor content length:", latestCode.length);
        if (isLargeOrDestructiveChange) {
          scheduleCodeSync(latestCode, {
            immediate: true,
            reason: "large-or-destructive-edit",
          });
        } else {
          schedulePatchSync({
            sequence: localVersionRef.current,
            changes: serializeModelChanges(event),
          });
        }
        scheduleCodeSave(latestCode);
      })
    );

    editorDisposablesRef.current.push(
      editor.onDidChangeCursorSelection((event) => {
        if (!canEditCodeRef.current || !sessionIdRef.current) return;
        if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);

        cursorTimeoutRef.current = setTimeout(() => {
          socketRef.current?.emit("cursor-change", {
            sessionId: sessionIdRef.current,
            codeKey: `${activeProblemIndexRef.current}:${selectedLanguageRef.current}`,
            language: selectedLanguageRef.current,
            selection: serializeSelection(event.selection),
            position: editor.getPosition(),
            timestamp: Date.now(),
            clientId: clientIdRef.current,
          });
        }, CURSOR_SYNC_DEBOUNCE_MS);
      })
    );
  };

  const activeDifficultyClass = useMemo(
    () => getDifficultyBadgeClass(activeProblem?.difficulty),
    [activeProblem?.difficulty]
  );
  const remoteCursorPosition = remoteCursor?.positionLineNumber
    ? {
        lineNumber: remoteCursor.positionLineNumber,
        column: remoteCursor.positionColumn,
      }
    : remoteCursor;

  const handleCopyInviteLink = async () => {
    if (!session?.inviteToken && !session?.inviteLink) {
      toast.error("Invite link is not available yet");
      return;
    }

    const rawInviteUrl = session?.inviteLink || `/session/join/${session.inviteToken}`;
    const inviteUrl = rawInviteUrl.startsWith("http")
      ? rawInviteUrl
      : `${window.location.origin}${rawInviteUrl}`;
    if (!inviteUrl || !session?._id) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = inviteUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Invite link copied");
    } catch {
      toast.error("Failed to copy invite link");
    }
  };

  return (
    <div className="h-screen bg-base-100 flex flex-col">
      <Navbar hideNavigationLinks={shouldLockCandidateNavigation} />

      <div className="flex-1">
        <PanelGroup direction="horizontal">
          {/* LEFT PANEL - CODE EDITOR & PROBLEM DETAILS */}
          <Panel defaultSize={50} minSize={30}>
            <PanelGroup direction="vertical">
              {/* PROBLEM DSC PANEL */}
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full overflow-y-auto bg-base-200">
                  {/* HEADER SECTION */}
                  <div className="p-6 bg-base-100 border-b border-base-300">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h1 className="text-3xl font-bold text-base-content">
                          {activeProblem?.title || "Loading..."}
                        </h1>
                        {problemData?.category && (
                          <p className="text-base-content/60 mt-1">{problemData.category}</p>
                        )}
                        <p className="text-base-content/60 mt-2">
                          Host: {session?.host?.name || "Loading..."} •{" "}
                          {session?.participant ? 2 : 1}/2 participants
                        </p>
                        <p className="text-sm text-base-content/60 mt-1">
                          {problemData?.visibleTestCaseCount ?? problemData?.visibleTestCases?.length ?? 0} visible
                          testcases â€¢ {problemData?.totalTestCaseCount ?? activeProblem?.totalTestCaseCount ?? 0} total on submit
                        </p>
                        {isHost && remoteCursorPosition && (
                          <p className="text-xs text-base-content/50 mt-1">
                            Candidate cursor: line {remoteCursorPosition.lineNumber}, col{" "}
                            {remoteCursorPosition.column}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`badge badge-lg ${activeDifficultyClass}`}
                        >
                          {activeProblem?.difficulty
                            ? activeProblem.difficulty.slice(0, 1).toUpperCase() +
                              activeProblem.difficulty.slice(1)
                            : "Easy"}
                        </span>
                        {canManageSession && (
                          <button className="btn btn-secondary btn-sm" onClick={handleCopyInviteLink}>
                            Copy Invite
                          </button>
                        )}
                        {canManageSession && (
                          <button
                            onClick={handleEndSession}
                            disabled={endSessionMutation.isPending}
                            className="btn btn-error btn-sm gap-2"
                          >
                            {endSessionMutation.isPending ? (
                              <Loader2Icon className="w-4 h-4 animate-spin" />
                            ) : (
                              <LogOutIcon className="w-4 h-4" />
                            )}
                            End Session
                          </button>
                        )}
                        {isEnded && (
                          <span className="badge badge-ghost badge-lg">Ended</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {sessionProblems.length > 1 && (
                    <div className="px-6 py-4 border-b border-base-300 bg-base-200/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">
                          Question {activeProblemIndex + 1} of {sessionProblems.length}
                        </p>
                        {sessionRole === "interviewer" && (
                          <div className="flex items-center gap-2">
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleChangeActiveProblem(activeProblemIndex - 1)}
                              disabled={activeProblemIndex === 0 || updateActiveProblemMutation.isPending}
                            >
                              <ChevronLeftIcon className="size-4" />
                              Previous
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleChangeActiveProblem(activeProblemIndex + 1)}
                              disabled={
                                activeProblemIndex === sessionProblems.length - 1 ||
                                updateActiveProblemMutation.isPending
                              }
                            >
                              Next
                              <ChevronRightIcon className="size-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sessionProblems.map((problem, index) => (
                          <button
                            key={`${problem.title}-${index}`}
                            className={`btn btn-xs ${index === activeProblemIndex ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => handleChangeActiveProblem(index)}
                            disabled={sessionRole !== "interviewer" || updateActiveProblemMutation.isPending}
                          >
                            {index + 1}. {problem.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-6 space-y-6">
                    {/* problem desc */}
                    {problemData?.description && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Description</h2>
                        <div className="space-y-3 text-base leading-relaxed">
                          <p className="text-base-content/90">{problemData.description.text}</p>
                          {problemData.description.notes?.map((note, idx) => (
                            <p key={idx} className="text-base-content/90">
                              {note}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* examples section */}
                    {problemData?.examples && problemData.examples.length > 0 && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Examples</h2>

                        <div className="space-y-4">
                          {problemData.examples.map((example, idx) => (
                            <div key={idx}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="badge badge-sm">{idx + 1}</span>
                                <p className="font-semibold text-base-content">Example {idx + 1}</p>
                              </div>
                              <div className="bg-base-200 rounded-lg p-4 font-mono text-sm space-y-1.5">
                                <div className="flex gap-2">
                                  <span className="text-primary font-bold min-w-[70px]">
                                    Input:
                                  </span>
                                  <span>{example.input}</span>
                                </div>
                                <div className="flex gap-2">
                                  <span className="text-secondary font-bold min-w-[70px]">
                                    Output:
                                  </span>
                                  <span>{example.output}</span>
                                </div>
                                {example.explanation && (
                                  <div className="pt-2 border-t border-base-300 mt-2">
                                    <span className="text-base-content/60 font-sans text-xs">
                                      <span className="font-semibold">Explanation:</span>{" "}
                                      {example.explanation}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Constraints */}
                    {problemData?.constraints && problemData.constraints.length > 0 && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Constraints</h2>
                        <ul className="space-y-2 text-base-content/90">
                          {problemData.constraints.map((constraint, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-primary">•</span>
                              <code className="text-sm">{constraint}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

              <Panel defaultSize={50} minSize={20}>
                <PanelGroup direction="vertical">
                  <Panel defaultSize={70} minSize={30}>
                    <CodeEditorPanel
                      key={`${session?._id || "session"}-${activeProblemIndex}-${selectedLanguage}-${isParticipant}`}
                      selectedLanguage={selectedLanguage}
                      code={code}
                      isRunning={isRunning}
                      isSubmitting={isSubmitting}
                      canRunCode={canRunCode}
                      canSubmitCode={canRunCode}
                      isReadOnly={!canEditCode}
                      syncCodeFromProps={false}
                      onLanguageChange={handleLanguageChange}
                      onRunCode={handleRunCode}
                      onSubmitCode={handleSubmitCode}
                      onEditorMount={handleEditorMount}
                    />
                  </Panel>

                  <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

                  <Panel defaultSize={30} minSize={15}>
                    <OutputPanel output={output} />
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-2 bg-base-300 hover:bg-primary transition-colors cursor-col-resize" />

          {/* RIGHT PANEL - VIDEO CALLS & CHAT */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full bg-base-200 p-4 overflow-auto">
              {isInitializingCall ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
                    <p className="text-lg">Connecting to video call...</p>
                  </div>
                </div>
              ) : !streamClient || !call ? (
                <div className="h-full flex items-center justify-center">
                  <div className="card bg-base-100 shadow-xl max-w-md">
                    <div className="card-body items-center text-center">
                      <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mb-4">
                        <PhoneOffIcon className="w-12 h-12 text-error" />
                      </div>
                      <h2 className="card-title text-2xl">Connection Failed</h2>
                      <p className="text-base-content/70">Unable to connect to the video call</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full">
                  {callError && (
                    <div className="alert alert-warning mb-3 text-sm">
                      <span>{callError}</span>
                    </div>
                  )}
                  <StreamVideo client={streamClient}>
                    <StreamCall call={call}>
                      <VideoCallUI
                        chatClient={chatClient}
                        channel={channel}
                        onLeaveMeeting={handleLeaveMeeting}
                      />
                    </StreamCall>
                  </StreamVideo>
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default SessionPage;
