import { Loader2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import Navbar from "../components/Navbar";
import { useJoinSessionByToken } from "../hooks/useSessions";

function JoinSessionPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const joinSessionMutation = useJoinSessionByToken();
  const attemptedTokenRef = useRef(null);

  useEffect(() => {
    if (!token || attemptedTokenRef.current === token) return;

    attemptedTokenRef.current = token;
    joinSessionMutation.mutate(token, {
      onSuccess: (data) => {
        if (data?.session?._id) {
          navigate(`/session/${data.session._id}`, { replace: true });
        }
      },
    });
  }, [token, joinSessionMutation, navigate]);

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar hideNavigationLinks />
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-6">
        <div className="card bg-base-100 border border-base-300 shadow-xl max-w-md w-full">
          <div className="card-body items-center text-center">
            <Loader2Icon className="size-12 text-primary animate-spin" />
            <h1 className="card-title text-2xl">Joining interview</h1>
            <p className="text-base-content/70">Preparing your session room...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JoinSessionPage;
