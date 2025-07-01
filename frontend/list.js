document.addEventListener("DOMContentLoaded", () => {
  fetch("/games")
    .then(res => res.json())
    .then(games => {
      const list = document.getElementById("game-list");
      if (!list) return;

      list.innerHTML = "";

      games.forEach(game => {
        const li = document.createElement("li");
        li.innerHTML = `
          🎮 <a href="game.html?id=${game.id}">${game.name}</a> <span>(${game.year})</span>
        `;
        list.appendChild(li);
      });
    })
    .catch(err => {
      console.error("Gagal mengambil daftar game:", err);
      const list = document.getElementById("game-list");
      if (list) list.innerHTML = "<p>⚠️ Gagal memuat daftar game.</p>";
    });
});
