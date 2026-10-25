# Quality of life changes (2026-10-25)

## Database rollout

Before deploying the frontend, run `supabase/migrations/202610250001_quality_of_life.sql` in the Supabase SQL Editor as the database owner (or apply it with your normal Supabase migration workflow). This repository has no linked Supabase CLI project or database credentials, so the migration is supplied but has not been applied to the hosted database.

The migration is transactional and can be rerun. It adds nullable `books.added_when`, then sets the default to `now()` for new rows. Existing books retain NULL because their addition dates cannot be reconstructed. Editing a book or returning it to the waitlist preserves its original addition date. NULL dates are hidden in the UI and sort after known dates in either direction.

It also adds two authenticated RPCs:

- `get_meeting_rating(p_meeting_id text)` returns only the current average and count, reading all attendees' nonzero ratings even when individual `user_books` rows are protected by RLS. It only includes closed meetings dated today or earlier, attendee IDs present on that meeting, and ratings in the existing 1–10 scale. The UI converts this to five colored stars, including fractional fills. It fetches on opening/changing meetings and attendance, on window focus/visibility, and every 30 seconds while visible. The average is never stored as a stale snapshot.
- `admin_add_meeting_attendee(p_meeting_id text, p_user_id text)` checks the signed-in user's admin flag in the database, verifies that the selected member and meeting exist, and locks the meeting while appending the attendee. Repeated additions are idempotent. Existing attendee storage may be a PostgreSQL array or JSON array; the function preserves its type. Browser UI guards are supplemented by this database check.

Both functions use a fixed empty search path, fully qualified tables, and explicit execution grants to `authenticated` only. Existing table RLS policies and individual rating visibility are unchanged.

After applying the migration, verify with an admin and a normal member: add a missing attendee to a past meeting, confirm the new name appears, confirm duplicate additions do not duplicate IDs, and confirm that direct non-admin calls to the add RPC fail. For the average, use attendee ratings 8, 7, and 0 plus a non-attendee rating of 10: the expected result is 3.75/5 from two ratings. Update one attendee's rating and confirm the average refreshes. Check the functions against the actual hosted schema before deployment; the live schema is not versioned in this repository.

## Google Books troubleshooting

The documented endpoint is still `GET https://www.googleapis.com/books/v1/volumes?q=...`:
https://developers.google.com/books/docs/v1/reference/volumes/list

Two frontend problems were fixed: the old search forced ASCII queries to English and queries containing accents to Hungarian; it also treated error responses as empty results. The search now uses no automatic language restriction, checks HTTP/API errors, and displays distinct hints for service failures, quota exhaustion, and key/configuration failures. Missing keys are omitted instead of sending `key=undefined`. Returned language codes are no longer mistaken for countries, and publication years are prefilled when available.

A read-only probe using this workspace's configured key returned HTTP 503, `Service temporarily unavailable.` on 2026-10-25. This establishes a service failure for that request, not the cause of every failed production request. A server-side diagnostic also does not reproduce a browser's HTTP referrer restrictions.

Run `npm run check:google-books` (optionally followed by a search phrase) to see status, counts, and the API error without printing the key. The command reads local development env files; it does not inspect GitHub's deployment secrets. Check these places for production failures:

1. Browser DevTools → Network → the `books/v1/volumes` request. Inspect the HTTP status and JSON `error.message`; distinguish a genuine zero-result HTTP 200 from 400/403/429/503 failures.
2. Google Cloud Console → the project owning the key → APIs & Services → Enabled APIs & services: ensure Books API is enabled.
3. APIs & Services → Credentials → the key: check API restrictions and website/referrer restrictions against the deployed domain and local development origin.
4. Books API → Quotas & System Limits / Metrics: inspect exhausted quotas and failed requests.
5. GitHub repository → Settings → Secrets and variables → Actions: verify `VITE_GOOGLE_BOOKS_API_KEY`. Vite embeds this at build time; rebuild/redeploy after changing it. Local `.env.local` takes priority over `.env`.

The custom-entry button remains the final option below search results, including empty/error states, and is available without contacting Google. All editable book data fields are required, including cover (upload or URL) and recommendation. Positive integer page counts and integer publication years are validated. Search results and the editing modal scroll independently within the viewport.

## Verification

`npm test` covers search URL encoding, accented and unaccented Hungarian searches, absent keys, API/key/quota/network errors, empty/incomplete results, and aborted requests. `npm run build` checks production bundling. The deploy workflow now uses Node 22 because Vite 7 requires a newer runtime than the previous Node 18 setup.

The repository already has unrelated ESLint errors in authentication, profile, and voting components. Targeted lint checks should include all changed source files; do not interpret the existing full-project lint failures as new regressions.

A headless Chrome check with mocked backend responses also passed waitlist text/date filtering, HTTP 503 display and manual fallback, required-field validation, 375px-wide form containment, timeline year grouping without page overflow, fractional meeting ratings, and admin attendee addition. This validates frontend behavior; it does not execute the SQL functions against the hosted database.

## Follow-up: member list and timeline

Staging project `mocyrovwheildloqfkvy` was checked read-only: the original member query failed with PostgreSQL `42703` because `public.users.auth_created_at` does not exist. The table contains 14 profiles and has neither registration-date column. The corrected base query returned all 14 profiles using the local diagnostic credential; signed-in UI behavior was checked separately with mocked responses, not a real user session. The profile list now loads independently of optional registration metadata; registration sorting is offered only when dates exist. Loading, permission/error, retry, and empty-result states are shown explicitly. No database changes are required for this fix.

The timeline now uses a continuous proportional year axis, absolute book-card positions, year markers, arrow connectors, and above/below rows. Closely spaced years keep their exact axis anchors while cards shift to avoid overlaps. Unknown dates appear separately. The timeline scrolls within its own region on narrow screens. Same-year books remain grouped in one frame. Past-meeting rating stars are centered and enlarged to 40px on desktop and 32px on mobile.

Verification: 16 regression tests pass, including missing date columns and proportional/collision-free timeline geometry. Mocked headless Chrome checks cover member error/retry, absent registration sorting, mobile containment, precise year-anchor spacing, and centered responsive stars. Production build and targeted lint also pass.
