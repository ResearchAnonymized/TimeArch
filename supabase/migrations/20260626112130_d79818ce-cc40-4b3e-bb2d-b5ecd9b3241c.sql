
REVOKE EXECUTE ON FUNCTION public.api_check_rate(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.api_cleanup_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_check_rate(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_cleanup_logs() TO service_role;
