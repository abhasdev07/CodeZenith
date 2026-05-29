import { AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import Navbar from "../components/Navbar";
import { useJoinSessionByToken } from "../hooks/useSessions";
import { clearSessionLeft } from "../lib/sessionLifecycle";

const JOIN_RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 12000];
const isNotFoundError = (error) => error?.response?.status === 404;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function JoinSessionPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const joinSessionMutation = useJoinSessionByToken({ silentNotFound: true });
  
  const attemptedTokenRef = useRef(null);
  const navigationInProgressRef = useRef(false);
  const joinInProgressRef = useRef(false);
  
  const [joinError, setJoinError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  // Stable reference to the mutation function
  const mutateAsyncRef = useRef(null);
  
  useEffect(() => {
    mutateAsyncRef.current = joinSessionMutation.mutateAsync;
  }, [joinSessionMutation.mutateAsync]);

  useEffect(() => {
    // Early exit conditions
    if (!token) {
      console.log("[JoinSessionPage] No token provided");
      return;
    }
    
    if (attemptedTokenRef.current === token) {
      console.log("[JoinSessionPage] Token already attempted");
      return;
    }
    
    if (navigationInProgressRef.current) {
      console.log("[JoinSessionPage] Navigation already in progress");
      return;
    }

    if (joinInProgressRef.current) {
      console.log("[JoinSessionPage] Join already in progress");
      return;
    }

    // Mark this token as attempted
    attemptedTokenRef.current = token;
    joinInProgressRef.current = true;
    setJoinError("");

    const performJoin = async () => {
      try {
        console.log("[JoinSessionPage] Starting join with token:", token);
        
        // Use the ref to call the mutation function
        if (!mutateAsyncRef.current) {
          throw new Error("Mutation not initialized");
        }

        let data;
        for (let attempt = 0; attempt <= JOIN_RETRY_DELAYS_MS.length; attempt += 1) {
          try {
            const joinPromise = mutateAsyncRef.current(token);
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error("Join timed out after 12 seconds")), 12000);
            });

            data = await Promise.race([joinPromise, timeoutPromise]);
            break;
          } catch (error) {
            const shouldRetry =
              isNotFoundError(error) && attempt < JOIN_RETRY_DELAYS_MS.length;
            if (!shouldRetry) throw error;

            console.log(
              `[JoinSessionPage] Session not ready, retrying join in ${JOIN_RETRY_DELAYS_MS[attempt]}ms`
            );
            await wait(JOIN_RETRY_DELAYS_MS[attempt]);
          }
        }
        
        console.log("[JoinSessionPage] Join succeeded:", data);
        
        // Extract and validate session ID
        const sessionId = data?.session?._id || data?._id;
        if (!sessionId) {
          throw new Error("No session ID in response");
        }

        console.log("[JoinSessionPage] Session ID obtained:", sessionId);
        
        if (navigationInProgressRef.current) {
          console.log("[JoinSessionPage] Navigation already started, skipping");
          return;
        }

        // Prepare for navigation
        console.log("[JoinSessionPage] Preparing navigation...");
        clearSessionLeft(sessionId);
        navigationInProgressRef.current = true;
        setIsNavigating(true);
        
        // Navigate after a small delay to ensure state is updated
        setTimeout(() => {
          console.log("[JoinSessionPage] Navigating to session:", sessionId);
          navigate(`/session/${sessionId}`, { replace: true });
        }, 100);
        
      } catch (error) {
        console.error("[JoinSessionPage] Join error:", error);
        joinInProgressRef.current = false;
        
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          "Failed to join the interview session";
        
        console.error("[JoinSessionPage] Setting error:", errorMessage);
        setJoinError(errorMessage);
      }
    };

    performJoin();

  }, [navigate, retryCount, token]);

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar hideNavigationLinks />
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-6">
        <div className="card bg-base-100 border border-base-300 shadow-xl max-w-md w-full">
          <div className="card-body items-center text-center">
            {/* Show loading while navigating OR if no error */}
            {!joinError || isNavigating ? (
              <>
                <Loader2Icon className="size-12 text-primary animate-spin" />
                <h1 className="card-title text-2xl">
                  {isNavigating ? "Opening session..." : "Joining interview"}
                </h1>
                <p className="text-base-content/70">
                  {isNavigating ? "Redirecting to your session room..." : "Preparing your session room..."}
                </p>
              </>
            ) : (
              <>
                <AlertTriangleIcon className="size-12 text-warning" />
                <h1 className="card-title text-2xl">Join needs attention</h1>
                <p className="text-base-content/70">{joinError}</p>
                <div className="card-actions mt-2">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      attemptedTokenRef.current = null;
                      navigationInProgressRef.current = false;
                      setJoinError("");
                      setRetryCount((count) => count + 1);
                    }}
                  >
                    Retry
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate("/dashboard")}>
                    Dashboard
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default JoinSessionPage;
