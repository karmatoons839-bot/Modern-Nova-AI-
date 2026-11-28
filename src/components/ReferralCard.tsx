import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export const REFERRAL_REWARD_FREE = 500;
export const REFERRAL_REWARD_PLAN = 5000;
const KEY = 'mn-ref';

/** Remembers ?ref=CODE from any link, then binds it once after sign-in. */
export function ReferralCapture() {
  const { session } = useAuth();
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[A-Za-z0-9]{6,12}$/.test(ref)) localStorage.setItem(KEY, ref.toUpperCase());
  }, []);
  useEffect(() => {
    const code = localStorage.getItem(KEY);
    if (!session || !code) return;
    void supabase.rpc('apply_referral_code', { _code: code }).then(({ error }) => { if (!error) localStorage.removeItem(KEY); });
  }, [session]);
  return null;
}

export function ReferralCard() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const uid = session?.user.id;
  const { data } = useQuery({
    queryKey: ['referral', uid], enabled: Boolean(uid),
    queryFn: async () => {
      const { data: code, error } = await supabase.rpc('my_referral_code');
      if (error) throw error;
      const { data: rows } = await supabase.from('referrals').select('referred_user_id,referrer_user_id,status,reward_credits');
      const mine = (rows ?? []).filter(r => r.referrer_user_id === uid);
      const earned = mine.filter(r => r.status === 'rewarded').reduce((s, r) => s + (r.reward_credits ?? 0), 0);
      return { code: code as string, joined: mine.length, rewarded: mine.filter(r => r.status === 'rewarded').length, earned, usedCode: (rows ?? []).some(r => r.referred_user_id === uid) };
    },
  });
  const link = data ? `https://modernnova.in/?ref=${data.code}` : '';
  const apply = async () => {
    setMsg(null);
    const { data: r, error } = await supabase.rpc('apply_referral_code', { _code: input });
    const text: Record<string, string> = { applied: 'Code lag gaya! ✅', invalid: 'Galat code.', self: 'Apna khud ka code use nahi kar sakte.', already: 'Aap pehle hi ek code use kar chuke ho.', not_new: 'Code sirf naye users ke liye hai (pehle paid plan se pehle).' };
    setMsg(error ? error.message : text[r as string] ?? String(r));
    void qc.invalidateQueries({ queryKey: ['referral', uid] });
  };
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground"><Gift className="h-4 w-4 text-primary" /> Refer & Earn</h2>
      <p className="text-sm text-muted-foreground">Dost ko apna link bhejo. Jab woh koi paid plan lega, aapko <b className="text-foreground">{REFERRAL_REWARD_PLAN.toLocaleString('en-IN')} credits</b> milenge agar aapke paas koi paid plan hai — warna <b className="text-foreground">{REFERRAL_REWARD_FREE} credits</b>.</p>
      {data && <>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-primary">{data.code}</code>
          <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* manual copy */ } }}><Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy link'}</Button>
        </div>
        <p className="break-all text-xs text-muted-foreground">{link}</p>
        <p className="text-xs text-muted-foreground">Joined: {data.joined} · Rewarded: {data.rewarded} ({data.earned.toLocaleString('en-IN')} credits earned)</p>
        {!data.usedCode && <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Kisi ka refer code hai?" aria-label="Referral code" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <Button size="sm" disabled={input.trim().length < 6} onClick={() => void apply()}>Apply</Button>
        </div>}
        {msg && <p role="status" className="text-xs text-foreground">{msg}</p>}
      </>}
    </section>
  );
}
