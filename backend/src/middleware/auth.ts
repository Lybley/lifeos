import { Request, Response, NextFunction } from 'express';
import { auth } from 'express-oauth2-jwt-bearer';

// Auth0 JWT validation middleware
// Make it optional if Auth0 is not configured
let authMiddleware: any;

if (process.env.AUTH0_AUDIENCE && process.env.AUTH0_DOMAIN) {
  authMiddleware = auth({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
    tokenSigningAlg: 'RS256',
  });
} else {
  // Mock auth middleware if Auth0 not configured
  authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Add a mock user for development
    (req as any).auth = { sub: 'dev-user' };
    next();
  };
}

export { authMiddleware };

// Optional auth middleware (doesn't fail if no token)
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }
  return authMiddleware(req, res, next);
};
