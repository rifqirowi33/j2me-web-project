/* frontend/game.js */
const id        = new URLSearchParams(location.search).get("id");
const container = document.getElementById("game-detail");

if (!id || !container) {
  console.error("❌ ID game atau elemen container tidak ditemukan");
}

fetch("/gamelist")
  .then((r) => r.json())
  .then((data) => {
    const g = data.find((x) => x.id === id);
    if (!g) {
      container.innerHTML = "❌ Game tidak ditemukan";
      return;
    }

    /* ---------- markup detail ---------- */
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
      </p>
    `;

    /* ---------- update counter setelah unduh ---------- */
    document.getElementById("downloadBtn").addEventListener("click", () => {
      setTimeout(() => {
        fetch("/gamelist")
          .then((r) => r.json())
          .then((data) => {
            const updated = data.find((x) => x.id === g.id);
            if (updated) {
              const info = document.querySelector(".info");
              info.innerHTML = info.innerHTML.replace(
                /Diunduh:<\/strong> \d+×/,
                `Diunduh:</strong> ${updated.downloads}×`
              );
            }
          });
      }, 2000); // delay 2 detik
    });

    const track = document.getElementById("track");
    let startX = 0, scrollStart = 0;
    track.addEventListener("touchstart", e => {
      startX = e.touches[0].pageX;
      scrollStart = track.scrollLeft;
    });
    track.addEventListener("touchmove", e => {
      const delta = startX - e.touches[0].pageX;
      track.scrollLeft = scrollStart + delta;
    });

    let isDown = false;
    track.addEventListener("mousedown", e => { isDown = true; startX = e.pageX; scrollStart = track.scrollLeft; });
    track.addEventListener("mousemove", e => {
      if (!isDown) return;
      const delta = startX - e.pageX;
    track.scrollLeft = scrollStart + delta;
  });
  track.addEventListener("mouseup", () => isDown = false);
  track.addEventListener("mouseleave", () => isDown = false);

    /* ---------- Ambil screenshot ---------- */
    fetch(`/screenshots-list/${g.folderSlug}`)
      .then((r) => r.json())
      .then((result) => {
        const track = document.getElementById("track");

        if (!Array.isArray(result) || result.length === 0) {
          track.innerHTML =
            "<p style='color:white'>Tidak ada screenshot tersedia.</p>";
          return;
        }

        /* render gambar */
        result.forEach((key) => {
          const img = document.createElement("img");
          img.src   = `/screenshot/${key}`;
          img.alt   = "Screenshot";
          img.onclick = () => window.open(img.src, "_blank");
          track.appendChild(img);
        });

        /* ---------- Carousel + Swipe ---------- */
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

        /* swipe di layar sentuh */
        let isDown = false;
        let startX;
        let scrollLeft;
        
        track.addEventListener("pointerdown", (e) => {
          isDown = true;
          track.style.cursor = "grabbing";
          startX = e.pageX - track.offsetLeft;
          scrollLeft = track.scrollLeft;
        });
        
        track.addEventListener("pointerleave", () => {
          isDown = false;
          track.style.cursor = "grab";
        });
        
        track.addEventListener("pointerup", () => {
          isDown = false;
          track.style.cursor = "grab";
        });
        
        track.addEventListener("pointermove", (e) => {
          if (!isDown) return;
          e.preventDefault();
          const x = e.pageX - track.offsetLeft;
          const walk = (x - startX) * 1.5; // angka ini bisa kamu sesuaikan agar lebih/kurang geser
          track.scrollLeft = scrollLeft - walk;
        });
      
        track.addEventListener("pointercancel", () => {
          isDragging = false;
        });
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