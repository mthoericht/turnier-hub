import { z } from "zod";

const TEXT_ALLOWED_CHARS = /^[\p{L}\p{N} .,'()\-_/&+]+$/u;

export const idSchema = z.string().trim().min(1).max(64);

export const shortNameSchema = z.string()
  .trim()
  .min(1)
  .max(60)
  .regex(TEXT_ALLOWED_CHARS, "Ungültige Zeichen");

export const mediumNameSchema = z.string()
  .trim()
  .min(1)
  .max(100)
  .regex(TEXT_ALLOWED_CHARS, "Ungültige Zeichen");

export const classNameSchema = z.string()
  .trim()
  .min(1)
  .max(40)
  .regex(TEXT_ALLOWED_CHARS, "Ungültige Zeichen");
