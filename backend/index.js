import mime from "mime-types";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "config.env") });

import express from "express";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "./r2client.js";
import { games } from "./games.js";

// Setelah dotenv dimuat, baru buat client S3
const s3 = createS3Client(process.env);

const app  = express();
const PORT = process.env.PORT || 3535;

import fs from "fs"; // di bagian atas
const FRONTEND_PATH = path.join(__dirname, "..", "frontend");

// layani frontend static dari folder /frontend
app.use(express.static(FRONTEND_PATH));

app.get("/games", (_req, res) => res.json(games));

// fallback: kalau user buka '/', tampilkan index.html dari /frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

app.get("/", (req, res) => {
  const ua     = req.headers["user-agent"] || "";
  const opera  = req.headers["x-operamini-phone-ua"];
  const accept = req.headers["x-requested-with"];

  const isOperaMini = ua.includes("Opera Mini") || opera || accept === "com.opera.mini.native";

  if (isOperaMini) {
    return res.redirect("/games-opera");
  }

  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("/games", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "games.html"));
});


app.get("/game", (_req, res) => res.sendFile(path.join(FRONTEND_PATH, "game.html")));

app.get("/games-opera", (req, res) => {
  const list = games.map(game => `
    <li>
      <b>${game.name}</b> (${game.year})<br>
      <a href="/download/${game.id}">Unduh (${(game.size / 1024).toFixed(1)} KB)</a>
    </li>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Daftar Game Java</title>
      <meta charset="utf-8">
      <style>
        body { background:black; color:white; font-family:sans-serif; padding:10px; }
        a { color: #0ff }
      </style>
    </head>
    <body>
      <h2>📱 Game Java J2ME</h2>
      <p>Kompatibel dengan Opera Mini</p>
      <ul>${list}</ul>
      <hr>
      <small>&copy; 2025 java.repp.my.id</small>
    </body>
    </html>
  `;

  res.send(html);
});

app.get("/download/:id", async (req, res) => {
  const game = games.find(g => g.id === req.params.id);
  if (!game) return res.status(404).json({ error: "Game not found" });

  try {
    const cmd  = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key   : game.key,
    });
    const data = await s3.send(cmd);

    res.setHeader("Content-Type", "application/java-archive");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${game.key}"`
    );
    data.Body.pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Gagal mengunduh file" });
  }
});

app.get("/image/:filename", async (req, res) => {
  const { filename } = req.params;
  const key = `covers/${filename}`; // <=== PENTING: gunakan folder sesuai struktur R2 kamu

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const data = await s3.send(command);

    res.setHeader("Content-Type", mime.lookup(filename) || "application/octet-stream");
    data.Body.pipe(res);
  } catch (err) {
    console.error("❌ Image error:", err);
    res.status(404).send("Image not found");
  }
});

app.get("/screenshot/:id", async (req, res) => {
  const imageName = req.params.id;

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `screenshot/${imageName}`,
    });

    const data = await s3.send(command);

    res.setHeader("Content-Type", "image/png");
    data.Body.pipe(res);
  } catch (err) {
    console.error("Screenshot fetch error:", err);
    res.status(404).send("Screenshot not found");
  }
});

app.listen(PORT, () =>
  console.log(`✅ Server berjalan di http://localhost:${PORT}`)
);