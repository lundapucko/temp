// app.js

const PAGE_SIZE = 10;
const SHAREPOINT_EXCEL_URL = "lokalavdelningar.xlsx"


let allChapters = [];
let filteredChapters = [];
let currentPage = 1;

// DOM-element
const searchMainInput = document.getElementById("searchMainInput");
const searchLocationInput = document.getElementById("searchLocationInput");
const districtFilter = document.getElementById("districtFilter");
const chaptersList = document.getElementById("chaptersList");
const pagination = document.getElementById("pagination");
const resultsInfo = document.getElementById("resultsInfo");

document.addEventListener("DOMContentLoaded", () => {
  // Läs Excel-filen från repo (justera namn/sökväg vid behov)
  loadChaptersFromExcel(SHAREPOINT_EXCEL_URL);

  searchMainInput.addEventListener("input", handleFiltersChange);
  searchLocationInput.addEventListener("input", handleFiltersChange);
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

      const stift = (row[0] || "").toString().trim();        // A
      const namn = (row[1] || "").toString().trim();         // B
      const kortnamn = (row[2] || "").toString().trim();     // C
      const nummer = (row[3] || "").toString().trim();       // D
      const url = (row[4] || "").toString().trim();          // E
      const forsamling = (row[5] || "").toString().trim();   // F
      const postnummer = (row[6] || "").toString().trim();   // G
      const ort = (row[7] || "").toString().trim();          // H

      // Hoppa ev. rubrikrad
      if (index === 0) {
        const headerRow = [
          stift,
          namn,
          kortnamn,
          nummer,
          url,
          forsamling,
          postnummer,
          ort,
        ].map((v) => v.toLowerCase());

        const looksLikeHeader =
          headerRow[0].includes("stift") ||
          headerRow[0].includes("distrikt") ||
          headerRow[1].includes("namn") ||
          headerRow[2].includes("kort") ||
          headerRow[3].includes("nummer") ||
          headerRow[4].includes("länk") ||
          headerRow[4].includes("url") ||
          headerRow[5].includes("församling") ||
          headerRow[5].includes("pastorat") ||
          headerRow[6].includes("postnr") ||
          headerRow[6].includes("postnummer") ||
          headerRow[7].includes("ort");

        if (looksLikeHeader) {
          return; // hoppa denna rad
        }
      }

      // Skippa rader som helt saknar identitet
      if (!namn && !kortnamn && !nummer) return;

      chapters.push({
        namn,
        kortnamn,
        nummer,
        distrikt: stift,
        url,
        forsamling,
        postnummer,
        ort,
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
      '<div class="error-message">Kunde inte läsa lokalavdelningarna från Excel-filen. Kontrollera att kolumnerna är: A stift/distrikt, B namn, C kortnamn, D nummer, E länk, F församling/pastorat, G postnummer, H ort.</div>';
    resultsInfo.textContent = "Fel vid inläsning av lokalavdelningar.";
    pagination.innerHTML = "";
  }
}

// --- Filter (två sökfält + stiftfilter) --- //
function handleFiltersChange() {
  if (!allChapters || allChapters.length === 0) {
    return;
  }

  const mainQuery = searchMainInput.value.trim().toLowerCase();
  const locationQuery = searchLocationInput.value.trim().toLowerCase();
  const selectedDistrict = districtFilter.value;

  filteredChapters = allChapters.filter((chapter) => {
    const name = (chapter.namn || "").toLowerCase();
    const shortname = (chapter.kortnamn || "").toLowerCase();
    const number = String(chapter.nummer || "").toLowerCase();
    const parish = (chapter.forsamling || "").toLowerCase();
    const postcode = String(chapter.postnummer || "").toLowerCase();
    const city = (chapter.ort || "").toLowerCase();
    const district = (chapter.distrikt || "").toLowerCase();

    // Sökfält 1: namn, kortnamn, nummer, församling/pastorat
    const matchesMain =
      mainQuery === "" ||
      name.includes(mainQuery) ||
      shortname.includes(mainQuery) ||
      number.includes(mainQuery) ||
      parish.includes(mainQuery);

    // Sökfält 2: ort, postnummer
    const matchesLocation =
      locationQuery === "" ||
      postcode.includes(locationQuery) ||
      city.includes(locationQuery);

    // Stift enbart via filter (inte sök)
    const matchesDistrict =
      !selectedDistrict || chapter.distrikt === selectedDistrict;

    // Båda sökfält gäller samtidigt (AND)
    return matchesMain && matchesLocation && matchesDistrict;
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

    // --- Rubrik: bara namn ---
    const header = document.createElement("div");
    header.className = "chapter-header";

    const nameEl = document.createElement("div");
    nameEl.className = "chapter-name";
    nameEl.textContent = chapter.namn || "(saknar namn)";

    header.appendChild(nameEl);

    // --- Metadata: stift, församling, postnummer/ort ---
    const meta = document.createElement("div");
    meta.className = "chapter-meta";

    if (chapter.distrikt) {
      const districtSpan = document.createElement("span");
      districtSpan.textContent = chapter.distrikt;
      meta.appendChild(districtSpan);
    }

    if (chapter.forsamling) {
      const parishSpan = document.createElement("span");
      parishSpan.textContent = chapter.forsamling;
      meta.appendChild(parishSpan);
    }

    if (chapter.postnummer || chapter.ort) {
      const locationSpan = document.createElement("span");
      if (chapter.postnummer && chapter.ort) {
        locationSpan.textContent = `${chapter.postnummer} ${chapter.ort}`;
      } else {
        locationSpan.textContent = chapter.postnummer || chapter.ort;
      }
      meta.appendChild(locationSpan);
    }

    // --- Länk ---
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

    // --- Sätt ihop kortet ---
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

