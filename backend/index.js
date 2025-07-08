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
const gamesFilePath = path.join(__dirname, "games.json"); // atau "./backend/games.json" sesuai letaknya

function readGames() {
  const raw = fs.readFileSync(gamesFilePath, "utf-8");
  return JSON.parse(raw);
}
const FRONTEND_PATH = path.join(__dirname, "..", "frontend");

// layani frontend static dari folder /frontend
app.use(express.static(FRONTEND_PATH));

app.get("/games", (req, res) => {
  const games = readGames();

  const list = games.map(g => `
    <li>
    <img src="/icon/${g.icon}" alt="" class="game-icon">
    <a href="/game?id=${g.id}">${g.name}</a> (${g.year})
    </li>
  `).join("");

  res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Daftar Game Java</title>
      <link rel="stylesheet" href="/style.css" />
    </head>
    <body>

      <header>
        <h1>📱Daftar Game Java</h1>
        <p>Temukan dan unduh game Java favoritmu!</p>
      </header>

      <main>
        <ul id="game-list">
          ${list}
        </ul>
      </main>

      <footer>
        <p>© 2025 JAVA.REPP.MY.ID</p>
      </footer>

    </body>
    </html>
  `);
});

app.get("/gamelist", (_req, res) => {
  res.json(readGames());
});


// fallback: kalau user buka '/', tampilkan index.html dari /frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

app.get("/game", (_req, res) => res.sendFile(path.join(FRONTEND_PATH, "game.html")));

app.get("/game-classic", async (req, res) => {
  const id   = req.query.id;
  const game = readGames().find(g => g.id === id);
  if (!game) return res.send("<h2>Game tidak ditemukan</h2>");

  /* ── ambil daftar screenshot di R2 ───────────────────────── */
  let screenshotList = [];
  try {
    const prefix  = `screenshots/${game.folderSlug}/`;
    const result  = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: prefix,
    }));
    screenshotList = (result.Contents || [])
      .map(o => o.Key)
      .filter(k => /\.(png|jpe?g|gif)$/i.test(k))
      .map(k => `/screenshot/${k}`);
  } catch (e) {
    console.error("❌ Gagal ambil screenshot:", e.message);
  }

  /* ── HTML ─────────────────────────────────────────────────── */
  res.send(/*html*/`
<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>${game.name}</title>
  <style>
    body {background:#000;color:#fff;font-family:sans-serif;padding:12px;}
    a    {color:cyan}
    img  {border:1px solid #444;margin:6px 0;}
  </style>
</head><body>
  <h2>${game.name}</h2>
  <p><img src="${game.cover}" width="150" alt="cover"></p>

  <p><strong>Tahun:</strong> ${game.year}</p>
  <p><strong>Layar:</strong> ${game.screen}</p>
  <p><strong>Mod:</strong> ${game.mod}</p>
  <p><strong>Vendor:</strong> ${game.vendor}</p>
  <p><strong>Diunduh:</strong> ${game.downloads}×</p>
  <p><strong>Deskripsi:</strong><br>${game.description}</p>

  ${screenshotList.length
      ? `<h3>Screenshot</h3>` +
        screenshotList.map(src => `
            <p>
              <img src="${src}" width="160"
                   onclick="this.width=this.width==160?document.body.clientWidth:this.width=160">
            </p>`).join("")
      : `<p><em>(Tidak ada screenshot)</em></p>`}

  <p><a href="/download/${game.id}">⬇️ Unduh (${(game.size/1024).toFixed(1)} KB)</a></p>
  <p><a href="/games-classic">← Kembali ke daftar</a></p>
</body></html>
  `);
});

app.get("/games-classic", (req, res) => {
  const list = games.map(game => `
    <li style="margin-bottom:10px;display:flex;align-items:center;">
      <img src="/icon/${game.icon || 'default.png'}" alt="icon" width="24" height="24"
        style="margin-right:6px;border:1px solid #444;border-radius:4px">
      <a href="/game-classic?id=${game.id}">
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
        a { color: #0ff; text-decoration: none; }
        a:hover { text-decoration: underline; }
        img { vertical-align: middle; }
      </style>
    </head>
    <body>
      <h2>📟 JAVA REPP.MY.ID</h2>
      <p>Mendukung Opera Mini dan HP Jadul! Klik judul untuk melihat detail game</p>
      <ul style="list-style:none;padding:0">${list}</ul>
      <hr>
      <small>&copy; 2025 java.repp.my.id</small>
    </body>
    </html>
  `;

  res.send(html);
});

app.get("/download/:id", async (req, res) => {
  const game = readGames().find((g) => g.id === req.params.id);
  if (!game) return res.status(404).json({ error: "Game not found" });

  try {
    incrementDownload(game.id);  // <- angka otomatis naik & disimpan
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

app.get("/icon/:filename", async (req, res) => {
  const { filename } = req.params;
  const key = `icons/${filename}`; // disimpan di folder 'icons/' di R2

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const data = await s3.send(command);
    res.setHeader("Content-Type", mime.lookup(filename) || "image/png");
    data.Body.pipe(res);
  } catch (err) {
    console.error("❌ Icon error:", err);
    res.status(404).send("Icon not found");
  }
});

app.use(express.json());

app.post("/api/add-game", (req, res) => {
  try {
    const newGame = req.body;
    const games = readGames();

    if (!newGame.id || !newGame.name) {
      return res.status(400).json({ error: "ID dan nama harus diisi" });
    }

    const exists = games.find(g => g.id === newGame.id);
    if (exists) {
      return res.status(409).json({ error: "ID game sudah ada" });
    }

    games.push(newGame);
    fs.writeFileSync(gamesFilePath, JSON.stringify(games, null, 2));
    res.json({ success: true, message: "Game berhasil ditambahkan!" });
  } catch (err) {
    console.error("❌ Gagal menambah game:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat menambah game" });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Server berjalan di http://localhost:${PORT}`)
);

// Halaman 404: tangkap semua route yang tidak cocok
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>404 - Tidak Ditemukan</title>
      <style>
        body {
          background-color: black;
          color: white;
          font-family: monospace;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }

        h1 {
          font-size: 2em;
          margin-bottom: 0.5em;
          color: #fff;
        }

        .flicker {
          font-size: 8rem;
          color: #666;
          animation: flickerAnim 2s infinite;
          text-shadow: 0 0 5px #f00, 0 0 10px #f00;
        }

        @keyframes flickerAnim {
          0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
            color: #f00;
            opacity: 1;
            text-shadow: 0 0 5px #f00, 0 0 10px #f00;
          }
          20%, 22%, 24%, 55% {
            color: #333;
            opacity: 0.4;
            text-shadow: none;
          }
          60%, 62%, 64% {
            color: #f00;
            opacity: 0.8;
            text-shadow: 0 0 3px #f00;
          }
          61%, 63%, 65% {
            color: #222;
            opacity: 0.3;
            text-shadow: none;
          }
        }
      </style>
    </head>
    <body>
      <h1>Tidak ada apapun</h1>
      <div class="flicker">404</div>
    </body>
    </html>
  `);
});
