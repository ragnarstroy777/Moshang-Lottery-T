// Phone number utilities for card labels
// Provides unique Russian numbers in format: +7 (9XX) XXX-XX-XX

const USED = new Set();
let idToPhone = Object.create(null);

function formatPhone(input) {
  // Accepts raw string, returns +7 (9AB) CDE-FG-HI or null
  let d = String(input).replace(/\D/g, "");
  if (d.length === 10 && d[0] === "9") {
    d = "7" + d; // prepend country code
  }
  if (!(d.length === 11 && d.startsWith("79"))) return null;
  // d = 7 9 A B C D E F G H I
  const A = d[2], B = d[3], C = d[4], D = d[5], E = d[6], F = d[7], G = d[8], H = d[9], I = d[10];
  return `+7 (9${A}${B}) ${C}${D}${E}-${F}${G}-${H}${I}`;
}

function randomPhone() {
  // Format: +7 (9AB) CDE-FG-HI
  let n;
  do {
    const A = Math.floor(Math.random() * 10); // 0-9
    const B = Math.floor(Math.random() * 10);
    const C = Math.floor(Math.random() * 10);
    const D = Math.floor(Math.random() * 10);
    const E = Math.floor(Math.random() * 10);
    const F = Math.floor(Math.random() * 10);
    const G = Math.floor(Math.random() * 10);
    const H = Math.floor(Math.random() * 10);
    const I = Math.floor(Math.random() * 10);
    n = `+7 (9${A}${B}) ${C}${D}${E}-${F}${G}-${H}${I}`;
  } while (USED.has(n));
  USED.add(n);
  return n;
}

function normalizeExternal(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach(item => {
    if (!item) return;
    let s = String(item).trim();
    // try to format if raw digits
    if (/^\+?\d[\d\s\-()]*$/.test(s)) {
      const formatted = formatPhone(s);
      if (formatted && !USED.has(formatted)) {
        USED.add(formatted);
        out.push(formatted);
        return;
      }
    }
    // if already formatted correctly
    if (/^\+7 \(9\d{2}\) \d{3}-\d{2}-\d{2}$/.test(s) && !USED.has(s)) {
      USED.add(s);
      out.push(s);
    }
  });
  return out;
}

function parseCsv(csv) {
  if (!csv || typeof csv !== "string") return [];
  const parts = csv.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  return parts;
}

function buildPhoneMap(users, externalArray, externalCsv) {
  idToPhone = Object.create(null);
  USED.clear();
  const ext = normalizeExternal(externalArray || parseCsv(externalCsv));
  let extIndex = 0;
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const id = user && user[0];
    if (id == null) continue;
    let phone = extIndex < ext.length ? ext[extIndex++] : randomPhone();
    // ensure unique (randomPhone handles uniqueness)
    idToPhone[id] = phone;
  }
}

function getPhoneByUser(user) {
  if (!user) return "";
  const id = user[0];
  return idToPhone[id] || "";
}

// Optional programmatic injection hook
function setExternalPhones(list) {
  const arr = Array.isArray(list) ? list : [];
  // This does not rebuild the map; call buildPhoneMap again after providing external list
  return normalizeExternal(arr);
}

export { buildPhoneMap, getPhoneByUser, setExternalPhones };
