# SOP: Production Image Upload & Storage on VPS Using Node.js + Nginx

## 1. Purpose
This Standard Operating Procedure (SOP) defines the standard procedure for storing, processing, serving, and securing application images on a VPS server using:
- **Node.js backend**
- **Multer** for file uploads
- **Sharp** for image optimization & WebP conversion
- **Nginx** for direct static image serving
- **MongoDB** for storing lightweight relative image paths

### Core Goals:
- ⚡ **Fast image loading**: WebP format + Nginx static caching
- 📉 **Reduced server bandwidth usage**: Optimized resolution & quality
- 🔒 **Secure uploads**: Strict MIME type checking & size limits
- 🚀 **Better performance**: Offloading static serving from Node.js to Nginx
- 📦 **Easy backup & maintenance**: Isolated upload directory outside app deployments

---

## 2. Image Storage Architecture

### Production Flow:
```
User Application (React / Mobile App / WebView)
             │
             ▼
    Node.js Backend API
             │
             ▼
 Upload Middleware (Multer)
             │
             ▼
 Image Processing (Sharp)
             │
             ▼
    VPS File Storage
    (/var/www/uploads/)
             │
             ▼
 Nginx Static File Server
             │
             ▼
  User Browser / Client
```

### Environment Storage Strategy:
- **Local Development**: Images served by Express static middleware from `Backend/uploads/`
- **Production (VPS)**: Images served directly by Nginx from `/var/www/uploads/`

---

## 3. VPS & Project Directory Structure

> **CRITICAL RULE**: Do not store uploaded images inside the application deployment folder. This prevents deployments from overwriting user images and enables fast Nginx static serving.

### Recommended VPS Structure:
```text
/var/www/
├── appzeto/
│   ├── backend/
│   └── frontend/
└── uploads/
    ├── foods/
    ├── restaurants/
    ├── categories/
    ├── banners/
    ├── users/
    └── temp/
```

### Development Directory Structure:
```text
Backend/
├── src/
├── uploads/
│   ├── foods/
│   ├── restaurants/
│   ├── categories/
│   ├── banners/
│   └── users/
├── package.json
└── server.js
```

---

## 4. Image Upload & Processing Flow

```text
User uploads image
       │
       ▼
Node.js receives image buffer
       │
       ▼
Validate MIME type & size (Multer)
       │
       ▼
Generate unique filename (UUID / Hash)
       │
       ▼
Process with Sharp (Resize & Convert to WebP)
       │
       ▼
Save file to target path
 ├── Local  → Backend/uploads/<module>/<filename>.webp
 └── VPS    → /var/www/uploads/<module>/<filename>.webp
       │
       ▼
Store relative path in MongoDB (/uploads/<module>/<filename>.webp)
```

### Module Route & Storage Mapping:

| Module | Upload Route | Local Folder | Production VPS Folder |
|---|---|---|---|
| **Food** | `POST /api/foods` | `Backend/uploads/foods` | `/var/www/uploads/foods` |
| **Restaurant** | `POST /api/restaurants` | `Backend/uploads/restaurants` | `/var/www/uploads/restaurants` |
| **Category** | `POST /api/categories` | `Backend/uploads/categories` | `/var/www/uploads/categories` |
| **Banner** | `POST /api/banners` | `Backend/uploads/banners` | `/var/www/uploads/banners` |
| **User Profile** | `POST /api/users/profileimage` | `Backend/uploads/users` | `/var/www/uploads/users` |

---

## 5. Image Optimization Rules

Never store raw camera/phone photos directly.

- **Before Optimization**: `IMG_12345.jpg` (~8 MB, 4000x3000)
- **After Sharp Optimization**: `food_a82hd72.webp` (~150–300 KB, 800x800, WebP)

---

## 6. Image Processing Standards (Sharp Settings)

| Image Type | Max Resolution | Target Format | Quality |
|---|---|---|---|
| **Food Items** | 800 x 800 px | WebP | 80–85% |
| **Restaurant Logos / Covers** | 1200 x 800 px | WebP | 80–85% |
| **Promotional Banners** | 1600 x 600 px | WebP | 80–85% |
| **User Profile Photos** | 400 x 400 px | WebP | 80% |

---

## 7. File Naming Rules

- Never trust or retain the client's original filename.
- Generate filenames using: `module_` + `UUID / Timestamp / Random Hash` + `.webp`
- **Good Example**: `food_a82hd72.webp`, `restaurant_92ks72.webp`
- **Benefits**: Prevents name collisions, prevents directory traversal, improves CDN/browser caching predictability.

---

## 8. MongoDB Storage Rules

- **Do NOT** store Base64 strings, Buffer objects, or binary files in MongoDB.
- **Store ONLY relative URL paths**.

### Example MongoDB Document:
```json
{
  "_id": "60d5ecb8b5c0c8001f3e4a10",
  "name": "Paneer Pizza",
  "image": "/uploads/foods/food_a82hd72.webp"
}
```

### Dynamic URL Resolution:
- **Development**: `http://localhost:5000/uploads/foods/food_a82hd72.webp`
- **Production**: `https://appzeto.com/uploads/foods/food_a82hd72.webp`

---

## 9. Nginx Static Image Serving Configuration

### Development:
Express static middleware serves the files:
```javascript
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

### Production Nginx Config (`/etc/nginx/sites-available/appzeto`):
```nginx
location /uploads/ {
    alias /var/www/uploads/;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
    access_log off;
    autoindex off;
}
```

---

## 10. Browser Cache Strategy

Static images should be cached aggressively by clients and browsers:
```nginx
Cache-Control: public, max-age=2592000, immutable
```
- **30 days browser caching** for dynamic uploaded content.
- For fixed static brand assets: `expires 1y;` can be used.

---

## 11. Upload Security Rules

### 1. File Type Validation:
Allow only valid image MIME types:
- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

Reject `.exe`, `.sh`, `.php`, `.pdf`, `.zip`, and unknown extensions.

### 2. File Size Limits:
- Maximum upload limit: **3 MB to 5 MB**. Reject larger payloads at Multer level.

### 3. Nginx Security Hardening:
```nginx
# Block execution of scripts in uploads directory & block hidden files
location ~ ^/uploads/.*\.(php|pl|py|jsp|asp|sh|cgi)$ {
    deny all;
}

location ~ /\. {
    deny all;
}
```

---

## 12. Nginx Performance Settings

### Enable Gzip for Text/JSON (Exclude WebP/Images):
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```
> Note: Do not gzip WebP/JPEG images as they are already compressed.

### Enable HTTP/2:
```nginx
listen 443 ssl http2;
```

### Disable Access Logging for Static Images:
```nginx
location /uploads/ {
    access_log off;
}
```

---

## 13. Frontend Optimization
- Implement HTML `loading="lazy"` on image elements.
- Use explicit `width` and `height` attributes to prevent layout shift (CLS).

---

## 14. Image Replacement & Deletion Procedure

When an admin updates/replaces an image:
1. Upload and process the new image.
2. Save new file and update MongoDB record.
3. **Delete old image file** from disk (`fs.unlink`) to prevent storage bloat.

---

## 15. Migration Checklist (Cloudinary → Local/VPS Storage)

1. Create upload target directories (`Backend/uploads/` locally & `/var/www/uploads/` on VPS).
2. Configure Nginx static `/uploads/` route alias.
3. Update upload middleware to use Multer memory storage + Sharp processing.
4. Run migration script to download Cloudinary images, convert to WebP, save to VPS, and update MongoDB relative paths.
5. Verify application image loading end-to-end.
6. Safely decommission Cloudinary credentials after verification.

---

## 16. Backup & Monitoring Strategy

- **Backup Target**: `/var/www/uploads/` directory alongside MongoDB dumps.
- **Monitoring Commands**:
  - Check disk space: `df -h`
  - Check upload folder size: `du -sh /var/www/uploads/*`
  - Check Nginx error logs: `tail -f /var/log/nginx/error.log`

---

## 17. Final Go-Live Checklist

- [x] Development images stored in `Backend/uploads/`
- [x] Production images stored in `/var/www/uploads/`
- [x] Sharp converts all uploads to WebP
- [x] Resolutions optimized according to module rules
- [x] Unique non-predictable filenames generated
- [x] MongoDB stores only relative paths
- [x] Nginx handles `/uploads/` directly
- [x] Browser caching headers configured (`max-age=2592000`)
- [x] Strict MIME type & 5MB file size checks enabled
- [x] Unused old images deleted on update/replacement
