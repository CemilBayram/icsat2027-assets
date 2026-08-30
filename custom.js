console.log(
    "%c🔥 ICSAT CUSTOM.JS YENİ SÜRÜM ÇALIŞIYOR 🔥",
    "color:red;font-size:20px;font-weight:bold;"
);

/*
================================================================
GÜNCEL APPS SCRIPT WEB APP DEPLOYMENT'I
Google Sheets'teki 6 sayfa (Program, Speakers, Committee,
Sponsors, Registration, Announcements) tek bir Web App'ten
?sheet=SAYFA_ADI parametresiyle okunuyor.
================================================================
*/

const ICSAT_SHEETS_API_URL =
    "https://script.google.com/macros/s/AKfycbyJDnHRvfnLPfrvX-dcF_ORBL4wPXeTDq3eXbBrMKP8OaQckqtrxM6rqHK-QnEINlo0/exec";

const API_URL =
    `${ICSAT_SHEETS_API_URL}?sheet=Speakers`;

const COMMITTEE_API_URL =
    `${ICSAT_SHEETS_API_URL}?sheet=Committee`;


/*
================================================================
RETRY YARDIMCISI
Apps Script Web App'ler bir süre boşta kalınca "cold start"
gecikmesi yaşıyor ve bazen ilk istekte 404/timeout dönebiliyor.
Bu yüzden başarısız isteği sessizce, artan bekleme süreleriyle
(800ms, 1600ms, 3200ms) birkaç kez daha deniyoruz. Başarılı
isteklerde ekstra gecikme yok — sadece hata durumunda devreye
giriyor.
================================================================
*/

async function icsatFetchJSON(url, retries = 3, backoffMs = 800) {

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {

        try {

            const response = await fetch(
                `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`,
                {
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            return await response.json();

        } catch (err) {

            lastError = err;

            // Son denemeyse bekleme yapmadan hatayı yukarı fırlat
            if (attempt < retries) {
                await new Promise(resolve =>
                    setTimeout(resolve, backoffMs * Math.pow(2, attempt))
                );
            }

        }

    }

    throw lastError;

}


/*
============================================================
SPEAKERS
============================================================
*/

async function loadSpeakers() {

    const container =
        document.getElementById("icsat-speakers");

    if (!container) return;

    container.innerHTML = `
        <div class="speakers-loading">
            Loading speakers…
        </div>
    `;

    try {

        const data = await icsatFetchJSON(API_URL);

        if (!Array.isArray(data)) {
            throw new Error("API bir liste döndürmedi.");
        }


        /*
        ========================================================
        SADECE AKTİF KONUŞMACILAR
        ========================================================
        */

        const activeSpeakers = data
            .filter(speaker =>
                String(speaker.Active)
                    .toLowerCase()
                    .trim() === "true"
            )
            .sort((a, b) =>
                Number(a.Order) - Number(b.Order)
            );


        /*
        ========================================================
        BÖLÜMLER
        ========================================================
        */

        const groups = [
            {
                type: "Keynote",
                title: "Keynote Speakers",
                className: "keynote-section"
            },
            {
                type: "Invited",
                title: "Invited Speakers",
                className: "invited-section"
            },
            {
                type: "Chair",
                title: "Chairs",
                className: "chair-section"
            },
            {
                type: "Speaker",
                title: "Speakers",
                className: "speaker-section"
            }
        ];


        container.innerHTML = "";


        /*
        ========================================================
        HER BÖLÜMÜ OLUŞTUR
        ========================================================
        */

        groups.forEach(group => {

            const speakers =
                activeSpeakers.filter(speaker =>
                    String(speaker.Type)
                        .trim()
                        .toLowerCase() ===
                    group.type.toLowerCase()
                );


            // Bu tipte kişi yoksa bölüm oluşturma
            if (speakers.length === 0) {
                return;
            }


            const section =
                document.createElement("section");

            section.className =
                `speaker-group ${group.className}`;


            /*
            ====================================================
            BÖLÜM BAŞLIĞI
            ====================================================
            */

            const heading =
                document.createElement("div");

            heading.className =
                "speaker-group-heading";


            heading.innerHTML = `

                ${
                    group.type === "Keynote"
                        ? `<span class="section-star">★</span>`
                        : ""
                }

                <h2>
                    ${group.title}
                </h2>

                <div class="heading-line"></div>

            `;


            section.appendChild(heading);


            /*
            ====================================================
            KART GRID
            ====================================================
            */

            const grid =
                document.createElement("div");

            grid.className =
                "speaker-grid";


            speakers.forEach(speaker => {

                const card =
                    createSpeakerCard(speaker);

                grid.appendChild(card);

            });


            section.appendChild(grid);

            container.appendChild(section);

        });


        /*
        ========================================================
        HİÇ AKTİF KONUŞMACI YOKSA
        ========================================================
        */

        if (activeSpeakers.length === 0) {

            container.innerHTML = `

                <div class="speakers-empty">
                    No active speakers available.
                </div>

            `;

        }

    }

    catch (error) {

        console.error(
            "Speakers yüklenemedi:",
            error
        );


        container.innerHTML = `

            <div class="speakers-error">

                <strong>
                    Speakers could not be loaded.
                </strong>

                <br><br>

                ${error.message}

            </div>

        `;

    }

}


/*
================================================================
KONUŞMACI KARTI
================================================================
*/

function createSpeakerCard(speaker) {

    const card =
        document.createElement("article");


    card.className =
        "speaker-card";


    /*
    ------------------------------------------------------------
    TYPE CLASS
    ------------------------------------------------------------
    */

    const type =
        String(speaker.Type || "")
            .trim()
            .toLowerCase();


    card.classList.add(
        `type-${type}`
    );


    /*
    ------------------------------------------------------------
    FOTOĞRAF
    ------------------------------------------------------------
    */

    const photo =
        speaker.Photo
            ? `
                <div class="speaker-photo-wrap">

                    <img
                        class="speaker-photo"
                        src="${speaker.Photo}"
                        alt="${speaker.Name || "Speaker"}"
                        loading="lazy"
                    >

                </div>
              `
            : `
                <div class="speaker-photo-wrap no-photo">
                    <span>Speaker</span>
                </div>
              `;


    /*
    ------------------------------------------------------------
    GOOGLE SCHOLAR
    ------------------------------------------------------------
    */

    const scholar =
        speaker.GoogleScholar &&
        String(speaker.GoogleScholar).trim() !== ""
            ? `
                <a
                    class="speaker-scholar"
                    href="${speaker.GoogleScholar}"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Google Scholar"
                >
                    <span class="scholar-icon">G</span>
                    <span>Google Scholar</span>
                </a>
              `
            : "";


    /*
    ------------------------------------------------------------
    KART İÇERİĞİ
    ------------------------------------------------------------
    */

    card.innerHTML = `

        ${photo}


        <div class="speaker-card-content">


            <div class="speaker-type-label">

                ${
                    type === "keynote"
                        ? "KEYNOTE SPEAKER"
                        : type === "invited"
                            ? "INVITED SPEAKER"
                            : type === "chair"
                                ? "CHAIR"
                                : "SPEAKER"
                }

            </div>


            <h3 class="speaker-name">
                ${speaker.Name || ""}
            </h3>


            ${
                speaker.Title
                    ? `
                        <div class="speaker-talk">
                            ${speaker.Title}
                        </div>
                      `
                    : ""
            }


           ${scholar}


        </div>

    `;


    return card;

}


/*
================================================================
BAŞLAT SPEAKER (retry destekli sağlam init deseni)
================================================================
*/

let speakersInitDone = false;

function initSpeakers() {

    const container =
        document.getElementById("icsat-speakers");

    if (!container) {
        return false;
    }

    console.log("✅ Speakers container bulundu.");

    if (!speakersInitDone) {
        speakersInitDone = true;
        loadSpeakers();
    }

    return true;
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        initSpeakers();
    }
);

if (window.jQuery) {
    jQuery(window).on(
        "elementor/frontend/init",
        function () {
            console.log("✅ Elementor frontend hazır (speakers).");
            setTimeout(initSpeakers, 300);
            setTimeout(initSpeakers, 1000);
            setTimeout(initSpeakers, 2000);
        }
    );
}

let speakersTryCount = 0;

const speakersTryInterval =
    setInterval(function () {

        speakersTryCount++;

        if (initSpeakers()) {
            clearInterval(speakersTryInterval);
        }

        if (speakersTryCount >= 20) {
            clearInterval(speakersTryInterval);
            console.log("⚠️ Speakers container 20 denemede bulunamadı.");
        }

    }, 500);


/*
============================================================
COMMITTEE
============================================================
*/

let committeeLoading = false;
let committeeLoaded = false;

async function loadCommittee() {

    const committeeContainer =
        document.getElementById("committee-container");

    if (!committeeContainer) {
        console.log("Committee container bulunamadı.");
        return;
    }

    // Aynı anda ikinci API isteği başlatma
    if (committeeLoading) {
        console.log("Committee zaten yükleniyor, tekrar başlatılmadı.");
        return;
    }

    committeeLoading = true;

    if (!committeeLoaded) {
        committeeContainer.innerHTML = `
            <div class="committee-loading">
                Loading committee members…
            </div>
        `;
    }

    try {

        const data =
            await icsatFetchJSON(COMMITTEE_API_URL);

        if (!Array.isArray(data)) {
            throw new Error("Committee API bir liste döndürmedi.");
        }

        console.log("Committee API data:", data);
        console.log("Committee toplam kayıt:", data.length);

        /*
        ====================================================
        SADECE AKTİF ÜYELER
        ====================================================
        */

        const activeMembers = data
            .filter(member =>
                String(member.Active)
                    .trim()
                    .toLowerCase() === "true"
            )
            .sort((a, b) =>
                Number(a.Order || 0) -
                Number(b.Order || 0)
            );

        console.log(
            "Committee aktif kayıt:",
            activeMembers.length
        );

        console.log(
            "Committee Section değerleri:",
            [...new Set(
                data.map(member =>
                    String(member.Section || "").trim()
                )
            )]
        );

        /*
        ====================================================
        GRUPLAR
        ====================================================
        */

        const groups = [
            {
                section: "Honorary Chairs",
                title: "Honorary Chairs",
                className: "honorary-chairs-section"
            },
            {
                section: "Chairs",
                title: "Chairs",
                className: "chairs-section"
            },
            {
                section: "Co-Chairs",
                title: "Co-Chairs",
                className: "co-chairs-section"
            },
            {
                section: "Secretariat",
                title: "Secretariat",
                className: "secretariat-section"
            },
            {
                section: "Organizing Committee",
                title: "Organizing Committee Members",
                className: "organizing-committee-section"
            },
            {
                section: "Scientific Committee",
                title: "Scientific Committee Members",
                className: "scientific-committee-section"
            }
        ];

        /*
        ====================================================
        NORMALIZE
        ====================================================
        */

        function normalizeSection(value) {
            return String(value || "")
                .trim()
                .replace(/\s+/g, " ")
                .toLowerCase();
        }

        /*
        ====================================================
        HTML'I GEÇİCİ ALANDA OLUŞTUR
        ====================================================
        */

        const fragment =
            document.createDocumentFragment();

        let renderedGroupCount = 0;

        groups.forEach(group => {

            const target =
                normalizeSection(group.section);

            const members =
                activeMembers.filter(member => {

                    const section =
                        normalizeSection(member.Section);

                    return section === target;
                });

            console.log(
                `Committee "${group.section}":`,
                members.length
            );

            if (members.length === 0) {
                return;
            }

            renderedGroupCount++;

            const section =
                document.createElement("section");

            section.className =
                `committee-group ${group.className}`;

            /*
            ====================================================
            BAŞLIK
            ====================================================
            */

            const heading =
                document.createElement("div");

            heading.className =
                "committee-group-heading";

            heading.innerHTML = `
                <h2>${group.title}</h2>
                <div class="committee-heading-line"></div>
            `;

            section.appendChild(heading);

            /*
            ====================================================
            GRID
            ====================================================
            */

            const grid =
                document.createElement("div");

            grid.className =
                "committee-grid";

            members.forEach(member => {

                const card =
                    createCommitteeCard(member);

                grid.appendChild(card);

            });

            section.appendChild(grid);

            fragment.appendChild(section);

        });

        /*
        ====================================================
        SONUÇ
        ====================================================
        */

        if (renderedGroupCount === 0) {

            committeeContainer.innerHTML = `
                <div class="committee-empty">
                    No active committee members available.
                </div>
            `;

            console.warn(
                "Committee: Hiçbir grup oluşturulamadı."
            );

            return;
        }

        /*
        ====================================================
        DOM'A TEK SEFERDE EKLE
        ====================================================
        */

        committeeContainer.innerHTML = "";
        committeeContainer.appendChild(fragment);

        committeeLoaded = true;

        console.log(
            "✅ Committee render tamamlandı.",
            "Grup sayısı:",
            renderedGroupCount,
            "Kart sayısı:",
            committeeContainer.querySelectorAll(
                ".committee-card"
            ).length
        );

    }

    catch (error) {

        console.error(
            "Committee yüklenemedi:",
            error
        );

        committeeContainer.innerHTML = `
            <div class="committee-error">
                <strong>
                    Committee could not be loaded.
                </strong>

                <br><br>

                ${error.message}
            </div>
        `;

    }

    finally {

        committeeLoading = false;

    }

}


/*
============================================================
COMMITTEE KARTI
============================================================
*/

function createCommitteeCard(member) {

    const card =
        document.createElement("article");

    card.className =
        "committee-card";

    const fullName =
        member.Title
            ? `${member.Title} ${member.Name || ""}`.trim()
            : (member.Name || "").trim();

    card.innerHTML = `

        <div class="committee-card-content">

            <h3 class="committee-name">
                ${fullName}
            </h3>

            ${
                member.Affiliation
                    ? `
                        <div class="committee-affiliation">
                            ${member.Affiliation}
                        </div>
                      `
                    : ""
            }

            ${
                member.Country
                    ? `
                        <div class="committee-country">
                            ${member.Country}
                        </div>
                      `
                    : ""
            }

        </div>

    `;

    return card;
}


/*
============================================================
COMMITTEE INIT
============================================================
*/

let committeeInitDone = false;

function initCommittee() {

    const container =
        document.getElementById("committee-container");

    if (!container) {
        return false;
    }

    console.log("✅ Committee container bulundu.");

    // Aynı init'i tekrar tekrar çalıştırma
    if (!committeeInitDone) {

        committeeInitDone = true;

        loadCommittee();

    }

    return true;
}


/*
============================================================
DOM
============================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    function () {
        initCommittee();
    }
);


/*
============================================================
ELEMENTOR
============================================================
*/

if (window.jQuery) {

    jQuery(window).on(
        "elementor/frontend/init",
        function () {

            console.log(
                "✅ Elementor frontend hazır."
            );

            setTimeout(initCommittee, 300);
            setTimeout(initCommittee, 1000);
            setTimeout(initCommittee, 2000);

        }
    );

}


/*
============================================================
ELEMENTOR GEÇ YÜKLENİRSE
============================================================
*/

let committeeTryCount = 0;

const committeeTryInterval =
    setInterval(function () {

        committeeTryCount++;

        if (initCommittee()) {

            clearInterval(
                committeeTryInterval
            );

        }

        if (committeeTryCount >= 20) {

            clearInterval(
                committeeTryInterval
            );

            console.log(
                "⚠️ Committee container 20 denemede bulunamadı."
            );

        }

    }, 500);


/*
================================================================
ICSAT 2027 — SCIENTIFIC PROGRAM
Program.txt içeriğinden aktarıldı. Çakışma olmasın diye tüm
değişken/fonksiyon adları "program" önekiyle yeniden adlandırıldı
(yukarıdaki "container", "data" gibi genel adlarla ÇAKIŞMAZ).

SHEET SÜTUNLARI (beklenen): day, room, start, end, title, speaker, type

"day" sütunu "5.May", "6.May", "05 May" gibi gün.Ay formatında
girilebilir — kongre yılı aşağıdaki PROGRAM_CONGRESS_YEAR sabitinden
okunur, gelecek yıl değiştirmeniz gerekirse tek satır yeterli.

ODA ADINDA "Online" geçiyorsa (örn. "Online Session - 1") o oturum
otomatik olarak Online bölümüne düşer; geri kalan tüm odalar
yüz yüze bölümde, "Main Hall" en başta, diğerleri alfabetik sırada
(Room A, Room B, Room C ...) gösterilir. Hangi günün online
olacağı önceden belirlenmiş DEĞİLDİR — bu tamamen oda adına göre
otomatik çalışır.
================================================================
*/

const PROGRAM_CONGRESS_YEAR = 2027;

// Belirli online odalar için Zoom linki eklemek isterseniz buraya
// oda adını BİREBİR yazıp linkini girin. Girilmeyen odalarda
// "Zoom linki yakında paylaşılacaktır." yazısı görünür.
const PROGRAM_ZOOM_LINKS = {
    // "Online Session - 1": "https://zoom.us/j/XXXXXXXXXXX",
    // "Online Session - 2": "https://zoom.us/j/XXXXXXXXXXX",
    // "Online Session - 3": "https://zoom.us/j/XXXXXXXXXXX",
};

// DİKKAT: artık const DEĞİL, let — initProgram() bu değişkeni
// container her bulunduğunda yeniden atıyor (Speakers/Committee
// ile aynı sağlam init deseni).
let programContainer = document.getElementById("icsat-pro");

// Program da aynı Apps Script deployment'ından okunuyor
// (doGet, ?sheet parametresi verilmezse zaten "Program"a düşüyor,
// ama açıkça belirtmek daha net).
const PROGRAM_API_URL =
    `${ICSAT_SHEETS_API_URL}?sheet=Program`;

let programData = [];
let programLoadedOnce = false;

async function loadProgram() {

    // Bu sayfada #icsat-pro yoksa (Speakers/Committee sayfalarındayız) hiç çalışma.
    if (!programContainer) return;

    // Sadece ilk yüklemede "loading" göster; 60 saniyelik arka plan
    // yenilemelerinde ekranı gereksiz yere sıfırlamayalım.
    if (!programLoadedOnce) {
        programContainer.innerHTML = `
            <div class="program-loading">Loading program…</div>
        `;
    }

    try {

        programData = await icsatFetchJSON(PROGRAM_API_URL);

        if (!Array.isArray(programData)) {
            throw new Error("Program API bir liste döndürmedi.");
        }

        programLoadedOnce = true;

        programBuild();

    } catch (err) {

        console.error("Program yüklenemedi:", err);

        programContainer.innerHTML = `
            <div class="program-error">
                <strong>Program could not be loaded.</strong>
                <br><br>
                ${err.message}
            </div>
        `;
    }
}

/* ================= TARİH YARDIMCILARI ================= */

const PROGRAM_MONTH_MAP = {
    "jan": 0, "ocak": 0, "oca": 0,
    "feb": 1, "şub": 1, "sub": 1,
    "mar": 2, "mart": 2,
    "apr": 3, "nis": 3, "nisan": 3,
    "may": 4, "mayıs": 4, "mayis": 4,
    "jun": 5, "haz": 5, "haziran": 5,
    "jul": 6, "tem": 6, "temmuz": 6,
    "aug": 7, "agu": 7, "ağu": 7, "agustos": 7, "ağustos": 7,
    "sep": 8, "eyl": 8, "eylul": 8, "eylül": 8,
    "oct": 9, "eki": 9, "ekim": 9,
    "nov": 10, "kas": 10, "kasim": 10, "kasım": 10,
    "dec": 11, "ara": 11, "aralik": 11, "aralık": 11
};

// "5.May", "05 May", "6.Mayıs" gibi değerleri "2027-05-05" formatına çevirir.
function programParseDayISO(dayRaw) {
    const raw = String(dayRaw || "").trim();
    const match = raw.match(/(\d{1,2})[.\s\-]*([A-Za-zÇŞĞÜÖİçşğüöı]+)/);
    if (!match) return null;

    const dayNum = parseInt(match[1], 10);
    const monthKey = match[2].toLowerCase().slice(0, 3) in PROGRAM_MONTH_MAP
        ? match[2].toLowerCase().slice(0, 3)
        : match[2].toLowerCase();

    const monthIndex = PROGRAM_MONTH_MAP[monthKey];
    if (monthIndex === undefined || isNaN(dayNum)) return null;

    const iso = new Date(Date.UTC(PROGRAM_CONGRESS_YEAR, monthIndex, dayNum));
    return iso.toISOString().slice(0, 10); // "2027-05-05"
}

function programFormatDayLabel(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit", month: "long", year: "numeric", weekday: "long"
    });
}

/* ================= DURUM ================= */

function programGetStatus(session, iso) {
    const start = new Date(`${iso}T${session.start || "00:00"}:00+03:00`);
    const end = new Date(`${iso}T${session.end || "00:00"}:00+03:00`);
    const now = new Date();

    if (now > end) return "finished";
    if (now >= start) return "live";
    return "upcoming";
}

function programGetTimeLeft(session, iso) {
    const target = new Date(`${iso}T${session.start || "00:00"}:00+03:00`);
    const diff = target - new Date();
    if (diff <= 0) return "";

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m left`;
}

function programGetSpecial(title = "") {
    const t = title.toLowerCase();
    if (t.includes("lunch")) return "lunch";
    if (t.includes("coffee")) return "coffee";
    return "";
}

function programParseType(session) {
    const raw = `${session.type || ""} ${session.title || ""} ${session.speaker || ""}`.toLowerCase();
    return {
        isKeynote: /key\s*-?\s*note/.test(raw),
        isPoster: raw.includes("poster"),
        isOral: raw.includes("oral"),
        isInvited: raw.includes("invited"),
        isChair: raw.includes("chair")
    };
}

/* ================= ODA YARDIMCILARI ================= */

// Oda adında "online" geçiyorsa bu oda online bölümüne gider.
function programIsOnlineRoom(room) {
    return /online/i.test(room || "");
}

// Main Hall her zaman ilk sırada, kalanı alfabetik (Room A, Room B, Room C...).
function programRoomSort(a, b) {
    const aIsMain = /main hall/i.test(a);
    const bIsMain = /main hall/i.test(b);
    if (aIsMain && !bIsMain) return -1;
    if (bIsMain && !aIsMain) return 1;
    return a.localeCompare(b, "tr");
}

/* ================= OTURUM KARTI ================= */

function programCreateSession(session, iso) {

    const status = programGetStatus(session, iso);
    const special = programGetSpecial(session.title);
    const { isKeynote, isPoster, isOral, isInvited, isChair } = programParseType(session);

    let typeBadge = "";
    if (isKeynote) {
        typeBadge = `<span class="keynote-badge">⭐ Key-Note</span>`;
    } else if (isPoster) {
        typeBadge = `<span class="poster-badge">POSTER</span>`;
    } else if (isOral) {
        typeBadge = `<span class="oral-badge">ORAL</span>`;
    } else if (isInvited) {
        typeBadge = `<span class="invited-badge">INVITED</span>`;
    }

    let speakerBadge = "";
    if (isKeynote || isInvited) {
        speakerBadge = `<span class="invited-badge">Invited Speaker</span>`;
    } else if (isChair) {
        speakerBadge = `<span class="chair-badge">Chair</span>`;
    }

    let badgeHTML = "";
    if (status === "upcoming") {
        badgeHTML = `
            <div class="badge-main">UPCOMING</div>
            <div class="badge-sub">${programGetTimeLeft(session, iso)}</div>
        `;
    } else if (status === "live") {
        badgeHTML = `<div class="badge-main">LIVE NOW</div>`;
    } else {
        badgeHTML = `<div class="badge-main">FINISHED</div>`;
    }

    const el = document.createElement("div");
    el.className = `ip-session ${special} ${isPoster ? "poster-session" : ""} ${isKeynote ? "keynote-session" : ""}`;

    el.innerHTML = `
        <div class="ip-time">${session.start} - ${session.end}</div>
        <div class="ip-title2">${typeBadge} ${session.title || ""}</div>
        <div class="ip-speaker">${speakerBadge} ${session.speaker || ""}</div>
        <div class="ip-badge ${status}">${badgeHTML}</div>
    `;

    return el;
}

/* ================= GRID OLUŞTUR ================= */

function programBuildGrid(roomNames, sessionsByRoom, isOnline) {
    const grid = document.createElement("div");
    grid.className = isOnline ? "ip-grid online" : "ip-grid";

    roomNames.forEach(room => {
        const card = document.createElement("div");
        card.className = "ip-card";

        let zoomHeader = "";
        if (isOnline) {
            const link = PROGRAM_ZOOM_LINKS[room.trim()];
            zoomHeader = link
                ? `<div class="zoom-header"><a href="${link}" target="_blank" rel="noopener noreferrer">🔴 ${room} Zoom</a></div>`
                : `<div class="zoom-header" style="opacity:0.8;">Zoom linki yakında paylaşılacaktır.</div>`;
        }

        card.innerHTML = `<div class="ip-room">${room}${zoomHeader}</div>`;

        sessionsByRoom[room]
            .slice()
            .sort((a, b) => (a.start || "").localeCompare(b.start || ""))
            .forEach(session => {
                card.appendChild(programCreateSession(session, sessionsByRoom.__iso));
            });

        grid.appendChild(card);
    });

    return grid;
}

/* ================= BUILD ================= */

function programBuild(search = "") {

    programContainer.innerHTML = "";

    // Geçerli günleri (ISO tarihe çevrilebilenleri) bul, kronolojik sırala.
    const dayMap = {}; // rawDayValue -> iso
    programData.forEach(s => {
        const raw = s.day;
        if (!(raw in dayMap)) {
            const iso = programParseDayISO(raw);
            if (iso) dayMap[raw] = iso;
        }
    });

    const sortedDayKeys = Object.keys(dayMap).sort((a, b) => dayMap[a].localeCompare(dayMap[b]));

    if (sortedDayKeys.length === 0) {
        programContainer.innerHTML = `<div class="program-empty">No program data available yet.</div>`;
        return;
    }

    sortedDayKeys.forEach(dayKey => {
        const iso = dayMap[dayKey];

        // O güne ait, arama filtresinden geçen oturumlar
        // (Sheet'te aynı satırın birden fazla kez kopyalanmış olma ihtimaline karşı
        //  day+room+start+end+title+speaker+type birebir aynıysa tekilleştirilir.)
        const seenRows = new Set();
        const daySessions = programData.filter(s => {
            if (s.day !== dayKey) return false;

            if (search) {
                const text = `${s.title || ""} ${s.speaker || ""} ${s.room || ""}`.toLowerCase();
                if (!text.includes(search.toLowerCase())) return false;
            }

            const rowKey = JSON.stringify([s.day, s.room, s.start, s.end, s.title, s.speaker, s.type]);
            if (seenRows.has(rowKey)) return false;
            seenRows.add(rowKey);
            return true;
        });

        if (daySessions.length === 0) return;

        programContainer.insertAdjacentHTML("beforeend", `
            <div class="ip-header">
                <div class="ip-title">ICSAT 2027 Scientific Program</div>
                <div class="ip-title--sub">${programFormatDayLabel(iso)}</div>
            </div>
        `);

        // Odalara göre grupla
        const sessionsByRoom = {};
        daySessions.forEach(s => {
            const room = (s.room || "Room").trim();
            (sessionsByRoom[room] ||= []).push(s);
        });
        sessionsByRoom.__iso = iso; // programCreateSession için taşınıyor

        const allRooms = Object.keys(sessionsByRoom).filter(k => k !== "__iso");
        const inPersonRooms = allRooms.filter(r => !programIsOnlineRoom(r)).sort(programRoomSort);
        const onlineRooms = allRooms.filter(r => programIsOnlineRoom(r)).sort((a, b) => a.localeCompare(b, "tr"));

        if (inPersonRooms.length) {
            programContainer.appendChild(programBuildGrid(inPersonRooms, sessionsByRoom, false));
        }

        if (onlineRooms.length) {
            programContainer.insertAdjacentHTML("beforeend", `
                <div class="ip-header" style="margin-top:30px;">
                    <div class="ip-title--sub" style="font-size:22px; font-weight:900;">Online Sessions — Zoom Platform</div>
                </div>
            `);
            programContainer.appendChild(programBuildGrid(onlineRooms, sessionsByRoom, true));
        }
    });
}

/*
================================================================
BAŞLAT PROGRAM (retry destekli sağlam init deseni)
================================================================
*/

let programInitDone = false;

function initProgram() {

    programContainer = document.getElementById("icsat-pro");

    if (!programContainer) {
        return false;
    }

    console.log("✅ Program container bulundu.");

    if (!programInitDone) {
        programInitDone = true;
        loadProgram();
        setInterval(loadProgram, 60000);
    }

    return true;
}

document.addEventListener("DOMContentLoaded", function () {
    initProgram();
});

if (window.jQuery) {
    jQuery(window).on("elementor/frontend/init", function () {
        console.log("✅ Elementor frontend hazır (program).");
        setTimeout(initProgram, 300);
        setTimeout(initProgram, 1000);
        setTimeout(initProgram, 2000);
    });
}

let programTryCount = 0;

const programTryInterval = setInterval(function () {

    programTryCount++;

    if (initProgram()) {
        clearInterval(programTryInterval);
    }

    if (programTryCount >= 20) {
        clearInterval(programTryInterval);
        console.log("⚠️ Program container 20 denemede bulunamadı.");
    }

}, 500);


/*
================================================================
SOSYAL PROGRAM MODÜLÜ
Aynı Apps Script deployment'ından "SocialProgram" adlı sekmeyi
okur. Program modülüyle birebir aynı sağlam init deseni
(DOMContentLoaded + elementor/frontend/init + retry interval)
ve aynı tarih/gün parse yardımcıları (programParseDayISO,
programFormatDayLabel) kullanılır — tekrar kod yazılmaz.

Google Sheet "SocialProgram" sekmesindeki beklenen sütunlar:
  day          -> "5.May" gibi (Program sekmesiyle aynı format)
  time         -> "19:00"
  endTime      -> "22:00" (opsiyonel, boş bırakılabilir)
  title        -> "Gala Dinner"
  location     -> "Dedeman Hotel, Erzurum"
  type         -> "gala" | "tour" | "reception" | "excursion" |
                   "cultural" | "ceremony" | "meal" | "" (serbest metin,
                   ikon eşlemesi anahtar kelimeye göre otomatik yapılır)
  description  -> "Açık büfe akşam yemeği ve canlı müzik..."
  note         -> "Kayıt gerekli / Ücretsizdir" gibi kısa not (opsiyonel)

Hocaların yapması gereken tek şey bu sekime satır eklemek/
düzenlemek — sayfa 60 saniyede bir otomatik güncellenir.
================================================================
*/

let socialContainer = document.getElementById("icsat-social");

const SOCIAL_API_URL =
    `${ICSAT_SHEETS_API_URL}?sheet=SocialProgram`;

let socialData = [];
let socialLoadedOnce = false;

async function loadSocial() {

    // Bu sayfada #icsat-social yoksa hiç çalışma.
    if (!socialContainer) return;

    if (!socialLoadedOnce) {
        socialContainer.innerHTML = `
            <div class="social-loading">Loading social program…</div>
        `;
    }

    try {

        socialData = await icsatFetchJSON(SOCIAL_API_URL);

        if (!Array.isArray(socialData)) {
            throw new Error("Social Program API bir liste döndürmedi.");
        }

        socialLoadedOnce = true;

        socialBuild();

    } catch (err) {

        console.error("Sosyal program yüklenemedi:", err);

        socialContainer.innerHTML = `
            <div class="social-error">
                <strong>Social program could not be loaded.</strong>
                <br><br>
                ${err.message}
            </div>
        `;
    }
}

/* ================= İKON EŞLEME ================= */

function socialGetIcon(type = "", title = "") {
    const t = `${type} ${title}`.toLowerCase();

    if (/gala|dinner|banquet|yemek/.test(t)) return "🍽️";
    if (/tour|gezi|excursion|trip/.test(t)) return "🚌";
    if (/reception|welcome|karşılama|kokteyl|cocktail/.test(t)) return "🤝";
    if (/cultural|concert|müzik|show|folklor|dance/.test(t)) return "🎭";
    if (/ceremony|opening|closing|açılış|kapanış/.test(t)) return "🎓";
    if (/breakfast|coffee|kahvaltı|kahve/.test(t)) return "☕";
    if (/museum|müze|visit|ziyaret/.test(t)) return "🏛️";
    if (/mountain|palandöken|ski|kayak/.test(t)) return "🏔️";

    return "📍";
}

/* ================= KART OLUŞTUR ================= */

function socialCreateCard(event) {

    const el = document.createElement("div");
    el.className = "sp-event icsat-reveal";

    const timeRange = event.endTime
        ? `${event.time} – ${event.endTime}`
        : `${event.time || ""}`;

    el.innerHTML = `
        <div class="sp-dot">${socialGetIcon(event.type, event.title)}</div>
        <div class="sp-card">
            <div class="sp-time">${timeRange}</div>
            <div class="sp-title">${event.title || ""}</div>
            ${event.location ? `<div class="sp-location">📍 ${event.location}</div>` : ""}
            ${event.description ? `<div class="sp-desc">${event.description}</div>` : ""}
            ${event.note ? `<div class="sp-note">${event.note}</div>` : ""}
        </div>
    `;

    return el;
}

/* ================= BUILD ================= */

function socialBuild() {

    socialContainer.innerHTML = "";

    // Program modülüyle aynı gün parse mantığı yeniden kullanılıyor.
    const dayMap = {};
    socialData.forEach(s => {
        const raw = s.day;
        if (!(raw in dayMap)) {
            const iso = programParseDayISO(raw);
            if (iso) dayMap[raw] = iso;
        }
    });

    const sortedDayKeys = Object.keys(dayMap).sort((a, b) => dayMap[a].localeCompare(dayMap[b]));

    if (sortedDayKeys.length === 0) {
        socialContainer.innerHTML = `<div class="social-empty">No social program items available yet.</div>`;
        return;
    }

    sortedDayKeys.forEach(dayKey => {
        const iso = dayMap[dayKey];

        const seenRows = new Set();
        const dayEvents = socialData.filter(s => {
            if (s.day !== dayKey) return false;

            const rowKey = JSON.stringify([s.day, s.time, s.title, s.location]);
            if (seenRows.has(rowKey)) return false;
            seenRows.add(rowKey);
            return true;
        });

        if (dayEvents.length === 0) return;

        socialContainer.insertAdjacentHTML("beforeend", `
            <div class="sp-header">
                <div class="sp-title--main">ICSAT 2027 Social Program</div>
                <div class="sp-title--sub">${programFormatDayLabel(iso)}</div>
            </div>
        `);

        const timeline = document.createElement("div");
        timeline.className = "sp-timeline";

        dayEvents
            .slice()
            .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
            .forEach(event => {
                timeline.appendChild(socialCreateCard(event));
            });

        socialContainer.appendChild(timeline);
    });
}

/*
================================================================
BAŞLAT SOSYAL PROGRAM (retry destekli sağlam init deseni)
================================================================
*/

let socialInitDone = false;

function initSocial() {

    socialContainer = document.getElementById("icsat-social");

    if (!socialContainer) {
        return false;
    }

    console.log("✅ Sosyal Program container bulundu.");

    if (!socialInitDone) {
        socialInitDone = true;
        loadSocial();
        setInterval(loadSocial, 60000);
    }

    return true;
}

document.addEventListener("DOMContentLoaded", function () {
    initSocial();
});

if (window.jQuery) {
    jQuery(window).on("elementor/frontend/init", function () {
        console.log("✅ Elementor frontend hazır (sosyal program).");
        setTimeout(initSocial, 300);
        setTimeout(initSocial, 1000);
        setTimeout(initSocial, 2000);
    });
}

let socialTryCount = 0;

const socialTryInterval = setInterval(function () {

    socialTryCount++;

    if (initSocial()) {
        clearInterval(socialTryInterval);
    }

    if (socialTryCount >= 20) {
        clearInterval(socialTryInterval);
        console.log("⚠️ Sosyal Program container 20 denemede bulunamadı.");
    }

}, 500);


// ==== ICSAT MENU MODÜLÜ (alt menü destekli) ====
(function () {
  if (window.__ICSAT_MENU_INIT__) return;
  window.__ICSAT_MENU_INIT__ = true;

  const ICSAT_MENU_ENDPOINT = `${ICSAT_SHEETS_API_URL}?sheet=Menu`;

  function icsatIsActiveTrue(val) {
    return val === true || String(val).trim().toUpperCase() === "TRUE";
  }

  function icsatNormalizePath(url) {
    try {
      const u = new URL(url, window.location.origin);
      return u.pathname.replace(/\/$/, "") || "/";
    } catch {
      return String(url || "").replace(/\/$/, "") || "/";
    }
  }

  function icsatBuildLink(item, currentPath) {
    const itemPath = icsatNormalizePath(item.Link);
    const isActive = item.Link !== "#" && itemPath === currentPath;
    return `<a href="${item.Link}" class="icsat-menu-link${isActive ? " is-active" : ""}">${item.Ad}</a>`;
  }

  async function icsatRenderMenu() {
    const container = document.getElementById("icsat-menu");
    if (!container) return;

    container.innerHTML = '<div class="icsat-menu-loading">Menü yükleniyor...</div>';

    try {
      const data = await icsatFetchJSON(ICSAT_MENU_ENDPOINT);

      const items = data
        .filter(item => icsatIsActiveTrue(item.Aktif))
        .sort((a, b) => Number(a.Sira) - Number(b.Sira));

      const currentPath = icsatNormalizePath(window.location.href);

      // Üst seviye: UstMenu hücresi boş olanlar
      const topLevel = items.filter(item => !String(item.UstMenu || "").trim());

      const itemsHtml = topLevel.map(parent => {
        const children = items.filter(
          item => String(item.UstMenu || "").trim() === String(parent.Ad).trim()
        );

        if (children.length === 0) {
          return `<li class="icsat-menu-item">${icsatBuildLink(parent, currentPath)}</li>`;
        }

        const childActive = children.some(
          c => c.Link !== "#" && icsatNormalizePath(c.Link) === currentPath
        );

        const childrenHtml = children
          .map(child => `<li>${icsatBuildLink(child, currentPath)}</li>`)
          .join("");

        return `
          <li class="icsat-menu-item has-submenu${childActive ? " is-active-parent" : ""}">
            <button class="icsat-menu-link icsat-menu-parent" aria-expanded="false">
              ${parent.Ad}
              <svg class="icsat-menu-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <ul class="icsat-submenu">${childrenHtml}</ul>
          </li>
        `;
      }).join("");

      container.innerHTML = `
        <nav class="icsat-menu">
          <ul class="icsat-menu-links">${itemsHtml}</ul>
          <button class="icsat-menu-toggle" aria-label="Menü" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </nav>
      `;

      const nav = container.querySelector(".icsat-menu");
      const toggle = container.querySelector(".icsat-menu-toggle");
      const linksList = container.querySelector(".icsat-menu-links");

      toggle.addEventListener("click", () => {
        const isOpen = linksList.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", isOpen);
        toggle.classList.toggle("is-active", isOpen);
      });

      nav.querySelectorAll(".has-submenu > .icsat-menu-parent").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const li = btn.closest(".has-submenu");
          const wasOpen = li.classList.contains("is-open");

          nav.querySelectorAll(".has-submenu.is-open").forEach(el => {
            el.classList.remove("is-open");
            el.querySelector(".icsat-menu-parent").setAttribute("aria-expanded", "false");
          });

          if (!wasOpen) {
            li.classList.add("is-open");
            btn.setAttribute("aria-expanded", "true");
          }
        });
      });

      document.addEventListener("click", () => {
        nav.querySelectorAll(".has-submenu.is-open").forEach(el => {
          el.classList.remove("is-open");
          el.querySelector(".icsat-menu-parent").setAttribute("aria-expanded", "false");
        });
      });

    } catch (err) {
      console.error("Menu yüklenemedi:", err);
      container.innerHTML = '<div class="icsat-menu-error">Menü yüklenemedi.</div>';
    }
  }

  document.addEventListener("DOMContentLoaded", icsatRenderMenu);
})();
