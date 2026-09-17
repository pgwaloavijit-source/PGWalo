

Build/rework the **Super Admin system** in the existing PGWalo application.

**Important:** Current changes are committed. First inspect the existing code, database, authentication, roles and admin-related UI. Reuse anything production-quality and compatible. Replace/remove incomplete, duplicate or poorly implemented admin functionality. Do not break existing owner/tenant/user flows.

## 1. Super Admin Login

Create a dedicated Super Admin login flow.

**Login options:**

* Phone: `7070696968`
* PIN: `111111`
* Username: `PGWalo.Avijit`
* Password: `1q2w3e4r5t`

Credentials must be configurable through environment/secrets, not hardcoded in frontend code.

Flow:
`Footer → Super Admin Login → Admin Authentication → Authorization Check → Dashboard`

Requirements:

* Separate admin authentication/role.
* Secure session/token handling.
* Protected admin routes.
* Non-admin users cannot access admin pages by manually entering URLs.
* Logout.
* Handle invalid credentials/session expiry.
* Keep normal user login unchanged.

## 2. Admin Layout

Create a consistent admin layout:

**Sidebar**

* Dashboard
* Users
* PG Owners
* Tenants
* Properties / PGs
* Rooms & Allocations
* Bookings
* Agreements
* Payments/Transactions
* Tickets
* Reports
* Analytics
* Notifications
* Admin Settings

**Top bar**

* Search
* Notifications
* Admin profile
* Logout

Make sidebar responsive and collapse appropriately on smaller screens.

## 3. Dashboard

Dashboard should provide an application-wide overview.

Show:

* Total Users
* Total Owners
* Total Tenants
* Total PGs
* Total Rooms
* Occupied Rooms
* Available Rooms
* Pending Approvals
* Active Bookings
* Revenue/Payments summary if payment data exists
* Open Tickets
* Pending Agreements
* Recent registrations
* Recent bookings/allocations
* Recent tickets
* Recent admin actions

Use real database data. Do not use fake/static numbers.

Provide date filters such as:
`Today / 7 Days / 30 Days / 3 Months / Custom`

## 4. Users Management

Admin can:

* View all users
* Search
* Filter by role/status
* Open user profile
* View account information
* View activity/related records
* Activate/deactivate account
* Manage appropriate permissions

Statuses:
`Active / Disabled / Suspended` where supported.

Do not permanently delete important transactional records unless the existing data model explicitly supports safe deletion.

## 5. PG Owner Management

Admin can:

* View all owners
* View owner profile
* View their PG/property listings
* View verification/approval status
* View rooms
* View allocations/bookings
* View agreements
* View tickets
* Enable/disable owner account
* Approve/reject listings where applicable

Show clear status:
`Pending / Approved / Rejected / Disabled`

## 6. Property / PG Management

Admin can manage every PG/property.

For each property show:

* Owner
* Property details
* Location
* Amenities
* Photos
* Description
* Rooms
* Pricing
* Availability
* Occupancy
* Listing status
* Approval status
* Created/updated dates

Actions:

* View
* Approve
* Reject
* Disable/unpublish
* Edit where appropriate

Use existing property/listing data instead of creating duplicate models.

## 7. Rooms & Allocation Control

Admin must have visibility/control over rooms.

Show:

* PG
* Room number/name
* Room type
* Capacity
* Current occupants
* Available beds
* Price
* Status

Allocation workflow:

`Tenant request → Pending → Admin/Owner review → Approved → Allocated`

Admin can:

* Approve/reject allocation
* View allocation history
* Reassign where business rules allow
* See conflicts
* Track vacancies

Never allow allocation actions that violate existing capacity/business rules.

## 8. Bookings

Admin can view all bookings.

Filters:

* Date
* PG
* Owner
* Tenant
* Status

Show:

* Booking details
* Tenant
* Property
* Room
* Amount
* Dates
* Status
* Related agreement/payment/ticket

Do not duplicate booking logic already implemented.

## 9. Agreements

Admin should be able to:

* View agreement records
* See owner/tenant
* See property/room
* View agreement status
* View/download available agreements
* Track pending/completed agreements

Existing owner/tenant agreement functionality must continue working.

## 10. Payments / Transactions

If payment data already exists, provide:

* Total transactions
* Revenue
* Pending payments
* Successful payments
* Failed/refunded payments
* Transaction history

Filters:
`Date / Owner / Tenant / PG / Status`

If payments are not implemented in the application, create the admin structure without inventing fake financial data.

## 11. Ticketing System

Every user type can create support tickets.

Ticket fields:

* Category/type
* Subject
* Description
* Image/attachment
* User
* Related PG/property/booking if applicable
* Created date

Admin ticket screen:

* All tickets
* Search/filter
* Open ticket
* View conversation/details
* Assign/handle ticket
* Add response
* Change status

Statuses:
`Raised → Open → Resolved → Closed`

Users must be able to see their ticket status and responses.

## 12. Reports

Create report views based on real data.

Useful reports:

* User registrations
* Owner registrations
* PG/listing growth
* Occupancy
* Room availability
* Booking trends
* Allocation trends
* Revenue/payment trends if available
* Ticket trends
* Agreement completion
* Disabled/suspended accounts

Allow filtering by date and relevant entity.

Add export functionality only if compatible with the existing application architecture.

## 13. Analytics

Create an analytics section with charts/cards using real data.

Examples:

* User growth
* Owner growth
* PG growth
* Occupancy percentage
* Booking trends
* Revenue trends
* Ticket volume/status
* Agreement completion
* Geographic/property distribution if location data exists

Analytics must be calculated from actual stored data.

Avoid unnecessary charts. Prioritize useful operational metrics.

## 14. Notifications

Admin should see important events such as:

* New owner registration
* New PG/listing awaiting approval
* Allocation request
* New ticket
* Payment issue
* Agreement pending
* Other existing application alerts

Use the application's existing notification infrastructure if available.

## 15. Admin Activity / Audit Log

Track important admin actions:

* Login/logout
* Account enable/disable
* Listing approval/rejection
* Allocation approval/rejection
* Ticket status changes
* Important edits
* Other destructive/administrative actions

Store:
`Admin + action + target + timestamp + relevant details`

Provide an admin activity screen.

## 16. Admin Settings

Create settings for:

* Admin profile
* Credentials/security configuration
* Session/security settings where supported
* Application-level configuration that is already supported

Never expose secrets in client-side code.

## 17. Data & Architecture Rules

Before implementing:

1. Inspect existing database/schema/models.
2. Inspect existing authentication/RBAC.
3. Inspect existing owner/tenant/property/room/booking/agreement/ticket models.
4. Reuse existing APIs/services/components where good.
5. Remove duplicate admin implementations.
6. Add only missing models/endpoints/components.
7. Keep one source of truth for every entity.
8. Use real data everywhere.
9. Enforce authorization on the backend/server, not only by hiding frontend buttons.

## 18. Final Validation

Test the complete workflow:

`Super Admin Login
→ Dashboard
→ Users
→ Owners
→ Properties
→ Rooms
→ Allocations
→ Bookings
→ Agreements
→ Payments
→ Tickets
→ Reports
→ Analytics
→ Notifications
→ Audit Logs
→ Settings
→ Logout`

Also verify that:

* Normal users cannot access admin routes.
* Existing owner/tenant functionality still works.
* Existing data is preserved.
* No duplicate/conflicting implementations remain.
* Responsive UI works.
* Loading/empty/error states are handled.
* Build, lint, typecheck and available tests pass.

**Do not commit changes. At completion, provide a concise summary of:**

1. Existing functionality reused
2. Functionality replaced/removed
3. New functionality added
4. Database/API changes
5. Tests performed
6. Remaining issues
