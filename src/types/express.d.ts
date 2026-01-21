import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        id: string;
        email: string;
      };
      admin?: {
        id: string;
        email: string;
        fullName: string;
      };
    }
  }
}
