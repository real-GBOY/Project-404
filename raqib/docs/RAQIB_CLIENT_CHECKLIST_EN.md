# Raqib — requirements checked against what works today

> This list answers the requirements message (15–20) point by point. Status means: **Works** (built and automatically tested), **Partial**, **Not built**, or **Waiting on you** (cannot be done until you supply the material). It contains no price and no duration; those are agreed separately. (Arabic version: `RAQIB_CLIENT_CHECKLIST_AR.md`.)

**How to try it:** every demo account uses the password `demo-password-2026`. Accounts: General Manager `m.alsudairi@raqib.sa`, Quality Manager `s.alotaibi@raqib.sa`, Project Manager `f.aldosari@raqib.sa`, Security Supervisor `m.alharbi@raqib.sa`, Inspector `k.alshehri@raqib.sa`, Guard `g-10302@raqib.sa`. To try it on a phone, open the same address in the phone's browser (the screens adapt to small displays and to right-to-left Arabic).

## 15 — Project ranking and search

| Requirement | Status | How to try it |
|---|---|---|
| Rank projects by observations, improvement, complaints and contract-expiry proximity | **Works** | Analytics → "Project ranking"; an order selector (needs attention first, most observations, least improvement, most complaints, contract ending soonest, highest score) |
| Store contract dates and employee counts | **Works** | Projects → edit project: contract start, contract end, employees assigned |
| Complaint indicators do not reveal report details or who filed them | **Works** | The complaint count shows only to people holding a confidential-reports grant; for everyone else the column does not appear (it is not shown as zero) |
| Search by name, national ID, employee number, case number, inspection issue number and project code, by permission | **Works** | The search bar (Ctrl+K). "Case number" is read as the observation, corrective-action or training-request reference (OBS / CA / TR). Results are limited to what the user may see and never include confidential reports |
| Ranking weights | **Works** | Equal by default; edit them in Settings → Project ranking (Quality Manager account) |

## 16 — Training requests

| Requirement | Status | How to try it |
|---|---|---|
| Supervisor's request → Project Manager approval → Quality Management | **Works** | Security Supervisor: Training requests → New request; the Project Manager approves; Quality schedules and records completion |
| Guard's request → their supervisor's review → Project Manager → Quality, per the path you approve | **Works** | Guard: Training requests → New request (for themselves only); the supervisor reviews and forwards. The path is adjustable: Settings → Training requests (turn the supervisor's review of guard requests on or off) |
| Save request data, reason, priority, approvals, rejection reasons and execution status; auto-fill known data and action dates | **Works** | Any request's detail shows the full history with dates and reasons; employee data is filled from the employee record |
| Final approval path | **Waiting on you** | The current path is what you described; any change you approve is set in Settings |

## 17 — Surveys and confidential reports

| Requirement | Status | How to try it |
|---|---|---|
| Surveys for guards and a confidential-report channel | **Works** | "Surveys" menu: a guard answers under their name, a hidden identity, or anonymously. "Confidential reports": a guard files a report |
| Only the person or people you designate can read them | **Works** | The General Manager grants access with an expiry date and a reason; entry is logged and needs an acknowledgement. The General Manager also names who manages surveys |
| Report details and the reporter's identity never appear to the Project Manager or anyone unauthorized, in search, reports, exports or e-mail | **Works** | Covered by automated tests (search, analytics, export, notifications that carry no content, direct links). Enforced in the server and the database |
| General Quality Management permission does not grant access automatically | **Works** | A Quality Manager without an explicit grant is refused (403) |

## 18 — Language, settings and development

| Requirement | Status | How to try it |
|---|---|---|
| Arabic and English in screens, forms, alerts, reports and PDF, with correct text direction | **Works** | The language switch; reports and blank forms print to PDF from the browser in Arabic and English |
| Spell-check | **Partial** | On in surveys, text dialogs and Arabic name fields; not reviewed on every screen |
| Update projects, employees, forms, items, weights and authorized people from the right account | **Works** | Projects, guards, inspection forms, deduction rules and naming authorized people, each by that account's permission |
| Keep versions; historical reports do not change | **Works** | Forms and deduction rules have fixed versions; an issued report keeps its settings, organization name and logo as issued |
| Quality standards and MOI requirements | **Waiting on you** | They will be added only after you supply and approve them |

## 19 — Scope of the quality role

| Requirement | Status | Note |
|---|---|---|
| Quality oversees, inspects, verifies and follows up; operational remediation stays with the Project Manager | **Works** | Quality permissions exclude carrying out corrective actions and the Project Manager stage of training approval; covered by a test |
| Security quality sits under Projects Management; quality staff are company employees, not contractors | **Organizational note** | The system has no "contractor" role; reporting lines grant no permissions, and permissions are defined by separate templates |

## 20 — Costs and delivery

| Requirement | Status | Note |
|---|---|---|
| In-system analytics, no Power BI or external subscriptions | **Works** | Analytics and export (CSV and Excel) are built in |
| Clarify monthly and yearly costs (hosting, domain, e-mail, storage) | **Documented, no prices** | `RAQIB_DELIVERY.md` lists the services and which recur; each provider sets its price and no figures are given. E-mail is not yet configured |
| Price and budget | **To be agreed** | The full scope is larger than USD 500 covers; the price and how it is split between the two stages are agreed in writing before the work is treated as binding |
| Confirm design improvement is included | **Set by the agreement** | The design improvements made are targeted; the approved screens were not redesigned |
| Two-stage delivery with outputs, duration and acceptance criteria | **Partial** | Outputs and acceptance are written; **durations and price are not stated** and are to be agreed |
| Source code, database, admin account, user guide, backup and restore, bug-fix period | **Partial** | Code, database, backup and restore are documented; a detailed per-role user guide is written once the forms are approved; **the bug-fix period length is not set** |
| Name and logo | **Waiting on you** | Both are set in Settings → Organization (the logo is uploaded there) |
| Updated version showing the whole journey: scheduling → inspection → corrective action → approval → PDF | **Works (with sample forms)** | Includes several forms per visit, auto-fill, the fixed deduction from 100, escalation and reports. **Your original forms have not been received**, so the current forms are stand-ins |
| Closure after implementation, testing, fixing notes and your approval | **Procedure** | Set in the delivery document as the condition for acceptance |

## What cannot be finished until you send material

Your original inspection forms; the approved deduction table; shift times and the consecutive-shift rule; how escalation days (3/6/9) are counted and who receives them; quality standards and MOI requirements; the name and logo; the final training approval path if it differs. A fill-in request with templates is in `RAQIB_MATERIALS_REQUEST.md`.

## Not included at present

Server-generated PDF (PDFs are produced by the browser); a separate "quality supervisor" role distinct from the inspector; checking real e-mail delivery (needs a mail server set up); a full redesign of the approved screens.

## Not yet published

The changes above are saved in the repository and tested locally but have **not been deployed** to the hosted version (Vercel and the server); the published version is the one before them.
