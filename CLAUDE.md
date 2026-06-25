# AI-Generated Apps Security Rules & Guidelines

This guide establishes the security standards and rules that this project must enforce at all times.

## 1. Secrets and Environment Variables
* **Rule**: Never expose secrets in frontend code.
* All API keys, database URLs, and private configurations must live in `.env` files only.
* The `.env` file must always be excluded in `.gitignore` (which includes `.env`, `.env.local`, `.env.*.local`).
* Frontend code must never contain raw secret values.
* For Vite, only variables prefixed with `VITE_` belong in the frontend, and these must never be secret keys.
* Backend secrets must be accessed via backend env vars only.
* A `.env.example` file with empty values must be kept in the repository root.
* Intentional public client-side keys (like Supabase anon key) must be clearly commented.

## 2. Rate Limiting
* **Rule**: Apply rate limiting on all API routes.
* Auth endpoints: 5 requests per 15 mins per IP.
* General API: 60 requests per minute per IP.
* AI/LLM endpoints: 10 requests per minute per user.
* File uploads: 5 requests per minute per IP.
* Show user-friendly rate-limit error messages on the frontend.

## 3. Input Validation and Sanitization
* **Rule**: Validate and sanitize everything on the server.
* Use schema validation libraries (Zod/Joi) to validate data types, formats, length limits, and enum values.
* Parameterize or use ORM for all database queries; never construct queries via string concatenation with user data.
* Validate uploaded file sizes, extensions, and MIME types on the server.

## 4. Authentication and Authorization
* **Rule**: Use established auth libraries and follow password rules.
* Never store plain text passwords (use bcrypt with cost >= 12, or argon2).
* Sign JWTs with a strong env-stored secret (>= 32 chars). Short expiries (15-60 mins) only.
* Refresh tokens in `httpOnly` cookies, never in `localStorage`.
* Validate user identity and verify correct resource ownership/permissions on every single request.

## 5. SQL and Database Security
* **Rule**: Always use an ORM or parameterized queries.
* constructed queries must never concatenate raw user input.
* Do not return raw database error messages or internal schema details to the client.

## 6. CORS Configuration
* **Rule**: Never use wildcard CORS (`*`) in production.
* Explicitly whitelist only known origins. Restrict allowed HTTP methods.

## 7. HTTP Security Headers
* **Rule**: Set security headers using Helmet or config.
* CSP, X-Frame-Options (DENY/SAMEORIGIN), X-Content-Type-Options (nosniff), HSTS, and Referrer-Policy. Remove `X-Powered-By`.

## 8. File Upload Security
* **Rule**: Validate, rename, and store uploads safely.
* Validate file sizes (e.g. 5MB max for images). Store files outside the web root or in secure cloud buckets. Rename files to UUIDs.

## 9. Error Handling and Logging
* **Rule**: Never return internal errors or stack traces to the client.
* Return generic error messages to clients. Log detailed errors server-side securely.

## 10. Dependency Security
* **Rule**: Audit dependencies and pin versions.
* Pin dependencies via `package-lock.json` or `requirements.txt`. Do regular audits.

## 11. XSS Prevention
* **Rule**: Never render dynamic user content as raw HTML.
* Avoid `dangerouslySetInnerHTML` unless input is completely sanitized using libraries like DOMPurify.

## 12. Deployment Checklist
* Before every deploy, verify:
  * `.env` is not committed.
  * Platform environment variables are populated correctly.
  * Database access is locked down.
  * HTTPS is enforced.
  * rate-limiting and CORS policies are locked down.

---

## AI and LLM-Specific Rules
* Sanitise inputs before calling LLMs to prevent prompt injection.
* Enforce `max_tokens` limits.
* Keep LLM key server-side only; route all LLM calls through backend proxies.
* Validate and sanitize LLM outputs before rendering them to avoid XSS.
