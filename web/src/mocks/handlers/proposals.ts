import { ApiError } from '@/api/client';
import type { ProposalView, ProposalsResponse, RiskAssessmentResponse } from '@/api/types';
import { addDays } from '@/domain/dates';
import { isValidWeights } from '@/domain/portfolio/engine';
import { assessPortfolio } from '@/domain/portfolio/assessment';
import { evaluateProposals, findProposal } from '@/domain/portfolio/proposals';
import { profileByLevel, type RiskLevel } from '@/domain/profiles';
import type { MockRoute } from '../router';
import { recallProfile } from '../profileStore';
import { assumptionsAt } from './market';

const VALID_DAYS = 7;

const isLevel = (x: unknown): x is RiskLevel => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 5;

function profileOr404(profileId: unknown) {
  const profile = typeof profileId === 'string' ? recallProfile(profileId) : null;
  if (!profile) {
    throw new ApiError(404, 'profile_not_found', 'Nie znaleziono profilu. Wypełnij formularz jeszcze raz.');
  }
  return profile;
}

/** Użytkownik może przesunąć profil najwyżej o jeden poziom względem wyniku formularza. */
function checkLevel(level: unknown, formLevel: RiskLevel): RiskLevel {
  if (!isLevel(level) || Math.abs(level - formLevel) > 1) {
    throw new ApiError(422, 'validation_error', 'Niepoprawny poziom profilu.', ['level']);
  }
  return level;
}

export function buildProposalsResponse(profileId: string, level: unknown, now: Date = new Date()): ProposalsResponse {
  const stored = profileOr404(profileId);
  const lvl = checkLevel(level, stored.level);
  const a = assumptionsAt(now);
  const proposals: ProposalView[] = evaluateProposals(lvl, stored.plan, a).map((p) => ({
    id: p.id,
    level: p.level,
    kind: p.kind,
    name: p.name,
    tag: p.tag,
    idea: p.idea,
    weights: p.weights,
    groupTotals: p.groupTotals,
    sri: p.metrics.sri,
    sriWord: p.metrics.sriWord,
    medianPLN: p.metrics.median,
    p10PLN: p.metrics.p10,
    p90PLN: p.metrics.p90,
    worstYear: p.metrics.worstYear,
    goalProbability: p.metrics.goalProbability,
    annualCost: p.metrics.annualCost,
    withinLimits: p.withinLimits,
  }));
  return { profileId, level: lvl, plan: stored.plan, asOf: a.asOf, validUntil: addDays(a.asOf, VALID_DAYS), proposals };
}

export function buildRiskAssessment(body: unknown, now: Date = new Date()): RiskAssessmentResponse {
  const b = (body ?? {}) as Record<string, unknown>;
  const stored = profileOr404(b.profileId);
  const level = checkLevel(b.level, stored.level);
  const proposal = typeof b.proposalId === 'string' ? findProposal(b.proposalId) : null;
  const weights = Array.isArray(b.weights) ? (b.weights as number[]) : null;

  const bad: string[] = [];
  if (!proposal || proposal.level !== level) bad.push('proposalId');
  if (!weights || !isValidWeights(weights)) bad.push('weights');
  if (bad.length > 0 || !proposal || !weights) {
    throw new ApiError(422, 'validation_error', 'Wysłane dane są niepoprawne.', bad);
  }

  const a = assumptionsAt(now);
  return {
    profileId: b.profileId as string,
    proposalId: proposal.id,
    baseName: proposal.name,
    weights,
    plan: stored.plan,
    asOf: a.asOf,
    validUntil: addDays(a.asOf, VALID_DAYS),
    assessment: assessPortfolio(
      { weights, baseWeights: proposal.weights, baseName: proposal.name, plan: stored.plan, profile: profileByLevel(level) },
      a,
    ),
  };
}

export const proposalRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/proposals',
    latencyMs: 500,
    handler: ({ query }) => buildProposalsResponse(String(query?.profileId ?? ''), Number(query?.level)),
  },
  {
    method: 'POST',
    path: '/risk-assessment',
    // dłuższe oczekiwanie pokazuje stan „model analizuje” podczas prezentacji
    latencyMs: 900,
    handler: ({ body }) => buildRiskAssessment(body),
  },
];
