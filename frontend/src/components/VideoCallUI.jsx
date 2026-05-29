import {
  CallControls,
  CallingState,
  SpeakerLayout,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { Loader2Icon, MessageSquareIcon, UsersIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Channel, Chat, MessageInput, MessageList, Thread, Window } from "stream-chat-react";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";

function VideoCallUI({ chatClient, channel, onLeaveMeeting }) {
  const navigate = useNavigate();
  const { useCallCallingState, useParticipantCount } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participantCount = useParticipantCount();
  const [isChatOpen, setIsChatOpen] = useState(false);

  if (callingState === CallingState.JOINING) {
    return (
      <div className="h-full flex items-center justify-center rounded-2xl border border-white/10 bg-[#151820]">
        <div className="text-center">
          <Loader2Icon className="size-10 mx-auto animate-spin text-emerald-300 mb-4" />
          <p className="text-sm font-medium text-base-content/75">Joining call...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="session-video-panel h-full min-h-0 flex flex-col gap-3 str-video">
      <div className="min-h-0 flex-1 flex flex-col rounded-2xl border border-white/10 bg-[#151820] p-3 shadow-[0_14px_32px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-base-content/80">
            <span className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <UsersIcon className="size-4 text-emerald-300" />
            </span>
            <span className="font-semibold">
              {participantCount} {participantCount === 1 ? "participant" : "participants"}
            </span>
          </div>
          {chatClient && channel && (
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`btn btn-sm min-h-9 rounded-lg border-0 px-3 ${
                isChatOpen ? "btn-primary" : "btn-ghost"
              }`}
              title={isChatOpen ? "Hide chat" : "Show chat"}
            >
              <MessageSquareIcon className="size-4" />
              Chat
            </button>
          )}
        </div>

        <div className="mt-3 min-h-[320px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#101923] p-1">
          <SpeakerLayout />
        </div>

        <div className="mt-3 flex justify-end rounded-xl border border-white/10 bg-black/20 px-2 py-2">
          <CallControls onLeave={onLeaveMeeting || (() => navigate("/dashboard"))} />
        </div>
      </div>

      {/* CHAT SECTION */}

      {chatClient && channel && isChatOpen && (
        <div
          className="min-h-0 flex-1 flex flex-col rounded-2xl border border-white/10 shadow-[0_14px_32px_rgba(0,0,0,0.2)] overflow-hidden bg-[#151820]"
        >
          <div className="bg-[#101217] px-3 py-2.5 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-base-content/90">Session Chat</h3>
            <button
              onClick={() => setIsChatOpen(false)}
              className="btn btn-ghost btn-xs min-h-8 rounded-lg px-2 text-base-content/60 hover:text-base-content"
              title="Close chat"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden stream-chat-dark">
            <Chat client={chatClient} theme="str-chat__theme-dark">
              <Channel channel={channel}>
                <Window>
                  <MessageList />
                  <MessageInput />
                </Window>
                <Thread />
              </Channel>
            </Chat>
          </div>
        </div>
      )}
    </div>
  );
}
export default VideoCallUI;
