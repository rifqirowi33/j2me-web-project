const id = new URLSearchParams(location.search).get("id");
const container = document.getElementById("game-detail");

if (!id || !container) {
  console.error("❌ ID game atau elemen container tidak ditemukan");
}

fetch("/games")
  .then((r) => r.json())
  .then((data) => {
    const g = data.find((x) => x.id === id);
    if (!g) {
      container.innerHTML = "❌ Game tidak ditemukan";
      return;
    }

    // Tampilkan detail game + unduhan
    container.innerHTML = `
      <div class="game-box">
        <img class="cover" src="${g.cover}" alt="Cover ${g.name}" />
        <div class="info">
          <h2>${g.name}</h2>
          <p><strong>Tahun Rilis:</strong> ${g.year}</p>
          <p><strong>Ukuran Layar:</strong> ${g.screen}</p>
          <p><strong>Rincian Mod:</strong> ${g.mod}</p>
          <p><strong>Vendor:</strong> ${g.vendor}</p>
          <p><strong>Diunduh:</strong> ${g.downloads}×</p>
          <p>${g.description}</p>
        </div>
      </div>

      <h3 class="ss">Screenshot</h3>
      <div class="carousel">
        <button id="prevBtn">◀</button>
        <div class="track" id="track"></div>
        <button id="nextBtn">▶</button>
      </div>

      <p style="margin-top:12px;">
        <a class="dl-btn" id="downloadBtn" href="/download/${g.id}">
        ⬇️ Unduh (${(g.size / 1024).toFixed(1)} KB)
        </a>
      </p>`;
      
      document.getElementById("downloadBtn").addEventListener("click", () => {
        fetch(`/api/increment-download/${g.id}`, { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
        // Perbarui angka unduhan di UI
        const info = document.querySelector(".info");
        info.innerHTML = info.innerHTML.replace(
          /Diunduh:<\/strong> \d+×/,
          `Diunduh:</strong> ${data.downloads}×`
        );
      }
    })
    .catch((err) => {
      console.error("❌ Gagal memperbarui jumlah unduhan:", err);
    });
  });
    
    // Ambil screenshot dari backend
    fetch(`/screenshots-list/${g.folderSlug}`)
    .then((r) => r.json())
    .then((result) => {
      
      const track = document.getElementById("track");
      if (!Array.isArray(result) || result.length === 0) {
        track.innerHTML = "<p style='color:white'>Tidak ada screenshot tersedia.</p>";
        return;
      }
      
      result.forEach((key) => {
         console.log("Menambahkan screenshot:", key);
        const img = document.createElement("img");
        img.src = `/screenshot/${key}`;
        img.alt = "Screenshot";
        img.onclick = () => window.open(img.src, "_blank");
        track.appendChild(img);
      });

    // Carousel
    let idx = 0;
    const scrollTo = () =>
      track.scrollTo({ left: idx * 160, behavior: "smooth" });
    document.getElementById("prevBtn").onclick = () => {
      idx = Math.max(idx - 1, 0);
      scrollTo();
    };
    document.getElementById("nextBtn").onclick = () => {
      idx = Math.min(idx + 1, result.length - 1);
      scrollTo();
    };
  })
  .catch((err) => {
    console.error("❌ Gagal memuat screenshot:", err);
    document.getElementById("track").innerHTML =
      "<p style='color:white'>Gagal memuat screenshot.</p>";
  });

  })
  .catch((err) => {
    console.error("❌ Gagal memuat detail game:", err);
    container.innerHTML = "❌ Tidak dapat memuat data game.";
  });