// revenuecat-webhook — the authoritative source of profiles.is_premium.
//
// RevenueCat POSTs subscription lifecycle events here; we verify a shared secret
// and write is_premium via the service role (the only writer allowed by
// migration 0007). This is what makes Pro-gating trustworthy server-side — the
// client can no longer self-grant.
//
// Deploy (must skip JWT — RevenueCat has no Supabase JWT; we auth via the secret):
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
// Secret:
//   supabase secrets set REVENUECAT_WEBHOOK_SECRET=<a-long-random-string>
// Then in RevenueCat → Project → Integrations → Webhooks:
//   URL:  https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header value: the same secret
//
// Prerequisite: the app calls Purchases.logIn(supabaseUserId) so event.app_user_id
// is the Supabase uuid (not an anonymous $RCAnonymousID).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ENTITLEMENT = 'MySetup Pro';

// Events that (re)activate access → grant. CANCELLATION and BILLING_ISSUE keep
// access until it actually ends, so they don't appear here; only EXPIRATION
// revokes.
const GRANT = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);
const REVOKE = new Set(['EXPIRATION']);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Authenticate the caller as RevenueCat via the shared secret.
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || (req.headers.get('Authorization') || '') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const event = body?.event ?? {};
  const uid: string | undefined = event.app_user_id;
  const type: string | undefined = event.type;

  // Nothing to map, or an anonymous user (never called logIn) → ack and move on.
  if (!uid || !type || uid.startsWith('$RCAnonymousID')) {
    return new Response('ok', { status: 200 });
  }

  const ids: string[] = event.entitlement_ids
    || (event.entitlement_id ? [event.entitlement_id] : []);
  const concernsUs = ids.length === 0 || ids.includes(ENTITLEMENT);

  let isPremium: boolean | null = null;
  if (concernsUs && GRANT.has(type)) isPremium = true;
  else if (concernsUs && REVOKE.has(type)) isPremium = false;
  if (isPremium === null) return new Response('ok', { status: 200 }); // event we don't act on

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { error } = await admin
    .from('profiles')
    .update({ is_premium: isPremium, updated_at: new Date().toISOString() })
    .eq('id', uid);
  if (error) return new Response(error.message, { status: 500 });

  return new Response('ok', { status: 200 });
});
