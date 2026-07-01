/**
 * Centralised error notification helper.
 * Standardises how the UI surfaces failures (toast + log).
 */
import { toast } from "@/hooks/use-toast";
import { type AppError, toAppError } from "@/lib/result";
import { logger } from "@/lib/logger";

export function notifyError(input: unknown, context?: string): AppError {
  const e = toAppError(input);
  logger.error(context ?? "error", e);
  toast({
    title: context ? `Couldn't ${context}` : "Something went wrong",
    description: e.message,
    variant: "destructive",
  });
  return e;
}

export function notifySuccess(message: string, description?: string): void {
  toast({ title: message, description });
}
