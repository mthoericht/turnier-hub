declare global {
  namespace Express {
    interface Request {
      /** Authelia / proxy subject (`Remote-User`). */
      remoteSubject?: string;
      /** From `ADMIN_REMOTE_USERS`, `Remote-Groups` + `ADMIN_REMOTE_GROUP`, or `DEV_REMOTE_ADMIN` (non-prod). */
      userRole?: "ADMIN" | "USER";
    }
  }
}

export {};
