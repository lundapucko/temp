// app.js

const PAGE_SIZE = 15;

let allChapters = [];
let filteredChapters = [];
let currentPage = 1;

// DOM-element
const searchInput = document.getElementById("searchInput");
const districtFilter = document.getElementById("districtFilter");
const chaptersList = document.getElementById("chaptersList");
const pagination = document.getElementById("pagination");
const resultsInfo = document.getElementById("resultsInfo");

document.addEventListener("DOMContentLoaded", () => {
  // Läs Excel-filen från repo
  loadChaptersFromExcel("lokalavdelningar.xlsx");

  searchInput.addEventListener("input", handleFiltersChange);
  districtFilter.addEventListener("change", handleFiltersChange);
});

// --- Läs Excel-fil från server/repo --- //
async function loadChaptersFromExcel(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error("Kunde inte hämta Excel-filen.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Läs hela arket till en 2D-array
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const chapters = [];

    rows.forEach((row, index) => {
      if (!row || row.length === 0) return;

      const stift = (row[0] || "").toString().trim();       // Kolumn A
      const namn = (row[1] || "").toString().trim();        // Kolumn B
      const kortnamn = (row[2] || "").toString().trim();    // Kolumn C
      const nummer = (row[3] || "").toString().trim();      // Kolumn D
      const url = (row[4] || "").toString().trim();         // Kolumn E

      // Hoppa ev. rubrikrad
      if (index === 0) {
        const headerRow = [stift, namn, kortnamn, nummer, url]
          .map((v) => v.toLowerCase());
        const looksLikeHeader =
          headerRow[0].includes("stift") ||
          headerRow[1].includes("namn") ||
          headerRow[2].includes("kort") ||
          headerRow[3].includes("nummer") ||
          headerRow[4].includes("länk") ||
          headerRow[4].includes("url");
        if (looksLikeHeader) {
          return; // hoppa denna rad
        }
      }

      if (!namn && !kortnamn && !nummer) return;

      chapters.push({
        namn,
        kortnamn,
        nummer,
        distrikt: stift,
        url
      });
    });

    if (chapters.length === 0) {
      throw new Error("Inga lokalavdelningar kunde läsas från filen.");
    }

    // Sortera på kortnamn A–Ö
    allChapters = chapters.slice().sort((a, b) =>
      (a.kortnamn || "").localeCompare(b.kortnamn || "", "sv", {
        sensitivity: "base",
      })
    );

    filteredChapters = allChapters.slice();
    currentPage = 1;
    render();
  } catch (error) {
    console.error(error);
    chaptersList.innerHTML =
      '<div class="error-message">Kunde inte läsa lokalavdelningarna från Excel-filen. Kontrollera att kolumnerna är: A stift, B namn, C kortnamn, D nummer, E länk.</div>';
    resultsInfo.textContent = "Fel vid inläsning av lokalavdelningar.";
    pagination.innerHTML = "";
  }
}

// --- Filter (sök + stift) --- //
function handleFiltersChange() {
  if (!allChapters || allChapters.length === 0) {
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  const selectedDistrict = districtFilter.value;

  filteredChapters = allChapters.filter((chapter) => {
    const name = (chapter.namn || "").toLowerCase();
    const shortname = (chapter.kortnamn || "").toLowerCase();
    const number = String(chapter.nummer || "").toLowerCase();
    const district = (chapter.distrikt || "").toLowerCase();

    const matchesQuery =
      query === "" ||
      name.includes(query) ||
      shortname.includes(query) ||
      number.includes(query) ||
      district.includes(query);

    const matchesDistrict =
      !selectedDistrict || chapter.distrikt === selectedDistrict;

    return matchesQuery && matchesDistrict;
  });

  currentPage = 1;
  render();
}

// --- Rendering --- //
function render() {
  renderList();
  renderPagination();
  renderInfo();
}

function renderList() {
  chaptersList.innerHTML = "";

  if (!filteredChapters || filteredChapters.length === 0) {
    chaptersList.innerHTML =
      '<div class="empty-message">Inga lokalavdelningar matchar din sökning eller filter.</div>';
    return;
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pageItems = filteredChapters.slice(startIndex, endIndex);

  pageItems.forEach((chapter) => {
    const card = document.createElement("article");
    card.className = "chapter-card";

    const header = document.createElement("div");
    header.className = "chapter-header";

    const nameEl = document.createElement("div");
    nameEl.className = "chapter-name";
    nameEl.textContent = chapter.namn || "(saknar namn)";

    const shortnameEl = document.createElement("div");
    shortnameEl.className = "chapter-shortname";
    shortnameEl.textContent = chapter.kortnamn || "";

    header.appendChild(nameEl);
    header.appendChild(shortnameEl);

    const meta = document.createElement("div");
    meta.className = "chapter-meta";

    if (chapter.nummer) {
      const numberSpan = document.createElement("span");
      numberSpan.textContent = `Nr: ${chapter.nummer}`;
      meta.appendChild(numberSpan);
    }

    if (chapter.distrikt) {
      const districtSpan = document.createElement("span");
      districtSpan.textContent = chapter.distrikt;
      meta.appendChild(districtSpan);
    }

    const actions = document.createElement("div");
    actions.className = "chapter-actions";

    const link = document.createElement("a");
    link.className = "chapter-link";

    if (chapter.url) {
      link.href = chapter.url;
    } else {
      link.href = "#";
    }

    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Gå till lokalavdelningen";

    actions.appendChild(link);

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(actions);

    chaptersList.appendChild(card);
  });
}

function renderPagination() {
  pagination.innerHTML = "";

  const totalItems = filteredChapters.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;

  if (totalPages <= 1) {
    return; // Ingen paginering behövs
  }

  if (currentPage > totalPages) {
    currentPage = totalPages;
  } else if (currentPage < 1) {
    currentPage = 1;
  }

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "Föregående";
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      render();
    }
  });

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Nästa";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      render();
    }
  });

  const infoSpan = document.createElement("span");
  infoSpan.className = "page-info";
  infoSpan.textContent = `Sida ${currentPage} av ${totalPages}`;

  pagination.appendChild(prevBtn);
  pagination.appendChild(infoSpan);
  pagination.appendChild(nextBtn);
}

function renderInfo() {
  if (!filteredChapters || filteredChapters.length === 0) {
    resultsInfo.textContent = "0 lokalavdelningar";
    return;
  }

  const totalItems = filteredChapters.length;
  const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, totalItems);

  resultsInfo.textContent = `Visar ${startIndex}–${endIndex} av ${totalItems} lokalavdelningar`;
}
