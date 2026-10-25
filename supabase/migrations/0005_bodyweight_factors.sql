-- Bodyweight factor: fraction of body weight an exercise moves, so bodyweight work and variations
-- can be compared on one scale. Sources and confidence are recorded in bw_basis.
alter table public.exercise
  add column bw_factor numeric(3,2) check (bw_factor between 0 and 1.5),
  add column bw_basis text;
alter table public.check_log add column bw_factor numeric(3,2);

create policy "own exercise: update" on public.exercise for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

update public.exercise set bw_factor = 0.88, bw_basis = 'estimate' where name in ('Chair squat', 'Balance board squat');
update public.exercise set bw_factor = 0.40, bw_basis = 'estimate' where name = 'Incline push-up on bench';
update public.exercise set bw_factor = 0.60, bw_basis = 'estimate' where name = 'Reverse lunge, hand on chair';
