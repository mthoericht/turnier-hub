import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

export type AuthPayload = { sub: string };

export function signToken(userId: string): string
{
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}
