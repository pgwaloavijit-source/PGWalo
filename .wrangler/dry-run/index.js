var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker/utils/cors.ts
function handleCors() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-role, x-organization-id",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(handleCors, "handleCors");
function addCorsHeaders(response) {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-role, x-organization-id");
  return newResponse;
}
__name(addCorsHeaders, "addCorsHeaders");

// src/worker/utils/jwt.ts
async function generateJWT(payload, secret) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + 24 * 60 * 60
    // 24 hours expiration
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(data, secret);
  return `${data}.${signature}`;
}
__name(generateJWT, "generateJWT");
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3)
      return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await sign(data, secret);
    if (signature !== expectedSignature)
      return null;
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
async function sign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );
  return base64UrlEncode(signature);
}
__name(sign, "sign");
function base64UrlEncode(data) {
  if (typeof data === "string") {
    const encoder = new TextEncoder();
    data = encoder.encode(data);
  }
  const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(data) {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}
__name(base64UrlDecode, "base64UrlDecode");

// src/worker/middleware/auth.ts
async function authMiddleware(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (env.JWT_SECRET) {
      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (payload) {
        return {
          success: true,
          user: {
            id: payload.userId,
            role: payload.role,
            organizationId: payload.organizationId,
            name: payload.name
          }
        };
      }
    }
  }
  const role = request.headers.get("x-user-role") || "public";
  const organizationId = request.headers.get("x-organization-id") || env.DEFAULT_ORGANIZATION_ID;
  const userId = request.headers.get("x-user-id");
  const validRoles = ["public", "owner", "resident", "staff", "admin", "manager", "warden", "accountant"];
  if (!validRoles.includes(role)) {
    return { success: false, error: "Invalid role" };
  }
  return {
    success: true,
    user: {
      id: userId || "user-demo",
      role,
      organizationId
    }
  };
}
__name(authMiddleware, "authMiddleware");
function hasPermission(role, permission) {
  const rolePermissions = {
    admin: ["*"],
    // Full access
    owner: ["*"],
    // Full operational access
    manager: [
      "resident.view",
      "resident.create",
      "resident.edit",
      "resident.move",
      "resident.checkout",
      "room.view",
      "room.assign",
      "room.transfer",
      "invoice.view",
      "payment.view",
      "payment.record",
      "complaint.view",
      "complaint.assign",
      "complaint.resolve",
      "report.view"
    ],
    warden: ["resident.view", "room.view", "room.assign", "complaint.view", "complaint.assign", "complaint.resolve"],
    accountant: [
      "resident.view",
      "invoice.view",
      "invoice.create",
      "invoice.adjust",
      "payment.view",
      "payment.record",
      "payment.verify",
      "payment.refund",
      "deposit.view",
      "deposit.deduct",
      "deposit.refund",
      "report.view",
      "report.export",
      "audit.view"
    ],
    staff: ["room.view", "complaint.view", "complaint.resolve"],
    resident: ["invoice.view", "payment.view", "payment.record", "deposit.view", "complaint.view"],
    public: ["room.view"]
  };
  const permissions = rolePermissions[role] || [];
  return permissions.includes("*") || permissions.includes(permission);
}
__name(hasPermission, "hasPermission");

// src/worker/handlers/bootstrap.ts
var TABLES = [
  "organizations",
  "properties",
  "residents",
  "beds",
  "stays",
  "rent_plans",
  "invoices",
  "payments",
  "payment_allocations",
  "deposit_transactions",
  "notices",
  "checkouts",
  "audit_logs",
  "booking_requests",
  "attendance_records",
  "staff_members",
  "staff_tasks",
  "broadcast_notifications",
  "meal_plans",
  "chat_messages",
  "maintenance_tickets",
  "leads",
  "electricity_meter_readings",
  "security_deposit_records",
  "rent_agreements",
  "visitor_passes",
  "system_settings",
  "role_permissions"
];
var READ_PERMISSIONS = {
  organizations: "staff.view",
  properties: "room.view",
  residents: "resident.view",
  beds: "room.view",
  stays: "resident.view",
  rent_plans: "invoice.view",
  invoices: "invoice.view",
  payments: "payment.view",
  payment_allocations: "payment.view",
  deposit_transactions: "deposit.view",
  notices: "resident.view",
  checkouts: "resident.view",
  audit_logs: "audit.view",
  booking_requests: "resident.view",
  attendance_records: "resident.view",
  staff_members: "staff.view",
  staff_tasks: "staff.view",
  broadcast_notifications: "staff.view",
  meal_plans: "staff.view",
  chat_messages: "staff.view",
  maintenance_tickets: "complaint.view",
  leads: "staff.view",
  electricity_meter_readings: "resident.view",
  security_deposit_records: "deposit.view",
  rent_agreements: "resident.view",
  visitor_passes: "resident.view",
  system_settings: "staff.view",
  role_permissions: "staff.view"
};
async function bootstrapHandler(request, env, user) {
  const organizationId = user.organizationId || env.DEFAULT_ORGANIZATION_ID;
  if (request.method === "GET") {
    const result = {};
    for (const table of TABLES) {
      const permission = READ_PERMISSIONS[table] || "staff.view";
      if (!hasPermission(user.role, permission)) {
        result[table] = [];
        continue;
      }
      try {
        let query = `SELECT * FROM ${table}`;
        const params = [];
        if (user.role !== "admin" && table !== "system_settings" && table !== "role_permissions") {
          query += ` WHERE organization_id = ?`;
          params.push(organizationId);
        }
        const { results } = await env.DB.prepare(query).bind(...params).all();
        result[table] = results || [];
      } catch (error) {
        console.error(`Error loading ${table}:`, error);
        result[table] = [];
      }
    }
    const response2 = new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response2);
  }
  if (request.method === "POST") {
    if (!hasPermission(user.role, "staff.permission_manage")) {
      const response2 = new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
    try {
      const body = await request.json();
      await env.DB.batch([
        env.DB.prepare("BEGIN TRANSACTION")
      ]);
      for (const [table, rows] of Object.entries(body)) {
        if (!TABLES.includes(table) || table === "audit_logs")
          continue;
        if (!Array.isArray(rows))
          continue;
        for (const row of rows) {
          const typedRow = row;
          const columns = Object.keys(typedRow).join(", ");
          const placeholders = Object.keys(typedRow).map(() => "?").join(", ");
          const values = Object.values(typedRow);
          if (user.role !== "admin" && !typedRow.organization_id) {
            typedRow.organization_id = organizationId;
          }
          const query = `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`;
          await env.DB.prepare(query).bind(...values).run();
        }
      }
      await env.DB.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, timestamp, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user.id,
        user.name || "System",
        user.role,
        "Bootstrap Snapshot Saved",
        "Database",
        (/* @__PURE__ */ new Date()).toISOString(),
        JSON.stringify({ collections: Object.keys(body) })
      ).run();
      await env.DB.batch([
        env.DB.prepare("COMMIT")
      ]);
      const response2 = new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    } catch (error) {
      await env.DB.prepare("ROLLBACK").run();
      console.error("Bootstrap save error:", error);
      const response2 = new Response(JSON.stringify({ error: "Failed to save bootstrap data" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
  }
  const response = new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
  return addCorsHeaders(response);
}
__name(bootstrapHandler, "bootstrapHandler");

// src/worker/handlers/collection.ts
var READ_PERMISSIONS2 = {
  organizations: "staff.view",
  properties: "room.view",
  residents: "resident.view",
  beds: "room.view",
  stays: "resident.view",
  rent_plans: "invoice.view",
  invoices: "invoice.view",
  payments: "payment.view",
  payment_allocations: "payment.view",
  deposit_transactions: "deposit.view",
  notices: "resident.view",
  checkouts: "resident.view",
  audit_logs: "audit.view",
  booking_requests: "resident.view",
  attendance_records: "resident.view",
  staff_members: "staff.view",
  staff_tasks: "staff.view",
  broadcast_notifications: "staff.view",
  meal_plans: "staff.view",
  chat_messages: "staff.view",
  maintenance_tickets: "complaint.view",
  leads: "staff.view",
  electricity_meter_readings: "resident.view",
  security_deposit_records: "deposit.view",
  rent_agreements: "resident.view",
  visitor_passes: "resident.view",
  system_settings: "staff.view",
  role_permissions: "staff.view"
};
var WRITE_PERMISSIONS = {
  organizations: "staff.permission_manage",
  properties: "room.assign",
  residents: "resident.edit",
  beds: "room.assign",
  stays: "room.transfer",
  rent_plans: "invoice.adjust",
  invoices: "invoice.create",
  payments: "payment.record",
  payment_allocations: "payment.verify",
  deposit_transactions: "deposit.deduct",
  notices: "resident.checkout",
  checkouts: "resident.checkout",
  audit_logs: "audit.view",
  booking_requests: "resident.create",
  attendance_records: "resident.create",
  staff_members: "staff.create",
  staff_tasks: "staff.create",
  broadcast_notifications: "staff.create",
  meal_plans: "staff.create",
  chat_messages: "staff.create",
  maintenance_tickets: "complaint.create",
  leads: "staff.create",
  electricity_meter_readings: "resident.create",
  security_deposit_records: "deposit.deduct",
  rent_agreements: "resident.create",
  visitor_passes: "resident.create",
  system_settings: "staff.permission_manage",
  role_permissions: "staff.permission_manage"
};
var VALID_TABLES = [
  "organizations",
  "properties",
  "residents",
  "beds",
  "stays",
  "rent_plans",
  "invoices",
  "payments",
  "payment_allocations",
  "deposit_transactions",
  "notices",
  "checkouts",
  "audit_logs",
  "booking_requests",
  "attendance_records",
  "staff_members",
  "staff_tasks",
  "broadcast_notifications",
  "meal_plans",
  "chat_messages",
  "maintenance_tickets",
  "leads",
  "electricity_meter_readings",
  "security_deposit_records",
  "rent_agreements",
  "visitor_passes",
  "system_settings",
  "role_permissions"
];
async function collectionHandler(request, env, collection, id, user) {
  const organizationId = user.organizationId || env.DEFAULT_ORGANIZATION_ID;
  if (!VALID_TABLES.includes(collection)) {
    const response2 = new Response(JSON.stringify({ error: "Unknown collection" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response2);
  }
  const readPermission = READ_PERMISSIONS2[collection] || "staff.view";
  const writePermission = WRITE_PERMISSIONS[collection] || "staff.permission_manage";
  if (request.method === "GET") {
    if (!hasPermission(user.role, readPermission)) {
      const response2 = new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
    try {
      const url = new URL(request.url);
      let query = `SELECT * FROM ${collection}`;
      const params = [];
      const conditions = [];
      if (user.role !== "admin" && collection !== "system_settings" && collection !== "role_permissions") {
        conditions.push(`organization_id = ?`);
        params.push(organizationId);
      }
      if (id) {
        conditions.push(`id = ?`);
        params.push(id);
      }
      if (collection === "properties") {
        const location = (url.searchParams.get("location") || url.searchParams.get("q") || "").trim();
        const city = (url.searchParams.get("city") || "").trim();
        const type = (url.searchParams.get("type") || "").trim();
        const roomType = (url.searchParams.get("roomType") || "").trim();
        const moveInDate = (url.searchParams.get("moveInDate") || "").trim();
        const maxPrice = Number(url.searchParams.get("maxPrice") || "");
        const amenities = url.searchParams.getAll("amenity").filter(Boolean);
        if (city && city !== "All") {
          conditions.push(`LOWER(city) = LOWER(?)`);
          params.push(city);
        }
        if (type && type !== "All") {
          conditions.push(`gender = ?`);
          params.push(type);
        }
        if (Number.isFinite(maxPrice) && maxPrice > 0) {
          conditions.push(`starting_price <= ?`);
          params.push(maxPrice);
        }
        if (location) {
          const likeTerm = `%${location.toLowerCase()}%`;
          conditions.push(`(
            LOWER(name) LIKE ?
            OR LOWER(locality) LIKE ?
            OR LOWER(city) LIKE ?
            OR LOWER(address) LIKE ?
            OR LOWER(locality || ', ' || city) LIKE ?
          )`);
          params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
        }
        if (roomType && roomType !== "All") {
          conditions.push(`(EXISTS (
            SELECT 1 FROM json_each(properties.rooms)
            WHERE json_extract(json_each.value, '$.type') = ?
          ) OR EXISTS (
            SELECT 1 FROM beds
            WHERE beds.property_id = properties.id
              AND beds.sharing_type = ?
          ))`);
          params.push(roomType, roomType);
        }
        if (moveInDate) {
          conditions.push(`(
            EXISTS (
              SELECT 1 FROM json_each(properties.rooms)
              WHERE CAST(json_extract(json_each.value, '$.availableBeds') AS INTEGER) > 0
                ${roomType && roomType !== "All" ? `AND json_extract(json_each.value, '$.type') = ?` : ""}
            )
            OR EXISTS (
              SELECT 1 FROM beds
              WHERE beds.property_id = properties.id
                AND (
                  beds.status IN ('Vacant', 'Available', 'Ready')
                  OR (beds.next_available_date IS NOT NULL AND beds.next_available_date <= ?)
                )
                ${roomType && roomType !== "All" ? "AND beds.sharing_type = ?" : ""}
            )
          )`);
          if (roomType && roomType !== "All")
            params.push(roomType);
          params.push(moveInDate);
          if (roomType && roomType !== "All")
            params.push(roomType);
        }
        for (const amenity of amenities) {
          conditions.push(`amenities LIKE ?`);
          params.push(`%"${amenity}"%`);
        }
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }
      if (collection === "properties") {
        query += ` ORDER BY featured DESC, rating DESC, starting_price ASC`;
      }
      const { results } = await env.DB.prepare(query).bind(...params).all();
      const response2 = new Response(JSON.stringify(results || []), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    } catch (error) {
      console.error(`Error loading ${collection}:`, error);
      const response2 = new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
  }
  if (request.method === "POST") {
    if (!hasPermission(user.role, writePermission)) {
      const response2 = new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
    try {
      const body = await request.json();
      if (user.role !== "admin" && !body.organization_id && collection !== "system_settings" && collection !== "role_permissions") {
        body.organization_id = organizationId;
      }
      const columns = Object.keys(body).join(", ");
      const placeholders = Object.keys(body).map(() => "?").join(", ");
      const values = Object.values(body);
      const query = `INSERT INTO ${collection} (${columns}) VALUES (${placeholders})`;
      await env.DB.prepare(query).bind(...values).run();
      await env.DB.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, timestamp, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user.id,
        user.name || "System",
        user.role,
        "API Record Created",
        collection,
        body.id,
        (/* @__PURE__ */ new Date()).toISOString(),
        JSON.stringify({ newValue: body, propertyId: body.property_id })
      ).run();
      const response2 = new Response(JSON.stringify(body), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    } catch (error) {
      console.error(`Error creating ${collection}:`, error);
      const response2 = new Response(JSON.stringify({ error: "Failed to create record" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
  }
  if (request.method === "PUT") {
    if (!id) {
      const response2 = new Response(JSON.stringify({ error: "ID required for update" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
    if (!hasPermission(user.role, writePermission)) {
      const response2 = new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
    try {
      const body = await request.json();
      const existingQuery = `SELECT * FROM ${collection} WHERE id = ?`;
      const { results: existingResults } = await env.DB.prepare(existingQuery).bind(id).all();
      if (!existingResults || existingResults.length === 0) {
        const response3 = new Response(JSON.stringify({ error: "Record not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response3);
      }
      const existing = existingResults[0];
      if (user.role !== "admin" && collection !== "system_settings" && collection !== "role_permissions" && existing.organization_id !== organizationId) {
        const response3 = new Response(JSON.stringify({ error: "Forbidden: organization isolation" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response3);
      }
      const setClause = Object.keys(body).map((key) => `${key} = ?`).join(", ");
      const values = [...Object.values(body), id];
      const query = `UPDATE ${collection} SET ${setClause} WHERE id = ?`;
      await env.DB.prepare(query).bind(...values).run();
      await env.DB.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, timestamp, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user.id,
        user.name || "System",
        user.role,
        "API Record Updated",
        collection,
        id,
        (/* @__PURE__ */ new Date()).toISOString(),
        JSON.stringify({ previousValue: existing, newValue: body, propertyId: body.property_id, reason: body.reason })
      ).run();
      const updatedRecord = { ...existing, ...body };
      const response2 = new Response(JSON.stringify(updatedRecord), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    } catch (error) {
      console.error(`Error updating ${collection}:`, error);
      const response2 = new Response(JSON.stringify({ error: "Failed to update record" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
  }
  const response = new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
  return addCorsHeaders(response);
}
__name(collectionHandler, "collectionHandler");

// src/worker/handlers/health.ts
async function healthHandler(env) {
  const response = new Response(JSON.stringify({
    ok: true,
    environment: env.ENVIRONMENT,
    storage: env.MEDIA ? "D1 + R2" : "D1 (R2 optional)",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }), {
    headers: { "Content-Type": "application/json" }
  });
  return addCorsHeaders(response);
}
__name(healthHandler, "healthHandler");

// src/worker/handlers/media.ts
async function mediaHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "POST" && path === "/api/media/upload") {
    if (!env.MEDIA) {
      const response2 = new Response(JSON.stringify({ error: "R2 storage not configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
    const formData = await request.formData();
    const file = formData.get("file");
    const category = formData.get("category") || "general";
    if (!file || typeof file === "string") {
      const response2 = new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
    try {
      const timestamp = Date.now();
      const extension = file.name.split(".").pop();
      const filename = `${category}/${timestamp}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
      await env.MEDIA.put(filename, file.stream(), {
        httpMetadata: {
          contentType: file.type
        }
      });
      const publicUrl = `/api/media/${filename}`;
      const response2 = new Response(JSON.stringify({
        success: true,
        filename,
        url: publicUrl,
        size: file.size,
        type: file.type
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    } catch (error) {
      console.error("Upload error:", error);
      const response2 = new Response(JSON.stringify({ error: "Upload failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
  }
  if (request.method === "GET" && path.startsWith("/api/media/")) {
    if (!env.MEDIA) {
      const response2 = new Response(JSON.stringify({ error: "R2 storage not configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
    const filename = path.replace("/api/media/", "");
    try {
      const object = await env.MEDIA.get(filename);
      if (!object) {
        const response2 = new Response(JSON.stringify({ error: "File not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response2);
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Cache-Control", "public, max-age=31536000");
      return new Response(object.body, { headers });
    } catch (error) {
      console.error("Download error:", error);
      const response2 = new Response(JSON.stringify({ error: "Download failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
  }
  if (request.method === "DELETE" && path.startsWith("/api/media/")) {
    if (!env.MEDIA) {
      const response2 = new Response(JSON.stringify({ error: "R2 storage not configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
    const filename = path.replace("/api/media/", "");
    try {
      await env.MEDIA.delete(filename);
      const response2 = new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    } catch (error) {
      console.error("Delete error:", error);
      const response2 = new Response(JSON.stringify({ error: "Delete failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
  }
  const response = new Response(JSON.stringify({ error: "Invalid media endpoint" }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  });
  return addCorsHeaders(response);
}
__name(mediaHandler, "mediaHandler");

// src/worker/handlers/auth.ts
async function authHandler(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/auth/login" && request.method === "POST") {
    try {
      const body = await request.json();
      const role = body.role || "public";
      const userId = `user-${Date.now()}`;
      const token = await generateJWT({
        userId,
        role,
        organizationId: env.DEFAULT_ORGANIZATION_ID,
        name: body.email.split("@")[0]
      }, env.JWT_SECRET || "default-secret");
      const response2 = new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: userId,
          role,
          name: body.email.split("@")[0],
          organizationId: env.DEFAULT_ORGANIZATION_ID
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    } catch (error) {
      console.error("Login error:", error);
      const response2 = new Response(JSON.stringify({
        success: false,
        error: "Login failed"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
  }
  if (path === "/api/auth/register" && request.method === "POST") {
    try {
      const body = await request.json();
      const userId = `user-${Date.now()}`;
      const token = await generateJWT({
        userId,
        role: body.role,
        organizationId: env.DEFAULT_ORGANIZATION_ID,
        name: body.name
      }, env.JWT_SECRET || "default-secret");
      const response2 = new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: userId,
          role: body.role,
          name: body.name,
          organizationId: env.DEFAULT_ORGANIZATION_ID
        }
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    } catch (error) {
      console.error("Registration error:", error);
      const response2 = new Response(JSON.stringify({
        success: false,
        error: "Registration failed"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response2);
    }
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    const response2 = new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response2);
  }
  const response = new Response(JSON.stringify({ error: "Invalid auth endpoint" }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  });
  return addCorsHeaders(response);
}
__name(authHandler, "authHandler");

// src/worker/index.ts
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "OPTIONS") {
      return handleCors();
    }
    try {
      if (path === "/api/health") {
        return healthHandler(env);
      }
      if (path.startsWith("/api/auth")) {
        return authHandler(request, env);
      }
      if (path.startsWith("/api/media")) {
        return mediaHandler(request, env, ctx);
      }
      if (path === "/api/bootstrap") {
        const authResult = await authMiddleware(request, env);
        if (!authResult.success) {
          return addCorsHeaders(new Response(JSON.stringify({ error: authResult.error }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }));
        }
        if (request.method === "GET") {
          return bootstrapHandler(request, env, authResult.user);
        } else if (request.method === "POST") {
          return bootstrapHandler(request, env, authResult.user);
        }
      }
      const collectionMatch = path.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/);
      if (collectionMatch) {
        const authResult = await authMiddleware(request, env);
        if (!authResult.success) {
          return addCorsHeaders(new Response(JSON.stringify({ error: authResult.error }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }));
        }
        const [, collection, id] = collectionMatch;
        return collectionHandler(request, env, collection, id, authResult.user);
      }
      return addCorsHeaders(new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      }));
    } catch (error) {
      console.error("Worker error:", error);
      return addCorsHeaders(new Response(JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }));
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=index.js.map
