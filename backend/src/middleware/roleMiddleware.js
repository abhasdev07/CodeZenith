/**
 * Role-Based Access Control Middleware
 * Provides role checking for route protection in CodeZenith
 *
 * Supported Roles:
 * - "interviewer": Can create sessions, end interviews, view candidate work
 * - "candidate": Can join sessions, submit solutions, run code
 */

/**
 * Generic role checker middleware
 * @param {string|string[]} requiredRoles - Single role or array of allowed roles
 * @returns {Function} Express middleware function
 */
export const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    // Verify user is attached (should be from protectRoute middleware)
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized - user not authenticated",
      });
    }

    // Handle single role or array of roles
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    // Check if user's role is in allowed roles
    if (!req.user.role) {
      return res.status(403).json({
        message: `Access denied. No role is assigned to your account. Required role: ${roles.join(", ")}`,
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. This action requires one of these roles: ${roles.join(", ")}. Your role: ${req.user.role}`,
      });
    }

    // Log for audit trail (optional, helps with debugging)
    console.log(`✅ Role check passed: ${req.user.name} (${req.user.role})`);

    next();
  };
};

/**
 * Require interviewer role
 * Use on routes only interviewers should access
 */
export const requireInterviewer = requireRole("interviewer");

/**
 * Require candidate role
 * Use on routes only candidates should access
 */
export const requireCandidate = requireRole("candidate");

/**
 * Allow multiple roles
 * Useful for shared routes with different permissions
 * @param {string[]} roles - Array of allowed roles
 */
export const requireAnyRole = (roles) => requireRole(roles);
