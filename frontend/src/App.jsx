import { useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useLocation, useNavigate } from "react-router";
import HomePage from "./pages/HomePage";

import { Toaster } from "react-hot-toast";
import DashboardPage from "./pages/DashboardPage";
import ProblemPage from "./pages/ProblemPage";
import ProblemsPage from "./pages/ProblemsPage";
import SessionPage from "./pages/SessionPage";
import JoinSessionPage from "./pages/JoinSessionPage";
import axiosInstance from "./lib/axios";

function App() {
  const { isSignedIn, isLoaded, user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSignedIn) return;

    const lockCandidateToSession = async () => {
      try {
        const { data } = await axiosInstance.get("/sessions/active");
        const activeSessions = data?.sessions || [];
        const participantSession = activeSessions.find(
          (session) =>
            session.participant?.clerkId === user?.id && session.host?.clerkId !== user?.id
        );

        if (!participantSession?._id) return;

        const targetPath = `/session/${participantSession._id}`;
        const isAlreadyInsideTargetSession = location.pathname === targetPath;
        const isAnySessionRoute = location.pathname.startsWith("/session/");

        if (!isAlreadyInsideTargetSession && !isAnySessionRoute) {
          navigate(targetPath, { replace: true });
        }
      } catch {
        // ignore transient session lock fetch errors
      }
    };

    lockCandidateToSession();
  }, [isSignedIn, location.pathname, navigate, user?.id]);

  // this will get rid of the flickering effect
  if (!isLoaded) return null;

  return (
    <>
      <Routes>
        <Route path="/" element={!isSignedIn ? <HomePage /> : <Navigate to={"/dashboard"} />} />
        <Route path="/dashboard" element={isSignedIn ? <DashboardPage /> : <Navigate to={"/"} />} />

        <Route path="/problems" element={isSignedIn ? <ProblemsPage /> : <Navigate to={"/"} />} />
        <Route path="/problem/:id" element={isSignedIn ? <ProblemPage /> : <Navigate to={"/"} />} />
        <Route
          path="/session/join/:token"
          element={isSignedIn ? <JoinSessionPage /> : <Navigate to={"/"} />}
        />
        <Route path="/session/:id" element={isSignedIn ? <SessionPage /> : <Navigate to={"/"} />} />
      </Routes>

      <Toaster toastOptions={{ duration: 3000 }} />
    </>
  );
}

export default App;
