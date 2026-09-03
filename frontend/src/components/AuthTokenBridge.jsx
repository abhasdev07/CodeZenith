import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { setAuthTokenGetter } from "../lib/axios";

function AuthTokenBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      setAuthTokenGetter(null);
      return;
    }

    setAuthTokenGetter(getToken);
    return () => setAuthTokenGetter(null);
  }, [getToken, isSignedIn]);

  return null;
}

export default AuthTokenBridge;
