import { NextResponse } from 'next/server';
import { validateSubmission } from '@/lib/questionnaire/validation';
import { recommendCareerDirections, recommendCourses } from '@/lib/adapter/service';
import { catalogueReady } from '@/lib/catalogue/release';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

const noStore = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow'
};

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: { code: 'PAYLOAD_TOO_LARGE', message: 'That request was too large to process.' } },
      { status: 413, headers: noStore }
    );
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: { code: 'PAYLOAD_TOO_LARGE', message: 'That request was too large to process.' } },
        { status: 413, headers: noStore }
      );
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'That request could not be read.' } },
      { status: 400, headers: noStore }
    );
  }

  const readiness = catalogueReady();
  if (!readiness.ready) {
    return NextResponse.json(
      {
        error: {
          code: 'CATALOGUE_UNAVAILABLE',
          message: 'Course information is not available right now. You can browse courses or talk to an adviser.'
        }
      },
      { status: 503, headers: noStore }
    );
  }

  const validated = validateSubmission(body);
  if (!validated.ok || !validated.value) {
    const status = validated.code === 'VERSION_MISMATCH' ? 409 : validated.code === 'INVALID_JSON' ? 400 : 422;
    return NextResponse.json(
      {
        error: {
          code: validated.code ?? 'INVALID_ANSWER',
          message: validated.message ?? 'Some answers could not be used.',
          fields: validated.errors.map(error => ({
            questionId: error.questionId,
            detailId: error.detailId,
            code: error.code,
            message: error.message
          }))
        }
      },
      { status, headers: noStore }
    );
  }

  try {
    // Answers, details and free text are never logged.
    const response =
      validated.value.journey === 'career'
        ? recommendCareerDirections(validated.value)
        : recommendCourses(validated.value);
    return NextResponse.json(response, { headers: noStore });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'TEMPORARILY_UNAVAILABLE',
          message: 'We could not work out results just now. Your answers are still here, so you can try again.'
        }
      },
      { status: 503, headers: noStore }
    );
  }
}
