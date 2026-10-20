-- Persistent per-tier sandbox progress for dev/dev_admin to "test drive"
-- the Setup/DIY/Free client experience without a real client account.
-- Not tied to any profile — keyed purely by tier, so it survives across
-- sessions until explicitly reset.
create table public.dev_sandbox_step_status (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('custom','diy','free')),
  step_id uuid not null references public.setup_steps(id) on delete cascade,
  status public.step_status not null default 'not_started',
  updated_at timestamptz not null default now(),
  unique (tier, step_id)
);

alter table public.dev_sandbox_step_status enable row level security;

create policy dev_sandbox_step_status_staff_only on public.dev_sandbox_step_status
  for all using (is_staff()) with check (is_staff());
