require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "submissions.json");
const MAX_MB = Math.max(1, Number(process.env.MAX_FILE_SIZE_MB || 100));
const MAX_BYTES = MAX_MB * 1024 * 1024;

for (const dir of [UPLOAD_DIR, DATA_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]", "utf8");

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "20kb" }));

// Do not expose the uploads directory as a public static folder.
// Files are served only through the authenticated admin download route.

function readSubmissions() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return []; }
}
function writeSubmissions(items) {
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(items, null, 2), "utf8");
  fs.renameSync(temp, DB_FILE);
}
function clean(value, max = 100) {
  return String(value || "").trim().replace(/[<>]/g, "").slice(0, max);
}
function adminAuth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Basic ")) {
    res.set(
      "WWW-Authenticate",
      'Basic realm="School Admin", charset="UTF-8"'
    );

    return res.status(401).send("Authentication required");
  }

  let decoded;

  try {
    decoded = Buffer.from(
      header.slice(6),
      "base64"
    ).toString("utf8");
  } catch {
    return res.status(401).send("Invalid credentials");
  }

  const separator = decoded.indexOf(":");

  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  const expectedUser = process.env.ADMIN_USER || "DIPSTC26";
  const expectedPassword =
    process.env.ADMIN_PASSWORD || "DipSTC@2026";

  const safeEqual = (a, b) => {
    const aa = Buffer.from(a);
    const bb = Buffer.from(b);

    return aa.length === bb.length &&
      crypto.timingSafeEqual(aa, bb);
  };

  if (
    separator < 0 ||
    !safeEqual(user, expectedUser) ||
    !safeEqual(password, expectedPassword)
  ) {
    res.set(
      "WWW-Authenticate",
      'Basic realm="School Admin", charset="UTF-8"'
    );

    return res.status(401).send("Invalid credentials");
  }

  next();
}



const allowed = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/heic", ".heic"],
  ["image/heif", ".heif"],
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/webm", ".webm"],
  ["video/3gpp", ".3gp"]
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = allowed.get(file.mimetype);
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1, fields: 12, fieldSize: 2000 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) return cb(new Error("Please upload a JPG, PNG, WEBP, HEIC, MP4, MOV, WEBM or 3GP file."));
    cb(null, true);
  }
});

// Lightweight in-memory rate limit: maximum 8 submissions per IP per 15 minutes.
const attempts = new Map();
function submissionLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = attempts.get(ip) || { count: 0, start: now };
  if (now - entry.start > 15 * 60 * 1000) { entry.count = 0; entry.start = now; }
  entry.count += 1;
  attempts.set(ip, entry);
  if (entry.count > 8) return res.status(429).json({ error: "Too many attempts. Please try again after 15 minutes." });
  next();
}

app.get("/api/config", (_req, res) => {
  res.json({
    maxFileSizeMb: MAX_MB,
    whatsappGroupLink: process.env.WHATSAPP_GROUP_LINK || "",
    schoolWebsiteUrl: process.env.SCHOOL_WEBSITE_URL || "",
    officialWebsiteUrl: process.env.OFFICIAL_WEBSITE_URL || "https://stcolumbusekdara.cloud/"
  });
});

app.post("/api/submissions", submissionLimit, (req, res, next) => {
  upload.single("media")(req, res, (err) => {
    if (err) return next(err);
    try {
      // Honeypot field: bots should fill this; real users leave it empty.
      if (req.body.website) {
        if (req.file) fs.unlinkSync(path.join(UPLOAD_DIR, req.file.filename));
        return res.status(200).json({ ok: true, message: "Thank you for participating." });
      }
      if (!req.file) return res.status(400).json({ error: "Please select a photo or video first." });

      const studentName = clean(req.body.studentName, 80);
      const className = clean(req.body.className, 30);
      const message = clean(req.body.message, 500);
      const consent = req.body.consent === "on" || req.body.consent === "true";

      if (!studentName || !className || !consent) {
        fs.unlinkSync(path.join(UPLOAD_DIR, req.file.filename));
        return res.status(400).json({ error: "Please complete the required details and parent consent." });
      }

      const record = {
        id: crypto.randomUUID(),
        studentName, className, message,
        fileName: req.file.filename,
        originalName: path.basename(req.file.originalname).slice(0, 150),
        mimeType: req.file.mimetype,
        size: req.file.size,
        submittedAt: new Date().toISOString()
      };
      const records = readSubmissions();
      records.unshift(record);
      writeSubmissions(records);
      res.status(201).json({ ok: true, message: "Your submission has been received. Thank you for sharing your light.", certificate: { name: studentName, message: message || "A light for a brighter tomorrow", className } });
    } catch (e) {
      next(e);
    }
  });
});

app.get("/admin", adminAuth, (req, res) => {
  res.set("Cache-Control", "no-store");

  res.sendFile(
    path.join(__dirname, "public", "admin.html")
  );
});

app.get(
  "/api/admin/submissions",
  adminAuth,
  (req, res) => {

    const records = readSubmissions();

    const submissions = records.map(item => ({
      id: item.id,
      studentName: item.studentName,
      className: item.className,
      message: item.message,
      mimeType: item.mimeType,
      size: item.size,
      submittedAt: item.submittedAt,

      previewUrl:
        `/api/admin/preview/${encodeURIComponent(item.id)}`,

      downloadUrl:
        `/api/admin/download/${encodeURIComponent(item.id)}`
    }));

    res.set("Cache-Control", "private, no-store");

    res.json(submissions);
  }
);


// Private media preview
app.get(
  "/api/admin/preview/:id",
  adminAuth,
  (req, res) => {

    const item = readSubmissions().find(
      x => x.id === req.params.id
    );

    if (!item) {
      return res.status(404).send("Submission not found");
    }

    const filename = path.basename(item.fileName);

    const fullPath = path.join(
      UPLOAD_DIR,
      filename
    );

    if (!fs.existsSync(fullPath)) {
      return res.status(404).send("Media file not found");
    }

    res.set({
      "Content-Type": item.mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store"
    });

    res.sendFile(fullPath);
  }
);


// Download original media
app.get(
  "/api/admin/download/:id",
  adminAuth,
  (req, res) => {

    const item = readSubmissions().find(
      x => x.id === req.params.id
    );

    if (!item) {
      return res.status(404).send("Submission not found");
    }

    const filename = path.basename(item.fileName);

    const fullPath = path.join(
      UPLOAD_DIR,
      filename
    );

    if (!fs.existsSync(fullPath)) {
      return res.status(404).send("Media file not found");
    }

    res.download(
      fullPath,
      path.basename(item.originalName || filename)
    );
  }
);

app.get("/admin.html", adminAuth, (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "admin.html"));
});
app.use(express.static(path.join(ROOT, "public"), { extensions: ["html"] }));
// app.get("/api/admin/submissions", adminAuth, (_req, res) => {
//   const rows = readSubmissions().map(({ fileName, ...row }) => ({
//     ...row,
//     downloadUrl: `/api/admin/download/${encodeURIComponent(row.id)}`
//   }));
//   res.json(rows);
// });
// app.get("/api/admin/download/:id", adminAuth, (req, res) => {
//   const item = readSubmissions().find(x => x.id === req.params.id);
//   if (!item) return res.status(404).send("Submission not found.");
//   const fullPath = path.join(UPLOAD_DIR, path.basename(item.fileName));
//   if (!fs.existsSync(fullPath)) return res.status(404).send("Media file not found.");
//   res.download(fullPath, item.originalName || item.fileName);
// });

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE"
      ? `File is too large. Maximum allowed size is ${MAX_MB} MB.`
      : "Upload could not be processed. Please try again.";
    return res.status(400).json({ error: message });
  }
  res.status(400).json({ error: err.message || "Something went wrong. Please try again." });
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `St. Columbus Diya Campaign running at http://localhost:${PORT}`
  );
});