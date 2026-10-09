-- Only the server-held database role can access these tables; app handlers enforce ownership.
grant select,insert,update on public.feedback_tickets,public.feedback_messages to twocast_app;
create policy feedback_tickets_backend on public.feedback_tickets for all to twocast_app using (true) with check (true);
create policy feedback_messages_backend on public.feedback_messages for all to twocast_app using (true) with check (true);
