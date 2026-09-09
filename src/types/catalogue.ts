/** Types for the published catalogue release and the engine contract it feeds. */

export type QualificationStatus = 'regulated_verified' | 'unregulated' | 'unverified';

export interface FieldReview {
  conflicting: boolean;
  valid_until: string;
  source: string;
}

/** The exact record shape the reference engine consumes. */
export interface ApprovedCourse {
  canonical_id: string;
  record_id?: string;
  title: string;
  url: string;
  active: boolean;
  review_status: 'approved';
  qualification_status: QualificationStatus;
  categoryIds: string[];
  entry_policy: { status: 'unknown' } | { status: 'verified'; rule: unknown };
  goals?: string[];
  experienceFit?: string[];
  hoursPerWeek?: number;
  priceGbp?: number;
  level?: number;
  field_reviews: Record<string, FieldReview>;
}

export interface CourseMembership {
  category: string;
  categoryId: string;
  subcategory: string | null;
  subcategoryId: string | null;
  primary: boolean;
}

/** Display facts shown to a learner. `null` always means unknown. */
export interface CourseDisplay {
  canonicalId: string;
  title: string;
  url: string;
  level: number | null;
  levelLabel: string | null;
  awardingBodyLabel: string | null;
  qualificationStatus: QualificationStatus;
  sourceQualificationStatus: string;
  primaryCategory: string;
  primaryCategoryId: string;
  primarySubcategory: string | null;
  categoryIds: string[];
  memberships: CourseMembership[];
  priceGbp: number | null;
  hoursPerWeek: number | null;
  tqtHours: number | null;
  entryRequirements: string | null;
  placementRequired: boolean | null;
  sourceRow: number;
  sourceSheet: string;
  recordId: string;
}

export interface TaxonomySubcategory { id: string; label: string; courseCount: number }
export interface TaxonomyCategory {
  id: string;
  label: string;
  courseCount: number;
  subcategories: TaxonomySubcategory[];
}

export interface QuarantinedGroup {
  canonicalId: string;
  reason: string;
  detail?: string;
  rows: { recordId: string; sourceRow: number; title?: string; awardingBodyLabel?: string }[];
}

export interface CatalogueRelease {
  releaseId: string;
  checksum: string;
  publishedAt: string;
  schemaVersion: string;
  editorialRulesVersion: string;
  reviewStatus: string;
  sourceFile: string;
  sourceSha256: string;
  snapshotPeriod: string;
  auditedOn: string;
  reviewValidUntil: string;
  allowedUrlHosts: string[];
  sourceRowCount: number;
  courses: ApprovedCourse[];
  display: CourseDisplay[];
  taxonomy: TaxonomyCategory[];
  quarantined: QuarantinedGroup[];
  rejected: unknown[];
  unknownFields: Record<string, string>;
  sourceAudit: Record<string, unknown>;
}

export interface ReleaseManifest {
  schemaVersion: string;
  activeReleaseId: string;
  activeReleaseFile: string;
  checksum: string;
  publishedAt: string;
  previousReleaseId: string | null;
  availableReleases: string[];
  questionnaireVersion: string;
  editorialRulesVersion: string;
  reviewStatus: string;
  emergencySuppressionList: string[];
}
