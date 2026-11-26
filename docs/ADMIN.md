# Admins

In v1 only admins (Simeon and Ivo) enter venues and events. Admin rights live in `profiles.is_admin`. No client can change that column: it has no update grant and no RPC sets it. Set it only with SQL, as below.

## Make someone an admin

1. Sign in to the app once and finish sign-up, so the profile exists.
2. Open the Supabase dashboard → project **Ai-Hodim** → **SQL Editor**, and run:

```sql
update public.profiles
set is_admin = true
where username in ('<simeon-username>', '<ivo-username>');

-- check
select username, is_admin from public.profiles where is_admin;
```

3. Reload the app. It reads `is_admin` at sign-in, and the admin buttons appear on **Заведения**.

## Remove admin rights

```sql
update public.profiles set is_admin = false where username = '<username>';
```

## What admins can do

- Create and edit venues: name, address, phone, coordinates, check-in radius and check-in window.
- Create and edit events: performer, start time (Sofia time) and promo text.

The database enforces this with RLS (`is_admin()` on every insert, update and delete of `venues` and `events`). The hidden buttons are only cosmetic.

To delete a venue or an event, use SQL. Deleting a venue also deletes its events.
