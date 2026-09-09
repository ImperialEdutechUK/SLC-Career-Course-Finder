import { isDeepStrictEqual } from 'node:util';

export const ENGINE_VERSION = '0.2.0';
export const WEIGHTS = Object.freeze({ category: 40, goal: 25, experience: 15, workload: 10, budget: 10 });
export const GENERAL_GOALS = Object.freeze(['first_role', 'career_change', 'progress_in_role', 'personal_interest', 'not_sure', 'unsure', 'explore',
  'new_subject', 'prepare_work', 'develop_work_skills', 'further_study', 'specific_requirement']);
const BASE_CRITICAL_FIELDS = ['active', 'title', 'url', 'categoryIds', 'qualification_status', 'entry_policy'];
const OPTIONAL_REVIEWED_FIELDS = ['goals', 'experienceFit', 'hoursPerWeek', 'priceGbp', 'level'];
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const object = value => value !== null && typeof value === 'object'
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2048;
const scalar = value => typeof value === 'boolean' || nonempty(value) || (typeof value === 'number' && Number.isFinite(value));
const strings = value => Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(nonempty);
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const missing = value => value === undefined || value === null || value === '';
const stableCompare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const factKey = key => typeof key === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)
  && !['constructor', 'prototype', '__proto__'].includes(key);
const plainData = value => object(value) && Reflect.ownKeys(value).every(key => typeof key === 'string'
  && Object.getOwnPropertyDescriptor(value, key)?.get === undefined
  && Object.getOwnPropertyDescriptor(value, key)?.set === undefined);
const identifier = value => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value);
const validUtcDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z'));
};

function factsErrors(facts) {
  if (!plainData(facts)) return ['facts must be a plain data object'];
  if (Object.keys(facts).length > 100) return ['facts may contain at most 100 keys'];
  return Object.entries(facts).flatMap(([key, value]) => !factKey(key)
    ? [`invalid fact key: ${key}`]
    : value !== null && value !== undefined && !scalar(value) ? [`fact ${key} must be a finite scalar or null`] : []);
}

/** Strict, bounded all/any DSL. Empty branches and unknown operators are errors. */
export function validateRule(rule) {
  const errors = [];
  let count = 0;
  function visit(node, path, depth) {
    count += 1;
    if (depth > 12 || count > 200) { errors.push(`${path}: rule too complex`); return; }
    if (!plainData(node)) { errors.push(`${path}: expected a plain data object`); return; }
    const keys = Object.keys(node);
    const branches = ['all', 'any'].filter(key => own(node, key));
    if (branches.length) {
      if (branches.length !== 1 || keys.length !== 1) { errors.push(`${path}: use exactly one all/any branch`); return; }
      const key = branches[0];
      if (!Array.isArray(node[key]) || node[key].length === 0) { errors.push(`${path}: ${key} must be nonempty`); return; }
      if (node[key].length > 200) { errors.push(`${path}: branch too large`); return; }
      node[key].forEach((child, i) => visit(child, `${path}.${key}[${i}]`, depth + 1));
      return;
    }
    if (keys.length !== 3 || !['fact', 'op', 'value'].every(key => own(node, key))) {
      errors.push(`${path}: leaf requires only fact, op, value`); return;
    }
    if (!factKey(node.fact)) {
      errors.push(`${path}: invalid flat fact key`);
    }
    if (!['eq', 'gte', 'lte', 'in'].includes(node.op)) { errors.push(`${path}: unsupported operator`); return; }
    if (['gte', 'lte'].includes(node.op)) {
      if (typeof node.value !== 'number' || !Number.isFinite(node.value)) errors.push(`${path}: comparison value must be finite number`);
    } else if (node.op === 'in') {
      if (!Array.isArray(node.value) || node.value.length === 0 || node.value.length > 100 || !node.value.every(scalar) || !node.value.every(v => typeof v === typeof node.value[0])) {
        errors.push(`${path}: in requires a nonempty array of one scalar type`);
      }
    } else if (!scalar(node.value)) errors.push(`${path}: eq requires a non-null scalar`);
  }
  visit(rule, 'rule', 0);
  return errors;
}

/** Unknown is neither false nor true. No inference is made from absent facts. */
export function evaluateRule(rule, facts = {}) {
  const errors = validateRule(rule);
  if (errors.length) throw new TypeError(errors.join('; '));
  const invalidFacts = factsErrors(facts);
  if (invalidFacts.length) throw new TypeError(invalidFacts.join('; '));
  const checks = [];
  function evaluate(node) {
    if (own(node, 'all') || own(node, 'any')) {
      const all = own(node, 'all');
      const values = node[all ? 'all' : 'any'].map(evaluate);
      if (all) return values.includes('not_met') ? 'not_met' : values.includes('unknown') ? 'unknown' : 'met';
      return values.includes('met') ? 'met' : values.includes('unknown') ? 'unknown' : 'not_met';
    }
    const expectedType = typeof (node.op === 'in' ? node.value[0] : node.value);
    const hasValue = own(facts, node.fact) && facts[node.fact] !== null && facts[node.fact] !== undefined;
    const actual = hasValue ? facts[node.fact] : undefined;
    const valid = hasValue && scalar(actual) && typeof actual === expectedType;
    let result = 'unknown';
    if (valid) {
      const passed = node.op === 'eq' ? actual === node.value
        : node.op === 'gte' ? actual >= node.value
          : node.op === 'lte' ? actual <= node.value : node.value.includes(actual);
      result = passed ? 'met' : 'not_met';
    }
    checks.push({ fact: node.fact, op: node.op, expected: node.value, result,
      ...(hasValue ? { actual } : {}),
      ...(valid ? {} : { reason: hasValue ? 'fact_type_invalid' : 'fact_missing' }) });
    return result;
  }
  return { result: evaluate(rule), checks };
}

export function evaluateEligibility(course, facts = {}) {
  if (!course.entry_policy || course.entry_policy.status === 'unknown') {
    return { status: 'check_needed', reason: 'course_policy_unknown', checks: [] };
  }
  if (course.entry_policy.status !== 'verified') throw new TypeError('unrecognised entry policy status');
  const result = evaluateRule(course.entry_policy.rule, facts);
  return { status: result.result === 'met' ? 'appears_to_meet' : result.result === 'not_met' ? 'pathway_needed' : 'check_needed',
    reason: result.result === 'met' ? 'stated_rules_met_by_supplied_facts'
      : result.result === 'not_met' ? 'stated_rule_not_met' : 'more_facts_needed', checks: result.checks };
}

function preferencesFrom(input) {
  const p = input ?? {};
  if (!plainData(p)) return { errors: ['preferences must be a plain data object'] };
  const errors = [], value = {};
  const allowed = ['categoryIds', 'goal', 'experience', 'hoursPerWeek', 'budgetGbp', 'regulatedOnly'];
  for (const key of Object.keys(p)) if (!allowed.includes(key)) errors.push(`unsupported preference key: ${key}`);
  if (!missing(p.categoryIds) && !(Array.isArray(p.categoryIds) && p.categoryIds.length === 0)) {
    if (!Array.isArray(p.categoryIds) || p.categoryIds.length > 10 || !p.categoryIds.every(identifier)) errors.push('categoryIds must contain at most 10 valid identifiers');
    else value.categoryIds = [...new Set(p.categoryIds)];
  }
  for (const key of ['goal', 'experience']) {
    if (!missing(p[key])) {
      if (!identifier(p[key])) errors.push(`${key} must be a valid identifier`);
      else value[key] = p[key];
    }
  }
  for (const key of ['hoursPerWeek', 'budgetGbp']) {
    if (!missing(p[key])) {
      const maximum = key === 'hoursPerWeek' ? 168 : 1000000;
      if (!number(p[key]) || p[key] > maximum) errors.push(`${key} must be a finite number from 0 to ${maximum}`);
      else value[key] = p[key];
    }
  }
  if (!missing(p.regulatedOnly)) {
    if (typeof p.regulatedOnly !== 'boolean') errors.push('regulatedOnly must be boolean');
    else value.regulatedOnly = p.regulatedOnly;
  }
  return { value, errors };
}

function catalogErrors(course, now, allowedUrlHosts) {
  const errors = [];
  if (!object(course)) return ['invalid_course_record'];
  if (!nonempty(course.canonical_id)) errors.push('canonical_id_missing');
  if (course.active !== true) errors.push('course_inactive');
  if (course.review_status !== 'approved') errors.push('course_not_approved');
  if (!nonempty(course.title)) errors.push('title_invalid');
  try {
    const url = new URL(course.url);
    if (!nonempty(course.url) || url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) errors.push('url_invalid');
    if (allowedUrlHosts && !allowedUrlHosts.includes(url.hostname)) errors.push('url_host_not_allowed');
  }
  catch { errors.push('url_invalid'); }
  if (!strings(course.categoryIds)) errors.push('categoryIds_invalid');
  if (!['regulated_verified', 'unregulated', 'unverified'].includes(course.qualification_status)) errors.push('qualification_status_invalid');
  for (const key of ['goals', 'experienceFit']) if (!missing(course[key]) && !strings(course[key])) errors.push(`${key}_invalid`);
  for (const key of ['hoursPerWeek', 'priceGbp']) if (!missing(course[key]) && !number(course[key])) errors.push(`${key}_invalid`);
  if (!missing(course.level) && (!Number.isInteger(course.level) || course.level < 1 || course.level > 7)) errors.push('level_invalid');
  const policy = course.entry_policy;
  if (policy != null) {
    if (!object(policy) || !['verified', 'unknown'].includes(policy.status)) errors.push('entry_policy_invalid');
    else if (policy.status === 'verified') errors.push(...validateRule(policy.rule).map(error => `entry_policy_invalid: ${error}`));
    else if (own(policy, 'rule')) errors.push('unknown_policy_must_not_contain_rule');
  }
  const critical = [...BASE_CRITICAL_FIELDS, ...OPTIONAL_REVIEWED_FIELDS.filter(key => !missing(course[key]))];
  // All supplied review records are checked, including additional fields a catalog owner marked critical.
  for (const key of new Set([...critical, ...Object.keys(object(course.field_reviews) ? course.field_reviews : {})])) {
    const review = course.field_reviews?.[key];
    if (!object(review) || review.conflicting !== false || !nonempty(review.source)) {
      errors.push(`field_review_missing_or_conflicting: ${key}`); continue;
    }
    if (!validUtcDate(review.valid_until)) {
      errors.push(`field_expiry_invalid: ${key}`); continue;
    }
    const until = Date.parse(review.valid_until);
    if (!Number.isFinite(until) || until <= now) errors.push(`field_expired: ${key}`);
  }
  return errors;
}

function comparisonRecord(course) {
  // Import-row identifiers can differ; all other differences quarantine the canonical group.
  const { id, record_id, ...content } = course;
  return content;
}

function scoreCourse(course, preferences) {
  const dimensions = [], warnings = [];
  function add(dimension, available, courseValue, valid, fit) {
    if (!available) return;
    const missingField = !valid(courseValue);
    const weight = WEIGHTS[dimension];
    const fraction = missingField ? 0 : fit(courseValue);
    dimensions.push({ dimension, weight, points: weight * fraction });
    if (missingField) warnings.push(`course_field_missing: ${dimension}`);
    else if (fraction === 0) warnings.push(`preference_not_matched: ${dimension}`);
  }
  add('category', own(preferences, 'categoryIds'), course.categoryIds, strings,
    categories => preferences.categoryIds.filter(id => categories.includes(id)).length / preferences.categoryIds.length);
  add('goal', own(preferences, 'goal'), course.goals, strings, goals => goals.includes(preferences.goal) ? 1 : 0);
  add('experience', own(preferences, 'experience'), course.experienceFit, strings,
    experience => experience.includes(preferences.experience) ? 1 : 0);
  add('workload', own(preferences, 'hoursPerWeek'), course.hoursPerWeek, number,
    hours => hours <= preferences.hoursPerWeek ? 1 : 0);
  add('budget', own(preferences, 'budgetGbp'), course.priceGbp, number,
    price => price <= preferences.budgetGbp ? 1 : 0);
  const denominator = dimensions.reduce((sum, item) => sum + item.weight, 0);
  const points = dimensions.reduce((sum, item) => sum + item.points, 0);
  return { relevanceScore: denominator ? Math.round(points / denominator * 10000) / 100 : null,
    points, denominator, dimensions, warnings };
}

/** No AI, network, prices or entry facts are generated. now is injectable for reproducible tests. */
export function recommend(request = {}, catalog = [], options = {}) {
  const response = { engineVersion: ENGINE_VERSION, status: 'no_match', recommendations: [], pathways: [],
    excluded: [], warnings: [], totalDirectMatches: 0, totalPathwayMatches: 0 };
  if (!plainData(request) || !Array.isArray(catalog) || catalog.length > 10000 || !plainData(options)) return { ...response, status: 'invalid_request', errors: ['request/options must be plain data objects and catalog an array of at most 10000 records'] };
  const { now = new Date(), allowedUrlHosts, approvedSpecificGoalIds = [] } = options;
  const parsed = preferencesFrom(request.preferences);
  const facts = request.facts ?? {};
  const timestamp = now instanceof Date ? now.getTime() : validUtcDate(now) ? Date.parse(now) : NaN;
  const inputErrors = [...parsed.errors, ...factsErrors(facts),
    ...Object.keys(request).filter(key => !['preferences', 'facts'].includes(key)).map(key => `unsupported request key: ${key}`),
    ...Object.keys(options).filter(key => !['now', 'allowedUrlHosts', 'approvedSpecificGoalIds'].includes(key)).map(key => `unsupported option key: ${key}`),
    ...(!Number.isFinite(timestamp) ? ['now must be a valid Date or UTC ISO date string'] : [])];
  if (allowedUrlHosts !== undefined && (!Array.isArray(allowedUrlHosts) || allowedUrlHosts.length === 0 || allowedUrlHosts.length > 20
    || !allowedUrlHosts.every(host => typeof host === 'string' && host.length <= 253 && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(host)))) {
    inputErrors.push('allowedUrlHosts must contain 1 to 20 lowercase exact hostnames');
  }
  if (!Array.isArray(approvedSpecificGoalIds) || approvedSpecificGoalIds.length > 200
    || !approvedSpecificGoalIds.every(id => identifier(id) && !GENERAL_GOALS.includes(id))) {
    inputErrors.push('approvedSpecificGoalIds must contain at most 200 approved specific identifiers and no general goals');
  }
  if (inputErrors.length) return { ...response, status: 'invalid_request', errors: inputErrors };
  const preferences = parsed.value;
  response.evaluatedAt = new Date(timestamp).toISOString();
  if (allowedUrlHosts === undefined) response.warnings.push('url_host_allowlist_not_configured: reference evaluation only');
  if (!own(preferences, 'categoryIds') && !approvedSpecificGoalIds.includes(preferences.goal)) {
    response.status = 'needs_clarification';
    response.warnings.push('Ask for an interest/subject or meaningful course goal before ranking.');
    return response;
  }
  const groups = new Map();
  catalog.forEach((course, index) => {
    if (!object(course) || !nonempty(course.canonical_id)) {
      response.excluded.push({ recordIndex: index, reasons: ['canonical_id_missing'] }); return;
    }
    const entries = groups.get(course.canonical_id) ?? [];
    entries.push(course); groups.set(course.canonical_id, entries);
  });
  const candidates = [];
  for (const [canonicalId, entries] of groups) {
    const course = entries[0];
    if (entries.some(entry => !isDeepStrictEqual(comparisonRecord(entry), comparisonRecord(course)))) {
      response.excluded.push({ canonicalId, reasons: ['conflicting_duplicate'], count: entries.length }); continue;
    }
    const errors = catalogErrors(course, timestamp, allowedUrlHosts);
    if (errors.length) { response.excluded.push({ canonicalId, reasons: errors }); continue; }
    if (preferences.regulatedOnly === true && course.qualification_status !== 'regulated_verified') {
      response.excluded.push({ canonicalId, reasons: ['regulated_status_not_verified'] }); continue;
    }
    if (preferences.categoryIds && !preferences.categoryIds.some(id => course.categoryIds.includes(id))) {
      response.excluded.push({ canonicalId, reasons: ['no_category_fit'] }); continue;
    }
    if (!preferences.categoryIds && !course.goals?.includes(preferences.goal)) {
      response.excluded.push({ canonicalId, reasons: ['no_goal_fit'] }); continue;
    }
    candidates.push(course);
  }
  if (!preferences.categoryIds && !candidates.length) {
    response.status = 'needs_clarification';
    response.warnings.push('No verified course matches the supplied goal; ask for an interest/subject or a clearer goal.');
    return response;
  }
  for (const course of candidates) {
    // priceGbp is the verified all-inclusive total, including mandatory charges.
    if (own(preferences, 'budgetGbp') && number(course.priceGbp) && course.priceGbp > preferences.budgetGbp) {
      response.excluded.push({ canonicalId: course.canonical_id, reasons: ['over_budget_cap'] }); continue;
    }
    const score = scoreCourse(course, preferences);
    const eligibility = evaluateEligibility(course, facts);
    const budgetCheck = !own(preferences, 'budgetGbp') ? { status: 'not_requested' }
      : number(course.priceGbp) ? { status: 'within_cap', totalGbp: course.priceGbp, capGbp: preferences.budgetGbp }
        : { status: 'check_needed', reason: 'all_inclusive_price_unknown', capGbp: preferences.budgetGbp };
    if (budgetCheck.status === 'check_needed') score.warnings.push('budget_check_needed: total price must be confirmed before enrolment');
    // Zero observed relevance is not promoted as a recommendation.
    if (score.points === 0) { response.excluded.push({ canonicalId: course.canonical_id, reasons: ['no_positive_relevance'], warnings: score.warnings }); continue; }
    const result = { canonicalId: course.canonical_id, title: course.title, url: course.url,
      qualificationStatus: course.qualification_status, ...score, eligibility, budgetCheck };
    if (eligibility.status === 'pathway_needed') response.pathways.push(result);
    else response.recommendations.push(result);
  }
  const order = (a, b) => b.relevanceScore - a.relevanceScore
    || (a.eligibility.status === 'appears_to_meet' ? 0 : 1) - (b.eligibility.status === 'appears_to_meet' ? 0 : 1)
    || stableCompare(a.canonicalId, b.canonicalId);
  response.recommendations.sort(order); response.pathways.sort(order);
  response.totalDirectMatches = response.recommendations.length;
  response.totalPathwayMatches = response.pathways.length;
  response.recommendations = response.recommendations.slice(0, 3);
  response.pathways = response.pathways.slice(0, 3);
  response.status = response.totalDirectMatches ? 'results' : response.totalPathwayMatches ? 'no_direct_match' : 'no_match';
  return response;
}
