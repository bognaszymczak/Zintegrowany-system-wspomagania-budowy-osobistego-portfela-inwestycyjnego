import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import { toProfileRequest } from '@/features/onboarding/request';
import { DEMO_VALUES } from '@/features/onboarding/schema';
import { rememberProfile } from '../profileStore';
import { parseWeights } from './market';
import { buildProfileResponse } from './profile';
import { buildProposalsResponse, buildRiskAssessment, proposalRoutes } from './proposals';

const now = new Date('2026-11-03T12:00:00Z');
const profile = buildProfileResponse(toProfileRequest(DEMO_VALUES), now);
rememberProfile(profile);

const status = (fn: () => unknown): number | null => {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.status : -1;
  }
};

describe('mock GET /proposals', () => {
  it('zwraca trzy propozycje dla poziomu profilu, z datami ważności', () => {
    const res = buildProposalsResponse(profile.profileId, 3, now);
    expect(res.level).toBe(3);
    expect(res.proposals.map((p) => p.name)).toEqual(['Stabilność', 'Równowaga', 'Wzrost']);
    expect(res.asOf).toBe('2026-11-03');
    expect(res.validUntil).toBe('2026-11-10');
    expect(res.plan).toEqual(profile.plan);
    expect(res.proposals.every((p) => p.withinLimits)).toBe(true);
    expect(res.proposals.every((p) => p.weights.reduce((s, x) => s + x, 0) === 100)).toBe(true);
  });

  it('korekta profilu o jeden poziom działa, o dwa — nie', () => {
    expect(buildProposalsResponse(profile.profileId, 4, now).level).toBe(4);
    expect(buildProposalsResponse(profile.profileId, 2, now).level).toBe(2);
    expect(status(() => buildProposalsResponse(profile.profileId, 5, now))).toBe(422);
    expect(status(() => buildProposalsResponse(profile.profileId, 0, now))).toBe(422);
    expect(status(() => buildProposalsResponse(profile.profileId, 3.5, now))).toBe(422);
  });

  it('nieznany profil → 404; poziom zaszyty w identyfikatorze pozwala odtworzyć profil', () => {
    expect(status(() => buildProposalsResponse('cos-zupelnie-innego', 3, now))).toBe(404);
    expect(buildProposalsResponse('mock-L2-abc123', 2, now).proposals).toHaveLength(3);
  });

  it('trasa czyta parametry z zapytania', () => {
    const route = proposalRoutes.find((r) => r.method === 'GET' && r.path === '/proposals')!;
    const res = route.handler({ query: { profileId: profile.profileId, level: 3 } }) as { level: number };
    expect(res.level).toBe(3);
  });
});

describe('mock POST /risk-assessment', () => {
  const base = { profileId: profile.profileId, level: 3, proposalId: 'L3-rownowaga', weights: [20, 20, 6, 18, 8, 15, 13] };

  it('zwraca ocenę z kontekstem: nazwa propozycji, plan, daty', () => {
    const res = buildRiskAssessment(base, now);
    expect(res.baseName).toBe('Równowaga');
    expect(res.assessment.sri).toBe(4);
    expect(res.assessment.baseSri).toBe(3);
    expect(res.assessment.waterfall.length).toBeGreaterThanOrEqual(3);
    expect(res.plan).toEqual(profile.plan);
    expect(res.validUntil).toBe('2026-11-10');
  });

  it('odrzuca niepoprawne udziały i propozycję z innego poziomu', () => {
    expect(status(() => buildRiskAssessment({ ...base, weights: [50, 50] }, now))).toBe(422);
    expect(status(() => buildRiskAssessment({ ...base, weights: [20, 20, 6, 18, 8, 15, 14] }, now))).toBe(422);
    expect(status(() => buildRiskAssessment({ ...base, proposalId: 'L4-wzrost' }, now))).toBe(422);
    expect(status(() => buildRiskAssessment({ ...base, proposalId: 'x' }, now))).toBe(422);
    expect(status(() => buildRiskAssessment({ ...base, profileId: 'brak' }, now))).toBe(404);
    expect(status(() => buildRiskAssessment(null, now))).toBe(404);
  });
});

describe('parseWeights', () => {
  it('akceptuje 7 liczb o sumie 100', () => {
    expect(parseWeights('18,15,5,20,10,15,17')).toEqual([18, 15, 5, 20, 10, 15, 17]);
    expect(parseWeights(' 18, 15, 5, 20, 10, 15, 17 ')).toEqual([18, 15, 5, 20, 10, 15, 17]);
  });
  it('odrzuca resztę', () => {
    for (const bad of ['', '1,2,3', '18,15,5,20,10,15,18', 'a,b,c,d,e,f,g', undefined, 5]) {
      expect(parseWeights(bad)).toBeNull();
    }
  });
});
