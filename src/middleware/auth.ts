import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'email-deliverability-app-jwt-secret-key-2026';

export interface AuthUser {
  uid: string;
  email: string;
  callerKey?: string;
  callerName?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  res.setHeader('Content-Type', 'application/json');
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Unauthorized: Empty token' });
  }

  try {
    // 1. Try decoding with backend JWT secret
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && (decoded.uid || decoded.sub)) {
        req.user = {
          uid: decoded.uid || decoded.sub,
          email: decoded.email || '',
          callerKey: decoded.callerKey,
          callerName: decoded.callerName,
        };
        return next();
      }
    } catch {
      // If verification with JWT_SECRET fails, it could be a Supabase JWT
    }

    // 2. Decode Supabase JWT payload (claims contain sub and email)
    const decoded = jwt.decode(token) as any;
    if (decoded && decoded.sub) {
      req.user = {
        uid: decoded.sub,
        email: decoded.email || '',
        callerKey: decoded.callerKey,
        callerName: decoded.callerName,
      };
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
};

export function generateToken(user: { uid: string; email: string }): string {
  return jwt.sign(
    { uid: user.uid, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function generateCallerToken(caller: { callerKey: string; name: string; email: string; fixedCode?: string }): string {
  return jwt.sign(
    { 
      uid: `caller_${caller.callerKey}`, 
      email: caller.email, 
      callerKey: caller.callerKey, 
      callerName: caller.name,
      isCaller: true 
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}
