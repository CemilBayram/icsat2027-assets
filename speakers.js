/*
================================================================
ICSAT 2027 — SPEAKERS (KONUŞMACILAR)
Bu dosyadan ÖNCE custom.js yüklenmiş olmalı (ICSAT_SHEETS_API_URL
ve icsatFetchJSON buradan geliyor).
================================================================
*/

const API_URL =
    `${ICSAT_SHEETS_API_URL}?sheet=Speakers`;

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
BAŞLAT
================================================================
*/

loadSpeakers();
