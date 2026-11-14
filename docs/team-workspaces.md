# Sentinel AI Team Workspaces (Beta)

## Included behavior

- Authenticated users can create up to three private workspaces.
- The creator becomes the owner.
- Owners and admins can issue invitations to a verified email address.
- Invitation tokens are 256-bit random values; only SHA-256 hashes are stored in Supabase.
- Invitations expire after seven days and must be accepted by a signed-in account with the matching verified email.
- The beta allows up to 20 members and 10 pending invitations per workspace.
- Roles are Owner, Admin, Member, and Analyst.
- Owners can change non-owner roles. Owners/admins can invite; admins cannot remove other admins or the owner.
- Organization membership changes create append-only audit events.
- Invitations are shared manually as a one-time link. Email delivery is not claimed until SMTP is configured and tested.

## Data protection

- Organizations, memberships, invitations, and audit events all have RLS enabled.
- Browser roles have SELECT only; all writes use the authenticated server API and server-side service-role credentials.
- Membership reads use a fixed-search-path SECURITY DEFINER membership predicate to avoid recursive RLS.
- Organization creation and invitation acceptance use server-only transactional database functions.
- Invitation tokens are never stored in plaintext in the database.
- A user can only list organizations for which they have a membership; invitation reads are scoped to the authenticated email.
- Audit event access is limited to organization members.

## Manual preview test

1. Sign in with an email-confirmed account.
2. Create a workspace and verify the creator is Owner.
3. Invite a second account using its exact email address.
4. Open the invitation link in that account and sign in; confirm the invitation is accepted only for the matching verified email.
5. Confirm the new member sees the workspace and the expected role.
6. Verify member cannot invite or change roles; admin can invite but cannot change roles or remove owner/admin; owner can change non-owner roles.
7. Revoke a pending invitation and confirm it can no longer be accepted.
8. Verify a third account cannot read the workspace, members, invitations, or audit events.

## Limitations

- This is the first private team workspace layer, not full enterprise identity management.
- SSO, SCIM, centralized policy controls, organization-wide asset sharing, billing entitlements, and email delivery remain separate work.
- The module remains on the integration candidate until automated and manual validation passes.
