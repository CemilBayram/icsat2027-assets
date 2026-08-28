/*
================================================================
ICSAT 2027 — MENÜ (Sheets: Menu sekmesi)
Bu dosyadan ÖNCE custom.js yüklenmiş olmalı (ICSAT_SHEETS_API_URL
ve icsatFetchJSON buradan geliyor).
================================================================
*/

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