declare global {
  namespace Express {
    interface Request {
      /** Authelia / proxy subject (`Remote-User`). */
      remoteSubject?: string;
      /** From `Remote-Groups`, or `DEV_REMOTE_GROUPS` in non-production. */
      userRole?: "ADMIN" | "USER";
    }
  }
}

export {};
