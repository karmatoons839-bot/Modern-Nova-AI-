import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

async function database() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.admin',true),'false')='true' $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,status text,credits integer,updated_at timestamptz);
    CREATE TABLE public.credit_ledger(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,amount integer,reason text);
    CREATE TABLE public.telegram_account_links(telegram_user_id text PRIMARY KEY,website_user_id uuid);
    CREATE TABLE public.telegram_admin_config(id boolean,support_chat_id text);
  `);
  await db.exec(readFileSync('drizzle/migrations/0049_verified_member_reward_foundation.sql','utf8'));
  await db.exec(`INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001','active',5000,now());
    INSERT INTO telegram_account_links VALUES('100','00000000-0000-0000-0000-000000000001');
    INSERT INTO telegram_admin_config VALUES(true,'-200');
    INSERT INTO earning_settings(id,telegram_enabled) VALUES(true,true);`);
  return db;
}
describe('atomic earning database safeguards', () => {
  it('records a member once, withholds pending credits and grants an approved reward only once', async () => {
    const db = await database();
    try {
      await db.query(`select earning_observe_member('-200','101','100',1,false,true)`);
      await db.query(`select earning_observe_member('-200','101','100',2,false,true)`);
      expect((await db.query<{n:number}>('select count(*)::int n from earning_rewards')).rows[0]?.n).toBe(1);
      expect((await db.query<{amount:number}>(`select earning_claim('100') amount`)).rows[0]?.amount).toBe(0);
      await db.exec(`SELECT set_config('test.admin','true',false); SELECT set_config('test.user','00000000-0000-0000-0000-000000000001',false);`);
      await db.query(`select earning_review(id,true,'Verified membership evidence') from earning_rewards`);
      const claims = await Promise.all(Array.from({length:10}, () => db.query<{amount:number}>(`select earning_claim('100') amount`)));
      expect(claims.reduce((sum,c) => sum + (c.rows[0]?.amount ?? 0),0)).toBe(1000);
      expect((await db.query<{credits:number}>('select credits from profiles')).rows[0]?.credits).toBe(6000);
      expect((await db.query<{n:number}>('select count(*)::int n from credit_ledger')).rows[0]?.n).toBe(1);
    } finally { await db.close(); }
  });
  it('rejects unlinked claims', async () => {
    const db = await database();
    try { await expect(db.query(`select earning_claim('999')`)).rejects.toThrow('VERIFIED_ACCOUNT_LINK_REQUIRED'); } finally { await db.close(); }
  });
  it('denies ordinary approval', async () => {
    const db = await database();
    try { await expect(db.query(`select earning_review('00000000-0000-0000-0000-000000000001',true,'Member evidence')`)).rejects.toThrow('FORBIDDEN'); } finally { await db.close(); }
  });
  it('does not create rewards for bots or an unrelated group', async () => {
    const db = await database();
    try {
      await db.query(`select earning_observe_member('-200','101','100',1,true,true)`);
      await db.query(`select earning_observe_member('-999','102','100',2,false,true)`);
      expect((await db.query<{n:number}>('select count(*)::int n from earning_rewards')).rows[0]?.n).toBe(0);
    } finally { await db.close(); }
  });
});