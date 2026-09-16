# PGNest - PG & Hostel Management System
## Current Workflow, Features, Architecture & State Machine Documentation

*Generated: September 2026*  
*Application Environment: React 18+ (Vite, TypeScript, Tailwind CSS, Lucide Icons)*

---

## 1. Executive Summary & Product Architecture

**PGNest** is an end-to-end PG (Paying Guest) and Co-Living accommodation management ecosystem. The platform serves three distinct audiences through a shared reactive context:
1. **Public Prospects & Applicants**: Searching verified PG properties, scheduling in-person tours, and submitting bed booking applications.
2. **Tenants / Residents**: Tracking upcoming visits, monitoring application approval status, paying rent online, accessing mess menus, recording gate attendance, chatting with property managers, and raising maintenance tickets.
3. **PG Owners & Property Managers**: Managing multi-floor room and bed matrices, reviewing booking inquiries, allocating rooms, managing staff tasks, tracking rent collections, and broadcasting emergency announcements.

The application follows a **state-driven design**: features, navigation tabs, buttons, and permissions dynamically lock or unlock based on the user's role and lifecycle stage.

---

## 2. User Roles & Access Hierarchy

The application maintains discrete access levels:

| Role | Primary Scope | Permitted Operations | Restricted Operations |
| :--- | :--- | :--- | :--- |
| **Public / Guest** | Discovery & Booking | Search properties, filter by budget/sharing, schedule visits, apply for stay | Cannot view internal resident dashboards, room codes, or financial ledgers |
| **Prospective Resident (Unallocated)** | Tour & Application Tracking | View scheduled visits (Upcoming vs Past), reschedule/cancel tours, view booking application status | Gated from Rent, Room Services, Gate Attendance, Food Menu, Maintenance & Chat until room is approved |
| **Active Resident** | Full Resident Portal | View room & bed details, pay monthly rent (UPI/Card simulation), download receipts, biometric check-in/out, view daily 4-meal plan, submit tickets, chat with manager | Cannot access owner operational console or edit other residents' details |
| **PG Owner / Landlord** | Full Business Operations | Real-time occupancy analytics, room/bed inventory matrix, approve/reject bookings, assign beds, log expenses, manage staff, broadcast announcements | Bound to property operational scopes |
| **Manager / Staff** | Daily Floor Operations | Review assigned maintenance tickets, update room cleaning status, confirm move-ins, log gate entries | Cannot alter ownership settings or delete properties |

---

## 3. Master Resident & Booking Lifecycle (State Machine)

The application enforces a strict state machine to prevent unauthorized access or premature room assignment:

```text
               [ Public User ]
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
    Schedule Visit         Book Stay / Bed
           │                     │
           ▼                     ▼
     [ Visit: Confirmed ]   [ Booking: Pending Approval ]
           │                     │
     (Tour PG Campus)            │ (Owner / Caretaker reviews inventory)
           │                     │
           └──────────► ◄────────┘
                         │
              [ Owner Approval & Bed Allocation ]
                         │  (Assigns Room 204, Bed A)
                         ▼
             [ State: Active Resident ]
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   [ Rent Ledger ]  [ Attendance ]  [ Maintenance & Chat ]
        │
   (Submit Notice of Vacating)
        │
        ▼
   [ Notice Period ] ──► [ Checkout Settlement ] ──► [ Archived ]
```

### Detailed Lifecycle Stages:

1. **Lead / Tour Phase (`visit`)**:
   - Applicant selects an inspection date and time slot (`10:00 AM - 12:00 PM` or `04:00 PM - 06:00 PM`).
   - System generates a gate pass reference ID (e.g., `PGN-VIS-XXXXX`).
   - Scheduled tours appear in the resident's **"My Scheduled Visits"** view, categorised into **Upcoming** and **Past**.
   - The user can **Reschedule** (date/slot picker) or **Cancel** the tour.

2. **Stay Application (`booking` - Pending Approval)**:
   - Prospect selects sharing type (`Single`, `Double`, `Triple`), preferred move-in date, and occupancy type (Student / Professional).
   - Application status is set to `Pending Owner / Caretaker Approval`.
   - **Gating Enforced**: The resident's dashboard locks operational tabs (**My Stay**, **Rent**, **Attendance**, **Menu**, **Chat**, **Tickets**) and presents a clear status banner.

3. **Caretaker Approval & Room Allocation**:
   - The property owner reviews the applicant from the Owner Console.
   - Upon clicking **Approve & Allocate**, the system binds the applicant to a designated room and bed (e.g., Room 204, Bed A).
   - A broadcast announcement welcomes the resident, and their profile is promoted to `Active Resident`.
   - *Test Mode Feature*: A quick-approval shortcut (`⚡ [Test Mode] Approve & Assign Room 204`) is available directly on pending application cards for instant testing.

4. **Active Residency**:
   - The full Resident Portal unlocks immediately.
   - Access to digital rent receipts, gate entry logging, mess menus, and manager messaging is enabled.

---

## 4. Feature Matrix by Module

### 4.1. Public Property Discovery
- **Live Search & Geolocation Filtering**: Filter by City/Locality (Koramangala, HSR Layout, Indiranagar, Whitefield, Bellandur, Electronic City).
- **Budget & Sharing Filters**: Single, Double, Triple sharing, price sliders, AC / Non-AC toggles, and Food-included filters.
- **Detailed PG Modal**:
  - Image galleries and verified badges.
  - Room pricing breakdowns and security deposit policies.
  - Amenity badges (High-speed WiFi, 3-Time Homestyle Meals, Daily Housekeeping, RO Water, CCTV & Biometrics, Power Backup).
  - Google Maps location preview with nearby IT parks and colleges.
  - Dual action buttons: **"Schedule Physical Visit"** and **"Book Bed Online"**.

### 4.2. Resident Portal (Gated & State-Driven)
- **Profile Onboarding**: Automatic first-login profile modal capturing full legal name, age, phone number, gender, occupation, college/office, and emergency contact details.
- **My Scheduled Visits**:
  - **Upcoming Tab**: Active appointments, date/time slot, host caretaker contact, and security gate entry pass code.
  - **Past Tab**: Concluded or cancelled visits.
  - Reschedule and cancellation actions.
- **Room Booking Applications**:
  - Real-time status cards showing `Pending Approval` or `Approved & Allocated`.
  - Direct link to property and allocated room overview.
- **Allocated Resident Features (Active State Only)**:
  - **My Stay & Room**: Allocated room number, bed identifier, move-in date, security deposit balance, roommates list, and WiFi credentials.
  - **Rent Dues & Payments**: Live rent status (`Paid` vs `Pending`), billing cycle date (`07th Every Month`), digital payment simulator (UPI / Cards / Net Banking), and downloadable PDF-style receipts with transaction IDs.
  - **Gate Attendance**: One-tap Biometric Check-In / Check-Out toggle logging real-time timestamps with history logs.
  - **Mess Food Menu**: Day-by-day weekly meal planner covering Breakfast, Lunch, Evening Snacks, and Dinner.
  - **Manager Chat**: Instant two-way messaging channel with the property owner and caretaker.
  - **Maintenance Tickets**: Category tagging (Plumbing, Electrical, WiFi, Cleaning), priority levels (Normal, Urgent), and status tracking (`Open` → `In Progress` → `Resolved`).

### 4.3. Owner & Caretaker Console
- **Action-First Dashboard**:
  - Key business metrics: Total Beds, Occupancy Rate, Collected Rent, Pending Dues, and Open Complaints.
  - Alerts: Overdue tenants, upcoming checkouts, vacant rooms.
- **Interactive Room Matrix**:
  - Visual floor-by-floor room grid with bed badges (`Bed A`, `Bed B`).
  - Color-coded bed occupancy: `Occupied` (blue/green), `Vacant` (slate), `Cleaning/Maintenance` (amber).
  - Room detail drawer showing current occupants, rental yield, and attached amenities.
- **Inquiries & Booking Requests**:
  - Incoming prospective applications with contact details, room preference, and move-in timeline.
  - One-click **Approve & Allocate** (assigns room/bed) or **Reject**.
- **Financial & Operations Management**:
  - Rent collection tracker with manual override and status toggling (`Paid` / `Pending` / `Overdue`).
  - Expense logger (Electricity, Water, WiFi, Cook Salary, Maintenance).
  - Staff assignment panel for caretakers, cleaners, and security guards.
  - Broadcast notification engine (push alerts to all residents).

---

## 5. Data Flow & State Management

All application state is managed centrally in React Context (`/src/context/AppContext.tsx`) with automatic `localStorage` synchronization:

```text
               ┌──────────────────────────────┐
               │         AppContext           │
               │   (Global Reactive Store)    │
               └──────────────┬───────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
[ User State ]       [ Inventory State ]    [ Operations State ]
 • currentUser        • properties           • tickets
 • currentResident    • residents            • attendance
 • currentRole        • bookingRequests      • mealPlan
 • profileModalOpen   • roomMatrix           • chatMessages
                                             • broadcasts
```

### Key Context Methods:
- `addBookingRequest(req)`: Submits a visit or stay booking with reference ID generation.
- `approveBookingRequest(id, room, bed)`: Promotes a pending booking into an active resident record, allocates bed/room, and updates current user state.
- `cancelBookingRequest(id)`: Marks a scheduled tour as cancelled.
- `rescheduleVisit(id, newDate, newTime)`: Updates tour appointment parameters.
- `payRentSimulation(residentId, method)`: Processes simulated payment and produces an immutable `PaymentReceipt`.
- `recordAttendance(record)`: Appends biometric gate entry/exit logs.
- `addMaintenanceTicket(ticket)`: Files a new facility maintenance ticket.
- `sendChatMessage(text, isOwner)`: Dispatches messages between resident and owner.

---

## 6. Persistence & Storage Strategy

- **Client State**: Stored in `localStorage` under `pgnest_state_v2` (or modular keys).
- **Session Continuity**: Browser refreshes retain logged-in user profiles, booking requests, payment receipts, and room allocations.
- **Account Reset**: A dedicated "Switch User / Reset Demo" button is available in the navigation bar to simulate new registrations or test different roles from scratch.

---

## 7. Responsive UI & Accessibility

- **Mobile-First Layout**: Bottom sheets and scrollable tab headers optimized for 375px+ screens; touch targets meet the minimum 44px standard.
- **Color Contrast & Typography**: High-contrast slate neutrals paired with emerald (active/paid), amber (pending/notice), and blue (primary action) accents conforming to WCAG AA.
- **Icons**: 100% SVG vector iconography powered exclusively by `lucide-react`.
