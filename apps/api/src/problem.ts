// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { FastifyReply } from "fastify";
import { ERROR_CODE_STATUS, type ApiErrorCode, type ProblemDetails } from "@lingua/types";

export type ProblemInput = {
  code: ApiErrorCode;
  detail: string;
  instance: string;
  requestId: string;
  errors?: { path: string; message: string }[];
};

/**
 * Build an RFC 9457 problem document.
 *
 * The HTTP status is derived from the error code rather than passed in, so the
 * API layer and the client cannot disagree about how a code maps to a status.
 * See `ERROR_CODE_STATUS` in @lingua/types.
 */
export function createProblem(input: ProblemInput): ProblemDetails {
  const problem: ProblemDetails = {
    type: `https://lingua.example/problems/${input.code}`,
    title: humanizeCode(input.code),
    status: ERROR_CODE_STATUS[input.code],
    detail: input.detail,
    instance: input.instance,
    code: input.code,
    request_id: input.requestId,
  };

  if (input.errors) {
    problem.errors = input.errors;
  }

  return problem;
}

export function sendProblem(reply: FastifyReply, problem: ProblemDetails): void {
  reply.status(problem.status).type("application/problem+json").send(problem);
}

/** `voice_quota_exhausted` becomes `Voice quota exhausted`. */
function humanizeCode(code: string): string {
  const words = code.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
