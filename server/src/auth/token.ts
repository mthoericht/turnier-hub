import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

export type AuthPayload = { sub: string; tv?: number };

export function signToken(userId: string, tokenVersion = 0): string
{
  return jwt.sign({ sub: userId, tv: tokenVersion }, JWT_SECRET, { expiresIn: "7d" });
}
