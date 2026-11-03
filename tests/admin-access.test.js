import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminAccountAccessState,
  isActiveAdminProfile,
  isAdministratorClaim,
} from "../server/admin-access.js";

test("missing admin profile is reported separately from an active account", () => {
  assert.equal(getAdminAccountAccessState(null), "missing-profile");
});

test("disabled flags and disabled status are classified as restorable only when deletion is absent", () => {
  assert.equal(getAdminAccountAccessState({ role: "admin", disabled: true }), "disabled");
  assert.equal(getAdminAccountAccessState({ role: "admin", status: "Suspended" }), "disabled");
  assert.equal(getAdminAccountAccessState({ role: "admin" }, true), "disabled");
  assert.equal(getAdminAccountAccessState({ role: "admin", disabled: true, deletionStatus: "queued" }), "deletion-pending");
  assert.equal(getAdminAccountAccessState({ role: "admin", status: "Deleting" }), "deletion-pending");
  for (const status of ["suspended", "blocked", "blacklisted", "deleting"]) {
    assert.notEqual(getAdminAccountAccessState({ role: "member", status }), "active");
  }
  assert.equal(getAdminAccountAccessState({ role: "member", authDisabled: true }), "disabled");
});

test("only an active profile with an admin role is an active admin profile", () => {
  assert.equal(isActiveAdminProfile({ role: "admin", status: "Active" }), true);
  assert.equal(isActiveAdminProfile({ role: "member", status: "Active" }), false);
  assert.equal(isActiveAdminProfile({ role: "admin", authDisabled: true }), false);
});

test("admin recovery requires an existing admin claim", () => {
  assert.equal(isAdministratorClaim({ customClaims: { admin: true } }), true);
  assert.equal(isAdministratorClaim({ customClaims: { role: "ADMIN" } }), true);
  assert.equal(isAdministratorClaim({ customClaims: { role: "member" } }), false);
});
