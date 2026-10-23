// ===== Component: สวิตช์โหมดสว่าง/มืด (แถบด้านบน) =====
// ยังไม่เคยกด -> ตามการตั้งค่าของเครื่อง (เครื่องเปลี่ยนโหมด แอปเปลี่ยนตาม)
// กดแล้ว -> จำโหมดที่เลือกไว้ในเครื่องนี้ ไม่สนการตั้งค่าของเครื่องอีก
// (ค่าเริ่มต้นตอนเปิดแอป ตั้งไว้แล้วในหัว index.html ก่อนหน้าเว็บวาด)

const systemDark = matchMedia("(prefers-color-scheme: dark)");

function savedTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

// ใช้โหมดนี้: เปลี่ยนสีทั้งหน้า + ตำแหน่งสวิตช์ + สีแถบสถานะของมือถือ
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("themeToggle").checked = theme === "dark";
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).backgroundColor;
}

function setupTheme() {
  $("themeToggle").checked = document.documentElement.dataset.theme === "dark";
  $("themeToggle").onchange = (e) => {
    const theme = e.target.checked ? "dark" : "light";
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ไม่เป็นไร ใช้ได้จนปิดแอป */ }
    applyTheme(theme);
  };
  systemDark.addEventListener("change", (e) => {
    if (!savedTheme()) applyTheme(e.matches ? "dark" : "light");
  });
}
