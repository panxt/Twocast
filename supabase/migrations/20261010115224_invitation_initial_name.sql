alter table public.invite_codes add column if not exists initial_display_name varchar(40);
alter table public.invite_codes add constraint invite_initial_name_single_use
  check (initial_display_name is null or max_uses = 1);
