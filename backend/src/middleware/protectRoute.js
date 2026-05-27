import { requireAuth } from "@clerk/express";
import { clerkClient } from "@clerk/clerk-sdk-node";
import User from "../models/User.js";
import { upsertStreamUser } from "../lib/stream.js";

/**
 * Extract user information from Clerk session data
 * Handles multiple OAuth providers (Google, GitHub) and email/password auth
 */
async function extractClerkUserData(clerkAuth) {
  const auth = clerkAuth || {};
  let clerkUser = null;

  if (auth.userId) {
    try {
      clerkUser = await clerkClient.users.getUser(auth.userId);
    } catch (error) {
      console.warn("Could not fetch Clerk user profile, falling back to session claims:", error.message);
    }
  }

  // Extract email - try multiple sources for robustness
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    auth.sessionClaims?.email ||
    auth.sessionClaims?.email_addresses?.[0]?.email_address ||
    auth.sessionClaims?.primary_email ||
    "";

  // Extract name - handles different Clerk user object structures
  let fullName = "";

  // Priority 1: Direct firstName + lastName
  const firstName = auth.sessionClaims?.first_name || "";
  const lastName = auth.sessionClaims?.last_name || "";
  const clerkFirstName = clerkUser?.firstName || "";
  const clerkLastName = clerkUser?.lastName || "";

  if (clerkFirstName || clerkLastName) {
    fullName = `${clerkFirstName} ${clerkLastName}`.trim();
  }

  if (!fullName && (firstName || lastName)) {
    fullName = `${firstName} ${lastName}`.trim();
  }

  // Priority 2: fullName field (some OAuth providers)
  if (!fullName) {
    fullName =
      clerkUser?.fullName ||
      clerkUser?.username ||
      auth.sessionClaims?.fullName ||
      auth.sessionClaims?.name ||
      auth.sessionClaims?.given_name ||
      "";
  }

  // Priority 3: Extract name from email (fallback)
  if (!fullName && email) {
    fullName = email.split("@")[0].replace(/[._-]/g, " ").trim();
  }

  // Priority 4: Generic fallback
  if (!fullName) {
    fullName = "User";
  }

  // Extract profile image - handle multiple sources
  const profileImage =
    clerkUser?.imageUrl ||
    auth.sessionClaims?.image_url ||
    auth.sessionClaims?.profile_image_url ||
    auth.sessionClaims?.picture ||
    "";

  // Extract sign-in provider info for future use
  const signInProvider = auth.sessionClaims?.provider || "unknown";

  return {
    email: email || `user-${auth.userId}@clerk.local`,
    name: fullName,
    profileImage,
    signInProvider,
  };
}

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth?.().userId;

      if (!clerkId) {
        return res.status(401).json({
          message: "Unauthorized - invalid or expired token",
        });
      }

      // Try to find existing user
      let user = await User.findOne({ clerkId });

      if (user) {
        // User exists - optionally update profile if changed
        const clerkUserData = await extractClerkUserData(req.auth());

        // Check if any profile info changed
        const hasChanges =
          user.name !== clerkUserData.name ||
          user.email !== clerkUserData.email ||
          user.profileImage !== clerkUserData.profileImage;

        if (hasChanges) {
          // Update user with latest Clerk data
          user = await User.findByIdAndUpdate(
            user._id,
            {
              name: clerkUserData.name,
              email: clerkUserData.email,
              profileImage: clerkUserData.profileImage,
            },
            { new: true, runValidators: true }
          );

          console.log(
            `✅ User profile updated for ${clerkUserData.email}: name="${clerkUserData.name}"`
          );
        }
      } else {
        // Create new user from Clerk data
        const clerkUserData = await extractClerkUserData(req.auth());

        // Validate required fields
        if (!clerkUserData.email) {
          return res.status(400).json({
            message: "Could not extract email from Clerk authentication",
          });
        }

        if (!clerkUserData.name) {
          return res.status(400).json({
            message: "Could not extract name from Clerk authentication",
          });
        }

        try {
          user = await User.create({
            clerkId,
            email: clerkUserData.email,
            name: clerkUserData.name,
            profileImage: clerkUserData.profileImage,
            role: "candidate", // Default role: candidates can join interviews
          });

          console.log(
            `✅ New user created: "${clerkUserData.name}" (${clerkUserData.email}) as "candidate" via ${clerkUserData.signInProvider}`
          );
        } catch (createError) {
          // Handle duplicate email or clerkId
          if (createError.code === 11000) {
            const duplicateField = Object.keys(createError.keyPattern)[0];
            return res.status(409).json({
              message: `User with this ${duplicateField} already exists`,
            });
          }
          throw createError;
        }
      }

      // Attach user to request for downstream use
      req.user = user;

      // Ensure Stream user exists so chat/channel membership operations don't fail.
      await upsertStreamUser({
        id: user.clerkId.toString(),
        name: user.name,
        image: user.profileImage,
      });

      next();
    } catch (error) {
      console.error("❌ Error in protectRoute middleware:", {
        message: error.message,
        code: error.code,
        userId: req.auth?.().userId,
      });

      // Don't expose sensitive error details to client
      const statusCode = error.status || 500;
      res.status(statusCode).json({
        message:
          statusCode === 500
            ? "Internal Server Error - Failed to authenticate user"
            : error.message || "Authentication failed",
      });
    }
  },
];
