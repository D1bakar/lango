// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { Metadata } from "next";
import { ApiDownPanel } from "@/components/api-down";
import { fetchLanguages, fetchPairsByNative } from "@/lib/api";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = {
  title: "Choose a language",
};

// Content is read per request so edits to a content file are visible on reload,
// and so a production build never depends on the API being up.
export const dynamic = "force-dynamic";

export default async function LearnPage() {
  try {
    const languages = await fetchLanguages();
    const pairsByNative = await fetchPairsByNative(languages);

    return <Onboarding languages={languages} pairsByNative={pairsByNative} />;
  } catch (error) {
    return (
      <div className="max-w-4xl">
        <h1 className="font-serif text-3xl">Choose a language</h1>
        <div className="mt-8">
          <ApiDownPanel error={error} />
        </div>
      </div>
    );
  }
}
