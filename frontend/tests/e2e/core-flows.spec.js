import { expect, test } from "@playwright/test";

function authSession(role) {
  return {
    access: `test-${role}-token`,
    refresh: `test-${role}-refresh-token`,
    user: {
      id: role === "user" ? 10 : 20,
      username: `${role}-tester`,
      email: `${role}@example.com`,
      role,
    },
  };
}

async function loginAs(page, role) {
  await page.addInitScript((session) => {
    sessionStorage.setItem("stadium_auth", JSON.stringify(session));
  }, authSession(role));
}

test("landing page exposes customer, staff, and admin entry points", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: /Customer portal/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Staff portal/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Admin portal/i })).toBeVisible();
});

test("wrong role is redirected to its own dashboard entry", async ({ page }) => {
  await loginAs(page, "user");

  await page.goto("/staff/dashboard");

  await expect(page).toHaveURL(/\/login$/);
});

test("customer passes show active, used, expired, and revoked states", async ({ page }) => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await loginAs(page, "user");
  await page.route("**/api/events/my-tickets/", async (route) => {
    await route.fulfill({
      json: [
        ticket(1, "Active Match", future, "approved", false),
        ticket(2, "Used Match", future, "approved", true),
        ticket(3, "Expired Match", past, "approved", false),
        ticket(4, "Revoked Match", future, "rejected", false),
      ],
    });
  });
  await page.route("**/api/notifications/", async (route) => route.fulfill({ json: [] }));

  await page.goto("/user/ticket");

  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await expect(page.getByText("Used", { exact: true })).toBeVisible();
  await expect(page.getByText("Expired", { exact: true })).toBeVisible();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
});

test("staff can open the ticket scanner page", async ({ page }) => {
  await loginAs(page, "staff");
  await page.route("**/api/notifications/", async (route) => route.fulfill({ json: [] }));
  await page.route("**/api/events/recent-ticket-scans/", async (route) => route.fulfill({ json: [] }));
  await page.route("**/api/events/ticket-scan-access/", async (route) => {
    await route.fulfill({ json: { allowed: true, role: "staff", active_duties: [] } });
  });

  await page.goto("/staff/ticket-checking");

  await expect(page.getByRole("heading", { name: "Ticket Checking" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Camera" })).toBeVisible();
});

test("staff without an active scanning duty sees access guidance", async ({ page }) => {
  await loginAs(page, "staff");
  await page.route("**/api/notifications/", async (route) => route.fulfill({ json: [] }));
  await page.route("**/api/events/recent-ticket-scans/", async (route) => route.fulfill({ json: [] }));
  await page.route("**/api/events/ticket-scan-access/", async (route) => {
    await route.fulfill({
      json: {
        allowed: false,
        role: "staff",
        active_duties: [],
        message: "You do not have an active ticket-scanning duty. Ask an admin to assign one.",
      },
    });
  });

  await page.goto("/staff/ticket-checking");

  await expect(page.getByText(/do not have an active ticket-scanning duty/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Camera" })).toBeDisabled();
});

test("staff recent scans remain visible after refresh", async ({ page }) => {
  await loginAs(page, "staff");
  await page.route("**/api/notifications/", async (route) => route.fulfill({ json: [] }));
  await page.route("**/api/events/ticket-scan-access/", async (route) => {
    await route.fulfill({ json: { allowed: true, message: "Ticket scanning is enabled." } });
  });
  await page.route("**/api/events/recent-ticket-scans/", async (route) => {
    await route.fulfill({
      json: [{
        id: 1,
        ticket_id: 42,
        status: "Valid",
        message: "Ticket verified successfully.",
        holder: "customer",
        event: "Final Match",
        scanned_at: new Date().toISOString(),
      }],
    });
  });

  await page.goto("/staff/ticket-checking");
  await expect(page.getByText("Ticket 42")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ticket 42")).toBeVisible();
});

test("scanner access updates after admin grants a duty without staff logout", async ({ page }) => {
  let checks = 0;
  await loginAs(page, "staff");
  await page.route("**/api/notifications/", async (route) => route.fulfill({ json: [] }));
  await page.route("**/api/events/recent-ticket-scans/", async (route) => route.fulfill({ json: [] }));
  await page.route("**/api/events/ticket-scan-access/", async (route) => {
    checks += 1;
    await route.fulfill({
      json: checks === 1
        ? { allowed: false, message: "You do not have an active ticket-scanning duty." }
        : { allowed: true, message: "Ticket scanning is enabled for your active duty." },
    });
  });

  await page.goto("/staff/ticket-checking");
  await expect(page.getByRole("button", { name: "Start Camera" })).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: "Start Camera" })).toBeEnabled();
});

test("expired access token refreshes inside the same browser tab", async ({ page }) => {
  await loginAs(page, "user");
  let dashboardCalls = 0;
  await page.route("**/api/refresh/", async (route) => {
    await route.fulfill({ json: { access: "renewed-user-token" } });
  });
  await page.route("**/api/dashboard/", async (route) => {
    dashboardCalls += 1;
    if (dashboardCalls === 1) {
      await route.fulfill({ status: 401, json: { detail: "Token expired" } });
      return;
    }
    await route.fulfill({
      json: { tickets_count: 0, attended_events: 0, upcoming_events: [], recent_bookings: [] },
    });
  });
  await page.route("**/api/notifications/", async (route) => route.fulfill({ json: [] }));

  await page.goto("/user/dashboard");

  await expect(page.getByRole("heading", { name: "Ready for your next stadium visit." })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("stadium_auth")).access)).toBe("renewed-user-token");
});

test("refreshing a logged-in tab keeps its role session", async ({ page }) => {
  await loginAs(page, "user");
  await page.route("**/api/dashboard/", async (route) => {
    await route.fulfill({ json: { tickets_count: 0, attended_events: 0, upcoming_events: [], recent_bookings: [] } });
  });
  await page.route("**/api/notifications/", async (route) => route.fulfill({ json: [] }));

  await page.goto("/user/dashboard");
  await expect(page.getByRole("heading", { name: "Ready for your next stadium visit." })).toBeVisible();
  await page.reload();

  await expect(page).toHaveURL(/\/user\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Ready for your next stadium visit." })).toBeVisible();
});

test("user, staff, and admin tabs keep separate role sessions after refresh", async ({ context }) => {
  const tabs = [
    { role: "user", path: "/user/dashboard" },
    { role: "staff", path: "/staff/dashboard" },
    { role: "admin", path: "/admin/dashboard" },
  ];

  for (const tab of tabs) {
    const page = await context.newPage();
    await loginAs(page, tab.role);
    await page.route("**/api/**", async (route) => {
      const url = route.request().url();
      if (url.includes("admin-dashboard-stats")) {
        await route.fulfill({ json: adminStats() });
      } else if (url.includes("staff-stats")) {
        await route.fulfill({ json: { total_revenue: 0, total_tickets: 0, upcoming_events: 0, recent_tickets: [] } });
      } else if (url.includes("ticket-scan-access")) {
        await route.fulfill({ json: { allowed: true, message: "Ticket scanning is enabled.", active_duties: [] } });
      } else if (url.includes("staff-duties")) {
        await route.fulfill({ json: [] });
      } else if (url.includes("/dashboard/")) {
        await route.fulfill({ json: { tickets_count: 0, attended_events: 0, upcoming_events: [], recent_bookings: [] } });
      } else {
        await route.fulfill({ json: [] });
      }
    });
    await page.goto(tab.path);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${tab.path.replaceAll("/", "\\/")}$`));
    await page.close();
  }
});

test("user notification popup opens notifications and Back returns to dashboard", async ({ page }) => {
  await loginAs(page, "user");
  await page.route("**/api/dashboard/", async (route) => {
    await route.fulfill({
      json: {
        tickets_count: 0,
        attended_events: 0,
        upcoming_events: [],
        recent_bookings: [],
      },
    });
  });
  await page.route("**/api/notifications/", async (route) => {
    await route.fulfill({
      json: [
        {
          id: 1,
          title: "Ticket update",
          message: "Your ticket is ready.",
          type: "success",
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ],
    });
  });
  await page.route("**/api/notifications/1/mark-read/", async (route) => {
    await route.fulfill({ json: { status: "success" } });
  });

  await page.goto("/user/dashboard");
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText("Ticket update")).toBeVisible();
  await page.getByText("Ticket update").click();

  await expect(page).toHaveURL(/\/user\/notification$/);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/user\/dashboard$/);
});

test("chatbot answer survives refresh and unresolved issues create staff support", async ({ page }) => {
  await loginAs(page, "user");
  await page.route("**/api/notifications/", async (route) => route.fulfill({ json: [] }));
  await page.route("**/api/support/my-conversation/", async (route) => {
    await route.fulfill({ json: { conversation: null } });
  });
  await page.route("**/api/support/chatbot/", async (route) => {
    await route.fulfill({
      json: {
        answer: "Paid QR tickets are shown in Passes. I created a staff support case for investigation.",
        needs_support: true,
        support_created: true,
        conversation: {
          id: 9,
          assigned_role: "staff",
          status: "assigned",
          messages: [{
            id: 1,
            sender_role: "user",
            sender: { username: "user-tester" },
            message: "Where is my ticket QR?",
            created_at: new Date().toISOString(),
          }],
        },
      },
    });
  });

  await page.goto("/user/chatbot");
  await page.getByPlaceholder(/Ask a question/i).fill("Where is my ticket QR?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/created a staff support case/i)).toBeVisible();
  await expect(page.getByText(/STAFF - support thread/i).or(page.getByText(/Action Taker/i))).toBeVisible();

  await page.reload();
  await expect(page.getByText(/created a staff support case/i)).toBeVisible();
});

function ticket(id, title, date, eventStatus, isUsed) {
  return {
    id,
    seat_type: "Normal",
    price: "1.00",
    qr_code_hash: `qr-${id}`,
    is_paid: true,
    payment_status: "paid",
    is_used: isUsed,
    event_details: {
      id,
      title,
      date,
      status: eventStatus,
    },
  };
}

function adminStats() {
  return {
    users_total: 0,
    staff_total: 0,
    admins_total: 1,
    events_total: 0,
    events_pending: 0,
    events_approved: 0,
    tickets_sold: 0,
    total_revenue: 0,
    manual_pending: 0,
    revenue_sparkline: Array.from({ length: 7 }, (_, index) => ({
      day: new Date(Date.now() - index * 86400000).toISOString(),
      revenue: 0,
    })),
  };
}
