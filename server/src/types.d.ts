declare global {
  namespace Express {
    interface Request {
      clientId: string;
      userId?: string;
    }
  }
}

export {};
