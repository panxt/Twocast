create table public.feedback_tickets (
 id uuid primary key, user_id integer not null, author_name text not null,
 title varchar(120) not null, content text not null check(length(content) between 1 and 10000),
 status text not null default 'open' check(status in ('open','processing','closed')),
 attachments jsonb not null default '[]',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index feedback_tickets_owner_time on public.feedback_tickets(user_id, created_at desc);
create index feedback_tickets_updated on public.feedback_tickets(updated_at desc);
create table public.feedback_messages (
 id uuid primary key, ticket_id uuid not null references public.feedback_tickets(id) on delete cascade,
 user_id integer not null, author_name text not null, is_admin boolean not null,
 content text not null check(length(content) between 1 and 10000), created_at timestamptz not null default now()
);
create index feedback_messages_ticket_time on public.feedback_messages(ticket_id, created_at);
alter table public.feedback_tickets enable row level security;
alter table public.feedback_messages enable row level security;
revoke all on public.feedback_tickets, public.feedback_messages from anon, authenticated;
-- Existing application sessions are validated by the trusted backend, not Supabase Auth.
grant select, insert, update on public.feedback_tickets, public.feedback_messages to postgres;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('feedback-images','feedback-images',false,3145728,array['image/png','image/jpeg','image/webp']);
