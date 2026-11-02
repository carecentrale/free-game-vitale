-- 0006: a signed-in parent can delete their own cloud save.
-- Only the row whose user_id is the signed-in account can be deleted. No other account's save is affected.

create policy "own save delete" on public.cloud_saves
  for delete to authenticated
  using (auth.uid() = user_id);
