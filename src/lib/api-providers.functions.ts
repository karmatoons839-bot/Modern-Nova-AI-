import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { API_SERVICES, validBaseUrl } from './api-providers';

type Ctx = { userId: string; supabase: import('@supabase/supabase-js').SupabaseClient<import('@/integrations/supabase/types').Database> };
async function ownerDb(context: Ctx) {
  const { data } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' });
  if (data !== true) throw new Error('Only the owner can manage APIs');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}

export const listApiProviders = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await ownerDb(context);
  const { data, error } = await db.from('api_providers').select('service,base_url,key_hint,model,enabled,updated_at');
  if (error) throw new Error('APIs could not be loaded');
  const { COSTS } = await import('./credits.server');
  return { rows: data ?? [], builtInKey: Boolean(process.env['LOVABLE_API_KEY']), costs: COSTS, encryption: Boolean(process.env['HOSTING_CONFIG_ENCRYPTION_KEY']) };
});

const saveSchema = z.object({
  service: z.enum(API_SERVICES.map(s => s.id) as [string, ...string[]]),
  baseUrl: z.string().trim().max(500).refine(validBaseUrl, 'Use a full https:// URL'),
  apiKey: z.string().trim().max(4000).optional(),
  model: z.string().trim().max(200).optional(),
  enabled: z.boolean(),
});
export const saveApiProvider = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => saveSchema.parse(d)).handler(async ({ data, context }) => {
  const db = await ownerDb(context);
  const secret = process.env['HOSTING_CONFIG_ENCRYPTION_KEY'];
  if (!secret) throw new Error('Secure key storage is unavailable');
  const { encryptSecret } = await import('./secret-box.server');
  const { data: existing } = await db.from('api_providers').select('encrypted_key,key_hint').eq('service', data.service).maybeSingle();
  if (!data.apiKey && !existing) throw new Error('Enter the API key');
  const encrypted_key = data.apiKey ? await encryptSecret(data.apiKey, secret) : existing!.encrypted_key;
  const key_hint = data.apiKey ? `••••${data.apiKey.slice(-4)}` : existing!.key_hint;
  const { error } = await db.from('api_providers').upsert({ service: data.service, base_url: data.baseUrl, encrypted_key, key_hint, model: data.model || null, enabled: data.enabled, updated_by: context.userId, updated_at: new Date().toISOString() });
  if (error) throw new Error('API could not be saved');
  (await import('./api-providers.server')).clearProviderCache();
  await db.from('admin_audit_log').insert({ admin_id: context.userId, action: 'api_provider_saved', details: { service: data.service, enabled: data.enabled }, reason: 'API changed from Admin Dashboard' });
  return { saved: true };
});

export const removeApiProvider = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ service: z.string().max(40) }).parse(d)).handler(async ({ data, context }) => {
  const db = await ownerDb(context);
  const { error } = await db.from('api_providers').delete().eq('service', data.service);
  if (error) throw new Error('API could not be removed');
  (await import('./api-providers.server')).clearProviderCache();
  await db.from('admin_audit_log').insert({ admin_id: context.userId, action: 'api_provider_removed', details: { service: data.service }, reason: 'Reverted to built-in engine' });
  return { removed: true };
});
