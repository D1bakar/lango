// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * Seed the database with language data from the content YAML files.
 *
 * This runs once after `prisma migrate dev` to populate the `language` table.
 * Content packs are imported separately by the import job (Phase 3.5).
 */

import { PrismaClient } from "@prisma/client";
import { loadContent, toLanguagePairs } from "@lingua/core";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding languages from content/...");

  const content = await loadContent();

  // Upsert every language found in the content tree
  for (const lang of content.languages) {
    await prisma.language.upsert({
      where: { bcp47_tag: lang.tag },
      update: {
        english_name: lang.english_name,
        native_name: lang.native_name,
        script: lang.script,
        text_direction: lang.text_direction,
        transliteration_scheme: lang.transliteration_scheme,
        transliteration_required: lang.transliteration_required,
        tokenizer_profile: lang.tokenizer_profile,
        normalization_profile: lang.normalization_profile,
        morphology: lang.morphology as Record<string, unknown>,
        tts_config: (lang.tts ?? {}) as Record<string, unknown>,
        stt_config: (lang.stt ?? {}) as Record<string, unknown>,
        is_active: true,
      },
      create: {
        bcp47_tag: lang.tag,
        english_name: lang.english_name,
        native_name: lang.native_name,
        script: lang.script,
        text_direction: lang.text_direction,
        transliteration_scheme: lang.transliteration_scheme,
        transliteration_required: lang.transliteration_required,
        tokenizer_profile: lang.tokenizer_profile,
        normalization_profile: lang.normalization_profile,
        morphology: lang.morphology as Record<string, unknown>,
        tts_config: (lang.tts ?? {}) as Record<string, unknown>,
        stt_config: (lang.stt ?? {}) as Record<string, unknown>,
        is_active: true,
      },
    });
    console.log(`  ✓ ${lang.tag} (${lang.english_name})`);
  }

  // Create language pairs and upsert packs
  const allTags = new Set(content.languages.map((lang) => lang.tag));

  for (const pack of content.packs) {
    const nativeLang = await prisma.language.findUnique({
      where: { bcp47_tag: pack.native_language },
    });
    const targetLang = await prisma.language.findUnique({
      where: { bcp47_tag: pack.target_language },
    });

    if (!nativeLang || !targetLang) {
      console.warn(`  ⚠ Skipping pack ${pack.pack_key}: missing language`);
      continue;
    }

    // Ensure the language pair exists
    const pair = await prisma.languagePair.upsert({
      where: {
        native_language_id_target_language_id: {
          native_language_id: nativeLang.id,
          target_language_id: targetLang.id,
        },
      },
      update: { is_active: true },
      create: {
        native_language_id: nativeLang.id,
        target_language_id: targetLang.id,
        is_active: true,
      },
    });

    // Upsert the pack
    await prisma.contentPack.upsert({
      where: { pack_key: pack.pack_key },
      update: {
        title: pack.title,
        cefr_from: pack.cefr_from,
        cefr_to: pack.cefr_to,
        version: pack.version,
        license: pack.license,
        status: pack.status,
        published_at: pack.status === "published" ? new Date() : null,
      },
      create: {
        language_pair_id: pair.id,
        pack_key: pack.pack_key,
        title: pack.title,
        cefr_from: pack.cefr_from,
        cefr_to: pack.cefr_to,
        version: pack.version,
        license: pack.license,
        status: pack.status,
        published_at: pack.status === "published" ? new Date() : null,
      },
    });
    console.log(`  ✓ Pack ${pack.pack_key}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
