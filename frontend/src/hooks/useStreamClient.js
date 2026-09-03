import { useState, useEffect, useRef } from "react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import { initializeStreamClient, disconnectStreamClient } from "../lib/stream";
import { sessionApi } from "../api/sessions";

const JOIN_TIMEOUT_MS = 10000;

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function useStreamClient(session, loadingSession, isHost, isParticipant) {
  const [streamClient, setStreamClient] = useState(null);
  const [call, setCall] = useState(null);
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isInitializingCall, setIsInitializingCall] = useState(true);
  const [callError, setCallError] = useState("");
  const activeCallIdRef = useRef(null);
  const streamClientRef = useRef(null);
  const videoCallRef = useRef(null);
  const chatClientRef = useRef(null);

  useEffect(() => {
    // Only initialize on first load, not on refetch
    const isSessionDataReady = !!session?.callId && !!session?._id;
    const isEnded = ["ended", "completed", "cancelled"].includes(session?.status);
    const shouldJoin = isSessionDataReady && (isHost || isParticipant) && !isEnded;

    const initCall = async () => {
      if (!shouldJoin) {
        console.log("[useStreamClient] Not joining - shouldJoin is false", {
          hasCallId: !!session?.callId,
          isHost,
          isParticipant,
          isEnded,
        });
        setIsInitializingCall(false);
        return;
      }

      if (activeCallIdRef.current === session.callId && streamClientRef.current) {
        console.log("[useStreamClient] Already initialized for this call");
        setIsInitializingCall(false);
        return;
      }

      try {
        setIsInitializingCall(true);
        setCallError("");
        await cleanup();

        console.log("[useStreamClient] Ensuring session chat access...");
        await sessionApi.ensureSessionChatAccess(session._id);
        
        console.log("[useStreamClient] Getting Stream token...");
        const { token, userId, userName, userImage } = await withTimeout(
          sessionApi.getStreamToken(),
          5000,
          "Getting Stream token timed out"
        );

        console.log("[useStreamClient] Initializing Stream client...");
        const client = await withTimeout(
          initializeStreamClient(
            {
              id: userId,
              name: userName,
              image: userImage,
            },
            token
          ),
          5000,
          "Stream client initialization timed out"
        );

        streamClientRef.current = client;
        setStreamClient(client);
        activeCallIdRef.current = session.callId;

        const videoCall = client.call("default", session.callId);
        videoCallRef.current = videoCall;
        setCall(videoCall);

        const apiKey = import.meta.env.VITE_STREAM_API_KEY;
        const chatClientInstance = StreamChat.getInstance(apiKey);

        if (!chatClientInstance.userID) {
          console.log("[useStreamClient] Connecting chat user...");
          await withTimeout(
            chatClientInstance.connectUser(
              {
                id: userId,
                name: userName,
                image: userImage,
              },
              token
            ),
            5000,
            "Chat connection timed out"
          );
        }
        chatClientRef.current = chatClientInstance;
        setChatClient(chatClientInstance);

        console.log("[useStreamClient] Watching chat channel...");
        const chatChannel = chatClientInstance.channel("messaging", session.callId);
        await withTimeout(
          chatChannel.watch(),
          5000,
          "Chat channel watch timed out"
        );
        setChannel(chatChannel);

        console.log("[useStreamClient] Joining video call...");
        await withTimeout(
          videoCall.join({ create: true }),
          JOIN_TIMEOUT_MS,
          "Video join timed out. Check camera/microphone permissions and network access."
        );
        console.log("[useStreamClient] Successfully initialized Stream client");
      } catch (error) {
        console.error("[useStreamClient] Error initializing call:", error);
        setCallError(error.message || "Failed to join video call");
        toast.error("Video connection issue: " + (error.message || "Please refresh and try again."));
      } finally {
        setIsInitializingCall(false);
      }
    };

    const cleanup = async () => {
      try {
        console.log("[useStreamClient] Starting cleanup...");
        
        if (videoCallRef.current) {
          console.log("[useStreamClient] Leaving video call...");
          await withTimeout(videoCallRef.current.leave(), 3000, "Video leave timed out");
        }
        
        if (chatClientRef.current?.userID) {
          console.log("[useStreamClient] Disconnecting chat...");
          await withTimeout(chatClientRef.current.disconnectUser(), 3000, "Chat disconnect timed out");
        }
        
        console.log("[useStreamClient] Disconnecting Stream client...");
        await withTimeout(disconnectStreamClient(), 3000, "Stream disconnect timed out");
        
        console.log("[useStreamClient] Cleanup complete");
      } catch (error) {
        console.error("[useStreamClient] Cleanup error (non-blocking):", error);
        // Don't throw - cleanup is best-effort
      } finally {
        videoCallRef.current = null;
        chatClientRef.current = null;
        streamClientRef.current = null;
        activeCallIdRef.current = null;
        setCallError("");
        setCall(null);
        setChannel(null);
        setChatClient(null);
        setStreamClient(null);
      }
    };

    if (!loadingSession) initCall();

    return () => {
      const isUnmountingOrDifferentCall =
        !shouldJoin ||
        activeCallIdRef.current !== session?.callId ||
        ["ended", "completed", "cancelled"].includes(session?.status);
      if (isUnmountingOrDifferentCall) cleanup();
    };
  }, [session?._id, session?.callId, session?.status, isHost, isParticipant, loadingSession]);

  return {
    streamClient,
    call,
    chatClient,
    channel,
    isInitializingCall,
    callError,
  };
}

export default useStreamClient;
