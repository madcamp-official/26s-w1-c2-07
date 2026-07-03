export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return {
    url,
    publishableKey,
  };
}

function isConfiguredSecret(value: string | undefined) {
  return Boolean(value && !value.startsWith("replace-with-"));
}

export function getSupabaseSecretConfig() {
  const publicConfig = getSupabasePublicConfig();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!publicConfig || !isConfiguredSecret(secretKey)) {
    return null;
  }

  return {
    url: publicConfig.url,
    secretKey: secretKey as string,
  };
}
