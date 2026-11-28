import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, input, btn, btnOutline } from '@/components/Page';
import { ExternalLink } from 'lucide-react';
import { API_SERVICES, KEY_PAGES, isSafeKeyPageUrl } from '@/lib/api-providers';
import { listApiProviders, saveApiProvider, removeApiProvider } from '@/lib/api-providers.functions';

type Row = { service: string; base_url: string; key_hint: string; model: string | null; enabled: boolean; updated_at: string };

export function ApiProvidersAdmin() {
  const list = useServerFn(listApiProviders);
  const q = useQuery({ queryKey: ['api-providers'], queryFn: () => list() });
  if (q.isLoading) return <Card className="text-sm text-muted-foreground">Loading APIs…</Card>;
  if (q.error) return <Card className="text-sm text-destructive">{(q.error as Error).message}</Card>;
  const d = q.data!;
  return (
    <div className="space-y-3">
      <Card className="text-sm">
        <div className="font-bold">Website APIs</div>
        <p className="text-muted-foreground">Built-in engine (Lovable AI): {d.builtInKey ? 'connected' : 'not configured'}. Add your own API below to replace it. Keys are stored encrypted and never shown again.</p>
        <div className="mt-2 rounded-md border border-border p-2 text-xs">
          <div className="font-semibold">Built-in API (active when no custom API is saved)</div>
          <div>All-in-One / Voiceover URL: https://ai.gateway.lovable.dev</div>
          <div>Voiceover model: google/gemini-3.1-flash-tts-preview</div>
          <div>Image &amp; Thumbnail model: openai/gpt-image-2.5-sunburst</div>
          <div>Key: secured on server (hidden)</div>
        </div>
        <p className="mt-2 text-muted-foreground">Credit rates: Image {d.costs.image} · Thumbnail {d.costs.thumbnail} · Voiceover {d.costs.voicePerMinute}/minute</p>
      </Card>
      <Card className="space-y-3 text-sm">
        <div>
          <div className="font-bold">Your key pages</div>
          <p className="text-muted-foreground">Open a provider's own page in a new tab to view or create your key there. This site never shows, copies or logs any key.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {KEY_PAGES.filter(p => isSafeKeyPageUrl(p.url)).map(p => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className={`${btnOutline} flex-col items-start gap-1 py-3 text-left`}>
              <span className="inline-flex items-center gap-2"><ExternalLink className="h-4 w-4" /> {p.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{p.hint}</span>
            </a>
          ))}
        </div>
      </Card>
      {API_SERVICES.map(s => <ProviderCard key={s.id} id={s.id} label={s.label} hint={s.hint} row={d.rows.find(r => r.service === s.id) as Row | undefined} />)}
    </div>
  );
}

function ProviderCard({ id, label, hint, row }: { id: string; label: string; hint: string; row: Row | undefined }) {
  const qc = useQueryClient();
  const save = useServerFn(saveApiProvider);
  const remove = useServerFn(removeApiProvider);
  const [baseUrl, setBase] = useState(row?.base_url ?? '');
  const [apiKey, setKey] = useState('');
  const [model, setModel] = useState(row?.model ?? '');
  const [enabled, setEnabled] = useState(row?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setKey(''); await qc.invalidateQueries({ queryKey: ['api-providers'] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div><div className="font-bold">{label}</div><div className="text-xs text-muted-foreground">{hint}</div></div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row?.enabled ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>{row ? (row.enabled ? `Custom · ${row.key_hint}` : 'Custom · off') : 'Built-in'}</span>
      </div>
      <input className={input} placeholder="https://api.example.com" value={baseUrl} onChange={e => setBase(e.target.value)} />
      <input className={input} type="password" autoComplete="off" placeholder={row ? 'New API key (leave empty to keep current)' : 'API key'} value={apiKey} onChange={e => setKey(e.target.value)} />
      <input className={input} placeholder="Model (optional)" value={model} onChange={e => setModel(e.target.value)} />
      <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Use this API</label>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className={btn} onClick={() => run(() => save({ data: { service: id, baseUrl, enabled, ...(apiKey ? { apiKey } : {}), ...(model ? { model } : {}) } }), 'API saved')}>Save</button>
        {row && <button disabled={busy} className={btnOutline} onClick={() => run(() => remove({ data: { service: id } }), 'Back to built-in engine')}>Remove</button>}
      </div>
    </Card>
  );
}
