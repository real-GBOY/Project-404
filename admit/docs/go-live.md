# Admit: going live with a real organizer

The live deployment at https://admit-web-lime.vercel.app is a **showcase**: it carries the demo organizer "Nile Sessions Events", public demo
passwords and a Gmail sender. This page is what changes when a real business runs on Admit. Each step says why it matters.

## 1. Run it without demo data

Demo seeding is controlled by two flags in the API's `.env`. A real deployment sets **neither**:

```
ADMIT_SEED_DEMO=false              # (or remove it)
# ADMIT_ALLOW_DEMO_IN_PRODUCTION   # remove
```

In production Admit refuses `ADMIT_SEED_DEMO=true` without the second flag, so the demo organizer can never appear next to real data by accident.
On the web app set `VITE_DEMO=false` (it hides the demo account list on the sign-in page).

## 2. Create the organizer and its owner

On the server, as root, from `/opt/admit/backend` with the API's environment loaded:

```bash
npm run provision -- --name "Cairo Live Events" --slug cairo-live \
  --owner-email owner@cairolive.example --owner-name "Mona Hassan"
```

It creates the organization, the first owner account and the `owner` role, and prints the owner's first password **once** (random unless you pass
`--owner-password`). Nothing else is created: no events, no demo people. It refuses an existing site address or e-mail before creating
anything. The public site is `/e/<slug>`; set `VITE_ORG_SLUG` on the web app to make `/` open it.

The owner then signs in at `/admin`, **changes the password** (sidebar: Change password), and adds the team under Settings: an owner creates a
person's account (name and a starting password to hand over), gives them a role, and can reset their password later. Roles: owner (everything),
event manager, payment reviewer (approves transfers), door staff (scanner only), viewer.

If the only owner forgets their password: `npm run provision -- --reset-owner owner@cairolive.example` prints a new one.

## 3. Secrets: generate your own, back them up

| Secret | Where | If lost |
|---|---|---|
| `AURIC_JWT_SECRET` | API `.env` | everyone signs in again |
| `ADMIT_TICKET_KEY` | API `.env` | **every issued ticket QR and every emailed booking link stops working**; back it up beside the database password |
| Database passwords | API and worker `.env` | restore from the box; rotate in PostgreSQL and both files |
| R2 key (proofs and backups) | API `.env` | create a new token in Cloudflare, update the file, restart |
| SMTP password | worker `.env` | issue a new one, update, restart the worker |

The demo deployment's secrets were created by `provision-vps.sh` and pasted credentials were used during setup: **rotate everything** before
real use (the Vercel token, the SSH key, the Gmail app passwords, the R2 token).

## 4. Email that customers actually receive

Gmail through an app password is for demos (about 500 a day, a personal address in the "from"). For customers use a transactional provider on
**your own domain**: add the provider's SPF and DKIM records, then change three lines in `/opt/admit/worker/.env`
(`ADMIT_WORKER_TRANSPORT=smtp`, `ADMIT_WORKER_SMTP_URL`, `ADMIT_WORKER_MAIL_FROM`) and `systemctl restart admit-worker`. Send yourself a booking
and a ticket email first and check they land in the inbox, not spam. The dashboard's Email delivery page shows every message and its status; a
failed one has a Retry button, and a booking's detail has **Send the tickets email again**.

## 5. Money and refunds (decide the process before the first sale)

Admit verifies a transfer by hand and issues tickets; it does **not** move money. Refunds happen outside the system: the organizer returns the
money, then cancels the booking (tickets are revoked and the customer is emailed). Write the refund policy into each event's policies, which
every customer sees before booking and in their emails. Payment reviewers must compare the screenshot with the organizer's real account: the
review screen asks for four explicit checks before Approve is enabled.

## 6. Customers' personal data

Admit stores names, e-mails, phone numbers and payment screenshots. They are visible only to people with the matching permission, exports are
audited, proofs are in a private storage bucket reached only through the API, and a database dump is copied nightly to the same private bucket.
There is **no automated deletion** yet: to honor an erasure request, an owner deletes the person's proofs in the storage bucket and an
administrator anonymizes the booking rows in the database. Decide a retention period and publish a privacy notice on your own site.

## 7. Operate it

- **Health:** point an uptime monitor at `GET /api/health/ready` (database and outbox). Alert on anything but `ready`.
- **Logs:** `journalctl -u admit -f` and `journalctl -u admit-worker -f`.
- **Backups:** nightly at 03:30 to `/var/backups/admit` **and** to R2 (`backups/`, 14 days). Do a test restore once (see `docs/admit-deployment.md`).
- **Updates:** `bash scripts/deploy-admit-local.sh` ships the API; the web app deploys from Vercel. Migrations run on start.
- **Hardening in place:** HTTPS, security headers, request limits on sign-in and checkout, fail2ban on SSH, a firewall allowing only SSH, HTTP and
  HTTPS, automatic security updates. Use SSH keys only; disable password login for root.
- **Capacity:** one small VPS comfortably serves a few hundred bookings a day. Move PostgreSQL to a managed database before running large sales.

## 8. Before the first public event, rehearse

Create a test event with one cheap ticket, book it from a phone, transfer a tiny amount, approve it as a reviewer, open the email on the
phone, and scan the ticket with the door scanner on the **door person's** phone (camera needs HTTPS, which the live site has). Then cancel
the booking and confirm the ticket is refused at the door.

## Known limits

English only (Arabic and right-to-left are phase two); one currency (EGP) and one time zone; no refund recording; no partial payments; no
email invitations or self-service "forgot password" (an owner resets passwords); event cover pictures are a URL, not an upload; no wallet passes.
