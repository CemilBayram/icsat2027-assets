/*
================================================================
ICSAT 2027 — COMMITTEE (KURULLAR)
Bu dosyadan ÖNCE custom.js yüklenmiş olmalı (ICSAT_SHEETS_API_URL
ve icsatFetchJSON buradan geliyor).
================================================================
*/

const COMMITTEE_API_URL =
    `${ICSAT_SHEETS_API_URL}?sheet=Committee`;

async function loadCommittee() {

    const committeeContainer =
        document.getElementById("committee-container");

    if (!committeeContainer) return;

    committeeContainer.innerHTML = `
        <div class="committee-loading">
            Loading committee members…
        </div>
    `;

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

        const activeMembers =
            data
                .filter(member =>
                    String(member.Active)
                        .toLowerCase()
                        .trim() === "true"
                )
                .sort((a, b) =>
                    Number(a.Order) - Number(b.Order)
                );

        console.log(
            "Committee aktif kayıt:",
            activeMembers.length
        );

        console.log(
            "Committee Section değerleri:",
            [...new Set(
                data.map(member => member.Section)
            )]
        );


        /*
        ====================================================
        COMMITTEE BÖLÜMLERİ
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
                section: "Organizing Committee Members",
                title: "Organizing Committee Members",
                className: "organizing-committee-section"
            },

            {
                section: "Scientific Committee Members",
                title: "Scientific Committee Members",
                className: "scientific-committee-section"
            }

        ];


        committeeContainer.innerHTML = "";


        /*
        ====================================================
        HER BÖLÜMÜ OLUŞTUR
        ====================================================
        */

        groups.forEach(group => {

            const members =
                activeMembers.filter(member => {

                    const section =
                        String(member.Section || "")
                            .trim()
                            .replace(/\s+/g, " ")
                            .toLowerCase();

                    const target =
                        String(group.section || "")
                            .trim()
                            .replace(/\s+/g, " ")
                            .toLowerCase();

                    if (
                        target === "honorary chairs" ||
                        target === "chairs" ||
                        target === "co-chairs" ||
                        target === "secretariat"
                    ) {
                        return section === target;
                    }

                    if (target === "organizing committee members") {
                        return section.includes("organizing committee");
                    }

                    if (target === "scientific committee members") {
                        return section.includes("scientific committee");
                    }

                    return section === target;

                });


            if (members.length === 0) {
                return;
            }


            const section =
                document.createElement("section");

            section.className =
                `committee-group ${group.className}`;


            const heading =
                document.createElement("div");

            heading.className =
                "committee-group-heading";

            heading.innerHTML = `
                <h2>${group.title}</h2>
                <div class="committee-heading-line"></div>
            `;

            section.appendChild(heading);


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
            committeeContainer.appendChild(section);

        });


        if (activeMembers.length === 0) {

            committeeContainer.innerHTML = `
                <div class="committee-empty">
                    No active committee members available.
                </div>
            `;

        }

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


    /*
    --------------------------------------------------------
    KART İÇERİĞİ
    --------------------------------------------------------
    */

    card.innerHTML = `

        <div class="committee-card-content">

            <h3 class="committee-name">
    ${
        member.Title
            ? `${member.Title} ${member.Name || ""}`
            : member.Name || ""
    }
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
COMMITTEE BAŞLATMA
============================================================
*/

let committeeInitialized = false;

function initCommittee() {

    const container =
        document.getElementById("committee-container");

    if (!container) {
        return false;
    }

    if (committeeInitialized) {
        return true;
    }

    committeeInitialized = true;

    console.log("✅ Committee container bulundu.");
    console.log("🚀 Committee yükleniyor...");

    loadCommittee();

    return true;
}


/*
============================================================
DOM + ELEMENTOR
============================================================
*/

function startCommitteeWhenReady() {

    if (initCommittee()) {
        return;
    }

    let attempts = 0;

    const timer = setInterval(function () {

        attempts++;

        if (initCommittee()) {

            clearInterval(timer);
            return;

        }

        if (attempts >= 20) {

            clearInterval(timer);

            console.log(
                "⚠️ Committee container bulunamadı."
            );

        }

    }, 500);
}


/*
============================================================
NORMAL DOM
============================================================
*/

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        startCommitteeWhenReady
    );

} else {

    startCommitteeWhenReady();

}


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

            startCommitteeWhenReady();

        }
    );

}
