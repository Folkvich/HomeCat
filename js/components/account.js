// ===== Component: โปรไฟล์ + บ้าน (สร้าง/เข้าร่วม/เชิญ/ออก) =====
// ลำดับตอนเปิดแอป: ตั้งโปรไฟล์ (ชื่อ + อีโมจิ) -> เลือก/สร้างบ้าน -> โหลดแมวของบ้านนั้น
// ไม่ใช้อีเมล/รหัสผ่าน: ใช้ Anonymous Sign-in ของ Supabase เครื่องจะจำผู้ใช้ไว้เอง
// เปลี่ยนเครื่อง/ล้างเบราว์เซอร์ -> ตั้งโปรไฟล์ใหม่ แล้วกรอกรหัสเชิญบ้านเดิม แมวยังอยู่ครบ (แมวผูกกับบ้าน ไม่ได้ผูกกับคน)
// ลิงก์เชิญ (?join=รหัส): เครื่องที่มีโปรไฟล์อยู่แล้วใช้โปรไฟล์เดิมเข้าบ้านเลย ไม่สร้างผู้ใช้ใหม่

let appStarted = false; // เข้าหน้าแอปแล้วหรือยัง
let entering = null;    // กำลังหาบ้านอยู่ (กันเรียกซ้อนกัน 2 รอบ)
let profile = null;     // โปรไฟล์ของเรา { display_name, avatar }
let memberCount = 0;    // จำนวนสมาชิกบ้าน (ใช้เตือนตอนจะออก ถ้าเป็นคนสุดท้าย)
let pendingInvite = null; // รหัสเชิญจากลิงก์ ที่รอเข้าร่วมหลังตั้งโปรไฟล์เสร็จ

// โชว์เฉพาะหน้าที่ต้องการ ซ่อนหน้าอื่นทั้งหมด
function showOnly(viewId) {
  for (const id of ["bootView", "inviteView", "profileView", "householdView", "welcomeView", "listView", "detailView"]) $(id).hidden = id !== viewId;
  $("houseBtn").hidden = !["listView", "detailView"].includes(viewId);
}

// ----- เริ่มแอป -----

async function startApp() {
  const { data: { session } } = await db.auth.getSession();
  const invite = readInviteFromUrl();
  if (invite) return showInviteView(invite, session);
  if (!session) return showProfileView();
  await enterHousehold(session.user);
}

// อ่านรหัสเชิญจากลิงก์ แล้วลบออกจากแถบที่อยู่ (รีโหลดจะได้ไม่เข้าหน้าเชิญซ้ำ)
function readInviteFromUrl() {
  const url = new URL(location.href);
  const code = url.searchParams.get("join");
  if (!code) return null;
  url.searchParams.delete("join");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  return code.trim().toUpperCase();
}

const inviteLink = (code) => `${location.origin}${location.pathname}?join=${code}`;

// ----- Landing page ของลิงก์เชิญ -----

async function showInviteView(code, session) {
  showOnly("inviteView");
  $("inviteBody").innerHTML = `<p class="muted">กำลังโหลด...</p>`;
  const [preview, me, mine] = await Promise.all([
    db.rpc("invite_preview", { p_code: code }),
    session && db.from("profiles").select("display_name, avatar").eq("id", session.user.id).maybeSingle(),
    session && db.from("household_members").select("households(id, name, invite_code)").eq("user_id", session.user.id),
  ]);
  const h = preview.data?.[0];
  if (preview.error || !h) {
    const offline = preview.error && isNetworkError(preview.error);
    if (preview.error && !offline) console.error(preview.error);
    $("inviteBody").innerHTML = `
      <div class="empty-pic">🔗</div>
      <h2>${offline ? "ต่อเน็ตไม่ได้" : "ลิงก์เชิญใช้ไม่ได้"}</h2>
      <p class="muted">${offline ? "ลองเปิดลิงก์ใหม่อีกครั้งเมื่อมีเน็ต" : "รหัสอาจพิมพ์ผิด หรือบ้านนี้ไม่มีอยู่แล้ว ลองขอลิงก์ใหม่จากคนในบ้าน"}</p>
      <button class="primary" id="inviteHomeBtn">ไปหน้าแรก</button>`;
    $("inviteHomeBtn").onclick = () => startApp();
    return;
  }
  profile = me?.data || null;
  const already = mine?.data?.map((m) => m.households).find((x) => x.invite_code === code);
  const who = h.owner_name ? `${makeTextSafe(h.owner_avatar)} ${makeTextSafe(h.owner_name)} ชวนคุณเข้าบ้าน` : "คุณได้รับเชิญเข้าบ้าน";
  let action;
  if (already) action = `<button class="primary" id="inviteGoBtn">เปิดบ้านนี้</button><p class="muted small-center">คุณเป็นสมาชิกบ้านนี้อยู่แล้ว</p>`;
  else if (profile) action = `<button class="primary" id="inviteGoBtn">เข้าร่วมในชื่อ ${makeTextSafe(profile.avatar)} ${makeTextSafe(profile.display_name)}</button>`;
  else action = `<button class="primary" id="inviteGoBtn">ตั้งโปรไฟล์แล้วเข้าร่วม</button>
    <p class="muted small-center">เคยใช้ HomeCat แบบแอปบนหน้าจอโฮมแล้ว? เปิดแอปนั้นแล้วกรอกรหัส <b>${makeTextSafe(code)}</b> แทน จะได้ใช้โปรไฟล์เดิม ไม่ซ้ำกัน</p>`;
  $("inviteBody").innerHTML = `
    <div class="empty-pic">🏠</div>
    <p class="muted">${who}</p>
    <h2>${makeTextSafe(h.household_name)}</h2>
    <div class="invite-stats">
      <span><b>${h.member_count}</b> สมาชิก</span>
      <span><b>${h.cat_count}</b> แมว</span>
    </div>
    <p class="muted">ทุกคนในบ้านเห็นและบันทึกวัคซีน น้ำหนัก และนัดหมอของแมวชุดเดียวกัน</p>
    ${action}
    <p id="inviteError" class="field-error" hidden></p>`;
  $("inviteGoBtn").onclick = () => {
    if (already) return openHousehold(already);
    if (!profile) { pendingInvite = code; return showProfileView(); }
    acceptInvite(code);
  };
}

// เข้าร่วมบ้านด้วยรหัสเชิญ (ใช้ทั้งจากลิงก์ และจากช่องกรอกรหัส) คืน error เป็นข้อความ หรือ null ถ้าสำเร็จ
async function acceptInvite(code) {
  const { data, error } = await db.rpc("join_household", { p_code: code });
  if (error) {
    const msg = rpcErrorText(error);
    // ยังอยู่หน้าเชิญ -> โชว์ข้อความในหน้านั้น
    if (!$("inviteView").hidden) { $("inviteError").textContent = msg; $("inviteError").hidden = false; }
    if (/duplicate_name/.test(error.message)) offerRename();
    return msg;
  }
  pendingInvite = null;
  appStarted = false;
  await openHousehold(data, { welcome: true });
  return null;
}

// ชื่อซ้ำกับคนในบ้าน -> ปุ่มเปลี่ยนชื่อโปรไฟล์ (หลังเปลี่ยนจะเข้าร่วมให้อัตโนมัติ)
function offerRename() {
  const err = !$("inviteView").hidden ? $("inviteError") : !$("householdView").hidden ? $("householdError") : null;
  if (!err || err.querySelector("button")) return;
  err.insertAdjacentHTML("beforeend", ` <button type="button" class="link" id="renameBtn">เปลี่ยนชื่อ</button>`);
  $("renameBtn").onclick = () => showProfileView();
}

// แปลง error จากฟังก์ชันในฐานข้อมูลเป็นภาษาไทย
function rpcErrorText(error) {
  const m = error.message || "";
  if (/invalid_invite_code/.test(m)) return "ไม่พบบ้านที่ใช้รหัสนี้ ลองเช็กรหัสอีกครั้ง";
  if (/duplicate_name/.test(m)) return `ในบ้านนี้มีคนชื่อ "${profile?.display_name}" อยู่แล้ว ถ้าเป็นคุณจากเครื่องเก่า ให้เจ้าของบ้านลบชื่อเดิมออกก่อน หรือเปลี่ยนชื่อใหม่`;
  if (/profile_required/.test(m)) return "ตั้งโปรไฟล์ก่อนเข้าร่วมบ้าน";
  if (/not_owner/.test(m)) return "เฉพาะเจ้าของบ้านเท่านั้นที่ลบสมาชิกได้";
  if (isNetworkError(error)) return "ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง";
  return m;
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
    if (pendingInvite) {
      // มาจากลิงก์เชิญ -> เข้าร่วมบ้านนั้นเลย
      const err = await acceptInvite(pendingInvite);
      if (err) showProfileError(err); // เช่น ชื่อซ้ำ -> แก้ชื่อในหน้านี้แล้วกดใหม่ได้
      return;
    }
    await enterHousehold(session.user);
  } finally {
    btn.disabled = false;
  }
}

// แปลงข้อความ error ของ Supabase เป็นภาษาไทยที่อ่านเข้าใจ
function profileErrorText(error) {
  if (/anonymous sign-ins are disabled/i.test(error.message)) return "ยังไม่ได้เปิด Anonymous Sign-ins ใน Supabase (Authentication > Sign In / Providers)";
  if (/rate limit/i.test(error.message)) return "สร้างผู้ใช้ถี่เกินไป รอสักครู่แล้วลองใหม่";
  if (/duplicate_name/.test(error.message)) return "มีคนในบ้านใช้ชื่อนี้แล้ว ลองชื่ออื่น";
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
// welcome: true = เพิ่งเข้าร่วมบ้าน -> โชว์หน้าต้อนรับ (ครั้งแรกของบ้านนั้นเท่านั้น)
async function openHousehold(h, { welcome = false } = {}) {
  appStarted = true;
  household = h;
  householdId = h.id;
  currentId = null;
  try { localStorage.setItem(HOUSE_KEY, JSON.stringify(h)); } catch { /* ไม่เป็นไร */ }
  cats = loadCache();
  if (welcome && !wasWelcomed(h.id)) {
    showOnly("bootView");
    await refreshFromServer();
    return showWelcomeView();
  }
  showStartPage();
  if (await refreshFromServer()) redrawCurrentPage();
  await offerLegacyUpload();
}

// ----- หน้าต้อนรับสมาชิกใหม่ของบ้าน (ครั้งแรก) -----

const WELCOMED_KEY = "homecat.welcomed.";
function wasWelcomed(hid) { try { return !!localStorage.getItem(WELCOMED_KEY + hid); } catch { return false; } }

async function showWelcomeView() {
  showOnly("welcomeView");
  $("welcomeHouse").textContent = household.name;
  $("welcomeCode").textContent = household.invite_code;
  $("welcomeCats").textContent = cats.length ? `มีแมว ${cats.length} ตัวรออยู่: ${cats.slice(0, 5).map((c) => c.name).join(", ")}${cats.length > 5 ? " ..." : ""}` : "บ้านนี้ยังไม่มีแมว เพิ่มตัวแรกได้เลย";
  $("welcomeMembers").innerHTML = "";
  const { data } = await db.rpc("list_household_members", { hid: householdId });
  $("welcomeMembers").innerHTML = (data || []).map((m) =>
    `<span class="chip">${makeTextSafe(m.avatar)} ${makeTextSafe(m.display_name)}</span>`).join("");
}

function finishWelcome() {
  try { localStorage.setItem(WELCOMED_KEY + householdId, "1"); } catch { /* ไม่เป็นไร */ }
  showStartPage();
  offerLegacyUpload();
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
  const err = await acceptInvite(code);
  if (err) { showHouseholdError(err); if (/มีคนชื่อ/.test(err)) offerRename(); }
}

// ----- หน้าต่างบ้านของฉัน (รหัสเชิญ สมาชิก ออกจากบ้าน ออกจากระบบ) -----

async function openHouseDialog() {
  $("houseName").textContent = household.name;
  $("myProfile").textContent = profile ? `${profile.avatar} ${profile.display_name}` : "";
  $("inviteCode").textContent = household.invite_code;
  $("houseMembers").innerHTML = `<li class="muted">กำลังโหลด...</li>`;
  $("houseDialog").showModal();
  $("otherHouses").hidden = true;
  await Promise.all([drawHouseMembers(), drawOtherHouses()]);
}

// รายชื่อสมาชิก (เจ้าของบ้านจะเห็นปุ่มลบคนอื่น)
async function drawHouseMembers() {
  const [{ data: { user } }, { data, error }] = await Promise.all([
    db.auth.getUser(), db.rpc("list_household_members", { hid: householdId }),
  ]);
  memberCount = error ? 0 : data.length;
  const iAmOwner = !error && data.some((m) => m.user_id === user?.id && m.role === "owner");
  $("houseMembers").innerHTML = error ? `<li class="muted">โหลดรายชื่อไม่ได้ (ออฟไลน์?)</li>` : data.map((m) => `
    <li><span class="member-avatar">${makeTextSafe(m.avatar)}</span><span class="member-name">${makeTextSafe(m.display_name)}${m.user_id === user?.id ? " (คุณ)" : ""}</span>
      ${m.role === "owner" ? `<span class="tag">เจ้าของบ้าน</span>` : ""}
      ${iAmOwner && m.user_id !== user?.id ? `<button type="button" class="link danger" data-remove="${m.user_id}" data-name="${makeTextSafe(m.display_name)}">ลบ</button>` : ""}</li>`).join("");
}

// เจ้าของบ้านลบสมาชิก (เช่น โปรไฟล์เก่าจากเครื่องที่ไม่ได้ใช้แล้ว)
async function removeMember(uid, name) {
  if (!(await askConfirm(`ลบ "${name}" ออกจากบ้าน? เขาจะไม่เห็นแมวของบ้านนี้อีก จนกว่าจะเข้าร่วมใหม่ด้วยรหัสเชิญ`, "ลบสมาชิก"))) return;
  const { error } = await db.rpc("remove_household_member", { hid: householdId, uid });
  if (error) return showToast(`⚠️ ${rpcErrorText(error)}`, 5000);
  showToast(`ลบ ${name} ออกจากบ้านแล้ว`);
  drawHouseMembers();
}

// บ้านอื่นที่เราเป็นสมาชิก -> สลับไปได้
async function drawOtherHouses() {
  const { data: { user } } = await db.auth.getUser();
  const { data } = await db.from("household_members").select("households(id, name, invite_code)").eq("user_id", user?.id);
  const others = (data || []).map((m) => m.households).filter((h) => h.id !== householdId);
  $("otherHouses").hidden = !others.length;
  $("otherHouseList").innerHTML = others.map((h) =>
    `<button type="button" data-switch="${h.id}">🏠 ${makeTextSafe(h.name)}</button>`).join("");
  $("otherHouseList").onclick = (e) => {
    const h = others.find((x) => x.id === e.target.closest("[data-switch]")?.dataset.switch);
    if (!h) return;
    $("houseDialog").close();
    if (history.state?.catId) history.replaceState(null, "");
    openHousehold(h);
    showToast(`สลับไปบ้าน "${h.name}" แล้ว`);
  };
}

// แชร์ลิงก์เชิญ (มือถือเปิดเมนูแชร์ของเครื่อง, คอมคัดลอกลิงก์ลงคลิปบอร์ด)
async function shareInvite() {
  const url = inviteLink(household.invite_code);
  const text = `มาดูแลแมวด้วยกันใน HomeCat! บ้าน "${household.name}" (รหัส ${household.invite_code})`;
  try {
    if (navigator.share) await navigator.share({ title: "เชิญเข้าบ้าน HomeCat", text, url });
    else copyInviteLink();
  } catch { /* ผู้ใช้กดยกเลิกการแชร์ */ }
}

// คัดลอกลิงก์เชิญ ถ้าเบราว์เซอร์ไม่ยอม -> โชว์ลิงก์ในช่องให้คัดลอกเอง
async function copyInviteLink() {
  const url = inviteLink(household.invite_code);
  if (await copyText(url, $("houseDialog"))) {
    $("inviteLinkInput").hidden = true;
    return showToast("คัดลอกลิงก์เชิญแล้ว ✓");
  }
  const input = $("inviteLinkInput");
  input.value = url;
  input.hidden = false;
  input.focus();
  input.select();
  showToast("คัดลอกอัตโนมัติไม่ได้ กดค้างที่ลิงก์ด้านบนเพื่อคัดลอก", 4000);
}

async function leaveHousehold() {
  const warn = memberCount === 1
    ? `คุณเป็นสมาชิกคนสุดท้ายของบ้าน "${household.name}" ถ้าออก จะไม่มีใครเห็นแมวของบ้านนี้อีก จนกว่าจะมีคนกรอกรหัส ${household.invite_code} เข้ามาใหม่`
    : `ออกจากบ้าน "${household.name}"? คุณจะไม่เห็นแมวของบ้านนี้อีก จนกว่าจะเข้าร่วมใหม่ด้วยรหัส ${household.invite_code}`;
  if (!(await askConfirm(warn, "ออกจากบ้าน"))) return;
  const { data: { user } } = await db.auth.getUser();
  // ผ่านฟังก์ชันในฐานข้อมูล: ถ้าเราเป็นเจ้าของบ้าน จะส่งต่อให้สมาชิกที่อยู่มานานที่สุด
  const { error } = await db.rpc("leave_household", { hid: householdId });
  if (error) return showToast(`⚠️ ออกจากบ้านไม่สำเร็จ: ${rpcErrorText(error)}`, 5000);
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
  $("houseMembers").onclick = (e) => { const b = e.target.closest("[data-remove]"); if (b) removeMember(b.dataset.remove, b.dataset.name); };
  $("welcomeDoneBtn").onclick = finishWelcome;
  $("copyLinkBtn").onclick = copyInviteLink;

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
