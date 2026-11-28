import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const owner = "22222222-2222-4222-8222-222222222222";
const mig = (f: string) => readFileSync(new URL(`../../drizzle/migrations/${f}`, import.meta.url), "utf8");

async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TYPE public.app_role AS ENUM ('admin','user');
  CREATE TABLE public.generations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,tool text DEFAULT 'voice',status text DEFAULT 'done',telegram_sent_at timestamptz,telegram_attempts integer DEFAULT 0,telegram_claimed_at timestamptz,created_at timestamptz DEFAULT now());
  CREATE TABLE public.s2v_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),generation_id uuid,final_video_path text);
  CREATE FUNCTION public.has_role(u uuid,r public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT u='${owner}'::uuid AND r='admin' $$;`);
  await db.exec(mig("0029_telegram_test_delivery_approval.sql"));
  await db.exec(mig("0039_generation_forward_skip_unfinished_s2v.sql"));
  await db.exec(mig("0040_telegram_complete_voiceover_only.sql"));
  await db.exec(mig("0048_voice_export_and_delivery_identity.sql"));
  return db;
}

describe("generation forwarding claims", () => {
  it('concurrent send starts acquire exactly one permanent receipt', async () => {
    const db = await fixture();
    try {
      const full = await db.query<{id:string}>("insert into generations(tool) values('voice_full') returning id");
      const claims = await Promise.all(Array.from({length:20}, () => db.query<{claimed:boolean}>("select telegram_begin_generation($1) claimed", [full.rows[0]?.id])));
      expect(claims.filter(c => c.rows[0]?.claimed)).toHaveLength(1);
      await db.exec("update telegram_generation_receipts set status='review'; update generations set telegram_claimed_at=now()-interval '1 day'");
      expect((await db.query('select * from telegram_claim_generations(15)')).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
  it('identical complete audio has one export per account, not three', async () => {
    const db = await fixture();
    try {
      const insert = "insert into generations(user_id,tool,voice_export_hash) values($1,'voice_full','audio-sha256') on conflict do nothing";
      await Promise.all(Array.from({length:3}, () => db.query(insert,[owner])));
      expect((await db.query("select id from generations where tool='voice_full'")).rows).toHaveLength(1);
      await db.query(insert,['33333333-3333-4333-8333-333333333333']);
      expect((await db.query("select id from generations where tool='voice_full'")).rows).toHaveLength(2);
    } finally { await db.close(); }
  });
  it("20 older unfinished Script-to-Video items do not block a newer complete voiceover", async () => {
    const db = await fixture();
    try {
      for (let i = 0; i < 20; i++) {
        const r = await db.query<{ id: string }>("insert into public.generations(tool,created_at) values('script_video', now() - interval '2 days') returning id");
        await db.query("insert into public.s2v_projects(generation_id) values($1)", [r.rows[0]?.id]);
      }
      const voice = await db.query<{ id: string }>("insert into public.generations(tool) values('voice_full') returning id");
      const claims = await db.query<{ telegram_claim_generations: string }>("select * from public.telegram_claim_generations(15)");
      expect(claims.rows.map((r) => r.telegram_claim_generations)).toEqual([voice.rows[0]?.id]);
    } finally { await db.close(); }
  });

  it("a finished Script-to-Video project is still claimed", async () => {
    const db = await fixture();
    try {
      const r = await db.query<{ id: string }>("insert into public.generations(tool) values('script_video') returning id");
      await db.query("insert into public.s2v_projects(generation_id,final_video_path) values($1,'u/final.mp4')", [r.rows[0]?.id]);
      const claims = await db.query("select * from public.telegram_claim_generations(15)");
      expect(claims.rows.length).toBe(1);
    } finally { await db.close(); }
  });

  it("individual speech lines never claim delivery slots; only the complete voiceover is claimed", async () => {
    const db = await fixture();
    try {
      await db.exec("insert into public.generations(tool) select 'voice' from generate_series(1,30)");
      const full = await db.query<{id:string}>("insert into public.generations(tool) values('voice_full') returning id");
      const claims = await db.query<{telegram_claim_generations:string}>("select * from public.telegram_claim_generations(15)");
      expect(claims.rows.map(r => r.telegram_claim_generations)).toEqual([full.rows[0]?.id]);
      const lines = await db.query<{attempts:number}>("select sum(telegram_attempts)::int as attempts from public.generations where tool='voice'");
      expect(lines.rows[0]?.attempts).toBe(0);
    } finally { await db.close(); }
  });

  it("complete controlled-account voiceover stays gated until its own owner approval", async () => {
    const db = await fixture();
    try {
      const full = await db.query<{id:string}>("insert into public.generations(tool,user_id) values('voice_full','36380128-ba23-4dc1-a3ec-c18d12623209') returning id");
      expect((await db.query("select * from public.telegram_claim_generations(15)")).rows).toHaveLength(0);
      await db.query("select public.telegram_approve_creation($1,$2)", [owner, full.rows[0]?.id]);
      const claims = await db.query<{telegram_claim_generations:string}>("select * from public.telegram_claim_generations(15)");
      expect(claims.rows.map(r => r.telegram_claim_generations)).toEqual([full.rows[0]?.id]);
      expect((await db.query("select * from public.telegram_claim_generations(15)")).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
});
