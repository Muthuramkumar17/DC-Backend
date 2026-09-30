# DC Project Customer Unresolved Defects Fix

Fix only the currently unresolved Customer API defects listed below. Follow the project's existing CommonJS, Express, Mongoose, naming, formatting, response, sequential-ID, authorization, audit-log, timestamp, and error-handling standards.

Do not modify unrelated controllers, models, routes, frontend code, Booking logic, pricing, payment, subscription, invoice, visit, seed data, or valid Customer behavior.

## Files Allowed to Change

1. `backend/src/controllers/customerController.js`
2. `backend/src/routes/customerRoutes.js` only if routing or query handling requires a minimal correction
3. `backend/src/middleware/auth.js` only if protected-field sanitization must be corrected centrally without affecting legitimate fields
4. `backend/server.js` only for safe centralized `CastError` handling
5. `backend/src/models/Customer.js` only if an existing schema option directly causes one of these confirmed defects

Do not redesign the Customer API or rename existing fields.

## Confirmed Unresolved Defects

### CUS-026: Partial Area Search Does Not Work

Request:

```text
GET /api/customers?search=Talla
```

Existing customer:

```text
area: Tallakulam
```

Actual result:

```json
[]
```

Required fix:

- Include `area` in the existing case-insensitive partial-search conditions.
- Preserve partial searches by customer name and phone number.
- Preserve full-area search.
- Escape user-provided search text before building a regular expression, or use another safe search approach.
- Do not allow regular-expression injection or uncontrolled expensive expressions.
- Preserve the existing response structure and computed customer fields.

Suggested safe helper:

```javascript
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};
```

Use the escaped search value with case-insensitive matching only on the intended searchable fields.

### CUS-036 and CUS-037: `isActive` Filter Is Ignored

Requests:

```text
GET /api/customers?isActive=true
GET /api/customers?isActive=false
```

Actual result:

- Both active and inactive customers are returned.

Required fix:

- Parse only the exact query strings `true` and `false`.
- Apply the Boolean value to the MongoDB query.
- Do not use a truthy check that loses the `false` value.
- If `isActive` is omitted, keep the current behavior of returning both active and inactive customers.
- For unsupported values, return `400 Bad Request` with a controlled message.
- Ensure the status filter combines correctly with `search` instead of replacing it.

Suggested pattern:

```javascript
if (req.query.isActive !== undefined) {
  if (!['true', 'false'].includes(req.query.isActive)) {
    return res.status(400).json({
      message: 'isActive must be true or false',
    });
  }

  query.isActive = req.query.isActive === 'true';
}
```

Do not change the existing customer sorting or response enrichment.

### CUS-043: Invalid ObjectId During Delete Exposes Mongoose Details

Request:

```text
DELETE /api/customers/123
```

Actual response exposes a raw Mongoose `CastError`, including model, path, value, and type.

Required fix:

- Validate `req.params.id` using `mongoose.isValidObjectId()` before the database call.
- Return `400 Bad Request` with a controlled response.
- Do not expose model names, field paths, values, types, stack traces, or database details.

Required response:

```json
{
  "message": "Invalid identifier"
}
```

### CUS-045: Invalid ObjectId During Update Returns Generic Server Error

Request:

```text
PUT /api/customers/123
```

Actual response:

```json
{
  "message": "Internal server error"
}
```

Required fix:

- Validate the path parameter before customer lookup or update.
- Return `400 Bad Request`, not a `500` response.
- Use the same controlled response as delete and get handlers.

Required response:

```json
{
  "message": "Invalid identifier"
}
```

Apply consistent ObjectId validation to Customer GET-by-ID, PUT, and DELETE handlers without changing valid not-found behavior:

- Invalid format: `400 Invalid identifier`
- Valid but missing ObjectId: `404 Customer not found`

### CUS-060: Protected Fields Can Be Modified During Update

The update endpoint accepted client-supplied values for:

```text
customerId
__v
```

The endpoint correctly protected `_id`, `createdBy`, and `updatedBy`, but all server-managed fields must be protected.

Required fix:

- Build `updateData` from an explicit allowlist.
- Never pass `req.body` directly to `findByIdAndUpdate()` or another update operation.
- Ignore or reject all fields outside the allowlist.
- Protect at least:
  - `_id`
  - `customerId`
  - `createdBy`
  - `updatedBy` when client supplied
  - `createdAt`
  - `updatedAt`
  - `__v`
- Preserve server-managed timestamps.
- Preserve the existing authenticated actor and audit behavior.

Allowed Customer update fields:

```text
name
phoneNumber
address
doorNo
block
apartmentName
landmark
area
city
pincode
isActive
```

Suggested pattern:

```javascript
const allowedFields = [
  'name',
  'phoneNumber',
  'address',
  'doorNo',
  'block',
  'apartmentName',
  'landmark',
  'area',
  'city',
  'pincode',
  'isActive',
];

const updateData = {};

for (const field of allowedFields) {
  if (Object.prototype.hasOwnProperty.call(req.body, field)) {
    updateData[field] = req.body[field];
  }
}
```

Continue applying the existing type validation, trimming, name validation, phone validation, duplicate check, and `runValidators: true` to allowed fields.

### CUS-068 and CUS-069: Empty or Unknown-Only Update Is Treated as Success

Requests:

```json
{}
```

and:

```json
{
  "isAdmin": true,
  "unexpectedField": "unauthorized-value"
}
```

Actual result:

- Full customer returned as a successful update.
- `updatedAt` changed.
- A successful update audit may be created even though no valid field remained.

Required fix:

- After allowlisting and sanitizing fields, check whether `updateData` has at least one key.
- If no valid fields remain, return `400 Bad Request` before any database write.
- Do not change `updatedAt`.
- Do not create a successful update audit record.
- Do not modify the customer document.

Required response:

```json
{
  "message": "No valid fields to update"
}
```

Requests containing at least one valid field and one unknown field must continue to work as in CUS-070:

- Update only the allowed field.
- Ignore the unknown field.
- Return the updated customer.

## Safe Error Handling

Use controlled status codes:

```text
400: invalid request body, invalid identifier, no valid update fields, validation failure
404: valid identifier with no matching customer
409: duplicate phone number
500: unexpected server failure only
```

For unexpected errors, return:

```json
{
  "message": "Internal server error"
}
```

Do not return raw `error.message` for unexpected errors.

## Audit and Timestamp Integrity

Preserve existing audit functionality, with these requirements:

- A successful valid update may update `updatedAt` and create the existing successful audit record.
- A rejected invalid-ID request must not create a successful audit record.
- An empty update must not alter `updatedAt` or create a successful audit record.
- An unknown-only update must not alter `updatedAt` or create a successful audit record.
- A protected-field-only update must not modify protected fields.
- If no allowed field remains after sanitization, return `400` and perform no write.
- Do not change the current audit schema as part of this fix.

## Preserve Existing Passing Behavior

Do not break these confirmed passing behaviors:

- Valid customer creation and update
- Customer name and phone validation
- Duplicate-phone rejection
- Phone trimming
- Unknown fields ignored when a valid update field is present
- Authentication and HTTP-method permission enforcement
- Inactive user and inactive role enforcement
- Customer GET, search by name, search by phone, full-area search, and partial-name search
- Valid customer deletion
- Valid but nonexistent ID returns `Customer not found`
- Array and null bodies are rejected safely
- Server-generated customer IDs and audit fields during creation
- Sequential-ID, timestamps, and existing response structures

## Required Retests

After implementation, rerun only these cases first:

1. `CUS-026`: partial area search `Talla` returns the Tallakulam customer.
2. `CUS-036`: `isActive=true` returns only active customers.
3. `CUS-037`: `isActive=false` returns only inactive customers.
4. Combined `search` and `isActive` filters apply together.
5. `CUS-043`: delete with ID `123` returns `400 Invalid identifier`.
6. `CUS-045`: update with ID `123` returns `400 Invalid identifier`.
7. `CUS-060`: update cannot modify `customerId`, `_id`, audit fields, timestamps, or `__v`.
8. `CUS-068`: `{}` returns `400 No valid fields to update`; `updatedAt` remains unchanged.
9. `CUS-069`: unknown-only body returns the same controlled `400`; `updatedAt` remains unchanged.
10. `CUS-070`: one valid field plus one unknown field updates only the valid field.
11. Valid update regression.
12. Duplicate-phone update regression.
13. Authorization regression for read-only user update and delete.

## Required Output

After applying the fix, provide:

1. Modified file list.
2. Short explanation for each defect fix.
3. Confirmation that no unrelated Customer behavior changed.
4. Confirmation that no frontend, Booking, payment, subscription, invoice, visit, role, or authentication workflow was changed.
5. Confirmation that protected fields are excluded through an explicit update allowlist.
6. Confirmation that empty and unknown-only updates perform no database write, timestamp update, or successful audit write.
7. Confirmation that invalid ObjectIds return controlled `400` responses.
8. Confirmation that both `search` and `isActive` filters are safe and composable.
9. Results of the focused retest checklist.

Do not modify code outside this confirmed Customer defect scope.
