import { NextResponse } from 'next/server';
import { getRoute, questionnaire } from '@/lib/questionnaire';
import { config } from '@/lib/config';
import { optionalBranchAvailable } from '@/lib/questionnaire/flow';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ journey: string }> }
) {
  const { journey } = await params;
  if (journey !== 'career' && journey !== 'course') {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'That journey does not exist.' } },
      { status: 404 }
    );
  }
  const route = getRoute(journey);
  // Optional branches are suppressed when their reviewed bindings do not exist.
  const questions = route.questions.filter(
    question => !question.isOptionalBranch || optionalBranchAvailable(question.id)
  );
  const body = {
    questionnaireVersion: config.questionnaireVersion,
    supportedVersions: [config.questionnaireVersion],
    positioning: questionnaire.positioning,
    route: { ...route, questions },
    globalRules: questionnaire.globalRules,
    answerContract: questionnaire.answerContract
  };
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=300', ETag: `"${config.questionnaireVersion}-${journey}"` }
  });
}
