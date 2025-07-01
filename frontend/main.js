document.addEventListener("DOMContentLoaded", async () => {
  const gameList = document.getElementById("game-list");
  if (!gameList) return;

  try {
    const res = await fetch("/games");
    const games = await res.json();

    games.forEach(game => {
      const li = document.createElement("li");
      li.style.marginBottom = "10px";
      li.style.paddingBottom = "5px";
      li.style.borderBottom = "1px dotted white";

      li.innerHTML = `
        📦 <a href="game?id=${game.id}">${game.name}</a> (${game.year})
      `;

      gameList.appendChild(li);
    });

  } catch (err) {
    console.error("Gagal memuat daftar game:", err);
    gameList.innerHTML = "<li>Gagal memuat daftar game.</li>";
  }
});