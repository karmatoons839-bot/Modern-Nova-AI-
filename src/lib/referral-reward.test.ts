import { describe, expect, it } from 'vitest';
import { REFERRAL_REWARD_FREE, REFERRAL_REWARD_PLAN } from '@/components/ReferralCard';

describe('referral reward tiers', () => {
  it('pays 5000 credits when the referrer has a paid plan', () => {
    expect(REFERRAL_REWARD_PLAN).toBe(5000);
  });
  it('pays 500 credits when the referrer is on the free plan', () => {
    expect(REFERRAL_REWARD_FREE).toBe(500);
  });
  it('plan-holder reward is higher than free reward', () => {
    expect(REFERRAL_REWARD_PLAN).toBeGreaterThan(REFERRAL_REWARD_FREE);
  });
});
