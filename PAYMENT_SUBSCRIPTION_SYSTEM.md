# QSToolkit Payment & Subscription System Documentation

## Overview

This document describes the complete manual payment approval and subscription lifecycle system implemented for QSToolkit, replacing the deactivated Paystack integration.

### System Goals
1. Allow users to submit bank transfer receipts for admin verification
2. Enable admins to review and approve/reject payments from a dashboard
3. Automatically activate subscriptions upon admin approval
4. Monitor subscription expiry and send reminders (7d, 3d, 1d before expiry)
5. Automatically downgrade users to free tier after subscription expires
6. Maintain comprehensive audit trail of all subscription changes

---

## Architecture Overview

### Payment Flow
```
User submits receipt → Pending status → Admin reviews → Admin approves/rejects
  ↓ (if approved)
Subscription activated → User gains access to paid features → Expires after period
```

### Subscription Lifecycle
```
Active → 7 days before expiry (reminder 1)
      → 3 days before expiry (reminder 2)
      → 1 day before expiry (reminder 3)
      → Expiry date reached
      → 7-day grace period (limited access)
      → Grace period expires → Auto-downgrade to free tier
```

---

## Database Schema

### Tables Created

#### `direct_payment_submissions`
Tracks bank transfer payment submissions from users waiting for admin verification.

```sql
- id (UUID, PK)
- user_id (FK to users)
- plan_name ('basic', 'pro', 'enterprise')
- billing_interval ('monthly', 'annual')
- amount_ngn (decimal)
- receipt_url (S3 URL)
- reference_note (bank transaction reference from user)
- status ('pending', 'verified', 'rejected')
- rejection_reason (if rejected)
- admin_note (admin's notes during review)
- reviewed_by (FK to users, admin who reviewed)
- reviewed_at (timestamp)
- submitted_at, updated_at, created_at
```

Indexes:
- `user_id` - Quick lookup of user's submissions
- `status` - Filter by pending/verified/rejected
- `submitted_at DESC` - List submissions in reverse chronological order
- `reviewed_by` - Find submissions reviewed by specific admin

#### `user_subscriptions`
Comprehensive subscription lifecycle tracking per user.

```sql
- id (UUID, PK)
- user_id (FK to users, unique)
- plan_name ('free', 'basic', 'pro', 'enterprise')
- billing_interval ('monthly', 'annual')
- subscription_status ('active', 'expired', 'cancelled', 'suspended')
- subscription_started_at (when current subscription began)
- subscription_expires_at (when subscription ends)
- subscription_cancelled_at (if cancelled by user)
- grace_period_until (7 days after expiry; users can still access)
- reminder_sent_7d, reminder_sent_3d, reminder_sent_1d (flags to prevent duplicate reminders)
- auto_renew (boolean, not yet implemented)
- last_payment_id (FK to billing_transactions)
- created_at, updated_at
```

Indexes:
- `user_id` (unique) - One active subscription per user
- `subscription_status` - Filter by active/expired/etc.
- `subscription_expires_at` - Find subscriptions expiring soon
- `auto_renew` - Find users with auto-renewal enabled

#### `subscription_audit_log`
Immutable audit trail of all subscription changes for compliance.

```sql
- id (UUID, PK)
- user_id (FK to users)
- action ('subscription_activated', 'subscription_expired', 'downgrade_to_free', 'reminder_sent_7d', etc.)
- plan_from, plan_to (plan transition)
- triggered_by (FK to users; NULL = system-triggered)
- details (JSONB, flexible metadata)
- created_at (immutable timestamp)
```

#### `subscription_transactions` (Extended)
New columns added to existing table:
```sql
- admin_upgraded_by (FK to users, admin who approved)
- payment_channel ('paystack' or 'direct_transfer')
- bank_reference (for direct transfers)
- bank_confirmed_at (timestamp when admin verified)
```

---

## API Endpoints

### User-Facing Endpoints

#### 1. Submit Bank Transfer Payment
```
POST /api/subscription/direct/submit-payment
Headers: Authorization: Bearer {token}
Body: FormData
  - planName: 'basic' | 'pro' | 'enterprise'
  - billingInterval: 'monthly' | 'annual'
  - amountNgn: number
  - referenceNote: string (bank transfer reference)
  - receipt: File (JPEG, PNG, or PDF, max 5MB)

Response:
{
  "success": true,
  "data": {
    "id": "UUID",
    "user_id": "UUID",
    "plan_name": "pro",
    "status": "pending",
    "submitted_at": "2024-01-15T10:30:00Z"
  }
}
```

#### 2. Get My Payment Submissions
```
GET /api/subscription/direct/my-submissions?status=pending&limit=20
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": [
    {
      "id": "UUID",
      "plan_name": "pro",
      "amount_ngn": 15000,
      "status": "pending",
      "submitted_at": "2024-01-15T10:30:00Z",
      "reviewed_at": null
    }
  ]
}
```

#### 3. Get My Subscription Status
```
GET /api/subscription/status/current
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "plan_name": "pro",
    "subscription_status": "active",
    "subscription_expires_at": "2024-02-15T00:00:00Z",
    "grace_period_until": "2024-02-22T00:00:00Z",
    "days_until_expiry": 32,
    "in_grace_period": false,
    "auto_renew": false
  }
}
```

#### 4. Get Subscription Audit Trail
```
GET /api/subscription/audit/history?limit=50
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": [
    {
      "action": "subscription_activated",
      "plan_from": "free",
      "plan_to": "pro",
      "triggered_by": "admin-user-id",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Admin-Facing Endpoints

#### 1. List Payment Submissions
```
GET /api/admin/payments/direct/list?status=pending&page=1&limit=50
Headers: Authorization: Bearer {token}
Permissions: manage_billing

Response:
{
  "success": true,
  "data": {
    "submissions": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 123
    }
  }
}
```

#### 2. Get Payment Detail
```
GET /api/admin/payments/direct/:submissionId
Headers: Authorization: Bearer {token}
Permissions: manage_billing

Response:
{
  "success": true,
  "data": {
    "id": "UUID",
    "user": { "id": "UUID", "first_name": "John", "email": "john@example.com" },
    "plan_name": "pro",
    "amount_ngn": 15000,
    "receipt_url": "https://...",
    "reference_note": "TRF-1234567890",
    "status": "pending",
    "submitted_at": "2024-01-15T10:30:00Z"
  }
}
```

#### 3. Verify (Approve) Payment
```
POST /api/admin/payments/direct/:submissionId/verify
Headers: Authorization: Bearer {token}
Permissions: manage_billing
Body:
{
  "adminNote": "Receipt verified, bank confirmed NGN 15,000 transfer"
}

Response:
{
  "success": true,
  "data": {
    "id": "UUID",
    "status": "verified",
    "reviewed_by": "admin-uuid",
    "reviewed_at": "2024-01-15T11:00:00Z",
    "subscription_activated": true
  }
}
```

This endpoint:
1. Marks payment as verified
2. Creates billing_transactions record
3. Activates user_subscriptions record
4. Sends approval notification (if email service configured)
5. Logs to subscription_audit_log

#### 4. Reject Payment
```
POST /api/admin/payments/direct/:submissionId/reject
Headers: Authorization: Bearer {token}
Permissions: manage_billing
Body:
{
  "rejectionReason": "Receipt amount doesn't match NGN 15,000 invoice"
}

Response:
{
  "success": true,
  "data": {
    "id": "UUID",
    "status": "rejected",
    "rejection_reason": "Receipt amount doesn't match...",
    "reviewed_by": "admin-uuid",
    "reviewed_at": "2024-01-15T11:00:00Z"
  }
}
```

This endpoint:
1. Marks payment as rejected
2. Stores rejection reason
3. Sends rejection notification with reason
4. Allows user to resubmit if needed

#### 5. Get Payment Statistics
```
GET /api/admin/payments/direct/stats/overview
Headers: Authorization: Bearer {token}
Permissions: manage_billing

Response:
{
  "success": true,
  "data": {
    "pending": 12,
    "verified": 456,
    "rejected": 8,
    "totalRevenueNgn": 6840000
  }
}
```

---

## Service Architecture

### Services

#### `subscriptionManagementService.js`
Core business logic for subscription lifecycle.

**Key Exports:**
- `activateSubscription(userId, planName, billingInterval, paymentData)` - Creates/updates user_subscriptions, calculates expiry, creates audit log
- `downgradeToFreeTier(userId, reason)` - Sets plan_name='free', updates status, logs audit
- `sendExpiryReminder(userId, daysUntil)` - Marks reminder flag sent, enables de-duplication
- `getExpiringSubscriptions(daysUntil)` - Finds subscriptions expiring in N days
- `getSubscriptionStatus(userId)` - Returns current subscription + days until expiry
- `logSubscriptionChange(userId, action, data, triggeredBy)` - Creates audit log entry

#### `adminPaymentService.js`
Admin payment review and approval workflow.

**Key Exports:**
- `listPaymentSubmissions(filters)` - Paginated list of submissions
- `getPaymentSubmissionDetail(submissionId)` - Full submission with user details
- `verifyPaymentSubmission(submissionId, adminUserId, adminNote)` - Approve payment
  - Creates billing_transactions record
  - Calls subscriptionManagementService.activateSubscription()
  - Logs audit entry
- `rejectPaymentSubmission(submissionId, adminUserId, rejectionReason)` - Reject payment
- `getPaymentStats()` - Dashboard statistics

#### `paymentSubmissionService.js`
User bank transfer submission handling.

**Key Exports:**
- `submitBankTransfer(userId, submissionData, receiptFile)` - Accept user submission
  - Validates plan/interval
  - Uploads receipt to Supabase Storage
  - Creates direct_payment_submissions record
  - Returns reference for user tracking
- `getUserSubmissions(userId, filters)` - List user's submissions
- `getSubmission(submissionId)` - Get specific submission
- `getPendingCount(userId)` - Count pending submissions

#### `subscriptionNotificationTemplates.js`
Email notification templates.

**Key Exports:**
- `sendSubscriptionExpiryReminder(params, emailService)` - 7d/3d/1d reminders
- `sendSubscriptionDowngradeNotice(params, emailService)` - Downgrade notification

---

## Scheduled Jobs

### Scheduler Service (`schedulerService.js`)

#### `monitorSubscriptionExpiry()` - Runs daily at 8 AM WAT
```javascript
1. Get subscriptions expiring in 7 days (and haven't sent reminder)
2. Get subscriptions expiring in 3 days (and haven't sent reminder)
3. Get subscriptions expiring in 1 day (and haven't sent reminder)
4. For each: send email reminder + mark reminder flag in DB
5. Get subscriptions past grace period (expired > 7 days)
6. For each: downgrade to free tier + send downgrade email
7. Log all actions
```

**Handling Edge Cases:**
- On re-runs (e.g., if scheduler restarts), reminder flags prevent duplicate emails
- Grace period accounts for timezones
- All operations logged with user_id and action timestamp

---

## Configuration Required

### Environment Variables
```bash
# Storage
SUPABASE_STORAGE_BUCKET=payments

# Email (if using email notifications)
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_FROM_ADDRESS=noreply@qstoolkit.com

# Payment settings
DIRECT_TRANSFER_BANK_ACCOUNT=1234567890  # Display to users
DIRECT_TRANSFER_BANK_NAME=Zenith Bank
DIRECT_TRANSFER_BANK_CODE=057
```

### Admin Permissions
Require `manage_billing` permission for payment endpoints. Add to admin middleware permissions:
```javascript
'manage_billing': {
  description: 'Manage direct payments and subscriptions',
  actions: ['verify_payment', 'reject_payment', 'view_payments', 'view_stats']
}
```

### Multer Configuration
Receipt file uploads configured in `subscriptionRoutes.js`:
- Memory storage (buffer-based)
- 5MB max file size
- Allowed: JPEG, PNG, PDF

---

## Data Flow Examples

### Example 1: User Submits Payment
```
1. User fills form: Pro plan, monthly, NGN 15,000, receipt, bank ref
2. Frontend sends POST /api/subscription/direct/submit-payment with file
3. subscriptionController receives, validates, calls paymentSubmissionService.submitBankTransfer()
4. Service uploads receipt to Supabase Storage
5. Service creates direct_payment_submissions record (status='pending')
6. User gets submission ID to track payment
```

### Example 2: Admin Approves Payment
```
1. Admin views payments queue, clicks on submission
2. Frontend GET /api/admin/payments/direct/:submissionId
3. Admin sees payment details and receipt preview
4. Admin clicks "Approve" button
5. Frontend POST /api/admin/payments/direct/:submissionId/verify
6. Controller calls adminPaymentService.verifyPaymentSubmission()
7. Service creates billing_transactions record (payment_channel='direct_transfer')
8. Service calls subscriptionManagementService.activateSubscription()
9. activateSubscription creates user_subscriptions (status='active', expires 1 month later)
10. activateSubscription logs to subscription_audit_log (action='subscription_activated')
11. User is now Pro tier user with feature access
```

### Example 3: Scheduled Subscription Expiry Monitoring
```
Daily at 8 AM WAT:
1. Scheduler calls monitorSubscriptionExpiry()
2. Query: subscriptions where expiry_date = tomorrow ± 1 day and reminder_sent_1d = false
3. For each: call subscriptionNotificationTemplates.sendSubscriptionExpiryReminder()
4. Update reminder_sent_1d = true in database
5. 7 days after expiry_date:
   - Query: subscriptions where expiry_date < now - 7 days and status = 'active'
   - For each: call subscriptionManagementService.downgradeToFreeTier()
   - downgradeToFreeTier: sets plan_name='free', logs audit, sends email
   - User loses access to paid features
```

---

## Error Handling

### Payment Submission Errors
- Missing required fields → 400 Bad Request
- Invalid plan name → 400 Bad Request
- File upload failed → 500 Internal Server Error
- Database error → 500 Internal Server Error

### Admin Approval Errors
- Submission not found → 404 Not Found
- Already verified/rejected → 409 Conflict (optional to prevent re-processing)
- Database error → 500 Internal Server Error

### Subscription Monitoring Errors
- User not found → Skip and log warning
- Email service unavailable → Log warning, continue
- Database error → Log error, retry next cycle

---

## Monitoring & Troubleshooting

### Key Logs to Monitor
```
[INFO] Direct payment submitted: user_id={}, plan={}, amount={}
[INFO] Payment verified by admin: submission_id={}, admin_id={}
[INFO] Subscription activated: user_id={}, plan={}, expires_at={}
[INFO] Subscription downgraded to free: user_id={}, reason={}
[WARN] Subscription expiry reminder failed: user_id={}, error={}
[ERROR] monitorSubscriptionExpiry failed: error={}
```

### Dashboard Queries

**Find pending payments:**
```sql
SELECT * FROM direct_payment_submissions 
WHERE status = 'pending' 
ORDER BY submitted_at DESC;
```

**Find users with expiring subscriptions (7 days):**
```sql
SELECT u.id, u.email, s.plan_name, s.subscription_expires_at
FROM user_subscriptions s
JOIN users u ON s.user_id = u.id
WHERE s.subscription_expires_at BETWEEN now() AND now() + interval '7 days'
AND s.subscription_status = 'active'
AND s.reminder_sent_7d = false;
```

**View subscription audit trail for user:**
```sql
SELECT * FROM subscription_audit_log
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 100;
```

**Payment revenue statistics:**
```sql
SELECT 
  DATE(submitted_at) as date,
  COUNT(*) as total_submissions,
  SUM(CASE WHEN status='verified' THEN amount_ngn ELSE 0 END) as verified_revenue,
  COUNT(CASE WHEN status='pending' THEN 1 END) as pending_count
FROM direct_payment_submissions
GROUP BY DATE(submitted_at)
ORDER BY date DESC;
```

---

## Security Considerations

### Access Control
- User endpoints require authentication (`protect` middleware)
- Admin endpoints require authentication + `manage_billing` permission
- Admins can only see their organization's payments

### Data Privacy
- Receipt URLs are time-limited (Supabase Storage expiration)
- Rejection reasons logged but not exposed to other users
- Audit logs immutable (no DELETE operations)

### Input Validation
- File type validation (JPEG, PNG, PDF only)
- File size limit (5MB)
- Amount must be positive decimal
- Plan name must be in allowed list
- Billing interval must be 'monthly' or 'annual'

---

## Testing Checklist

- [ ] User can submit payment with receipt file
- [ ] Submitted payment appears in admin queue as "pending"
- [ ] Admin can view payment details with receipt preview
- [ ] Admin can approve payment → subscription activated
- [ ] Admin can reject payment → user sees rejection reason
- [ ] Approved users can see active subscription status
- [ ] Reminder emails sent at 7d, 3d, 1d before expiry
- [ ] Users downgraded to free tier after grace period
- [ ] Admin dashboard shows correct payment statistics
- [ ] Audit log captures all subscription changes
- [ ] Scheduler runs daily without errors

---

## Future Enhancements

1. **Auto-renewal**: Enable auto_renew flag to automatically activate subscriptions
2. **Payment reminders**: Email users before payment due date
3. **Receipt OCR**: Auto-extract amount from receipt images
4. **Webhook receipts**: Accept payment confirmations from bank APIs
5. **Subscription plans**: Support more granular plan options (quarterly, etc.)
6. **Volume discounts**: Calculate pricing based on annual commitment
7. **Trial periods**: Free trial before paid subscription
8. **Multi-currency**: Support USD, GBP, etc. in addition to NGN
9. **Tax calculation**: Calculate and track tax on subscriptions
10. **Invoicing**: Generate invoices for users and admins

---

## Related Documentation

- [Database Schema](./database/migrations/030_direct_payment_and_subscription_management.sql)
- [Payment Submission Service](./backend/src/services/paymentSubmissionService.js)
- [Admin Payment Service](./backend/src/services/adminPaymentService.js)
- [Subscription Management Service](./backend/src/services/subscriptionManagementService.js)
- [Admin Routes](./backend/src/routes/adminRoutes.js)
- [Subscription Routes](./backend/src/routes/subscriptionRoutes.js)

