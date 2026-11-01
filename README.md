# St. Columbus Diya Campaign Website

A self-hosted Node.js + Express Diya Prajwalan campaign website with media submissions, a digital diya interaction and downloadable participation certificates.

## Features

- Responsive festive landing page with an animated CSS diya.
- Student name, class and personal message fields (no parent name or phone number collected).
- Photo/video upload with file type and size validation, client-side preview, remove-file control and upload progress.
- Uploads stored privately in `uploads/`; metadata stored in `data/submissions.json`.
- Digital diya: enter a name, choose a thought, tap the matchstick and touch the wick to light it.
- Branded PNG participation certificate after successful media submission and after digital diya lighting, with download, native device share and WhatsApp message options.
- School emblem and custom illustrated cause backgrounds.
- Official school website link: https://www.stcolumbusekdara.cloud/
- Admin dashboard at `/admin`, protected by HTTP Basic Authentication; dashboard JavaScript is served as a separate file to comply with the Content Security Policy.
- Optional WhatsApp group invite link configured through `.env`.
- Helmet security headers, basic in-memory submission rate limiting and a honeypot field.

## Requirements

- Node.js 18+
- Nginx (recommended for public hosting and HTTPS)

## Install on Ubuntu VPS

```bash
# 1. Upload/extract this folder to your VPS, then enter it
cd st-columbus-diya-campaign

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
nano .env
```

The requested admin credentials are prefilled:
- Admin ID: `DIPSTC26`
- Password: `DipSTC@2026`

Replace the WhatsApp invite URL with your real group invite link. The official school website is already configured as `https://www.stcolumbusekdara.cloud/`. For production, keep `.env` private and change the admin password after initial setup if you prefer a private credential.

```bash
# 4. Start the app
npm start
```

The app listens on `127.0.0.1:3000` by default.

## Run with PM2

```bash
sudo npm install -g pm2
pm2 start server.js --name st-columbus-diya
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup` to enable startup after reboot.

## Nginx reverse proxy

Create a site config such as `/etc/nginx/sites-available/diya`:

```nginx
server {
    listen 80;
    server_name diya.yourdomain.in;

    client_max_body_size 110m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/diya /etc/nginx/sites-enabled/diya
sudo nginx -t
sudo systemctl reload nginx
```

Then configure HTTPS with Certbot for your subdomain.

## URLs

- Public campaign: `https://diya.yourdomain.in/`
- Admin dashboard: `https://diya.yourdomain.in/admin`

The browser will prompt for the admin username and password. Use ID `DIPSTC26` and password `DipSTC@2026` unless you change them in `.env`.

## Important production notes

1. **Do not expose `uploads/` as a public static directory.** The app deliberately serves media only through the authenticated admin download endpoint.
2. Back up both `uploads/` and `data/submissions.json` regularly.
3. Ensure the Linux user running Node/PM2 can write to `uploads/` and `data/`.
4. The app accepts one media file per submission. Supported MIME types: JPEG, PNG, WEBP, HEIC/HEIF, MP4, MOV, WEBM and 3GP.
5. Default max file size is 100 MB. If you change it in `.env`, also adjust Nginx `client_max_body_size` to slightly higher.
6. The built-in rate limit is in-memory and resets when the Node process restarts. For a high-traffic public campaign, consider a persistent rate limiter and a managed database/object storage.
7. The WhatsApp group button appears only when `WHATSAPP_GROUP_LINK` is configured. The official school website link is configured by default.
8. Obtain parent/guardian permission before collecting or publishing students' photos/videos. Admin downloads are private, but the school should still control how media is later shared.
9. Use a domain with HTTPS before inviting families to upload personal media.

## Updating

Replace the files, then restart the process:

```bash
pm2 restart st-columbus-diya
```


## Certificate and digital diya

- A certificate is offered after a successful photo/video submission.
- The digital diya section is independent of media submission and generates its own certificate after the flame is lit.
- PNG generation happens locally in the visitor's browser. The image is not uploaded to the server.
- The Web Share API can share the PNG to compatible apps (including Instagram/WhatsApp where supported). The WhatsApp text-share fallback opens WhatsApp with a message; users can attach the downloaded PNG themselves.


## Latest UI fixes

- Removed duplicated digital diya and certificate modal markup so element IDs are unique.
- Added client-side image/video preview and remove-file action.
- Added upload progress feedback and clearer validation/error messages.
- Fixed admin dashboard JavaScript loading under the security policy.
- Tightened responsive layout and upload interactions.
