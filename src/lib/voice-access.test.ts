import { describe, it, expect, vi } from 'vitest';

const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: db }));
vi.mock('./maintenance.server', () => ({ requireGenerationAvailable: vi.fn() }));
import { userVoicePlan } from './credits.server';
import { voiceAllowed } from './plans';

function profile(plan: string) {
  db.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { plan } }) }) }) });
}

describe('server-verified website voice access', () => {
  it('allows an owner admin with stored Standard plan to use all 400 voices', async () => {
    profile('pro');
    db.rpc.mockImplementation(async (name: string) => ({ data: name === 'has_role', error: null }));
    expect(await userVoicePlan('verified-owner')).toBe('premium');
    expect(db.rpc).toHaveBeenCalledWith('has_role', { _user_id: 'verified-owner', _role: 'admin' });
  });
  it('keeps Standard accounts restricted to their plan voices', async () => {
    profile('pro');
    db.rpc.mockResolvedValue({ data: false, error: null });
    const plan = await userVoicePlan('ordinary-user');
    expect(plan).toBe('pro');
    expect(voiceAllowed('voice_002', plan)).toBe(false);
    expect(voiceAllowed('voice_003', plan)).toBe(true);
  });
  it('fails closed when role verification is unavailable', async () => {
    profile('pro');
    db.rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    await expect(userVoicePlan('ordinary-user')).rejects.toMatchObject({ code: 'VOICE_ACCESS_CHECK_FAILED' });
  });
});