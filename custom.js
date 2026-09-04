console.log(
    "%c🔥 ICSAT CUSTOM.JS YENİ SÜRÜM ÇALIŞIYOR 🔥",
    "color:red;font-size:20px;font-weight:bold;"
);
console.log("ICSAT ASSETS — v1.1.1");

/*
================================================================
GÜNCEL APPS SCRIPT WEB APP DEPLOYMENT'I
Google Sheets'teki 8 sayfa (Program, Speakers, Committee,
Sponsors, Registration, Announcements, Documents, Photos) tek
bir Web App'ten ?sheet=SAYFA_ADI parametresiyle okunuyor.
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
SPEAKERS (Speakers / Invited Speakers / Chairs — ORTAK MODÜL)
============================================================
Aynı "Speakers" Google Sheet'i (Type sütunu: Keynote, Invited,
Chair, Speaker) artık BİRDEN FAZLA sayfada, her sayfada sadece
kendi Type'ını göstererek kullanılabiliyor. Sheet, fetch,
retry ve kart tasarımı tamamen ortak — sadece hangi Type'ların
hangi container'a çizileceği değişiyor. Böylece "single source
of truth" korunuyor: yeni bir sayfa açmak için Google Sheet'e
veya API'ye dokunmaya gerek yok, sadece aşağıdaki PAGE_CONFIGS
listesine bir satır eklemek yeterli.
============================================================
*/

// Tüm olası Type'ların ortak tanımı (başlık, className, ikon vb.)
const SPEAKER_GROUP_DEFS = {
    Keynote: {
        title: "Keynote Speakers",
        className: "keynote-section",
        star: true
    },
    Invited: {
        title: "Invited Speakers",
        className: "invited-section",
        star: false
    },
    Chair: {
        title: "Chairs",
        className: "chair-section",
        star: false
    },
    Speaker: {
        title: "Speakers",
        className: "speaker-section",
        star: false
    }
};

/*
================================================================
HANGİ SAYFADA HANGİ TYPE'LAR GÖSTERİLECEK
================================================================
Her sayfanın kendi bare container div'i var (ör: <div
id="icsat-speakers"></div>), sayfada hangisi varsa script onu
bulup sadece o container'a ait Type'ları çiziyor. Bir sayfada
container yoksa o config sessizce atlanır (aynı custom.js her
sayfada yüklü olduğu için bu şart).

Bir sayfayı taşımak/eklemek istersen sadece burayı düzenle.
================================================================
*/

const SPEAKER_PAGE_CONFIGS = [
    {
        // Hocalar Keynote ile Invited'ı aynı grup olarak görüyor,
        // bu yüzden ikisi de bu sayfada — ama "★ Keynote Speakers"
        // alt başlığı ayrım için korunuyor (SPEAKER_GROUP_DEFS'ten).
        containerId: "icsat-invited-speakers",
        types: ["Keynote", "Invited"],
        emptyText: "No active invited speakers available."
    },
    {
        // Chair + düz Speaker aynı sayfada. Speaker hiç
        // eklenmezse o bölüm zaten otomatik gizli kalıyor.
        containerId: "icsat-chairs",
        types: ["Chair", "Speaker"],
        emptyText: "No active chairs available."
    }
];

async function loadSpeakerPage(pageConfig) {

    const container =
        document.getElementById(pageConfig.containerId);

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
        SADECE AKTİF + BU SAYFANIN TYPE'LARINA AİT KONUŞMACILAR
        ========================================================
        */

        const activeSpeakers = data
            .filter(speaker =>
                String(speaker.Active)
                    .toLowerCase()
                    .trim() === "true"
            )
            .filter(speaker =>
                pageConfig.types
                    .map(t => t.toLowerCase())
                    .includes(
                        String(speaker.Type)
                            .trim()
                            .toLowerCase()
                    )
            )
            .sort((a, b) =>
                Number(a.Order) - Number(b.Order)
            );


        container.innerHTML = "";


        /*
        ========================================================
        HER BÖLÜMÜ OLUŞTUR (bu sayfaya ait type sırasıyla)
        ========================================================
        */

        pageConfig.types.forEach(type => {

            const groupDef = SPEAKER_GROUP_DEFS[type];

            if (!groupDef) return;

            const speakers =
                activeSpeakers.filter(speaker =>
                    String(speaker.Type)
                        .trim()
                        .toLowerCase() ===
                    type.toLowerCase()
                );


            // Bu tipte kişi yoksa bölüm oluşturma
            if (speakers.length === 0) {
                return;
            }


            const section =
                document.createElement("section");

            section.className =
                `speaker-group ${groupDef.className}`;


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
                    groupDef.star
                        ? `<span class="section-star">★</span>`
                        : ""
                }

                <h2>
                    ${groupDef.title}
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
                    ${pageConfig.emptyText}
                </div>

            `;

        }

    }

    catch (error) {

        console.error(
            `Speakers yüklenemedi (${pageConfig.containerId}):`,
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
BAŞLAT SPEAKER SAYFALARI (retry destekli sağlam init deseni)
================================================================
Aynı retry deseni artık jenerik bir fabrika fonksiyonuyla her
speaker sayfası (Speakers / Invited Speakers / Chairs) için ayrı
ayrı, ama tek bir yerden kuruluyor. Her sayfada bu custom.js zaten
yüklü olduğu için, o sayfada olmayan container'lar için init hiç
tetiklenmeden sessizce geçilir.
================================================================
*/

function createSpeakerPageInit(pageConfig) {

    let initDone = false;

    function init() {

        const container =
            document.getElementById(pageConfig.containerId);

        if (!container) {
            return false;
        }

        console.log(
            `✅ ${pageConfig.containerId} container bulundu.`
        );

        if (!initDone) {
            initDone = true;
            loadSpeakerPage(pageConfig);
        }

        return true;
    }

    document.addEventListener(
        "DOMContentLoaded",
        function () {
            init();
        }
    );

    if (window.jQuery) {
        jQuery(window).on(
            "elementor/frontend/init",
            function () {
                console.log(
                    `✅ Elementor frontend hazır (${pageConfig.containerId}).`
                );
                setTimeout(init, 300);
                setTimeout(init, 1000);
                setTimeout(init, 2000);
            }
        );
    }

    let tryCount = 0;

    const tryInterval =
        setInterval(function () {

            tryCount++;

            if (init()) {
                clearInterval(tryInterval);
            }

            if (tryCount >= 20) {
                clearInterval(tryInterval);
                console.log(
                    `⚠️ ${pageConfig.containerId} container 20 denemede bulunamadı.`
                );
            }

        }, 500);

}

SPEAKER_PAGE_CONFIGS.forEach(createSpeakerPageInit);


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
let programLastSearch = "";

/*
================================================================
BOOKMARK / TAKİP EDİLEN OTURUMLAR
Gerçek sitede (Claude sandbox'ın aksine) tarayıcının normal
localStorage'ı sorunsuz çalışır — kullanıcının işaretlediği
oturumlar sayfa yenilense de, siteden çıkıp geri gelse de kalıcı
kalır. localStorage bazı gizli/özel tarama modlarında hata
fırlatabildiği için try/catch ile sarmalanıyor.
================================================================
*/

const PROGRAM_FOLLOWED_STORAGE_KEY = "icsatFollowedSessions";

function programLoadFollowed() {
    try {
        const raw = localStorage.getItem(PROGRAM_FOLLOWED_STORAGE_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch (err) {
        return new Set();
    }
}

function programSaveFollowed() {
    try {
        localStorage.setItem(
            PROGRAM_FOLLOWED_STORAGE_KEY,
            JSON.stringify(Array.from(programFollowedIds))
        );
    } catch (err) {
        console.error("Bookmarks could not be saved:", err);
    }
}

let programFollowedIds = programLoadFollowed();

// "Live Now" bandını kapatma sadece bu sayfa yüklemesi boyunca geçerli —
// sayfa yenilenince (F5) otomatik olarak tekrar açık başlar (bilinçli tercih).
let programLiveStickyDismissed = false;

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

const PROGRAM_SOON_THRESHOLD_MIN = 15;   // "Starting Soon" (turuncu) bu dakikadan az kala başlar
const PROGRAM_ENDING_THRESHOLD_PCT = 85; // Oturumun son %15'inde "Ending soon" gösterilir

function programGetStatus(session, iso) {
    const start = new Date(`${iso}T${session.start || "00:00"}:00+03:00`);
    const end = new Date(`${iso}T${session.end || "00:00"}:00+03:00`);
    const now = new Date();

    if (now > end) return "finished";
    if (now >= start) return "live";

    const minsUntilStart = (start - now) / 60000;
    if (minsUntilStart <= PROGRAM_SOON_THRESHOLD_MIN) return "soon";

    return "upcoming";
}

// Canlı bir oturumun ne kadarının geçtiğini (%) ve son %15'te olup olmadığını hesaplar.
function programGetProgress(session, iso) {
    const start = new Date(`${iso}T${session.start || "00:00"}:00+03:00`);
    const end = new Date(`${iso}T${session.end || "00:00"}:00+03:00`);
    const now = new Date();

    const total = end - start;
    if (total <= 0) return { pct: 0, ending: false };

    const pct = Math.min(100, Math.max(0, ((now - start) / total) * 100));
    return { pct, ending: pct >= PROGRAM_ENDING_THRESHOLD_PCT };
}

function programGetTimeLeft(session, iso) {
    const target = new Date(`${iso}T${session.start || "00:00"}:00+03:00`);
    const diff = target - new Date();
    if (diff <= 0) return "";

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m left`;
}

// Canlı bir oturumun/blok'un bitimine ne kadar kaldığını yazıya çevirir —
// progress bar'ın altındaki "X% complete · Y left" etiketinde kullanılır.
function programGetTimeUntilEnd(session, iso) {
    const target = new Date(`${iso}T${session.end || "00:00"}:00+03:00`);
    const diff = target - new Date();
    if (diff <= 0) return "ended";

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
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

/*
================================================================
CHAIR BLOKLARI — GRUPLAMA
Chair, 30 dakikalık kendi sunumunu yapmaz; tüm oturum boyunca
orada durur ve bildirileri sırayla açar. Bu yüzden Sheet'te Chair
satırı TÜM BLOĞUN başlangıç-bitiş saatini kapsar (ör. 10:00-12:00),
altındaki bildiriler ise aynı oda + aynı saat aralığında AYRI
satırlar olarak girilir. Buradaki fonksiyon, aynı odada bir Chair
satırının zaman aralığına "gömülü" (start/end o aralığın içinde
kalan) diğer satırları bulup o Chair'in altına bildiri olarak
topluyor — Sheet'e veya kod.gs'e yeni bir sütun eklemeye gerek
kalmıyor, sadece oda+saat çakışmasına bakılıyor.

Bir Chair satırının altında hiç bildiri bulunamazsa (ör. henüz
Sheet'e bildiriler girilmemişse) o satır normal bir oturum kartı
gibi gösterilir — boş bir mini-ajanda kutusu görünmesin diye.
================================================================
*/

function programGroupChairBlocks(sessions) {
    const list = sessions.slice();
    const chairRows = list.filter(s => programParseType(s).isChair);

    const consumed = new Set();
    const blocks = [];

    chairRows.forEach(chair => {
        const talks = list.filter(s => {
            if (s === chair) return false;
            if (consumed.has(s)) return false;
            if (programParseType(s).isChair) return false; // bir chair diğerinin içine gömülmesin
            return (s.start || "") >= (chair.start || "") && (s.end || "") <= (chair.end || "");
        }).sort((a, b) => (a.start || "").localeCompare(b.start || ""));

        if (talks.length === 0) return; // boş chair — normal oturum gibi kalsın

        talks.forEach(t => consumed.add(t));
        consumed.add(chair);

        blocks.push({ chair, talks });
    });

    const standalone = list.filter(s => !consumed.has(s));

    return { blocks, standalone };
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

function programCreateSession(session, iso, nextItem) {

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
    let progressHTML = "";

    if (status === "upcoming" || status === "soon") {
        badgeHTML = `
            <div class="badge-main">${status === "soon" ? "STARTING SOON" : "UPCOMING"}</div>
            <div class="badge-sub">${programGetTimeLeft(session, iso)}</div>
        `;
    } else if (status === "live") {
        const { pct, ending } = programGetProgress(session, iso);

        badgeHTML = `
            <div class="badge-main">LIVE NOW</div>
            ${ending ? `<div class="badge-sub">Ending soon</div>` : ""}
        `;

        // Progress bar artık sadece renkli çubuk değil — üstünde
        // "%kaç tamamlandı · ne kadar kaldı" yazısı var, tek bakışta
        // ilerleme çubuğu olduğu anlaşılsın diye.
        progressHTML = `
            <div class="progress-wrap">
                <div class="progress-label ${ending ? "ending" : ""}">
                    <span>${pct.toFixed(0)}% complete</span>
                    <span>${programGetTimeUntilEnd(session, iso)}</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill ${ending ? "ending" : ""}" style="width:${pct.toFixed(0)}%"></div>
                </div>
            </div>
        `;
    } else {
        badgeHTML = `<div class="badge-main">FINISHED</div>`;
    }

    // Chair'ler ve o salonu takip edenler için: canlı oturumun altında
    // "Next up" ipucu — salonu terk etmeden sırada ne var görebiliyorlar.
    const nextHTML = (status === "live" && nextItem)
        ? `<div class="ip-next">Next up: <b>${nextItem.start || ""}</b> — ${nextItem.title || ""}</div>`
        : "";

    // Sticky "şu an canlı" bandının, takip listesinin ve
    // programRefreshBadges()'in her oturumu veriye tekrar erişmeden, DOM
    // üzerinden tanıyabilmesi için gerekli bilgiler.
    const sessionId = `sess-${iso}-${(session.room || "").replace(/\s+/g, "_")}-${(session.start || "").replace(":", "")}`;
    const isFollowed = programFollowedIds.has(sessionId);

    const el = document.createElement("div");
    el.id = sessionId;
    el.className = `ip-session ${special} ${isPoster ? "poster-session" : ""} ${isKeynote ? "keynote-session" : ""} ${status === "live" ? "is-live" : ""} ${isFollowed ? "is-followed" : ""}`;
    el.dataset.iso = iso;
    el.dataset.start = session.start || "";
    el.dataset.end = session.end || "";
    el.dataset.room = session.room || "";
    el.dataset.title = session.title || "";

    el.innerHTML = `
        <div class="ip-follow" title="Follow / unfollow this session" data-follow-id="${sessionId}">${isFollowed ? "⭐" : "☆"}</div>
        <div class="ip-time">${session.start} - ${session.end}</div>
        <div class="ip-title2">${typeBadge} ${session.title || ""}</div>
        <div class="ip-speaker">${speakerBadge} ${session.speaker || ""}</div>
        ${progressHTML}
        ${nextHTML}
        <div class="ip-badge ${status}">${badgeHTML}</div>
    `;

    return el;
}

/*
================================================================
CHAIR-LED SESSION KARTI
Chair kendisi sunum yapmaz — kart bloğun TÜMÜNÜ (ör. 10:00-12:00)
kapsar, durum/progress bar da tek bir bildiri değil tüm blok
üzerinden hesaplanır ("2/3 papers presented" gibi). Kartın altında
her bildirinin kendi saatiyle listelendiği bir mini-ajanda var;
o anda sunulan bildiri otomatik olarak "● Now presenting" ile,
bitenler "✓ Done" ile işaretleniyor.
================================================================
*/

function programCreateChairBlock(chair, talks, iso, nextItem) {

    const status = programGetStatus(chair, iso);
    const talksDone = talks.filter(t => programGetStatus(t, iso) === "finished").length;

    let badgeHTML = "";
    let progressHTML = "";

    if (status === "upcoming" || status === "soon") {
        badgeHTML = `
            <div class="badge-main">${status === "soon" ? "STARTING SOON" : "UPCOMING"}</div>
            <div class="badge-sub">${programGetTimeLeft(chair, iso)}</div>
        `;
    } else if (status === "live") {
        const { pct, ending } = programGetProgress(chair, iso);

        badgeHTML = `
            <div class="badge-main">LIVE NOW</div>
            ${ending ? `<div class="badge-sub">Ending soon</div>` : ""}
        `;

        progressHTML = `
            <div class="progress-wrap">
                <div class="progress-label ${ending ? "ending" : ""}">
                    <span>${talksDone}/${talks.length} papers presented</span>
                    <span>${programGetTimeUntilEnd(chair, iso)}</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill ${ending ? "ending" : ""}" style="width:${pct.toFixed(0)}%"></div>
                </div>
            </div>
        `;
    } else {
        badgeHTML = `<div class="badge-main">FINISHED</div>`;
    }

    const nextHTML = (status === "live" && nextItem)
        ? `<div class="ip-next">Next up: <b>${nextItem.start || ""}</b> — ${nextItem.title || ""}</div>`
        : "";

    // Her bildiri satırı iki alt satıra bölünmüş durumda: üstte saat + tip
    // rozeti + durum ("Now presenting"/"Done") yan yana, altta başlık tam
    // genişlikte kendi satırında — uzun akademik başlıklarda bile kart
    // dikeyde kontrolsüzce büyümüyor. Durum class'ları bilinçli olarak
    // "state-" önekiyle: sadece "upcoming/live/finished" ismini kullansaydık
    // sayfadaki genel rozet renkleriyle (aynı isimli class) çakışıp yanlış
    // renk (mavi) miras alınırdı.
    const agendaHTML = talks.map(t => {
        const tStatus = programGetStatus(t, iso);
        let stateClass = "state-upcoming", stateTag = "";
        if (tStatus === "finished") { stateClass = "state-done"; stateTag = "✓ Done"; }
        else if (tStatus === "live") { stateClass = "state-now"; stateTag = "● Now presenting"; }

        const { isKeynote, isPoster, isOral, isInvited } = programParseType(t);
        let typeBadge = "";
        if (isKeynote) typeBadge = `<span class="keynote-badge">⭐ Key-Note</span>`;
        else if (isPoster) typeBadge = `<span class="poster-badge">POSTER</span>`;
        else if (isOral) typeBadge = `<span class="oral-badge">ORAL</span>`;
        else if (isInvited) typeBadge = `<span class="invited-badge">INVITED</span>`;

        return `
            <div class="chair-agenda-item ${stateClass}">
                <div class="ca-row">
                    <span class="ca-time">${t.start || ""}</span>
                    ${typeBadge}
                    ${stateTag ? `<span class="ca-state">${stateTag}</span>` : ""}
                </div>
                <div class="ca-title">${t.title || ""}</div>
                <div class="ca-speaker">${t.speaker || ""}</div>
            </div>
        `;
    }).join("");

    const sessionId = `sess-${iso}-${(chair.room || "").replace(/\s+/g, "_")}-${(chair.start || "").replace(":", "")}`;
    const isFollowed = programFollowedIds.has(sessionId);

    const el = document.createElement("div");
    el.id = sessionId;
    el.className = `ip-session ip-chairblock ${status === "live" ? "is-live" : ""} ${isFollowed ? "is-followed" : ""}`;
    el.dataset.iso = iso;
    el.dataset.start = chair.start || "";
    el.dataset.end = chair.end || "";
    el.dataset.room = chair.room || "";
    el.dataset.title = chair.title || "";

    el.innerHTML = `
        <div class="ip-follow" title="Follow / unfollow this session" data-follow-id="${sessionId}">${isFollowed ? "⭐" : "☆"}</div>
        <div class="ip-time">${chair.start} - ${chair.end}</div>
        <div class="ip-title2"><span class="chair-badge">🎤 CHAIR-LED SESSION</span> ${chair.title || ""}</div>
        <div class="ip-speaker">Chaired by ${chair.speaker || ""}</div>
        ${progressHTML}
        <div class="chair-agenda">${agendaHTML}</div>
        ${nextHTML}
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

        // Chair bloklarını (varsa) tespit edip altındaki bildirileri
        // topluyoruz; geri kalan satırlar normal oturum olarak kalıyor.
        const { blocks, standalone } = programGroupChairBlocks(sessionsByRoom[room]);

        const renderItems = [
            ...blocks.map(b => ({ kind: "chairblock", chair: b.chair, talks: b.talks, sortKey: b.chair.start || "" })),
            ...standalone.map(s => ({ kind: "session", session: s, sortKey: s.start || "" }))
        ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        renderItems.forEach((item, idx) => {

            const nextEntry = renderItems[idx + 1] || null;
            const nextRef = nextEntry
                ? (nextEntry.kind === "chairblock" ? nextEntry.chair : nextEntry.session)
                : null;

            const el = item.kind === "chairblock"
                ? programCreateChairBlock(item.chair, item.talks, sessionsByRoom.__iso, nextRef)
                : programCreateSession(item.session, sessionsByRoom.__iso, nextRef);

            card.appendChild(el);
        });

        grid.appendChild(card);
    });

    return grid;
}

/* ================= BUILD ================= */

function programBuild(search = "") {

    programLastSearch = search;

    programContainer.innerHTML = "";

    // Çok salonlu "şu an canlı" bandı ve "takip ettiklerim" şeridi —
    // gün döngüsünden önce, sabit tek bir yerde.
    programContainer.insertAdjacentHTML("beforeend", `
        <div class="live-sticky" id="programLiveSticky"></div>
        <div class="follow-sticky" id="programFollowSticky"></div>
    `);

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

    // İlk çizimden hemen sonra sticky bantları (canlı + takip edilenler) güncelle.
    const { liveList, followedList } = programCollectStickyLists();
    programUpdateStickyBar(liveList);
    programUpdateFollowSticky(followedList);
}

/*
================================================================
STICKY BANTLAR İÇİN VERİ TOPLAMA
Artık DOM'daki data-* özniteliklerini tek tek okuyup badge/progress
patch'lemek yerine, her ~20 saniyede bir programBuild() TAMAMEN
yeniden çiziliyor (bkz. programRefreshBadges) — Chair blokları
gibi iç içe yapılar için bu, kırılgan bir DOM-patch mantığından
çok daha güvenilir. Bu fonksiyon sadece taze çizilmiş DOM'dan
"şu an canlı" ve "takip edilen" oturumları toplayıp iki sticky
banda besliyor.
================================================================
*/

function programCollectStickyLists() {
    const liveList = [];
    const followedList = [];

    programContainer.querySelectorAll(".ip-session[id]").forEach(el => {
        const info = { room: el.dataset.room || "", title: el.dataset.title || "", elId: el.id };
        if (el.classList.contains("is-live")) liveList.push(info);
        if (programFollowedIds.has(el.id)) followedList.push(info);
    });

    return { liveList, followedList };
}

/*
================================================================
CANLI GÜNCELLEME (20 saniyede bir)
================================================================
Bu fonksiyon veriyi tekrar Sheets'ten çekmez (o iş 60 saniyede bir
loadProgram()'da oluyor) — sadece programData'dan aynı verilerle
programBuild()'i yeniden çalıştırır, böylece "3 dakika kaldı" gibi
geri sayımlar, Chair bloklarındaki "Now presenting" vurgusu ve
progress bar'lar akıcı kalır. Önceki sürümde bu, DOM üzerinde tek
tek badge patch'leyen daha "hafif" bir fonksiyondu; Chair blokları
eklenince (iç içe mini-ajanda, değişken sayıda alt bildiri) DOM
patch'leme kırılgan hale geldiği için bilinçli olarak basitleştirildi.
================================================================
*/

function programRefreshBadges() {
    if (!programContainer) return;
    programBuild(programLastSearch);
}

// Aynı anda birden fazla salonda (yüz yüzede 4, online günlerde 3'e kadar)
// canlı oturum olabileceği için, bandın hepsini aynı anda listelemesi gerekiyor.
function programUpdateStickyBar(liveSessions) {

    const sticky = document.getElementById("programLiveSticky");
    if (!sticky) return;

    if (liveSessions.length === 0 || programLiveStickyDismissed) {
        sticky.classList.remove("show");
        sticky.innerHTML = "";
        return;
    }

    sticky.classList.add("show");
    sticky.innerHTML = `
        <div class="sticky-heading">🔴 Live Now<span class="sticky-close" title="Hide until page reload">✕</span></div>
        <div class="sticky-chips">
            ${liveSessions.map(s => `
                <div class="live-sticky-chip" onclick="document.getElementById('${s.elId}')?.scrollIntoView({behavior:'smooth', block:'center'})">
                    <span class="dot"></span>
                    <span class="chip-room">${s.room}</span>
                    <span class="chip-title">${s.title}</span>
                </div>
            `).join("")}
        </div>
    `;

    // Kapatma tuşuna basınca bant kaybolur ve sayfa yenilenene kadar
    // (F5) tekrar açılmaz — rahatsız olanlar için tercih.
    const closeBtn = sticky.querySelector(".sticky-close");
    if (closeBtn) {
        closeBtn.addEventListener("click", e => {
            e.stopPropagation();
            programLiveStickyDismissed = true;
            sticky.classList.remove("show");
            sticky.innerHTML = "";
        });
    }
}

// Kullanıcının ⭐ ile işaretlediği oturumları üstte, ayrı bir bantta listeler.
function programUpdateFollowSticky(followedSessions) {

    const sticky = document.getElementById("programFollowSticky");
    if (!sticky) return;

    if (followedSessions.length === 0) {
        sticky.classList.remove("show");
        sticky.innerHTML = "";
        return;
    }

    sticky.classList.add("show");
    sticky.innerHTML = `
        <div class="sticky-heading">⭐ Your Bookmarked Sessions</div>
        <div class="sticky-chips">
            ${followedSessions.map(s => `
                <div class="follow-sticky-chip" onclick="document.getElementById('${s.elId}')?.scrollIntoView({behavior:'smooth', block:'center'})">
                    <span>⭐</span>
                    <span class="chip-room">${s.room}</span>
                    <span class="chip-title">${s.title}</span>
                </div>
            `).join("")}
        </div>
    `;
}

// ⭐/☆ ikonuna tıklanınca takip et/bırak — event delegation ile TEK bir
// listener, çünkü kartlar her 20 saniyede bir yeniden çiziliyor ve
// tek tek her yıldıza listener bağlamak gereksiz/kırılgan olurdu.
function programHandleFollowClick(e) {
    const star = e.target.closest(".ip-follow");
    if (!star || !programContainer || !programContainer.contains(star)) return;

    const id = star.dataset.followId;
    if (!id) return;

    if (programFollowedIds.has(id)) programFollowedIds.delete(id);
    else programFollowedIds.add(id);

    programSaveFollowed();
    programBuild(programLastSearch);
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
        programContainer.addEventListener("click", programHandleFollowClick); // ⭐ takip tıklamaları
        loadProgram();
        setInterval(loadProgram, 60000);       // tam veri yenilemesi (Sheets'ten)
        setInterval(programRefreshBadges, 20000); // görünümü tazele (veri çekmez)
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
    if (/ceremony|opening|closing|açılış|kapanış/.test(t)) return "✨";
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

/*
================================================================
ICSAT 2027 — CONGRESS TIMELINE (Anasayfa Takvim/Schedule Bölümü)
custom.js'in EN SONUNA (Menu modülünden sonra) eklenecek blok.
Mevcut ICSAT_SHEETS_API_URL ve icsatFetchJSON zaten yukarıda
tanımlı olduğu için burada tekrar tanımlanmıyor.

Container: <div id="icsat-timeline"></div>

Google Sheet "Timeline" sekmesindeki beklenen sütunlar:
  Order       -> 1, 2, 3... (sıralama; boşsa satır sırası kullanılır)
  Title       -> "Last abstract or full-text submission date"
  Date        -> "April 30, 2026"  (SERBEST METİN — bu sütunu Sheets'te
                  mutlaka Plain Text yapın; "5.May" gibi otomatik Date
                  objesine çevrilmesin diye)
  BadgeType   -> "face" | "online" | "release" | "" (boş bırakılabilir)
  BadgeText   -> "Hybrid", "Abstract Book" gibi rozet metni (opsiyonel)
  Description -> Açıklama metni
================================================================
*/

let timelineContainer = document.getElementById("icsat-timeline");

const TIMELINE_API_URL =
    `${ICSAT_SHEETS_API_URL}?sheet=Timeline`;

let timelineData = [];
let timelineLoadedOnce = false;

async function loadTimeline() {

    if (!timelineContainer) return;

    if (!timelineLoadedOnce) {
        timelineContainer.innerHTML = `
            <div class="timeline-loading">Loading schedule…</div>
        `;
    }

    try {

        timelineData = await icsatFetchJSON(TIMELINE_API_URL);

        if (!Array.isArray(timelineData)) {
            throw new Error("Timeline API bir liste döndürmedi.");
        }

        timelineLoadedOnce = true;

        timelineBuild();

    } catch (err) {

        console.error("Timeline yüklenemedi:", err);

        timelineContainer.innerHTML = `
            <div class="timeline-error">
                <strong>Schedule could not be loaded.</strong>
                <br><br>
                ${err.message}
            </div>
        `;
    }
}

/* ================= BADGE CLASS ================= */

function timelineBadgeClass(type) {
    const t = String(type || "").trim().toLowerCase();
    if (["face", "online", "release"].indexOf(t) === -1) return "";
    return `badge-${t}`;
}

/* ================= KART OLUŞTUR ================= */

function timelineCreateEvent(row) {

    const badgeCls = timelineBadgeClass(row.BadgeType);
    const badgeHtml = (badgeCls && row.BadgeText)
        ? `<span class="badge ${badgeCls}">${row.BadgeText}</span>`
        : "";

    return `
        <div class="event">
            <span class="dot"></span>
            <div class="content">
                <h4>${row.Title || ""}</h4>
                <span class="date">${row.Date || ""} ${badgeHtml}</span>
                ${row.Description ? `<p>${row.Description}</p>` : ""}
            </div>
        </div>
    `;
}

/* ================= BUILD ================= */

function timelineBuild() {

    const headerHtml = `
        <header class="tl-header">
            <div class="tl-logo">ICSAT</div>
            <div>
                <h2 class="tl-title">ICSAT — Congress Schedule &amp; Presentation Guidelines</h2>
                <p class="tl-lead">Key dates, presentation types, and submission rules.</p>
            </div>
        </header>
    `;

    if (!Array.isArray(timelineData) || timelineData.length === 0) {
        timelineContainer.innerHTML = `
            <div class="tl-wrap">
                <div class="tl-card">
                    ${headerHtml}
                    <div class="timeline-empty">No schedule information available yet.</div>
                </div>
            </div>
        `;
        return;
    }

    const seenRows = new Set();
    const rows = timelineData.filter(row => {
        const key = JSON.stringify(row);
        if (seenRows.has(key)) return false;
        seenRows.add(key);
        return true;
    });

     // Order sütununa göre sırala; boşsa sheet'teki satır sırası korunur
    rows.sort((a, b) => (Number(a.Order) || 0) - (Number(b.Order) || 0));

    const eventsHtml = rows.map(timelineCreateEvent).join("");

    timelineContainer.innerHTML = `
        <div class="tl-wrap">
            <div class="tl-card">
                ${headerHtml}
                <div class="timeline">${eventsHtml}</div>
            </div>
        </div>
    `;
}

/*
================================================================
BAŞLAT TIMELINE (retry destekli sağlam init deseni —
Program/SocialProgram modüllerinizle birebir aynı yapı)
================================================================
*/

let timelineInitDone = false;

function initTimeline() {

    timelineContainer = document.getElementById("icsat-timeline");

    if (!timelineContainer) {
        return false;
    }

    console.log("✅ Timeline container bulundu.");

    if (!timelineInitDone) {
        timelineInitDone = true;
        loadTimeline();
    }

    return true;
}

document.addEventListener("DOMContentLoaded", function () {
    initTimeline();
});

if (window.jQuery) {
    jQuery(window).on("elementor/frontend/init", function () {
        console.log("✅ Elementor frontend hazır (timeline).");
        setTimeout(initTimeline, 300);
        setTimeout(initTimeline, 1000);
        setTimeout(initTimeline, 2000);
    });
}

let timelineTryCount = 0;

const timelineTryInterval = setInterval(function () {

    timelineTryCount++;

    if (initTimeline()) {
        clearInterval(timelineTryInterval);
    }

    if (timelineTryCount >= 20) {
        clearInterval(timelineTryInterval);
        console.log("⚠️ Timeline container 20 denemede bulunamadı.");
    }

}, 500);

/*
================================================================
ICSAT 2027 — REGISTRATION FEES & BANK INFORMATION MODÜLÜ
custom.js'in EN SONUNA (Timeline modülünden sonra) eklenecek blok.
Mevcut ICSAT_SHEETS_API_URL ve icsatFetchJSON zaten yukarıda
tanımlı olduğu için burada tekrar tanımlanmıyor.

Container: <div id="icsat-registration"></div>

Google Sheet "Registration" sekmesindeki beklenen sütunlar
(Section sütunu satırın ne olduğunu belirler):

  Section  -> "Meta" | "Fee" | "Bank"
  Order    -> sadece Fee satırlarında sıralama için (1, 2, 3...)
  Key      -> satırın anahtarı (aşağıda listelenmiştir)
  Label    -> Fee/Bank satırlarında ana metin; Meta satırlarında değerin kendisi
  Note     -> sadece Fee satırlarında opsiyonel alt not (örn. "(Undergraduate / MSc / PhD)")
  Early    -> sadece Fee satırlarında, Single boşsa: "₺4.000 / ₺3.000" gibi
  Late     -> sadece Fee satırlarında, Single boşsa: "₺5.000 / ₺4.000" gibi
  Single   -> sadece Fee satırlarında doluysa, Early/Late birleşip (colspan)
              tek fiyat olarak gösterilir (örn. Student, Accompanying Person)

  Section=Meta beklenen Key'ler:
    EarlyDate -> "Before 15 April 2027"
    LateDate  -> "After 15 April 2027"
    Footnote1, Footnote2, ... -> madde madde alt notlar
    ReceiptNote    -> ödeme sonrası dekont notu

  Section=Bank beklenen Key'ler:
    Bank, BankBranch, AccountHolder, SwiftCode, IBAN

Not: Accommodation Information bölümü (#accommodation-section)
bu modülden tamamen bağımsızdır ve hiç değiştirilmemiştir —
kendi statik HTML/CSS'iyle sayfada aynen kalır.
================================================================
*/

let registrationContainer = document.getElementById("icsat-registration");

const REGISTRATION_API_URL =
    `${ICSAT_SHEETS_API_URL}?sheet=Registration`;

let registrationData = [];
let registrationLoadedOnce = false;

async function loadRegistration() {

    // Bu sayfada #icsat-registration yoksa hiç çalışma.
    if (!registrationContainer) return;

    if (!registrationLoadedOnce) {
        registrationContainer.innerHTML = `
            <div class="reg-loading">Loading registration information…</div>
        `;
    }

    try {

        registrationData = await icsatFetchJSON(REGISTRATION_API_URL);

        if (!Array.isArray(registrationData)) {
            throw new Error("Registration API bir liste döndürmedi.");
        }

        registrationLoadedOnce = true;

        registrationBuild();

    } catch (err) {

        console.error("Registration bilgisi yüklenemedi:", err);

        registrationContainer.innerHTML = `
            <div class="reg-error">
                <strong>Registration information could not be loaded.</strong>
                <br><br>
                ${err.message}
            </div>
        `;
    }
}

/* ================= YARDIMCI: META HARİTASI ================= */

function registrationMetaMap(rows) {
    const map = {};
    rows.forEach(row => {
        if (row.Key) map[row.Key] = row.Label || "";
    });
    return map;
}

/* ================= YARDIMCI: TIRNAK İÇİNİ VURGULA =================
   "ICSAT 2027 – Your Name" gibi tırnak içine alınmış (düz " " veya
   akıllı “ ” tırnak) ifadeleri otomatik olarak kalın + bordo yapar.
   Sheets'te ReceiptNote hücresine nasıl yazarsan yaz, tırnak içine
   aldığın kısım otomatik vurgulanır — kodda elle bir şey değiştirmene
   gerek kalmaz.
==================================================================== */

function registrationHighlightQuotes(text) {
    if (!text) return "";
    return String(text).replace(/"([^"]*)"|“([^”]*)”/g, function (match) {
        return `<strong class="reg-highlight">${match}</strong>`;
    });
}

/* ================= FEE SATIRI OLUŞTUR ================= */

function registrationCreateFeeRow(fee) {

    const typeCell = `
        <td class="reg-type">
            ${fee.Label || ""}
            ${fee.Note ? `<span class="reg-type-note">${fee.Note}</span>` : ""}
        </td>
    `;

    if (fee.Single) {
        return `
            <tr>
                ${typeCell}
                <td colspan="2">${fee.Single}</td>
            </tr>
        `;
    }

    return `
        <tr>
            ${typeCell}
            <td>${fee.Early || ""}</td>
            <td>${fee.Late || ""}</td>
        </tr>
    `;
}

/* ================= BANK SATIRI OLUŞTUR ================= */

function registrationCreateBankRow(bank) {

    const labels = {
        Bank: "Bank",
        BankBranch: "Bank Branch",
        AccountHolder: "Account Holder",
        SwiftCode: "SWIFT Code",
        IBAN: "IBAN"
    };

    const label = labels[bank.Key] || bank.Key;

    return `
        <tr>
            <td class="reg-bank-label">${label}</td>
            <td>${bank.Label || ""}</td>
        </tr>
    `;
}

/* ================= BUILD ================= */

function registrationBuild() {

    // Aynı satırın tekrarını (yanlışlıkla iki kez girilmiş vs.) ele
    const seenRows = new Set();
    const rows = registrationData.filter(row => {
        const key = JSON.stringify(row);
        if (seenRows.has(key)) return false;
        seenRows.add(key);
        return true;
    });

    const metaRows = rows.filter(r => r.Section === "Meta");
    const bankRows = rows.filter(r => r.Section === "Bank");

    const feeRows = rows
        .filter(r => r.Section === "Fee")
        .sort((a, b) => (Number(a.Order) || 0) - (Number(b.Order) || 0));

    const meta = registrationMetaMap(metaRows);

    if (feeRows.length === 0 && bankRows.length === 0) {
        registrationContainer.innerHTML = `
            <div class="reg-wrap">
                <div class="reg-card">
                    <div class="reg-empty">No registration information available yet.</div>
                </div>
            </div>
        `;
        return;
    }

    const feesHtml = feeRows.map(registrationCreateFeeRow).join("");
    const bankHtml = bankRows.map(registrationCreateBankRow).join("");

    const footnoteLines = Object.keys(meta)
        .filter(k => /^Footnote\d*$/.test(k))
        .sort()
        .map(k => meta[k])
        .filter(Boolean);

    const footnoteHtml = footnoteLines.length
        ? `
            <div class="reg-footnote">
                ${footnoteLines.map(line => `<p>&bull; ${line}</p>`).join("")}
            </div>
        `
        : "";

    const noteHtml = meta.ReceiptNote
        ? `
            <div class="reg-note">
                <p>${registrationHighlightQuotes(meta.ReceiptNote)}</p>
            </div>
        `
        : "";

    registrationContainer.innerHTML = `
        <div class="reg-wrap">

            <div class="reg-card">
                <header class="reg-header">
                    <div class="reg-logo">$</div>
                    <div>
                        <h2 class="reg-title">Registration Fees</h2>
                        <p class="reg-lead">Please review the fees below and complete your registration before the deadline.</p>
                    </div>
                </header>

                <div class="reg-table-scroll">
                    <table class="reg-table">
                        <thead>
                            <tr class="reg-head-main">
                                <th>Registration Type</th>
                                <th>
                                    Early Registration
                                    ${meta.EarlyDate ? `<span class="reg-subnote">(${meta.EarlyDate})</span>` : ""}
                                </th>
                                <th>
                                    Late Registration
                                    ${meta.LateDate ? `<span class="reg-subnote">(${meta.LateDate})</span>` : ""}
                                </th>
                            </tr>
                            <tr class="reg-head-sub">
                                <th></th>
                                <th>Face-to-Face / Online</th>
                                <th>Face-to-Face / Online</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${feesHtml}
                        </tbody>
                    </table>
                </div>

                ${footnoteHtml}
            </div>

            <div class="reg-card reg-bank-card">
                <h2 class="reg-title reg-bank-title">Bank Information</h2>
                <hr class="reg-hr">
                <table class="reg-bank-table">
                    ${bankHtml}
                </table>
                ${noteHtml}
            </div>

        </div>
    `;
}

/*
================================================================
BAŞLAT REGISTRATION (retry destekli sağlam init deseni —
Timeline/Program/SocialProgram modülleriyle birebir aynı yapı)
================================================================
*/

let registrationInitDone = false;

function initRegistration() {

    registrationContainer = document.getElementById("icsat-registration");

    if (!registrationContainer) {
        return false;
    }

    console.log("✅ Registration container bulundu.");

    if (!registrationInitDone) {
        registrationInitDone = true;
        loadRegistration();
    }

    return true;
}

document.addEventListener("DOMContentLoaded", function () {
    initRegistration();
});

if (window.jQuery) {
    jQuery(window).on("elementor/frontend/init", function () {
        console.log("✅ Elementor frontend hazır (registration).");
        setTimeout(initRegistration, 300);
        setTimeout(initRegistration, 1000);
        setTimeout(initRegistration, 2000);
    });
}

let registrationTryCount = 0;

const registrationTryInterval = setInterval(function () {

    registrationTryCount++;

    if (initRegistration()) {
        clearInterval(registrationTryInterval);
    }

    if (registrationTryCount >= 20) {
        clearInterval(registrationTryInterval);
        console.log("⚠️ Registration container 20 denemede bulunamadı.");
    }

}, 500);

/*
================================================================
ICSAT 2027 — DOWNLOADABLE DOCUMENTS MODÜLÜ (v1.0.10)

Google Sheet "Documents" sekmesi beklenen sütunlar:
  Category      -> "Templates", "Guidelines", "Forms" gibi grup adı
  CategoryOrder -> (opsiyonel) kategorilerin sıralanması için sayı, boşsa 0
  Title         -> belgenin görünen adı
  Description   -> (opsiyonel) kısa açıklama
  FileURL       -> Google Drive / doğrudan dosya linki
  Order         -> (opsiyonel) aynı kategori içindeki sıralama, boşsa 0

Dosya ikonu FileURL'in uzantısından otomatik belirlenir
(pdf, doc/docx, xls/xlsx, ppt/pptx, zip/rar — diğerleri için genel ikon).
================================================================
*/

let documentsContainer = document.getElementById("icsat-documents");

const DOCUMENTS_API_URL =
    `${ICSAT_SHEETS_API_URL}?sheet=Documents`;

let documentsData = [];
let documentsLoadedOnce = false;

async function loadDocuments() {

    if (!documentsContainer) return;

    if (!documentsLoadedOnce) {
        documentsContainer.innerHTML = `
            <div class="doc-loading">Loading documents…</div>
        `;
    }

    try {

        documentsData = await icsatFetchJSON(DOCUMENTS_API_URL);

        if (!Array.isArray(documentsData)) {
            throw new Error("Documents API bir liste döndürmedi.");
        }

        documentsLoadedOnce = true;

        documentsBuild();

    } catch (err) {

        console.error("Documents yüklenemedi:", err);

        documentsContainer.innerHTML = `
            <div class="doc-error">
                <strong>Documents could not be loaded.</strong>
                <br><br>
                ${err.message}
            </div>
        `;
    }
}

/* ================= YARDIMCI: DOSYA İKONU ================= */

function documentsIconFor(url) {

    const ext = String(url || "").split(".").pop().toLowerCase().split("?")[0];

    const icons = {
        pdf: "📕",
        doc: "📘",
        docx: "📘",
        xls: "📗",
        xlsx: "📗",
        ppt: "📙",
        pptx: "📙",
        zip: "🗜️",
        rar: "🗜️"
    };

    return icons[ext] || "📄";
}

/* ================= KART OLUŞTUR ================= */

function documentsCreateCard(doc) {
    return `
        <a class="doc-card"
           href="${doc.FileURL || "#"}"
           target="_blank"
           rel="noopener noreferrer">
            <div class="doc-icon">${documentsIconFor(doc.FileURL)}</div>
            <div class="doc-info">
                <div class="doc-title">${doc.Title || ""}</div>
                ${doc.Description ? `<div class="doc-desc">${doc.Description}</div>` : ""}
            </div>
            <div class="doc-download" aria-hidden="true">⬇</div>
        </a>
    `;
}

/* ================= BUILD ================= */

function documentsBuild() {

    const seenRows = new Set();
    const rows = documentsData.filter(row => {
        const key = JSON.stringify(row);
        if (seenRows.has(key)) return false;
        seenRows.add(key);
        return true;
    }).filter(row => row.Title && row.FileURL);

    if (rows.length === 0) {
        documentsContainer.innerHTML = `
            <div class="doc-wrap">
                <div class="doc-empty">No documents available yet.</div>
            </div>
        `;
        return;
    }

    const groupsMap = {};
    rows.forEach(row => {
        const cat = row.Category || "Documents";
        if (!groupsMap[cat]) {
            groupsMap[cat] = {
                order: Number(row.CategoryOrder) || 0,
                items: []
            };
        }
        groupsMap[cat].items.push(row);
    });

    const groups = Object.keys(groupsMap)
        .map(name => ({
            name,
            order: groupsMap[name].order,
            items: groupsMap[name].items.sort(
                (a, b) => (Number(a.Order) || 0) - (Number(b.Order) || 0)
            )
        }))
        .sort((a, b) => a.order - b.order);

    const groupsHtml = groups.map(group => `
        <div class="doc-group">
            <h2 class="doc-group-title">${group.name}</h2>
            <div class="doc-grid">
                ${group.items.map(documentsCreateCard).join("")}
            </div>
        </div>
    `).join("");

    documentsContainer.innerHTML = `
        <div class="doc-wrap">
            ${groupsHtml}
        </div>
    `;
}

/*
================================================================
BAŞLAT DOCUMENTS (retry destekli sağlam init deseni)
================================================================
*/

let documentsInitDone = false;

function initDocuments() {

    documentsContainer = document.getElementById("icsat-documents");

    if (!documentsContainer) {
        return false;
    }

    console.log("✅ Documents container bulundu.");

    if (!documentsInitDone) {
        documentsInitDone = true;
        loadDocuments();
    }

    return true;
}

document.addEventListener("DOMContentLoaded", function () {
    initDocuments();
});

if (window.jQuery) {
    jQuery(window).on("elementor/frontend/init", function () {
        console.log("✅ Elementor frontend hazır (documents).");
        setTimeout(initDocuments, 300);
        setTimeout(initDocuments, 1000);
        setTimeout(initDocuments, 2000);
    });
}

let documentsTryCount = 0;

const documentsTryInterval = setInterval(function () {

    documentsTryCount++;

    if (initDocuments()) {
        clearInterval(documentsTryInterval);
    }

    if (documentsTryCount >= 20) {
        clearInterval(documentsTryInterval);
        console.log("⚠️ Documents container 20 denemede bulunamadı.");
    }

}, 500);

/*
================================================================
ICSAT 2027 — CONGRESS PHOTOS MODÜLÜ (v1.0.10)

Google Sheet "Photos" sekmesi beklenen sütunlar:
  Year     -> "2026" veya "2027" (yıla göre sekme/tab oluşturmak için)
  Caption  -> (opsiyonel) fotoğraf altyazısı
  ImageURL -> Google Drive paylaşım linki (herhangi bir formatta:
              .../file/d/ID/view, ?id=ID, veya sadece dosya ID'si)
  Order    -> (opsiyonel) aynı yıl içindeki sıralama, boşsa 0

Google Drive linkleri hotlink için otomatik olarak "thumbnail"
(liste görünümü) ve "uc?export=view" (lightbox tam boy) formatlarına
çevrilir. Drive dosyasının paylaşım ayarı "Bağlantıya sahip olan
herkes" (Anyone with the link) olarak ayarlanmalıdır.
================================================================
*/

let photosContainer = document.getElementById("icsat-photos");

const PHOTOS_API_URL =
    `${ICSAT_SHEETS_API_URL}?sheet=Photos`;

let photosData = [];
let photosLoadedOnce = false;
let photosActiveYear = null;
let photosLightboxIndex = 0;
let photosCurrentGroup = [];

/* ================= YARDIMCI: GOOGLE DRIVE ID ================= */

function photosExtractDriveId(url) {

    if (!url) return null;

    const raw = String(url).trim();

    let match = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    match = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return raw;

    return null;
}

function photosThumbUrl(url, size) {
    const id = photosExtractDriveId(url);
    if (!id) return url;
    return `https://drive.google.com/thumbnail?id=${id}&sz=${size || "w500"}`;
}

function photosFullUrl(url) {
    const id = photosExtractDriveId(url);
    if (!id) return url;
    // "uc?export=view" formatı Drive tarafında sık sık boş/engellenmiş
    // dönüyor. Büyük boyutlu "thumbnail" formatı hotlink için çok daha
    // güvenilir, bu yüzden lightbox'ta da bunu kullanıyoruz.
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
}

async function loadPhotos() {

    if (!photosContainer) return;

    if (!photosLoadedOnce) {
        photosContainer.innerHTML = `
            <div class="photo-loading">Loading photos…</div>
        `;
    }

    try {

        photosData = await icsatFetchJSON(PHOTOS_API_URL);

        if (!Array.isArray(photosData)) {
            throw new Error("Photos API bir liste döndürmedi.");
        }

        photosLoadedOnce = true;

        photosBuild();

    } catch (err) {

        console.error("Photos yüklenemedi:", err);

        photosContainer.innerHTML = `
            <div class="photo-error">
                <strong>Photos could not be loaded.</strong>
                <br><br>
                ${err.message}
            </div>
        `;
    }
}

/* ================= BUILD ================= */

function photosBuild() {

    const seenRows = new Set();
    const rows = photosData.filter(row => {
        const key = JSON.stringify(row);
        if (seenRows.has(key)) return false;
        seenRows.add(key);
        return true;
    }).filter(row => row.ImageURL);

    if (rows.length === 0) {
        photosContainer.innerHTML = `
            <div class="photo-wrap">
                <div class="photo-empty">No photos available yet.</div>
            </div>
        `;
        return;
    }

    const yearsMap = {};
    rows.forEach(row => {
        const year = String(row.Year || "Other");
        if (!yearsMap[year]) yearsMap[year] = [];
        yearsMap[year].push(row);
    });

    Object.keys(yearsMap).forEach(year => {
        yearsMap[year].sort((a, b) => (Number(a.Order) || 0) - (Number(b.Order) || 0));
    });

    const preferredOrder = ["2027", "2026"];
    const years = Object.keys(yearsMap).sort((a, b) => {
        const ai = preferredOrder.indexOf(a);
        const bi = preferredOrder.indexOf(b);
        if (ai !== -1 || bi !== -1) {
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        }
        return b.localeCompare(a);
    });

    if (!photosActiveYear || !yearsMap[photosActiveYear]) {
        photosActiveYear = years[0];
    }

    const tabsHtml = years.map(year => `
        <button type="button"
                class="photo-tab ${year === photosActiveYear ? "photo-tab-active" : ""}"
                data-year="${year}">
            ICSAT ${year}
        </button>
    `).join("");

    const activeItems = yearsMap[photosActiveYear] || [];
    photosCurrentGroup = activeItems;

    const gridHtml = activeItems.map((item, index) => `
        <div class="photo-item" data-index="${index}">
            <img src="${photosThumbUrl(item.ImageURL, "w500")}"
                 alt="${item.Caption || "ICSAT " + photosActiveYear}"
                 loading="lazy">
            ${item.Caption ? `<div class="photo-caption">${item.Caption}</div>` : ""}
        </div>
    `).join("");

    photosContainer.innerHTML = `
        <div class="photo-wrap">
            <div class="photo-tabs">${tabsHtml}</div>
            <div class="photo-grid">${gridHtml}</div>
        </div>
        <div class="photo-lightbox" id="icsat-photo-lightbox">
            <button type="button" class="photo-lb-close" aria-label="Close">✕</button>
            <button type="button" class="photo-lb-prev" aria-label="Previous">‹</button>
            <img class="photo-lb-img" src="" alt="">
            <div class="photo-lb-caption"></div>
            <button type="button" class="photo-lb-next" aria-label="Next">›</button>
        </div>
    `;

    photosBindEvents();
}

/* ================= EVENTLER ================= */

function photosBindEvents() {

    const tabs = photosContainer.querySelectorAll(".photo-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", function () {
            photosActiveYear = this.dataset.year;
            photosBuild();
        });
    });

    const items = photosContainer.querySelectorAll(".photo-item");
    items.forEach(item => {
        item.addEventListener("click", function () {
            photosLightboxIndex = Number(this.dataset.index);
            photosOpenLightbox();
        });
    });

    const lightbox = document.getElementById("icsat-photo-lightbox");
    if (!lightbox) return;

    lightbox.querySelector(".photo-lb-close")
        .addEventListener("click", photosCloseLightbox);

    lightbox.addEventListener("click", function (e) {
        if (e.target === lightbox) photosCloseLightbox();
    });

    lightbox.querySelector(".photo-lb-prev")
        .addEventListener("click", function () {
            photosLightboxIndex =
                (photosLightboxIndex - 1 + photosCurrentGroup.length) % photosCurrentGroup.length;
            photosRenderLightbox();
        });

    lightbox.querySelector(".photo-lb-next")
        .addEventListener("click", function () {
            photosLightboxIndex =
                (photosLightboxIndex + 1) % photosCurrentGroup.length;
            photosRenderLightbox();
        });

    document.addEventListener("keydown", photosHandleKeydown);
}

function photosHandleKeydown(e) {
    const lightbox = document.getElementById("icsat-photo-lightbox");
    if (!lightbox || !lightbox.classList.contains("photo-lb-open")) return;

    if (e.key === "Escape") photosCloseLightbox();
    if (e.key === "ArrowLeft") lightbox.querySelector(".photo-lb-prev").click();
    if (e.key === "ArrowRight") lightbox.querySelector(".photo-lb-next").click();
}

function photosOpenLightbox() {
    const lightbox = document.getElementById("icsat-photo-lightbox");
    if (!lightbox) return;
    lightbox.classList.add("photo-lb-open");
    document.body.style.overflow = "hidden";
    photosRenderLightbox();
}

function photosCloseLightbox() {
    const lightbox = document.getElementById("icsat-photo-lightbox");
    if (!lightbox) return;
    lightbox.classList.remove("photo-lb-open");
    document.body.style.overflow = "";
}

function photosRenderLightbox() {
    const lightbox = document.getElementById("icsat-photo-lightbox");
    if (!lightbox) return;

    const item = photosCurrentGroup[photosLightboxIndex];
    if (!item) return;

    lightbox.querySelector(".photo-lb-img").src = photosFullUrl(item.ImageURL);
    lightbox.querySelector(".photo-lb-caption").textContent = item.Caption || "";
}

/*
================================================================
BAŞLAT PHOTOS (retry destekli sağlam init deseni)
================================================================
*/

let photosInitDone = false;

function initPhotos() {

    photosContainer = document.getElementById("icsat-photos");

    if (!photosContainer) {
        return false;
    }

    console.log("✅ Photos container bulundu.");

    if (!photosInitDone) {
        photosInitDone = true;
        loadPhotos();
    }

    return true;
}

document.addEventListener("DOMContentLoaded", function () {
    initPhotos();
});

if (window.jQuery) {
    jQuery(window).on("elementor/frontend/init", function () {
        console.log("✅ Elementor frontend hazır (photos).");
        setTimeout(initPhotos, 300);
        setTimeout(initPhotos, 1000);
        setTimeout(initPhotos, 2000);
    });
}

let photosTryCount = 0;

const photosTryInterval = setInterval(function () {

    photosTryCount++;

    if (initPhotos()) {
        clearInterval(photosTryInterval);
    }

    if (photosTryCount >= 20) {
        clearInterval(photosTryInterval);
        console.log("⚠️ Photos container 20 denemede bulunamadı.");
    }

}, 500);
