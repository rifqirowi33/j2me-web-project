import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const filePath = path.join(__dirname, "games.json");

export let games = JSON.parse(fs.readFileSync(filePath, "utf-8"));

export function incrementDownload(id) {
  const g = games.find(x => x.id === id);
  if (!g) return null;
  g.downloads = (g.downloads || 0) + 1;
  fs.writeFileSync(filePath, JSON.stringify(games, null, 2));
  return g;
}