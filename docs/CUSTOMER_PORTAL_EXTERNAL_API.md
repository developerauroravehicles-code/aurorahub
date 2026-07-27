# Customer Portal — External Integration

AuroraHub issues and validates customer portal magic links. **SMS/email delivery stays in your external service.**

## Issue portal link (on demand)

When an installation completes (or anytime you need to send a link), call:

```
POST /api/customer-portal/issue-token
Authorization: Bearer {CRON_SECRET}
Content-Type: application/json

{
  "phone": "4161234567",
  "ttl_days": 30
}
```

**Response:**

```json
{
  "url": "https://your-app.com/customer-portal?token=…",
  "token": "…",
  "expires_at": "2026-08-26T12:00:00.000Z",
  "phone": "4161234567"
}
```

- Phone must normalize to 10-digit Canadian format.
- Default TTL: 30 days (`CUSTOMER_PORTAL_TOKEN_TTL_DAYS` env override).
- Store `CRON_SECRET` in Vercel env; same secret used by other cron routes.

## Automatic token on completion (webhook)

When a specialist marks a demand **completed**, AuroraHub:

1. Creates a portal token for the customer phone (if present).
2. Dispatches webhook event `demand_completed` with:

```json
{
  "event": "demand_completed",
  "timestamp": "2026-07-27T…",
  "demand_id": "uuid",
  "customer_phone": "4161234567",
  "portal_url": "https://…/customer-portal?token=…",
  "portal_expires_at": "2026-08-26T…",
  "hint": "External SMS/email service can send portal_url to the customer."
}
```

Configure webhooks under **Integrations → Webhooks** (`demand_completed` event).

If no phone is on the demand, `portal_url` is `null` — use the issue-token API when phone becomes available.

## Customer portal access

| URL | Behavior |
|-----|----------|
| `/customer-portal?token=…` | Validates token → phone lookup → hides VIN form |
| Expired/revoked token | Banner + VIN fallback |
| `/customer-portal` (no token) | Existing VIN lookup |

## Service records (portal)

Customers submit service tickets via the portal. AuroraHub:

- Notifies Aurora Managers in-app
- Sends **SMS to all Aurora Managers** with customer/vehicle/diagnosis summary
- AM approves in **Admin → Service Records**, assigns specialist, schedules appointment
- Specialist completes job in **Service Jobs** (+$20 payroll line)
- Specialist submits expenses → AM approves → payroll reimbursement

## Security

- Tokens stored as SHA-256 hashes only.
- Issue-token endpoint requires `CRON_SECRET`.
- Portal RPCs are `SECURITY DEFINER` with minimal exposed fields.
