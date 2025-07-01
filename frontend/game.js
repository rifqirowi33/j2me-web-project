const id = new URLSearchParams(location.search).get("id");
const container = document.getElementById("game-detail");

fetch("/url/games")
  .then((r) => r.json())
  .then((data) => {
    const g = data.find((x) => x.id === id);
    if (!g) return (container.innerHTML = "❌ Game tidak ditemukan");

    // Cover + detail
    container.innerHTML = `
      <div class="game-box">
        <img class="cover" src="${g.cover}" alt="Cover ${g.name}" />
        <div class="info">
          <h2>${g.name}</h2>
          <p><strong>Rilis:</strong> ${g.year}</p>
          <p><strong>Layar:</strong> ${g.screen}</p>
          <p><strong>Mod:</strong> ${g.mod}</p>
          <p><strong>Vendor:</strong> ${g.vendor}</p>
          <p><strong>Diunduh:</strong> ${g.downloads}×</p>
          <p>${g.description}</p>
        </div>
      </div>

      <h3>Screenshot</h3>
      <div class="carousel">
        <button id="prevBtn">◀</button>
        <div class="track" id="track"></div>
        <button id="nextBtn">▶</button>
      </div>

      <p style="margin-top:12px;">
        <a class="dl-btn" href="/download/${g.id}">
          ⬇️ Unduh (${(g.size/1024).toFixed(1)} KB)
        </a>
      </p>
    `;

    // isi track
    const track = document.getElementById("track");
    g.screenshots.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.onclick = () => window.open(src, "_blank"); // zoom / download
      track.appendChild(img);
    });

    // Carousel control
    let idx = 0;
    const scrollTo = () =>
      track.scrollTo({ left: idx * 160, behavior: "smooth" });

    document.getElementById("prevBtn").onclick = () => {
      idx = Math.max(idx - 1, 0);
      scrollTo();
    };
    document.getElementById("nextBtn").onclick = () => {
      idx = Math.min(idx + 1, g.screenshots.length - 1);
      scrollTo();
    };
  });
