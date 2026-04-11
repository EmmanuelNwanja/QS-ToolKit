# API Error Codes Reference

This document defines all standardized error codes returned by the QS Toolkit API. Each error response includes a `code` field that enables client-side branching for specific error handling and user-friendly messaging.

## Response Format

All error responses follow this standardized format:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "code": "ERROR_CODE_NAME",
  "statusCode": 400
}
```

**Note**: The `statusCode` field is included by the global error handler and reflects the HTTP status code of the response.

---

## Authentication Endpoints

### Register (`POST /api/auth/register`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `DISPOSABLE_EMAIL` | 400 | User registers with disposable email domain | Show toast: "Please use a permanent email address" |
| `EMAIL_CONFLICT` | 409 | Email already registered in system | Show toast: "Email already registered. Try logging in or use a different email." |
| `INTERNAL_ERROR` | 500 | Unexpected server error during registration | Show toast: "Registration failed. Please try again." Log error for debugging. |

### Login (`POST /api/auth/login`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `INVALID_CREDENTIALS` | 401 | Email not found OR password incorrect | Show toast: "Invalid email or password" (generic for security) |
| `INTERNAL_ERROR` | 500 | Unexpected server error during login | Show toast: "Login failed. Please try again." Log error for debugging. |

### Verify Email Token (`POST /api/auth/verifyEmail`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `INVALID_TOKEN` | 400 | Token not found in database | Show toast: "Invalid verification link. Request a new one." Offer resend option. |
| `TOKEN_ALREADY_USED` | 400 | Token has been previously consumed | Show toast: "Verification link already used. Request a new one." Offer resend option. |
| `TOKEN_EXPIRED` | 400 | Token timestamp has exceeded TTL (30 minutes) | Show toast: "Verification link expired. Request a new one." Offer resend option. |
| `INTERNAL_ERROR` | 500 | Unexpected server error during verification | Show toast: "Verification failed. Please try again." Log error. |

### Resend Verification Email (`POST /api/auth/resendVerification`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `INTERNAL_ERROR` | 500 | Email send fails or DB error | Show toast: "Failed to resend verification. Please try again." |

---

## Invoice Endpoints

### Create Invoice (`POST /api/invoices`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `INVALID_ITEMS_FORMAT` | 400 | Items array missing, non-array, or contains invalid field types/values | Show toast: "Invalid invoice items. Ensure all items have description, quantity, and price." Focus form on first invalid item. |
| `CLIENT_NAME_REQUIRED` | 400 | Client name is empty or missing | Show toast: "Client name is required." Focus form on client field. |
| `PROJECT_NOT_FOUND` | 404 | Project ID does not exist or user lacks access | Show toast: "Project not found." Redirect to project list. |
| `INTERNAL_ERROR` | 500 | Database or service error | Show toast: "Failed to create invoice. Please try again." Log error. |

### Get Invoice (`GET /api/invoices/:id`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `INVOICE_NOT_FOUND` | 404 | Invoice ID does not exist or user lacks access | Show toast: "Invoice not found." Redirect to invoice list. |
| `INTERNAL_ERROR` | 500 | Database error | Show toast: "Failed to load invoice. Please try again." |

### Export Invoice (`GET /api/invoices/:id/export`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `INVOICE_NOT_FOUND` | 404 | Invoice ID does not exist or user lacks access | Show toast: string_missing"Invoice not found." Redirect to invoice list. |
| `INTERNAL_ERROR` | 500 | PDF generation or branding fetch fails | Show toast: "Failed to export invoice. Please try again." Log error. |

---

## BOQ Endpoints

### Get BOQ (`GET /api/boq/:id`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `BOQ_NOT_FOUND` | 404 | BOQ ID does not exist or user lacks access | Show toast: "BOQ not found." Redirect to BOQ list. |
| `INTERNAL_ERROR` | 500 | Database error | Show toast: "Failed to load BOQ. Please try again." |

### Export BOQ (`GET /api/boq/:id/export`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `BOQ_NOT_FOUND` | 404 | BOQ ID does not exist or user lacks access | Show toast: "BOQ not found." Redirect to BOQ list. |
| `INTERNAL_ERROR` | 500 | PDF/Excel generation or branding fetch fails | Show toast: "Failed to export BOQ. Please try again." Log error. |

---

## Project Endpoints

### Get Project (`GET /api/projects/:id`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `PROJECT_NOT_FOUND` | 404 | Project ID does not exist or user lacks access | Show toast: "Project not found." Redirect to project list. |
| `INTERNAL_ERROR` | 500 | Database error | Show toast: "Failed to load project. Please try again." |

### Update Project (`PUT /api/projects/:id`)

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `PROJECT_NOT_FOUND` | 404 | Project ID does not exist or user lacks access | Show toast: "Project not found." Redirect to project list. |
| `INTERNAL_ERROR` | 500 | Update fails due to validation or database error | Show toast: "Failed to update project. Please try again." |

---

## General Error Codes

These codes can appear in any endpoint response:

| Error Code | HTTP Status | Trigger | Recommended Client Action |
|------------|-------------|---------|--------------------------|
| `REQUEST_FAILED` | 400-499 | Generic client error not covered by specific codes | Show generic toast: "Request failed. Please check your input and try again." |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Show toast: "Something went wrong. Our team has been notified. Please try again." Log errors for monitoring. |
| `SUPABASE_NOT_FOUND` | 404 | Supabase query returned no results (generic not-found) | Specific endpoints map this to custom codes like `INVOICE_NOT_FOUND`, `PROJECT_NOT_FOUND` |

---

## Frontend Implementation Pattern

### Error Handling in React Component

```javascript
try {
  const response = await invoiceAPI.create(formData);
  showToast.success('Invoice created successfully');
} catch (error) {
  const errorCode = error.response?.data?.code;
  
  switch (errorCode) {
    case 'INVALID_ITEMS_FORMAT':
      showToast.error('Invalid invoice items. Ensure all items have description, quantity, and price.');
      focusField('items');
      break;
    case 'CLIENT_NAME_REQUIRED':
      showToast.error('Client name is required.');
      focusField('clientName');
      break;
    case 'PROJECT_NOT_FOUND':
      showToast.error('Project not found.');
      navigate('/projects');
      break;
    default:
      showToast.error(error.response?.data?.message || 'Failed to create invoice.');
  }
}
```

---

## Backend Implementation Pattern

### Standardized Error Response

```javascript
// With error code
return res.status(400).json(error('Invalid items format', { code: 'INVALID_ITEMS_FORMAT' }));

// Without custom code (defaults to REQUEST_FAILED or INTERNAL_ERROR via middleware)
return res.status(500).json(error('Database connection failed'));

// The errorHandler middleware automatically adds code and statusCode fields
```

---

## Adding New Error Codes

When adding new error codes:

1. **Define the code** in the relevant endpoint's inline documentation
2. **Update this file** with the code, trigger condition, and recommended client action
3. **Pass the code in the response**: `error('message', { code: 'NEW_CODE_NAME' })`
4. **Update frontend** to handle the new code with specific UX (toast message, redirect, etc.)
5. **Test** the full flow from backend through frontend

---

## Observability & Monitoring

Error codes enable:
- **Client-side metrics**: Track which errors users encounter most frequently
- **Backend logging**: Correlate `code` with `message` and `statusCode` for pattern detection
- **Support**: Easily identify and triage issues from user reports mentioning error codes
- **Analytics**: Monitor trends in specific error categories (auth, invoicing, export)

---

## Revision History

- **2026-04-11**: Initial error code standardization, covering auth, invoice, BOQ, and project endpoints
