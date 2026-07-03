import { createClient } from "@supabase/supabase-js";

import { getSupabaseSecretConfig } from "@/lib/env";

export function createSupabaseAdminClient() {
  const config = getSupabaseSecretConfig();

  if (!config) {
    return null;
  }

  return createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

