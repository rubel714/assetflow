const http = require("http");
const assert = require("node:assert/strict");
const { test, before, after } = require("node:test");
const bcrypt = require("bcrypt");
const { createApp } = require("../src/app");
const db = require("../src/config/db");

const OTHER_ORG_NAME = "Phase1 Isolation Org";
const OTHER_ADMIN = "isolation_admin";
const OTHER_PASSWORD = "isolation123";

let server;
let baseUrl;
let otherAssetId;

function listen(app) {
  return new Promise((resolve) => {
    const s = http.createServer(app);
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

async function api(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function login(username, password) {
  const res = await api("POST", "/login", { body: { username, password } });
  assert.equal(res.status, 200, `login failed for ${username}: ${res.json?.message}`);
  return res.json.token;
}

async function ensureOtherTenant() {
  const [orgs] = await db.query("SELECT OrganizationId FROM organizations WHERE Name = ? LIMIT 1", [
    OTHER_ORG_NAME,
  ]);
  let orgId = orgs[0]?.OrganizationId;
  if (!orgId) {
    const [inserted] = await db.query("INSERT INTO organizations (Name) VALUES (?)", [OTHER_ORG_NAME]);
    orgId = inserted.insertId;
  }

  const hash = await bcrypt.hash(OTHER_PASSWORD, 10);
  const [users] = await db.query("SELECT UserId FROM users WHERE Username = ? LIMIT 1", [OTHER_ADMIN]);
  if (!users.length) {
    await db.query(
      `INSERT INTO users (OrganizationId, Username, Password, FullName, RoleKey, Status)
       VALUES (?, ?, ?, 'Isolation Admin', 'organization_admin', 'active')`,
      [orgId, OTHER_ADMIN, hash]
    );
  } else {
    await db.query(
      "UPDATE users SET OrganizationId = ?, Password = ?, RoleKey = 'organization_admin', Status = 'active' WHERE Username = ?",
      [orgId, hash, OTHER_ADMIN]
    );
  }

  const [assets] = await db.query(
    "SELECT AssetId FROM assets WHERE OrganizationId = ? AND AssetTag = 'AF-ISO1' LIMIT 1",
    [orgId]
  );
  if (assets.length) {
    otherAssetId = assets[0].AssetId;
  } else {
    const [created] = await db.query(
      `INSERT INTO assets (OrganizationId, AssetTag, Name, Status)
       VALUES (?, 'AF-ISO1', 'Isolation Laptop', 'Available')`,
      [orgId]
    );
    otherAssetId = created.insertId;
  }
}

before(async () => {
  await ensureOtherTenant();
  server = await listen(createApp());
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.end();
});

test("employee cannot manage users, setup, assets, or assign", async () => {
  const token = await login("employee", "employee123");
  assert.equal((await api("GET", "/users", { token })).status, 403);
  assert.equal((await api("POST", "/users", { token, body: { username: "x", password: "secret1", fullName: "X" } })).status, 403);
  assert.equal((await api("GET", "/departments", { token })).status, 403);
  assert.equal((await api("GET", "/designations", { token })).status, 403);
  assert.equal((await api("POST", "/assets", { token, body: { name: "Forbidden" } })).status, 403);
  const list = await api("GET", "/assets", { token });
  assert.equal(list.status, 200);
  const assignedId = list.json.assets?.[0]?.AssetId;
  if (assignedId) {
    assert.equal((await api("POST", `/assets/${assignedId}/assign`, { token, body: { userId: 1 } })).status, 403);
  }
  assert.equal((await api("GET", "/organization", { token })).status, 403);
  assert.equal((await api("GET", "/audit-logs", { token })).status, 403);
  assert.equal((await api("GET", "/assets/export", { token })).status, 403);
});

test("employee only sees assigned assets", async () => {
  const token = await login("employee", "employee123");
  const list = await api("GET", "/assets", { token });
  assert.equal(list.status, 200);
  for (const asset of list.json.assets || []) {
    assert.equal(asset.Status, "Assigned");
  }
  const other = await api("GET", `/assets/${otherAssetId}`, { token });
  assert.ok(other.status === 403 || other.status === 404);
});

test("asset manager cannot manage org settings or retire assets", async () => {
  const token = await login("manager", "manager123");
  assert.equal((await api("GET", "/organization", { token })).status, 403);
  assert.equal((await api("PATCH", "/organization", { token, body: { name: "Hacked" } })).status, 403);
  assert.equal((await api("POST", "/users", { token, body: { username: "nope", password: "secret1", fullName: "Nope" } })).status, 403);

  const list = await api("GET", "/assets?status=Available", { token });
  assert.equal(list.status, 200);
  const available = (list.json.assets || []).find((a) => a.Status === "Available");
  if (available) {
    const retired = await api("PATCH", `/assets/${available.AssetId}`, {
      token,
      body: { name: available.Name, status: "Retired" },
    });
    assert.equal(retired.status, 403);
  }
});

test("queries are scoped by organization", async () => {
  const demoAdmin = await login("admin", "admin123");
  const otherAdmin = await login(OTHER_ADMIN, OTHER_PASSWORD);

  const leak = await api("GET", `/assets/${otherAssetId}`, { token: demoAdmin });
  assert.equal(leak.status, 404);

  const own = await api("GET", `/assets/${otherAssetId}`, { token: otherAdmin });
  assert.equal(own.status, 200);
  assert.equal(own.json.asset.AssetTag, "AF-ISO1");

  const demoList = await api("GET", "/assets", { token: demoAdmin });
  assert.equal(demoList.status, 200);
  assert.ok(!(demoList.json.assets || []).some((a) => a.AssetId === otherAssetId));
});

test("assigned asset can be marked damaged without returning first", async () => {
  const token = await login("admin", "admin123");
  const created = await api("POST", "/assets", { token, body: { name: "Phase1 Status Probe" } });
  assert.equal(created.status, 201);
  const assetId = created.json.asset.AssetId;

  const users = await api("GET", "/users", { token });
  const employee = (users.json.users || []).find((u) => u.Username === "employee");
  assert.ok(employee);
  const assigned = await api("POST", `/assets/${assetId}/assign`, {
    token,
    body: { userId: employee.UserId, notes: "status check" },
  });
  assert.equal(assigned.status, 200);

  const damaged = await api("PATCH", `/assets/${assetId}`, {
    token,
    body: { name: "Phase1 Status Probe", status: "Damaged" },
  });
  assert.equal(damaged.status, 200, damaged.json?.message);
  assert.equal(damaged.json.asset.Status, "Damaged");
  assert.ok(!damaged.json.asset.CurrentAssignmentId);
});

test("admin can update organization settings", async () => {
  const token = await login("admin", "admin123");
  const current = await api("GET", "/organization", { token });
  assert.equal(current.status, 200);
  const name = current.json.organization.Name;
  const updated = await api("PATCH", "/organization", { token, body: { name } });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.organization.Name, name);
});

test("employee accepts a pending handover", async () => {
  const admin = await login("admin", "admin123");
  const created = await api("POST", "/assets", { token: admin, body: { name: "MVP Plus Handover Probe" } });
  assert.equal(created.status, 201, created.json?.message);
  const assetId = created.json.asset.AssetId;

  const users = await api("GET", "/users", { token: admin });
  const employee = (users.json.users || []).find((u) => u.Username === "employee");
  assert.ok(employee);

  const assigned = await api("POST", `/assets/${assetId}/assign`, {
    token: admin,
    body: { userId: employee.UserId, notes: "handover test" },
  });
  assert.equal(assigned.status, 200, assigned.json?.message);
  assert.equal(assigned.json.asset.HandoverStatus, "pending");

  const employeeToken = await login("employee", "employee123");
  const accepted = await api("POST", `/assets/${assetId}/accept`, { token: employeeToken });
  assert.equal(accepted.status, 200, accepted.json?.message);
  assert.equal(accepted.json.asset.HandoverStatus, "accepted");
});

test("lookup is scoped by organization", async () => {
  const demoAdmin = await login("admin", "admin123");
  const miss = await api("GET", "/assets/lookup?tag=AF-ISO1", { token: demoAdmin });
  assert.equal(miss.status, 404);
});

test("warranty list includes soon-to-expire assets", async () => {
  const admin = await login("admin", "admin123");
  const expiry = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const created = await api("POST", "/assets", {
    token: admin,
    body: { name: "MVP Plus Warranty Probe", lastWarrantyDate: expiry },
  });
  assert.equal(created.status, 201, created.json?.message);
  const list = await api("GET", "/warranties?days=30", { token: admin });
  assert.equal(list.status, 200);
  assert.ok((list.json.warranties || []).some((row) => row.AssetId === created.json.asset.AssetId));
});

test("employee cannot start a work order; manager can", async () => {
  const admin = await login("admin", "admin123");
  const created = await api("POST", "/assets", { token: admin, body: { name: "MVP Plus Repair Probe" } });
  assert.equal(created.status, 201, created.json?.message);
  const assetId = created.json.asset.AssetId;

  const employeeToken = await login("employee", "employee123");
  const employeeCreate = await api("POST", "/maintenance-requests", {
    token: employeeToken,
    body: { assetId, title: "Fan noise" },
  });
  assert.ok(employeeCreate.status === 403 || employeeCreate.status === 404);

  const request = await api("POST", "/maintenance-requests", {
    token: admin,
    body: { assetId, title: "Fan noise" },
  });
  assert.equal(request.status, 201, request.json?.message);

  const forbiddenStart = await api("PATCH", `/maintenance-requests/${request.json.request.RequestId}`, {
    token: employeeToken,
    body: { action: "start" },
  });
  assert.equal(forbiddenStart.status, 403);

  const manager = await login("manager", "manager123");
  const started = await api("PATCH", `/maintenance-requests/${request.json.request.RequestId}`, {
    token: manager,
    body: { action: "start" },
  });
  assert.equal(started.status, 200, started.json?.message);

  const asset = await api("GET", `/assets/${assetId}`, { token: admin });
  assert.equal(asset.json.asset.Status, "In Repair");

  const completed = await api("PATCH", `/maintenance-requests/${request.json.request.RequestId}`, {
    token: manager,
    body: { action: "complete" },
  });
  assert.equal(completed.status, 200, completed.json?.message);
  const restored = await api("GET", `/assets/${assetId}`, { token: admin });
  assert.equal(restored.json.asset.Status, "Available");
});
