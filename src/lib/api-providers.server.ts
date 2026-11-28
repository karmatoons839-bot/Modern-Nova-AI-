import { pickProvider, type ApiService } from './api-providers';
import { decryptSecret } from './secret-box.server';

export type ResolvedProvider = { base: string; key: string; model: string | null; custom: boolean };
let cache: { at: number; rows: { service: string; enabled: boolean; base_url: string; encrypted_key: string; model: string | null }[] } | null = null;
export function clearProviderCache() { cache = null; }

/** Returns the admin-configured API for a service, or the built-in Lovable AI engine. */
export async function resolveProvider(service: ApiService, defaults: { base: string; model: string }): Promise<ResolvedProvider | null> {
  try {
    if (!cache || Date.now() - cache.at > 30_000) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data } = await supabaseAdmin.from('api_providers').select('service,enabled,base_url,encrypted_key,model');
      cache = { at: Date.now(), rows: data ?? [] };
    }
    const row = pickProvider(cache.rows, service);
    const secret = process.env['HOSTING_CONFIG_ENCRYPTION_KEY'];
    if (row && secret) {
      return { base: row.base_url.replace(/\/+$/, '').replace(/\/v1$/, ''), key: await decryptSecret(row.encrypted_key, secret), model: row.model || defaults.model, custom: true };
    }
  } catch { /* fall back to built-in engine */ }
  const key = process.env['LOVABLE_API_KEY'];
  return key ? { base: defaults.base, key, model: defaults.model, custom: false } : null;
}
