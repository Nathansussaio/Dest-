/* Senhas nunca são guardadas em texto: só o resumo SHA-256 (com o e-mail como "sal").
   Quando houver servidor, quem guarda e confere a senha é o serviço de autenticação. */
import * as Crypto from 'expo-crypto';

export async function hashPassword(email: string, pass: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'desti:' + email.trim().toLowerCase() + ':' + pass);
}
