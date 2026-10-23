// ===== Component: โปรไฟล์ + บ้าน (สร้าง/เข้าร่วม/เชิญ/ออก) =====
// ลำดับตอนเปิดแอป: ตั้งโปรไฟล์ (ชื่อ + อีโมจิ) -> เลือก/สร้างบ้าน -> โหลดแมวของบ้านนั้น
// ไม่ใช้อีเมล/รหัสผ่าน: ใช้ Anonymous Sign-in ของ Supabase เครื่องจะจำผู้ใช้ไว้เอง
// เปลี่ยนเครื่อง/ล้างเบราว์เซอร์ -> ตั้งโปรไฟล์ใหม่ แล้วกรอกรหัสเชิญบ้านเดิม แมวยังอยู่ครบ (แมวผูกกับบ้าน ไม่ได้ผูกกับคน)

let appStarted = false; // เข้าหน้าแอปแล้วหรือยัง
let entering = null;    // กำลังหาบ้านอยู่ (กันเรียกซ้อนกัน 2 รอบ)
let profile = null;     // โปรไฟล์ของเรา { display_name, avatar }
let memberCount = 0;    // จำนวนสมาชิกบ้าน (ใช้เตือนตอนจะออก ถ้าเป็นคนสุดท้าย)

// โชว์เฉพาะหน้าที่ต้องการ ซ่อนหน้าอื่นทั้งหมด
function showOnly(viewId) {
  for (const id of ["bootView", "profileView", "householdView", "listView", "detailView"]) $(id).hidden = id !== viewId;
  $("houseBtn").hidden = !["listView", "detailView"].includes(viewId);
}

// ----- เริ่มแอป -----

async function startApp() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return showProfileView();
  await enterHousehold(session.user);
}

// ----- หน้าตั้งโปรไฟล์ (ครั้งแรก หรือกดแก้ไขจากหน้าต่างบ้าน) -----

function showProfileView() {
  const f = $("profileForm");
  f.name.value = profile?.display_name || "";
  pickAvatar(profile?.avatar || AVATARS[0]);
  showProfileError("");
  $("profileTitle").textContent = profile ? "แก้ไขโปรไฟล์" : "คุณชื่ออะไร?";
  $("cancelProfileBtn").hidden = !appStarted; // แก้ไขจากในแอป -> กดยกเลิกกลับได้
  showOnly("profileView");
}

function showProfileError(message) {
  $("profileError").textContent = message;
  $("profileError").hidden = !message;
}

// วาดปุ่มอีโมจิให้เลือก และไฮไลต์ตัวที่เลือกอยู่
function pickAvatar(avatar) {
  $("profileForm").avatar.value = avatar;
  $("avatarPicker").innerHTML = AVATARS.map((a) =>
    `<button type="button" class="avatar${a === avatar ? " picked" : ""}" data-avatar="${a}" aria-label="เลือก ${a}">${a}</button>`).join("");
}

// กด "เริ่มใช้งาน"/"บันทึก": ยังไม่มีผู้ใช้ -> สร้างผู้ใช้แบบไม่ระบุตัวตน แล้วบันทึกโปรไฟล์
async function saveProfile(e) {
  e.preventDefault();
  const f = $("profileForm");
  const display_name = f.name.value.trim();
  if (!display_name) return showProfileError("กรุณาใส่ชื่อ");
  const btn = $("saveProfileBtn");
  btn.disabled = true;
  try {
    let { data: { session } } = await db.auth.getSession();
    if (!session) {
      const { data, error } = await db.auth.signInAnonymously();
      if (error) return showProfileError(profileErrorText(error));
      session = data.session;
    }
    const row = { id: session.user.id, display_name, avatar: f.avatar.value, updated_at: new Date().toISOString() };
    const { error } = await db.from("profiles").upsert(row);
    if (error) return showProfileError(profileErrorText(error));
    profile = row;
    if (appStarted) { showStartPage(); return showToast("บันทึกโปรไฟล์แล้ว"); }
    await enterHousehold(session.user);
  } finally {
    btn.disabled = false;
  }
}

// แปลงข้อความ error ของ Supabase เป็นภาษาไทยที่อ่านเข้าใจ
function profileErrorText(error) {
  if (/anonymous sign-ins are disabled/i.test(error.message)) return "ยังไม่ได้เปิด Anonymous Sign-ins ใน Supabase (Authentication > Sign In / Providers)";
  if (/rate limit/i.test(error.message)) return "สร้างผู้ใช้ถี่เกินไป รอสักครู่แล้วลองใหม่";
  if (isNetworkError(error)) return "ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง";
  return error.message;
}

// ----- บ้าน -----

// หาบ้านของผู้ใช้ ถ้ายังไม่มี -> หน้าสร้าง/เข้าร่วมบ้าน, ถ้ามี -> เข้าแอป
function enterHousehold(user) {
  if (appStarted) return;
  return entering ??= findHousehold(user).finally(() => { entering = null; });
}

async function findHousehold(user) {
  const [members, me] = await Promise.all([
    db.from("household_members").select("households(id, name, invite_code)").eq("user_id", user.id),
    db.from("profiles").select("display_name, avatar").eq("id", user.id).maybeSingle(),
  ]);
  let houses;
  if (members.error) {
    // ออฟไลน์: ใช้บ้านที่เคยเปิดไว้ล่าสุด
    const saved = readSavedHousehold();
    if (!saved) { showProfileView(); return showProfileError("ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง"); }
    houses = [saved];
  } else {
    if (!me.data) return showProfileView(); // มีผู้ใช้แต่ยังไม่ได้ตั้งโปรไฟล์
    profile = me.data;
    houses = members.data.map((m) => m.households);
  }
  if (!houses.length) return showHouseholdView();
  const savedId = readSavedHousehold()?.id;
  await openHousehold(houses.find((h) => h.id === savedId) || houses[0]);
}

function readSavedHousehold() {
  try { return JSON.parse(localStorage.getItem(HOUSE_KEY)); } catch { return null; }
}

// เปิดใช้บ้านนี้: โชว์สำเนาในเครื่องทันที แล้วโหลดของล่าสุดจากเซิร์ฟเวอร์ตามมา
async function openHousehold(h) {
  appStarted = true;
  household = h;
  householdId = h.id;
  try { localStorage.setItem(HOUSE_KEY, JSON.stringify(h)); } catch { /* ไม่เป็นไร */ }
  cats = loadCache();
  showStartPage();
  if (await refreshFromServer()) redrawCurrentPage();
  await offerLegacyUpload();
}

// วาดหน้าที่เปิดอยู่ใหม่ (หลังได้ข้อมูลใหม่จากเซิร์ฟเวอร์)
function redrawCurrentPage() {
  if (!currentId) return drawCatCards();
  findCurrentCat() ? drawCatDetail() : goToCatListPage(); // แมวถูกคนอื่นในบ้านลบไปแล้ว -> กลับหน้ารายชื่อ
}

// มีแมวที่บันทึกไว้ในเครื่องตั้งแต่ก่อนมีระบบบ้าน -> ถามว่าจะย้ายขึ้นบ้านนี้ไหม
async function offerLegacyUpload() {
  let legacy;
  try { legacy = JSON.parse(localStorage.getItem(KEY)) || []; } catch { legacy = []; }
  if (!legacy.length) return;
  const ok = await askConfirm(`พบแมว ${legacy.length} ตัวที่บันทึกไว้ในเครื่องนี้ก่อนมีระบบบ้าน ย้ายขึ้นบ้าน "${household.name}" เลยไหม?`, "ย้ายขึ้นบ้าน", false);
  if (!ok) return; // ไม่ย้าย -> ข้อมูลเดิมยังอยู่ในเครื่อง เปิดครั้งหน้าจะถามอีก
  importCats(legacy);
  // เก็บของเดิมไว้อีกชื่อกันพลาด แล้วเลิกถาม
  try { localStorage.setItem(KEY + ".migrated", localStorage.getItem(KEY)); localStorage.removeItem(KEY); } catch { /* ไม่เป็นไร */ }
  redrawCurrentPage();
  showToast(`ย้ายแมว ${legacy.length} ตัวขึ้นบ้านแล้ว`);
}

// ----- หน้าสร้าง/เข้าร่วมบ้าน (ผู้ใช้ใหม่ที่ยังไม่มีบ้าน) -----

function showHouseholdView() {
  $("householdError").hidden = true;
  showOnly("householdView");
}

function showHouseholdError(message) {
  $("householdError").textContent = message;
  $("householdError").hidden = false;
}

async function createHousehold(e) {
  e.preventDefault();
  const name = $("createHouseForm").name.value.trim();
  if (!name) return showHouseholdError("กรุณาตั้งชื่อบ้าน");
  const { data, error } = await db.rpc("create_household", { p_name: name });
  if (error) return showHouseholdError(isNetworkError(error) ? "ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง" : error.message);
  await openHousehold(data);
  showToast(`สร้างบ้าน "${data.name}" แล้ว`);
}

async function joinHousehold(e) {
  e.preventDefault();
  const code = $("joinHouseForm").code.value.trim();
  if (!code) return showHouseholdError("กรุณากรอกรหัสเชิญ");
  const { data, error } = await db.rpc("join_household", { p_code: code });
  if (error) {
    return showHouseholdError(/invalid_invite_code/.test(error.message) ? "ไม่พบบ้านที่ใช้รหัสนี้ ลองเช็กรหัสอีกครั้ง"
      : isNetworkError(error) ? "ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง" : error.message);
  }
  await openHousehold(data);
  showToast(`เข้าร่วมบ้าน "${data.name}" แล้ว`);
}

// ----- หน้าต่างบ้านของฉัน (รหัสเชิญ สมาชิก ออกจากบ้าน ออกจากระบบ) -----

async function openHouseDialog() {
  $("houseName").textContent = household.name;
  $("myProfile").textContent = profile ? `${profile.avatar} ${profile.display_name}` : "";
  $("inviteCode").textContent = household.invite_code;
  $("houseMembers").innerHTML = `<li class="muted">กำลังโหลด...</li>`;
  $("houseDialog").showModal();
  const [{ data: { user } }, { data, error }] = await Promise.all([
    db.auth.getUser(), db.rpc("list_household_members", { hid: householdId }),
  ]);
  memberCount = error ? 0 : data.length;
  $("houseMembers").innerHTML = error ? `<li class="muted">โหลดรายชื่อไม่ได้ (ออฟไลน์?)</li>` : data.map((m) => `
    <li><span class="member-avatar">${makeTextSafe(m.avatar)}</span>${makeTextSafe(m.display_name)}${m.user_id === user?.id ? " (คุณ)" : ""}
      ${m.role === "owner" ? `<span class="tag">เจ้าของบ้าน</span>` : ""}</li>`).join("");
}

// แชร์รหัสเชิญ (มือถือเปิดเมนูแชร์ของเครื่อง, คอมคัดลอกลงคลิปบอร์ด)
async function shareInvite() {
  const text = `มาดูแลแมวด้วยกันใน HomeCat! เปิด ${location.origin + location.pathname} แล้วกรอกรหัสบ้าน: ${household.invite_code}`;
  try {
    if (navigator.share) await navigator.share({ title: "เชิญเข้าบ้าน HomeCat", text });
    else { await navigator.clipboard.writeText(household.invite_code); showToast("คัดลอกรหัสเชิญแล้ว"); }
  } catch { /* ผู้ใช้กดยกเลิกการแชร์ */ }
}

async function leaveHousehold() {
  const warn = memberCount === 1
    ? `คุณเป็นสมาชิกคนสุดท้ายของบ้าน "${household.name}" ถ้าออก จะไม่มีใครเห็นแมวของบ้านนี้อีก จนกว่าจะมีคนกรอกรหัส ${household.invite_code} เข้ามาใหม่`
    : `ออกจากบ้าน "${household.name}"? คุณจะไม่เห็นแมวของบ้านนี้อีก จนกว่าจะเข้าร่วมใหม่ด้วยรหัส ${household.invite_code}`;
  if (!(await askConfirm(warn, "ออกจากบ้าน"))) return;
  const { data: { user } } = await db.auth.getUser();
  const { error } = await db.from("household_members").delete().eq("household_id", householdId).eq("user_id", user.id);
  if (error) return showToast(`⚠️ ออกจากบ้านไม่สำเร็จ: ${error.message}`, 5000);
  forgetHousehold();
  $("houseDialog").close();
  appStarted = false;
  await enterHousehold(user);
}

// ผู้ใช้ไม่มีอีเมล/รหัสผ่าน: ออกแล้วกลับเข้าโปรไฟล์เดิมไม่ได้ ต้องตั้งโปรไฟล์ใหม่แล้วกรอกรหัสเชิญ
async function signOut() {
  const pending = outbox.length ? " และข้อมูลที่ยังไม่ได้ส่งขึ้นออนไลน์จะหาย" : "";
  if (!(await askConfirm(`ออกจากเครื่องนี้? โปรไฟล์นี้จะหายไปถาวร${pending} ถ้าจะกลับเข้ามา ต้องตั้งโปรไฟล์ใหม่แล้วกรอกรหัสบ้าน ${household.invite_code} (จดไว้ก่อนนะ)`, "ออกจากเครื่องนี้"))) return;
  await db.auth.signOut();
  forgetHousehold();
  outbox = [];
  saveOutbox();
  $("houseDialog").close();
  profile = null;
  showProfileView();
}

// ล้างข้อมูลบ้านในเครื่อง (สำเนาแมว + บ้านที่เลือกไว้)
function forgetHousehold() {
  try { localStorage.removeItem(CACHE_KEY + householdId); localStorage.removeItem(HOUSE_KEY); } catch { /* ไม่เป็นไร */ }
  cats = [];
  household = householdId = null;
  if (history.state?.catId) history.replaceState(null, "");
}

// ----- ผูกปุ่มและฟอร์ม -----

function setupAccount() {
  $("profileForm").onsubmit = saveProfile;
  $("avatarPicker").onclick = (e) => { const a = e.target.closest("[data-avatar]"); if (a) pickAvatar(a.dataset.avatar); };
  $("cancelProfileBtn").onclick = showStartPage;
  $("editProfileBtn").onclick = () => { $("houseDialog").close(); showProfileView(); };
  $("createHouseForm").onsubmit = createHousehold;
  $("joinHouseForm").onsubmit = joinHousehold;
  $("houseBtn").onclick = openHouseDialog;
  $("shareInviteBtn").onclick = shareInvite;
  $("leaveHouseBtn").onclick = leaveHousehold;
  $("signOutBtn").onclick = signOut;
  $("closeHouseBtn").onclick = () => $("houseDialog").close();

  // ออกจากระบบจากอีกแท็บ -> กลับหน้าตั้งโปรไฟล์
  db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && appStarted) { appStarted = false; profile = null; showProfileView(); }
  });

  // กลับมาออนไลน์ -> ส่งคิว, กลับมาเปิดแอป -> โหลดของที่คนอื่นในบ้านเพิ่งแก้
  window.addEventListener("online", async () => { if (householdId && await refreshFromServer()) redrawCurrentPage(); });
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && householdId && !document.querySelector("dialog[open]") && await refreshFromServer()) redrawCurrentPage();
  });
}
