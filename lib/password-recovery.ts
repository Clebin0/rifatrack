import type { SupabaseClient } from "@supabase/supabase-js";

export type RecoveryState = "ready" | "missing" | "mfa";

export async function checkPasswordSession(auth: SupabaseClient["auth"]): Promise<RecoveryState> {
  // getSession waits for the SDK's URL processing; never exchange the same code twice.
  const session = await auth.getSession();
  if (session.error) throw session.error;
  if (!session.data.session) return "missing";
  const level = await auth.mfa.getAuthenticatorAssuranceLevel();
  if (level.error) throw level.error;
  if (!level.data?.currentLevel) throw new Error("assurance_unavailable");
  return level.data.nextLevel === "aal2" && level.data.currentLevel !== "aal2" ? "mfa" : "ready";
}

export function authErrorMessage(error: { code?: string; status?: number }): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")
    return "O limite de envios foi atingido. Aguarde a liberação do serviço antes de solicitar outro e-mail. Criar outra conta não resolve esse limite.";
  switch (error.code) {
    case "insufficient_aal": return "Confirme o código do seu aplicativo autenticador para alterar a senha.";
    case "same_password": return "Escolha uma senha diferente da senha atual.";
    case "weak_password": return "Escolha uma senha mais forte, com pelo menos 12 caracteres.";
    case "email_not_confirmed": return "Confirme seu e-mail pelo link de cadastro antes de entrar.";
    case "invalid_credentials": return "E-mail ou senha incorretos. Se já tem uma conta, use Esqueci minha senha.";
    case "otp_expired":
    case "session_not_found":
    case "refresh_token_not_found": return "Sua sessão expirou. Solicite um novo link de recuperação.";
    default: return "Não foi possível concluir agora. Verifique a conexão e tente novamente.";
  }
}
