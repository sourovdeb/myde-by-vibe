# Sourov Agent

WordPress plugin providing an AI chat/agent admin interface with conversations, skills, and provider settings.

## REST API authentication (dual-nonce requirement)

All plugin REST routes are gated by `sa_rest_permission()` (see `includes/class-sa-settings.php`). The permission callback checks **both** of the following, and requests missing either one fail:

1. **`X-WP-Nonce`** — the standard WordPress REST cookie-auth nonce (created with `wp_create_nonce( 'wp_rest' )`). It is what makes WordPress treat the request as coming from the logged-in admin session. Without it, `current_user_can( 'manage_options' )` fails and the API returns `403 {"code":"forbidden","message":"Admins only."}` — the request is treated as a guest.
2. **`X-SA-Nonce`** — the plugin's own nonce (created with `wp_create_nonce( 'sa_rest' )`). It is bound to the same admin user and page session. Without it, the API returns `403 {"code":"bad_nonce","message":"Nonce check failed."}`.

Both nonces are issued to the admin page in `includes/admin-page.php` (as `nonce` and `rest_nonce`) and attached to every request by `assets/agent.js`. See `assets/agent.js` (`apiCall`) for the reference client implementation:

```
headers: {
  'X-SA-Nonce': <sa_rest nonce>,
  'X-WP-Nonce': <wp_rest nonce>,
  'Content-Type': 'application/json'
}
```

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `403 "Admins only."` | Missing/invalid `X-WP-Nonce` — request treated as guest | Send `X-WP-Nonce` from a logged-in admin session |
| `403 "Nonce check failed."` | Missing/invalid `X-SA-Nonce` | Send `X-SA-Nonce` from the same admin page session |
| Either error after login expires | Nonces are per-session and time-limited | Reload the admin page to obtain fresh nonces |

External integrations must therefore authenticate as a logged-in admin (cookie + `X-WP-Nonce`) **and** include the plugin's `X-SA-Nonce`. Application-password or other non-cookie auth alone will not satisfy `sa_rest_permission()`.
