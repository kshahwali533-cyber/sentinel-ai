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

## Shared verified assets

- Owners/admins can share a verified monitoring site with a workspace only when the site's owner is already a current workspace member.
- All workspace members can view shared asset metadata; only owners/admins can add or remove shares.
- Shared assets are references to the original monitoring site, not copies. Pausing or removing the original site affects the shared reference.
- The organization asset table has RLS enabled; authenticated clients have SELECT only; writes use the authenticated server API and service-role credentials.
- Audit events record asset sharing/removal.
- Unverified domains and assets owned by non-members cannot be shared.

## Workspace security policies and audit export

- Workspace owners can disable new invitations, verified-asset sharing, or audit exports.
- The server API enforces these controls; hiding a UI button is not treated as authorization.
- Admins can export the latest 1,000 audit events as JSON when the owner has enabled audit export.
- Policy changes and audit exports create audit events.
- Policy rows are visible to workspace members through RLS; writes are server-side only.
- These are first-version workspace controls, not SSO/SCIM or a complete enterprise compliance system.
- Automated event retention/purge is not claimed; backup and retention behavior still needs a documented operational policy.
