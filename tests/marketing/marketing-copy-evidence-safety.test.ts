import { describe, expect, it } from 'vitest';
import { generateDeterministicMarketingCopy } from '../../src/lib/marketing-engine';
import type { Business } from '../../src/types/database';

const business = {
  id: 'b3333333-3333-4333-8333-333333333333',
  name: 'Test Studio',
  business_type: 'product',
  industry: 'Fashion',
  location: 'Indore',
  country: 'India',
  currency: 'INR',
  currency_symbol: '₹',
  timezone: 'Asia/Kolkata',
  target_customers: 'Young adults looking for everyday streetwear',
} as Business;

describe('Deterministic marketing copy evidence safety', () => {
  it('does not invent discounts, scarcity, urgency, or an offer when none was supplied', () => {
    const result = generateDeterministicMarketingCopy({
      business,
      contentType: 'promotional_copy',
      productOrServiceName: 'Oversized T-shirt',
    });

    expect(result.groundedIn.offer).toBeUndefined();
    expect(result.body).toMatch(/No promotion details were supplied/i);
    expect(result.body).not.toMatch(/limited[- ]time|while supplies last|selling out|discount|special privilege|exclusive offer|claim today/i);
    expect(result.callToAction).not.toMatch(/redeem immediately|claim now|buy now/i);
  });

  it('does not invent product certifications, performance results, or unsupported quality claims', () => {
    const result = generateDeterministicMarketingCopy({
      business,
      contentType: 'instagram_post',
      productOrServiceName: 'Oversized T-shirt',
    });

    expect(result.body).not.toMatch(/100% authentic|certified|guaranteed results|zero fillers|pure ingredients|noticeable results|trusted choice/i);
    expect(result.suggestedVisual).toMatch(/current, genuine|confirmed/i);
  });

  it('uses only a business-supplied promotion and does not add scarcity around it', () => {
    const suppliedOffer = '10% discount on the current collection';
    const result = generateDeterministicMarketingCopy({
      business,
      contentType: 'promotional_copy',
      productOrServiceName: 'Oversized T-shirt',
      price: 649,
      offerDetails: suppliedOffer,
    });

    expect(result.groundedIn.offer).toBe(suppliedOffer);
    expect(result.body).toContain(suppliedOffer);
    expect(result.body).toContain('₹649');
    expect(result.body).not.toMatch(/only today|last chance|while stocks last|selling out fast/i);
  });

  it('does not pretend to know a customer’s visit history in reactivation messages', () => {
    const result = generateDeterministicMarketingCopy({
      business,
      contentType: 'customer_reactivation',
      productOrServiceName: 'Oversized T-shirt',
    });

    expect(result.body).not.toMatch(/it has been a while|we miss seeing you|since your last visit/i);
    expect(result.body).toMatch(/opt out of future updates/i);
  });
});
