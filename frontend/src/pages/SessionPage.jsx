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

function SessionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
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

  const { call, channel, chatClient, isInitializingCall, streamClient } = useStreamClient(
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

  // find the problem data based on active problem title
  const problemData = activeProblem?.title
    ? Object.values(PROBLEMS).find((p) => p.title === activeProblem.title)
    : null;

  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [code, setCode] = useState(problemData?.starterCode?.[selectedLanguage] || "");
  const saveTimeoutRef = useRef(null);

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

  // update code when problem loads or changes
  useEffect(() => {
    const codeKey = `${activeProblemIndex}:${selectedLanguage}`;
    const persistedCode = session?.candidateCode?.[codeKey];
    if (problemData?.starterCode?.[selectedLanguage]) {
      setCode(persistedCode || problemData.starterCode[selectedLanguage]);
    }
  }, [problemData, selectedLanguage, session?.candidateCode, activeProblemIndex]);

  useEffect(() => {
    if (!channel) return undefined;

    const listener = channel.on((event) => {
      if (event.type !== "code.update") return;
      if (event.user?.id === user?.id) return;
      if (event.codeKey !== `${activeProblemIndex}:${selectedLanguage}`) return;

      setCode(event.code || "");
    });

    return () => {
      listener?.unsubscribe?.();
    };
  }, [channel, user?.id, activeProblemIndex, selectedLanguage]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

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
    const starterCode = problemData?.starterCode?.[newLang] || "";
    setCode(starterCode);
    setOutput(null);
  };

  const handleRunCode = async () => {
    if (!canRunCode || !session?._id) return;
    setIsRunning(true);
    setOutput(null);

    const result = await executeCode({
      sessionId: session._id,
      language: selectedLanguage,
      sourceCode: code,
    });
    setOutput(result);
    setIsRunning(false);
  };

  const handleEndSession = () => {
    if (sessionRole !== "interviewer") return;
    if (confirm("Are you sure you want to end this session? All participants will be notified.")) {
      // this will navigate the INTERVIEWER to dashboard
      endSessionMutation.mutate(id, { onSuccess: () => navigate("/dashboard") });
    }
  };

  const handleChangeActiveProblem = (nextIndex) => {
    if (sessionRole !== "interviewer" || updateActiveProblemMutation.isPending) return;
    updateActiveProblemMutation.mutate(
      { id, activeProblemIndex: nextIndex },
      {
        onSuccess: () => {
          setOutput(null);
          refetch();
        },
      }
    );
  };

  const handleCodeChange = (value = "") => {
    setCode(value);
    if (!canEditCode || !session?._id) return;

    const codeKey = `${activeProblemIndex}:${selectedLanguage}`;
    channel?.sendEvent({
      type: "code.update",
      codeKey,
      code: value,
    });

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateCodeStateMutation.mutate({
        id: session._id,
        codeKey,
        code: value,
      });
    }, 900);
  };

  const activeDifficultyClass = useMemo(
    () => getDifficultyBadgeClass(activeProblem?.difficulty),
    [activeProblem?.difficulty]
  );

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
                      selectedLanguage={selectedLanguage}
                      code={code}
                      isRunning={isRunning}
                      canRunCode={canRunCode}
                      isReadOnly={!canEditCode}
                      onLanguageChange={handleLanguageChange}
                      onCodeChange={handleCodeChange}
                      onRunCode={handleRunCode}
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
                  <StreamVideo client={streamClient}>
                    <StreamCall call={call}>
                      <VideoCallUI chatClient={chatClient} channel={channel} />
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
