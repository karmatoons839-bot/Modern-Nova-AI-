import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('DIWALI999 redemption rules', () => {
  async function fixture() {
    const db = new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE promo_codes(id int,code text unique,percent int CONSTRAINT promo_codes_percent_check CHECK(percent BETWEEN 1 AND 90),active boolean,max_uses int,uses int,expires_at timestamptz);
      CREATE TABLE profiles(id uuid primary key,credits int default 0);
      CREATE TABLE payments(user_id uuid,plan text,amount_paise int,currency text,order_id text,payment_method text,status text,credits int,promo_code text,discount_percent int,bonus_credits int);
      CREATE FUNCTION activate_payment(_order text,_txn text,_method text,_amount_paise int) RETURNS text LANGUAGE plpgsql AS $$ BEGIN
        UPDATE profiles SET credits=profiles.credits+p.credits FROM payments p WHERE p.order_id=_order AND profiles.id=p.user_id;
        UPDATE promo_codes SET uses=uses+1 WHERE code=(SELECT promo_code FROM payments WHERE order_id=_order);
        UPDATE payments SET status='success' WHERE order_id=_order; RETURN 'activated'; END $$;`);
    await db.exec(readFileSync('drizzle/migrations/0037_limited_free_plan_coupon.sql','utf8'));
    await db.exec(readFileSync('drizzle/migrations/0038_coupon_plan_restriction.sql','utf8'));
    await db.exec(`INSERT INTO promo_codes VALUES(1,'DIWALI999',100,true,5,0,null,'pro');
      INSERT INTO profiles(id) SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,6) n;`);
    return db;
  }
  const user=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
  async function redeem(db:PGlite,n:number,order=`order-${n}`) { return db.query("select redeem_free_promo($1,'pro','DIWALI999',100000,$2)",[user(n),order]); }
  it('gives 100% discount with normal plan credits and no bonus',async()=>{
    const db=await fixture(); try { await redeem(db,1); expect((await db.query('select amount_paise,credits,bonus_credits,status from payments')).rows[0]).toEqual({amount_paise:0,credits:100000,bonus_credits:0,status:'success'}); } finally { await db.close(); }
  });
  it('allows exactly five people and rejects the sixth without granting',async()=>{
    const db=await fixture(); try { for(let n=1;n<=5;n++) await redeem(db,n); await expect(redeem(db,6)).rejects.toThrow('PROMO_INVALID_OR_EXHAUSTED'); expect((await db.query('select uses from promo_codes')).rows[0]).toEqual({uses:5}); expect((await db.query('select credits from profiles where id=$1',[user(6)])).rows[0]).toEqual({credits:0}); } finally { await db.close(); }
  });
  it('rejects a repeat account without consuming another slot',async()=>{
    const db=await fixture(); try { await redeem(db,1); await expect(redeem(db,1,'repeat')).rejects.toThrow('PROMO_ALREADY_USED'); expect((await db.query('select uses from promo_codes')).rows[0]).toEqual({uses:1}); } finally { await db.close(); }
  });
  it.each(['creator','premium'])('rejects DIWALI999 on %s without consuming a slot or granting credits',async(plan)=>{
    const db=await fixture(); try {
      await expect(db.query("select redeem_free_promo($1,$2,'DIWALI999',500000,'wrong-plan')",[user(1),plan])).rejects.toThrow('PROMO_PLAN_NOT_ALLOWED');
      expect((await db.query('select uses from promo_codes')).rows[0]).toEqual({uses:0});
      expect((await db.query('select credits from profiles where id=$1',[user(1)])).rows[0]).toEqual({credits:0});
      expect((await db.query('select count(*)::int as count from payments')).rows[0]).toEqual({count:0});
    } finally { await db.close(); }
  });
});
