import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Lokasi file JSON
const filePath = path.join(__dirname, "games.json");

// Ambil data awal dari file
export let games = JSON.parse(fs.readFileSync(filePath, "utf-8"));

// Fungsi menyimpan kembali ke file JSON
function saveGames() {
  fs.writeFileSync(filePath, JSON.stringify(games, null, 2));
}

// Fungsi untuk menambah jumlah unduhan
export function incrementDownload(id) {
  const game = games.find(g => g.id === id);
  if (game) {
    game.downloads = (game.downloads || 0) + 1;
    saveGames();
    return game; // ← penting agar bisa diakses di route `/api/increment-download/:id`
  }
  return null;
}