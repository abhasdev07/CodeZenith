import { useState, useEffect, useRef } from "react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import { initializeStreamClient, disconnectStreamClient } from "../lib/stream";
import { sessionApi } from "../api/sessions";

function useStreamClient(session, loadingSession, isHost, isParticipant) {
  const [streamClient, setStreamClient] = useState(null);
  const [call, setCall] = useState(null);
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isInitializingCall, setIsInitializingCall] = useState(true);
  const activeCallIdRef = useRef(null);
  const streamClientRef = useRef(null);
  const videoCallRef = useRef(null);
  const chatClientRef = useRef(null);

  useEffect(() => {
    const isEnded = ["ended", "completed", "cancelled"].includes(session?.status);
    const shouldJoin = !!session?.callId && (isHost || isParticipant) && !isEnded;

    const initCall = async () => {
      if (!shouldJoin) {
        setIsInitializingCall(false);
        return;
      }

      if (activeCallIdRef.current === session.callId && streamClientRef.current) {
        setIsInitializingCall(false);
        return;
      }

      try {
        setIsInitializingCall(true);
        await cleanup();

        await sessionApi.ensureSessionChatAccess(session._id);
        const { token, userId, userName, userImage } = await sessionApi.getStreamToken();

        const client = await initializeStreamClient(
          {
            id: userId,
            name: userName,
            image: userImage,
          },
          token
        );

        streamClientRef.current = client;
        setStreamClient(client);
        activeCallIdRef.current = session.callId;

        const videoCall = client.call("default", session.callId);
        await videoCall.join({ create: true });
        videoCallRef.current = videoCall;
        setCall(videoCall);

        const apiKey = import.meta.env.VITE_STREAM_API_KEY;
        const chatClientInstance = StreamChat.getInstance(apiKey);

        if (!chatClientInstance.userID) {
          await chatClientInstance.connectUser(
            {
              id: userId,
              name: userName,
              image: userImage,
            },
            token
          );
        }
        chatClientRef.current = chatClientInstance;
        setChatClient(chatClientInstance);

        const chatChannel = chatClientInstance.channel("messaging", session.callId);
        await chatChannel.watch();
        setChannel(chatChannel);
      } catch (error) {
        toast.error("Failed to join video call");
        console.error("Error init call", error);
      } finally {
        setIsInitializingCall(false);
      }
    };

    const cleanup = async () => {
      try {
        if (videoCallRef.current) await videoCallRef.current.leave();
        if (chatClientRef.current?.userID) await chatClientRef.current.disconnectUser();
        await disconnectStreamClient();
      } catch (error) {
        console.error("Cleanup error:", error);
      } finally {
        videoCallRef.current = null;
        chatClientRef.current = null;
        streamClientRef.current = null;
        activeCallIdRef.current = null;
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
  }, [session?._id, session?.callId, session?.status, loadingSession, isHost, isParticipant]);

  return {
    streamClient,
    call,
    chatClient,
    channel,
    isInitializingCall,
  };
}

export default useStreamClient;
