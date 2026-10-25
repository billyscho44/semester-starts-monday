-- The two trigger functions must run only as triggers, never as public API calls.
revoke execute on function public.block_other_signups() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
