"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error("Missing Supabase browser environment variables.");
  }

  return createBrowserClient(config.url, config.publishableKey);
}

export function hasSupabaseBrowserConfig() {
  return Boolean(getSupabasePublicConfig());
}
