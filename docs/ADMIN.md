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

- Create and edit venues: name, address, phone, location, check-in radius and check-in window.
  - **Location:** standing at the club, tap **Използвай текущото ми местоположение**. If the phone reports worse than ±50 m, step outside and tap again. Away from the club, long-press the place in the Google Maps app and paste the numbers it shows (`42.0136, 23.0934`), or paste a full Google Maps link from a browser. Short `maps.app.goo.gl` links don't contain coordinates and are refused. Anything more than 15 km from Blagoevgrad is refused too, which catches swapped numbers. Always tap **Провери на картата** before saving.
- Create and edit events: performer, start time (Sofia time) and promo text.

The database enforces this with RLS (`is_admin()` on every insert, update and delete of `venues` and `events`). The hidden buttons are only cosmetic.

To delete a venue or an event, use SQL. Deleting a venue also deletes its events.
