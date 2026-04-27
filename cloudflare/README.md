# Cloudflare Origin Certificate

Production nginx expects these files on the server:

- `cloudflare/origin.pem`
- `cloudflare/origin-key.pem`

Create them in Cloudflare:

1. Open **SSL/TLS -> Origin Server -> Create Certificate**.
2. Add hostnames `cayhesabim.com` and `*.cayhesabim.com`.
3. Save the certificate as `origin.pem`.
4. Save the private key as `origin-key.pem`.
5. In Cloudflare, set **SSL/TLS encryption mode** to **Full (strict)**.

Then redeploy:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Do not commit the `.pem` files.
