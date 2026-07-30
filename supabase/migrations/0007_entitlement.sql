-- Make profiles.is_premium server-authoritative.
--
-- It used to be written by the client (setIsPremium), so a user could self-grant
-- Pro by updating their own row. Revoke the client's ability to write that one
-- column; from now on only the service role (the RevenueCat webhook) may set it.
-- Every other profile column stays client-updatable under the existing RLS.
revoke update (is_premium) on public.profiles from authenticated;
revoke update (is_premium) on public.profiles from anon;

-- The service_role bypasses column privileges and RLS, so the revenuecat-webhook
-- function can still write is_premium. (No grant needed — service_role already
-- has it and is not affected by the revokes above.)
