import mime from "mime-types";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "config.env") });

import express from "express";
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "./r2client.js";
import { games } from "./games.js";
import { incrementDownload } from "./games.js";

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

app.get("/game", (_req, res) => res.sendFile(path.join(FRONTEND_PATH, "game.html")));

app.get("/game-opera", async (req, res) => {
  const id = req.query.id;
  const game = games.find((g) => g.id === id);

  if (!game) {
    return res.send("<h2>Game tidak ditemukan</h2>");
  }

  // Ambil screenshot dari R2
  let screenshotList = [];
  try {
    const prefix = `screenshots/${game.folderSlug}/`;
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: prefix,
    }));
    screenshotList = (result.Contents || [])
      .map((obj) => obj.Key)
      .filter((key) => /\.(png|jpe?g|gif)$/i.test(key))
      .map((key) => `/screenshot/${key}`);
  } catch (err) {
    console.error("❌ Gagal ambil screenshot:", err.message);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${game.name}</title>
      <style>
        body { background: black; color: white; font-family: sans-serif; padding: 14px; }
        a { color: cyan; }
        img { max-width: 100%; margin: 6px 0; border: 1px solid #444; }
      </style>
    </head>
    <body>
      <h2>${game.name}</h2>
      <p><strong>Tahun:</strong> ${game.year}</p>
      <p><strong>Layar:</strong> ${game.screen}</p>
      <p><strong>Mod:</strong> ${game.mod}</p>
      <p><strong>Vendor:</strong> ${game.vendor}</p>
      <p><strong>Deskripsi:</strong><br>${game.description}</p>

      <p><img src="${game.cover}" alt="Cover Game" width="150"></p>

      ${
        screenshotList.length
          ? `<h3>Screenshot:</h3>` + screenshotList.map(src => `<p><img src="${src}"></p>`).join("")
          : `<p><em>(Tidak ada screenshot)</em></p>`
      }

      <p><a href="/download/${game.id}">⬇️ Unduh (${(game.size / 1024).toFixed(1)} KB)</a></p>
      <p><a href="/games-opera">← Kembali ke daftar</a></p>
    </body>
    </html>
  `;

  res.send(html);
});

// untuk tampilan operamini, symbian, hp java
app.get("/games-opera", (req, res) => {
  const list = games.map(game => `
    <li style="margin-bottom: 10px;">
      <a href="/game-opera?id=${game.id}">
        <b>${game.name}</b> (${game.year})
      </a>
    </li>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>JAVA REPP.MY.ID</title>
      <meta charset="utf-8">
      <style>
        body { background: black; color: white; font-family: sans-serif; padding: 10px; }
        a { color: #0ff; }
        img { max-width: 100px; height: auto; margin: 2px; border: 1px solid #444; }
      </style>
    </head>
    <body>
      <h2>📱 JAVA REPP.MY.ID</h2>
      <p>mendukung Opera Mini dan HP Jadul! Klik judul untuk melihat detail Game</p>
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
    const cmd = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: game.key,
    });
    const data = await s3.send(cmd);

    // ambil nama file asli dari key (hilangkan 'games/')
    const originalFilename = path.basename(game.key);

    res.setHeader("Content-Type", "application/java-archive");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${originalFilename}"`
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

// ╭─ menangkap apa pun sesudah /screenshot/ ─╮
app.get(/^\/screenshot\/(.+)$/, async (req, res) => {
  const key = req.params[0];            // "screenshots/monsterhunter/MH1.png"
  const filename = path.basename(key);  // "MH1.png"

  try {
    const { Body } = await s3.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    }));

    res.setHeader("Content-Type", mime.lookup(filename) || "image/png");
    Body.pipe(res);
  } catch (err) {
    console.error("Screenshot fetch error:", err);
    res.status(404).send("Screenshot not found");
  }
});

app.get("/screenshots-list/:folder", async (req, res) => {
  const folder = req.params.folder;
  const prefix = `screenshots/${folder}/`;

  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: prefix,
    });

    const result = await s3.send(command);

    const screenshots = (result.Contents || [])
      .map((obj) => obj.Key)
      .filter((key) => /\.(png|jpg|jpeg|gif)$/i.test(key));

    res.json(screenshots);
  } catch (err) {
    console.error("❌ Error saat mengambil daftar screenshot:", err);
    res.status(500).json({ error: "Gagal mengambil daftar screenshot" });
  }
});

app.post("/api/increment-download/:id", (req, res) => {
  const game = incrementDownload(req.params.id);
  if (game) {
    res.json({ success: true, downloads: game.downloads });
  } else {
    res.status(404).json({ error: "Game not found" });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Server berjalan di http://localhost:${PORT}`)
);