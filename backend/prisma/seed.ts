/**
 * AeroComm — Prisma Seed File
 * /prisma/seed.ts
 *
 * Seeds:
 *   1. Demo tenant (charter company)
 *   2. Admin user with MFA placeholder
 *   3. Notification templates (S01–S08) — SMS content
 *   4. Automation rules (S01–S08) wired to triggers, conditions, and actions
 *
 * Run: npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant_aerocomm_demo";
const ADMIN_USER_ID = "user_admin_demo";

/**
 * All variable tokens available for interpolation in templates.
 * The automation builder UI renders these as an autocomplete picker.
 */
const TEMPLATE_VARIABLES = [
  // Passenger
  { token: "{{passenger.firstName}}", description: "Passenger first name", entityType: "CONTACT" },
  { token: "{{passenger.lastName}}", description: "Passenger last name", entityType: "CONTACT" },
  { token: "{{passenger.phone}}", description: "Passenger phone number", entityType: "CONTACT" },
  // Trip
  { token: "{{trip.departureDate}}", description: "Departure date (formatted)", entityType: "TRIP" },
  { token: "{{trip.departureTime}}", description: "Departure time (formatted)", entityType: "TRIP" },
  { token: "{{trip.boardingTime}}", description: "Boarding time (30 min before dep.)", entityType: "TRIP" },
  { token: "{{trip.fboName}}", description: "FBO / terminal name", entityType: "TRIP" },
  { token: "{{trip.fboAddress}}", description: "FBO full address", entityType: "TRIP" },
  { token: "{{trip.pilots}}", description: "Pilot name(s) for outbound leg", entityType: "TRIP" },
  { token: "{{trip.returnTime}}", description: "Return flight departure time", entityType: "TRIP" },
  { token: "{{trip.returnPilots}}", description: "Pilot name(s) for return leg", entityType: "TRIP" },
  { token: "{{trip.returnFbo}}", description: "Return leg FBO name", entityType: "TRIP" },
  { token: "{{trip.surveyLink}}", description: "Post-trip feedback survey URL", entityType: "TRIP" },
  // Tenant
  { token: "{{tenant.companyName}}", description: "Charter company name", entityType: "TENANT" },
  { token: "{{tenant.supportPhone}}", description: "Charter company support phone", entityType: "TENANT" },
  { token: "{{tenant.supportEmail}}", description: "Charter company support email", entityType: "TENANT" },
];

/**
 * The 8 SMS notification templates (S01–S08).
 * Body uses {{token}} syntax — interpolated at send time by the
 * NotificationTemplateEngine in /src/modules/notifications/templateEngine.ts
 */
const SMS_TEMPLATES = [
  {
    id: "tmpl_s01_booking_confirmation",
    name: "S01 – Booking Confirmation",
    channel: "SMS",
    subject: null,
    body: "✈️ Your trip is confirmed! Thank you for booking with {{tenant.companyName}}. If you have any special requests (snacks, pillows, etc.), reply here or contact our team. We're excited to serve you!",
    description: "Sent immediately when a trip is marked BOOKED.",
  },
  {
    id: "tmpl_s02_7day_reminder",
    name: "S02 – 7-Day Pre-Flight Reminder",
    channel: "SMS",
    subject: null,
    body: "👋 Looking forward to your upcoming flight on {{trip.departureDate}}! Please confirm any catering, special requests, or changes in passenger list by replying to this message.",
    description: "Sent 7 days before departure.",
  },
  {
    id: "tmpl_s03_2day_reminder",
    name: "S03 – 2-Day Reminder",
    channel: "SMS",
    subject: null,
    body: "✅ Just two days to go! Please confirm if you have any updates or special requests for your flight on {{trip.departureDate}}. We're reviewing your itinerary to ensure everything is perfect.",
    description: "Sent 48 hours before departure.",
  },
  {
    id: "tmpl_s04_day_before_itinerary",
    name: "S04 – Day-Before Itinerary",
    channel: "SMS",
    subject: null,
    body: "📋 Your flight departs tomorrow.\n• Pilot(s): {{trip.pilots}}\n• Departure Time: {{trip.departureTime}}\n• Location: {{trip.fboName}} — {{trip.fboAddress}}\nLet us know if you need anything!",
    description: "Sent 24 hours before departure with full itinerary.",
  },
  {
    id: "tmpl_s05_2hr_boarding",
    name: "S05 – 2-Hour Boarding Call",
    channel: "SMS",
    subject: null,
    body: "🛫 Final boarding prep! Your flight departs in 2 hours. Please arrive at {{trip.fboName}} by {{trip.boardingTime}}. For assistance, contact {{tenant.companyName}}: {{tenant.supportPhone}}.",
    description: "Sent 2 hours before departure.",
  },
  {
    id: "tmpl_s06_return_reminder",
    name: "S06 – Return Flight Reminder",
    channel: "SMS",
    subject: null,
    body: "🔄 Reminder: Your return flight is scheduled for today at {{trip.returnTime}}.\n• Pilot(s): {{trip.returnPilots}}\n• Departure FBO: {{trip.returnFbo}}\nPlease arrive 30 minutes prior to departure.",
    description: "Sent 2 hours before the return leg (round trips only).",
  },
  {
    id: "tmpl_s07_post_trip_thankyou",
    name: "S07 – Post-Trip Thank You",
    channel: "SMS",
    subject: null,
    body: "🙏 Thank you for flying with {{tenant.companyName}}! We hope your experience was exceptional. We'd love your feedback: {{trip.surveyLink}}. Safe travels until next time!",
    description: "Sent the day after the trip is marked COMPLETED (clamped to 9:00 AM local).",
  },
  {
    id: "tmpl_s08_weather_delay",
    name: "S08 – Weather / Ops Delay",
    channel: "SMS",
    subject: null,
    body: "⚠️ Update: Due to weather or operational conditions, your flight may be affected. Our team will contact you shortly with revised details. Your safety is our priority.",
    description: "Sent immediately when a trip delay flag is raised.",
  },
];

/**
 * Automation rule definitions for S01–S08.
 *
 * Delay strategy for time-offset triggers:
 *   - Actions are scheduled via Azure Service Bus scheduled messages.
 *   - The automationEngine resolves `delayRelativeTo` + `delayOffsetMs`
 *     at trigger time to compute the exact enqueue timestamp.
 *   - This survives app restarts (no in-memory timers).
 *
 * delayRelativeTo values:
 *   "trip.departureAt"    → trip departure timestamp
 *   "trip.returnAt"       → return leg departure timestamp
 *   "trip.completedAt"    → when trip was marked COMPLETED
 *   null                  → no delay (execute immediately)
 */
const AUTOMATION_RULES = [
  // ── S01: Booking Confirmation ─────────────────────────────────────────────
  {
    id: "auto_s01_booking_confirmation",
    name: "S01 – Booking Confirmation SMS",
    description: "Immediately confirms the trip booking via SMS to all passengers.",
    enabled: true,
    trigger: {
      eventType: "TRIP_STATUS_CHANGED",
      filters: { toStatus: "BOOKED" },
    },
    conditionGroups: [], // No additional conditions — fire for all bookings
    actions: [
      {
        sequence: 1,
        actionType: "SEND_SMS",
        delayRelativeTo: null,
        delayOffsetMs: 0,
        config: {
          recipientType: "TRIP_PASSENGERS",
          templateId: "tmpl_s01_booking_confirmation",
        },
      },
    ],
  },

  // ── S02: 7-Day Reminder ───────────────────────────────────────────────────
  {
    id: "auto_s02_7day_reminder",
    name: "S02 – 7-Day Pre-Flight Reminder SMS",
    description: "Reminds passengers 7 days before departure to confirm requests.",
    enabled: true,
    trigger: {
      eventType: "TRIP_STATUS_CHANGED",
      filters: { toStatus: "BOOKED" },
    },
    conditionGroups: [],
    actions: [
      {
        sequence: 1,
        actionType: "SEND_SMS",
        delayRelativeTo: "trip.departureAt",
        delayOffsetMs: -7 * 24 * 60 * 60 * 1000, // -7 days
        config: {
          recipientType: "TRIP_PASSENGERS",
          templateId: "tmpl_s02_7day_reminder",
        },
      },
    ],
  },

  // ── S03: 2-Day Reminder ───────────────────────────────────────────────────
  {
    id: "auto_s03_2day_reminder",
    name: "S03 – 2-Day Pre-Flight Reminder SMS",
    description: "Final reminder 48 hours before departure.",
    enabled: true,
    trigger: {
      eventType: "TRIP_STATUS_CHANGED",
      filters: { toStatus: "BOOKED" },
    },
    conditionGroups: [],
    actions: [
      {
        sequence: 1,
        actionType: "SEND_SMS",
        delayRelativeTo: "trip.departureAt",
        delayOffsetMs: -48 * 60 * 60 * 1000, // -48 hours
        config: {
          recipientType: "TRIP_PASSENGERS",
          templateId: "tmpl_s03_2day_reminder",
        },
      },
    ],
  },

  // ── S04: Day-Before Itinerary ─────────────────────────────────────────────
  {
    id: "auto_s04_day_before",
    name: "S04 – Day-Before Itinerary SMS",
    description: "Sends full itinerary with pilot and FBO details 24 hours out.",
    enabled: true,
    trigger: {
      eventType: "TRIP_STATUS_CHANGED",
      filters: { toStatus: "BOOKED" },
    },
    conditionGroups: [],
    actions: [
      {
        sequence: 1,
        actionType: "SEND_SMS",
        delayRelativeTo: "trip.departureAt",
        delayOffsetMs: -24 * 60 * 60 * 1000, // -24 hours
        config: {
          recipientType: "TRIP_PASSENGERS",
          templateId: "tmpl_s04_day_before_itinerary",
        },
      },
    ],
  },

  // ── S05: 2-Hour Boarding Call ─────────────────────────────────────────────
  {
    id: "auto_s05_2hr_boarding",
    name: "S05 – 2-Hour Boarding Call SMS",
    description: "Final boarding instructions sent 2 hours before departure.",
    enabled: true,
    trigger: {
      eventType: "TRIP_STATUS_CHANGED",
      filters: { toStatus: "BOOKED" },
    },
    conditionGroups: [],
    actions: [
      {
        sequence: 1,
        actionType: "SEND_SMS",
        delayRelativeTo: "trip.departureAt",
        delayOffsetMs: -2 * 60 * 60 * 1000, // -2 hours
        config: {
          recipientType: "TRIP_PASSENGERS",
          templateId: "tmpl_s05_2hr_boarding",
        },
      },
    ],
  },

  // ── S06: Return Flight Reminder ───────────────────────────────────────────
  {
    id: "auto_s06_return_reminder",
    name: "S06 – Return Flight Reminder SMS",
    description: "Reminds passengers of return leg 2 hours before return departure. Only fires for round trips.",
    enabled: true,
    trigger: {
      eventType: "TRIP_STATUS_CHANGED",
      filters: { toStatus: "DEPARTED" },
    },
    conditionGroups: [
      {
        // Only fire if the trip has a return leg
        operator: "AND",
        conditions: [
          {
            field: "trip.returnAt",
            operator: "IS_NOT_EMPTY",
            value: null,
          },
        ],
      },
    ],
    actions: [
      {
        sequence: 1,
        actionType: "SEND_SMS",
        delayRelativeTo: "trip.returnAt",
        delayOffsetMs: -2 * 60 * 60 * 1000, // -2 hours from return leg
        config: {
          recipientType: "TRIP_PASSENGERS",
          templateId: "tmpl_s06_return_reminder",
        },
      },
    ],
  },

  // ── S07: Post-Trip Thank You ──────────────────────────────────────────────
  {
    id: "auto_s07_post_trip",
    name: "S07 – Post-Trip Thank You & Survey SMS",
    description: "Sends thank-you and feedback survey link the morning after trip completion.",
    enabled: true,
    trigger: {
      eventType: "TRIP_STATUS_CHANGED",
      filters: { toStatus: "COMPLETED" },
    },
    conditionGroups: [],
    actions: [
      {
        sequence: 1,
        actionType: "SEND_SMS",
        /**
         * Delay: +1 day from completedAt, clamped to 9:00 AM local tenant time.
         * The AutomationEngine resolves this using:
         *   1. completedAt + 1 day
         *   2. Set hour to 09:00 in tenant.timezone
         *   3. If resulting time is already past, advance to next day 09:00
         */
        delayRelativeTo: "trip.completedAt",
        delayOffsetMs: 24 * 60 * 60 * 1000, // +1 day — engine clamps to 9 AM
        config: {
          recipientType: "TRIP_PASSENGERS",
          templateId: "tmpl_s07_post_trip_thankyou",
          clampToHour: 9, // Instruct engine to clamp delivery to 9:00 AM local
        },
      },
    ],
  },

  // ── S08: Weather / Ops Delay ──────────────────────────────────────────────
  {
    id: "auto_s08_weather_delay",
    name: "S08 – Weather / Operational Delay SMS",
    description: "Immediately alerts all passengers when a trip delay flag is raised.",
    enabled: true,
    trigger: {
      eventType: "TRIP_DELAY_FLAGGED",
      filters: {}, // Fires for any delay type (weather, ops, mechanical)
    },
    conditionGroups: [],
    actions: [
      {
        sequence: 1,
        actionType: "SEND_SMS",
        delayRelativeTo: null,
        delayOffsetMs: 0, // Immediate
        config: {
          recipientType: "TRIP_PASSENGERS",
          templateId: "tmpl_s08_weather_delay",
        },
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function seedTenant() {
  console.log("🏢  Seeding demo tenant...");
  return prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: "AeroComm Demo Charter Co.",
      slug: "aerocomm-demo",
      timezone: "America/Chicago",
      supportPhone: "+18005550100",
      supportEmail: "support@demo.aerocomm.io",
      isActive: true,
    },
  });
}

async function seedAdminUser() {
  console.log("👤  Seeding admin user...");
  const hashedPassword = await argon2.hash("ChangeMe123!", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  return prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    update: {},
    create: {
      id: ADMIN_USER_ID,
      tenantId: TENANT_ID,
      email: "admin@demo.aerocomm.io",
      firstName: "Demo",
      lastName: "Admin",
      passwordHash: hashedPassword,
      role: "COMPANY_ADMIN",
      isActive: true,
      mfaSettings: {
        create: {
          totpEnabled: false,
          smsEnabled: false,
          // Populate totpSecret after first login via /auth/mfa/setup
        },
      },
    },
  });
}

async function seedTemplateVariables() {
  console.log("📋  Seeding template variables...");
  for (const variable of TEMPLATE_VARIABLES) {
    await prisma.templateVariable.upsert({
      where: { token: variable.token },
      update: {},
      create: variable,
    });
  }
}

async function seedNotificationTemplates() {
  console.log("📨  Seeding SMS notification templates (S01–S08)...");
  for (const template of SMS_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { id: template.id },
      update: {
        body: template.body,
        description: template.description,
      },
      create: {
        ...template,
        tenantId: TENANT_ID,
        isSystem: true, // System templates can be cloned but not deleted
        createdById: ADMIN_USER_ID,
      },
    });
  }
}

async function seedAutomationRules() {
  console.log("⚙️   Seeding automation rules (S01–S08)...");

  for (const rule of AUTOMATION_RULES) {
    // Upsert the parent automation record
    const automation = await prisma.automation.upsert({
      where: { id: rule.id },
      update: {
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
      },
      create: {
        id: rule.id,
        tenantId: TENANT_ID,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        isSystem: true, // Pre-built; cloneable but not deletable by users
        createdById: ADMIN_USER_ID,
      },
    });

    // Upsert the trigger
    await prisma.automationTrigger.upsert({
      where: { automationId: automation.id },
      update: {
        eventType: rule.trigger.eventType as never,
        filters: JSON.stringify(rule.trigger.filters),
      },
      create: {
        automationId: automation.id,
        eventType: rule.trigger.eventType as never,
        filters: JSON.stringify(rule.trigger.filters),
      },
    });

    // Delete and re-create condition groups (simpler than full upsert on nested)
    await prisma.automationConditionGroup.deleteMany({
      where: { automationId: automation.id },
    });

    for (const group of rule.conditionGroups) {
      const conditionGroup = await prisma.automationConditionGroup.create({
        data: {
          automationId: automation.id,
          operator: group.operator as never,
        },
      });

      for (const condition of group.conditions) {
        await prisma.automationCondition.create({
          data: {
            conditionGroupId: conditionGroup.id,
            field: condition.field,
            operator: condition.operator as never,
            value: condition.value ? String(condition.value) : null,
          },
        });
      }
    }

    // Delete and re-create actions
    await prisma.automationAction.deleteMany({
      where: { automationId: automation.id },
    });

    for (const action of rule.actions) {
      await prisma.automationAction.create({
        data: {
          automationId: automation.id,
          sequence: action.sequence,
          actionType: action.actionType,
          delayRelativeTo: action.delayRelativeTo,
          delayOffsetMs: action.delayOffsetMs,
          config: JSON.stringify(action.config),
        },
      });
    }

    console.log(`   ✓ ${rule.name}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱  AeroComm database seed starting...\n");

  await seedTenant();
  await seedAdminUser();
  await seedTemplateVariables();
  await seedNotificationTemplates();
  await seedAutomationRules();

  console.log("\n✅  Seed complete.\n");
  console.log("   Demo tenant  : AeroComm Demo Charter Co.");
  console.log("   Admin login  : admin@demo.aerocomm.io");
  console.log("   Password     : ChangeMe123!  ← change immediately after first login");
  console.log("   MFA          : Not yet configured — complete setup at /settings/security\n");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
