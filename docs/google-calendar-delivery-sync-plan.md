# Google Calendar Delivery Sync Plan

## Current Relevant Models

- `UserProfile` in `prisma/schema.prisma`
  - Stores Supabase-auth-linked users via `authUserId`, `email`, `displayName`, `role`, `status`.
  - Has delivery relations: `assignedDeliveries`, `createdDeliveries`, `updatedDeliveries`.
  - No OAuth/calendar fields yet.
- `UserPermission`
  - Per-user module/action flags. Admins bypass permission flags through `hasPermission`.
- `ActivityLog`
  - Existing audit trail for user, order, delivery, and settings changes.
  - Delivery scheduling/update logs already use `DELIVERY_SCHEDULED` and `DELIVERY_UPDATED`.
- `Delivery`
  - Delivery schedule fields: `scheduledDate`, `scheduledTimeWindow`, provider fields, recipient fields, `deliveryAddressSnapshot`.
  - Assignment field already exists: `assignedStaffId`.
  - Status controls lifecycle: `PLANNED`, `SCHEDULED`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`, `DELIVERED`, `FAILED`, `CANCELLED`.
  - No Google Calendar event metadata yet.
- `DeliveryItem`
  - Per-delivery planned/delivered item quantities.
- `Order`
  - Owns deliveries and stores customer/order snapshot data useful for event titles/descriptions.

## Where User Management Should Show Calendar Connection

- `app/(dashboard)/users/page.tsx`
  - Server page is admin-only through `requireAdmin()`.
  - Currently selects user identity, role/status, dates, and permissions.
  - Should later include each user's calendar connection summary in the `select`, such as connected/disconnected, Google account email, calendar ID, and last sync error.
- `components/dashboard/user-management.tsx`
  - `ManagedUser` is the client-facing user shape.
  - `UserTable` currently has columns: User, Role, Status, Access, Updated / Invited, Action.
  - Add a `Calendar` column or compact status under the User column.
  - In the edit form, add a separate "Google Calendar" section with Connect, Reconnect, Disconnect, and sync status.
  - Because OAuth should connect the current signed-in Google account, admin editing another user should not silently connect on their behalf unless the product intentionally supports delegated setup. Recommended behavior: users connect their own calendar from their own row/profile state; admins can view status and disconnect/revoke if needed.

## Where Delivery Scheduling Logic Currently Lives

- `components/dashboard/order-workspace.tsx`
  - `DeliveryForm` builds the delivery scheduling form.
  - Current submitted fields: `orderId`, `scheduledDate`, `scheduledTimeWindow`, provider, destination, recipient, notes, and `items`.
  - It does not currently expose `assignedStaffId`, despite `Delivery.assignedStaffId` existing in Prisma.
  - `DeliveryProgressForm` submits delivery status updates and supports `IN_TRANSIT`, `DELIVERED`, and `CANCELLED`.
- `app/actions/orders.ts`
  - `createDeliveryAction` validates `createDeliverySchema`, creates `Delivery`, creates nested `DeliveryItem` rows, updates order delivery summary, logs `DELIVERY_SCHEDULED`, then revalidates `/orders` and `/deliveries`.
  - `updateDeliveryProgressAction` validates `updateDeliveryProgressSchema`, updates delivery status/items/notes, updates order delivery summary, logs `DELIVERY_UPDATED`, then revalidates `/orders` and `/deliveries`.
- `lib/validation/orders.ts`
  - `createDeliverySchema` validates delivery scheduling payload.
  - `updateDeliveryProgressSchema` validates delivery lifecycle updates.
- `app/(dashboard)/deliveries/page.tsx`
  - Read-only delivery tracking page with filters and a table.
  - Does not currently update schedule or assignment.
- `app/(dashboard)/orders/page.tsx`
  - Fetches active staff for filtering.
  - Selects delivery `assignedStaff.displayName` for display.
  - Builds `OrderWorkspace` data from order/delivery records.

## Proposed Database Changes

Do not make these changes yet. Proposed future Prisma additions:

- Add `GoogleCalendarConnection`
  - `id`
  - `userId` unique relation to `UserProfile`
  - `googleAccountEmail`
  - `calendarId` defaulting to `"primary"` unless user chooses another calendar
  - encrypted `accessToken`
  - encrypted `refreshToken`
  - `accessTokenExpiresAt`
  - `scope`
  - `connectedAt`
  - `disconnectedAt`
  - `lastSyncAt`
  - `lastSyncStatus`
  - `lastSyncError`
- Add calendar sync metadata to `Delivery`
  - `googleCalendarEventId`
  - `googleCalendarId`
  - `googleCalendarUserId`
  - `googleCalendarSyncedAt`
  - `googleCalendarSyncStatus`
  - `googleCalendarSyncError`
  - Index `googleCalendarUserId` and `googleCalendarEventId`.
- Consider `GoogleCalendarSyncLog`
  - Useful if delivery sync failures need auditability without overwriting the latest error.
  - Fields: `deliveryId`, `userId`, `action`, `status`, `error`, `createdAt`.

## Proposed Server Actions / API Routes

- OAuth routes
  - `app/api/google-calendar/connect/route.ts`
    - Requires active user.
    - Starts OAuth with `state` containing CSRF-safe nonce and intended user ID.
  - `app/api/google-calendar/callback/route.ts`
    - Verifies state.
    - Exchanges code for tokens.
    - Stores encrypted tokens for the signed-in `UserProfile`.
    - Revalidates `/users`.
  - `app/actions/google-calendar.ts`
    - `disconnectGoogleCalendarAction`
    - Optional `testGoogleCalendarConnectionAction`
    - Permission: a user can disconnect their own calendar; admins may disconnect any user if desired.
- Delivery sync service
  - `lib/google-calendar/client.ts`
    - Builds Google OAuth/calendar clients from env vars and stored tokens.
    - Refreshes tokens and persists refreshed access tokens.
  - `lib/google-calendar/delivery-events.ts`
    - Maps `Delivery + Order + Items` into Google Calendar event title, description, location, start/end.
    - Parses `scheduledTimeWindow` conservatively. If no precise time exists, create an all-day event for `scheduledDate`.
  - `lib/google-calendar/delivery-sync.ts`
    - `syncDeliveryCalendarEvent(deliveryId, txOrPrisma?)`
    - Creates event when delivery is scheduled and assigned user has a connection.
    - Updates event when schedule/recipient/provider/items/status change.
    - Cancels/deletes event when delivery status becomes `CANCELLED` or `FAILED`, or when assignment is removed.
- Existing actions integration
  - After `createDeliveryAction` transaction commits, call sync for the new delivery.
  - After `updateDeliveryProgressAction` transaction commits, call sync/cancel based on status.
  - If a later action adds schedule/assignment editing, call sync there too.

## Proposed Env Variables

Existing env handling is direct `process.env` access in Supabase/Cloudinary helpers, with runtime errors for required server-only credentials. Follow that style initially.

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`
- `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`
- Optional: `GOOGLE_CALENDAR_DEFAULT_EVENT_DURATION_MINUTES`, default `120`
- Optional: `GOOGLE_CALENDAR_TIMEZONE`, default `"Asia/Manila"`

OAuth scope should be minimal, likely `https://www.googleapis.com/auth/calendar.events`.

## Proposed Sync Flow

1. User opens Users page and clicks Connect Calendar.
2. App redirects to Google OAuth.
3. Callback stores encrypted tokens in `GoogleCalendarConnection`.
4. Staff schedules delivery from Orders.
5. Delivery action creates the `Delivery` record.
6. Sync service loads delivery with order, customer, items, and `assignedStaff.googleCalendarConnection`.
7. If no assigned staff or no calendar connection, mark sync as skipped and keep delivery saved.
8. If connected, create Google event in that user's calendar and store event metadata on `Delivery`.
9. On delivery updates, update the existing event.
10. On `CANCELLED` or `FAILED`, delete or cancel the Google event and mark sync status accordingly.

Recommended event content:
- Title: `Delivery: {orderNumber or deliveryNumber} - {customerDisplayNameSnapshot}`
- Date/time: all-day for date-only schedules, timed event when a parseable time window exists.
- Location: `deliveryAddressSnapshot.addressLine`
- Description: delivery number, order number, provider, recipient, phone, item summary, internal link to order.

## Risks And Edge Cases

- Delivery assignment is not currently captured in `DeliveryForm`; sync needs an assigned user before it can target a personal calendar.
- Existing `createDeliveryAction` does not set `assignedStaffId`; current display may fall back to customer assigned staff or creator, but Google sync should use an explicit delivery assignee.
- OAuth tokens must be encrypted at rest.
- Google API failures should not roll back delivery scheduling. Save the delivery, record sync failure, show reconnect/retry status.
- Token refresh can fail if user revokes access; mark connection disconnected or needs reconnect.
- Calendar event timing is ambiguous because `scheduledTimeWindow` is free text. Date-only all-day events are safer until structured start/end fields exist.
- Reassignment requires deleting/cancelling the old user's event and creating one for the new assigned user.
- Duplicate event creation can happen if retries run after a partial failure; use stored `googleCalendarEventId` and idempotent sync logic.
- Users may connect a Google account whose email differs from their system email; display this clearly.
- Admin permissions need careful handling so one user cannot connect OAuth credentials for another user accidentally.

## Phased Implementation Checklist

### Phase 1: Data Model And Token Storage

- Add `GoogleCalendarConnection` model.
- Add delivery calendar event metadata fields.
- Add encryption helpers and tests for token encryption/decryption.
- Add env validation helper for Google Calendar server credentials.

### Phase 2: Users Page Connection UI

- Extend `app/(dashboard)/users/page.tsx` query to include calendar connection status.
- Extend `ManagedUser` in `components/dashboard/user-management.tsx`.
- Add calendar connection status to the user table.
- Add connect/reconnect/disconnect controls in the edit form or a dedicated user calendar section.

### Phase 3: OAuth Routes

- Add connect and callback route handlers.
- Store state nonce securely.
- Exchange authorization code for tokens.
- Save encrypted token data for the signed-in user.
- Add disconnect action.

### Phase 4: Delivery Assignment Support

- Add `assignedStaffId` to `createDeliverySchema`.
- Add assigned staff selector to `DeliveryForm`.
- Pass active staff options from `app/(dashboard)/orders/page.tsx` into `OrderWorkspace`.
- Persist `assignedStaffId` in `createDeliveryAction`.
- Keep existing permission checks: `DELIVERIES CREATE` for scheduling, `DELIVERIES UPDATE` for changes.

### Phase 5: Calendar Event Sync

- Add Google Calendar client wrapper.
- Add delivery-to-event mapping.
- Add create/update/cancel sync functions.
- Trigger sync after delivery creation and progress updates.
- Record sync status and errors on `Delivery`.

### Phase 6: Retry And Observability

- Add manual retry action for failed syncs.
- Show sync status in delivery details and/or Users page.
- Add `ActivityLog` or `GoogleCalendarSyncLog` entries for sync failures.
- Add tests for skipped sync, create, update, cancel, token refresh, and revoked access.

### Phase 7: Validation

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm test`.
- Manually verify OAuth connect/disconnect on a local Google OAuth test app.
- Manually verify schedule, update, cancel, and reassignment flows against a test calendar.
