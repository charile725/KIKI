import { z } from "zod";
import { fits } from "./types.js";
export const bodySchema = z.object({
  height: z
    .number()
    .min(120, "身高需介於 120–220 公分")
    .max(220, "身高需介於 120–220 公分"),
  weight: z
    .number()
    .min(30, "體重需介於 30–250 公斤")
    .max(250, "體重需介於 30–250 公斤"),
  shoulder: z.number().min(25).max(70).optional(),
  chest: z.number().min(50).max(200).optional(),
  waist: z.number().min(40).max(200).optional(),
  hip: z.number().min(50).max(200).optional(),
});
export const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(40),
  fit_preference: z.enum(fits),
  personalize: z.boolean(),
  external_ai_consent: z.boolean(),
});
export const recommendationSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(2, "請多描述一點穿搭需求")
    .max(500, "最多輸入 500 字"),
});
export const tryonSchema = z.object({
  request_id: z.uuid(),
  product_id: z.string().min(1).max(64),
  size: z.string().min(1).max(12),
  color: z.string().min(1).max(30),
});
export const authSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("請輸入有效的電子郵件")),
  password: z.string().min(6, "密碼至少需要 6 個字元").max(128),
});
export const registrationSchema = authSchema.extend({
  display_name: z.string().trim().max(40, "暱稱最多 40 個字").optional(),
});
export function errorText(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues.map((i) => i.message).join("；");
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error)
    return String(error.message);
  return "操作未完成，請稍後重試。";
}
