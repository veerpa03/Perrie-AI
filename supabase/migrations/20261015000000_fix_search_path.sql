-- Pin search_path on the updated_at trigger function (Supabase security
-- advisor: function_search_path_mutable). Without this, a role that can
-- create objects earlier in the search path could shadow `now()`/plpgsql
-- built-ins the function relies on.
create or replace function public.perrie_touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
