// Sabre spike — S0 auth discovery.
// Run: node --env-file=.env.local scripts/sabre-spike.mjs
const token = process.env.SABRE_HACKATHON_ACCESS_TOKEN || "";
const user = process.env.SABRE_APP_USERNAME || "";
const pass = process.env.SABRE_APP_PASS || "";
const pcc = process.env.SABRE_PCC || "";
const domain = process.env.SABRE_DOMAIN || "AS";

const BASES = [
  "https://api.havail.sabre.com",
  "https://api-crt.cert.havail.sabre.com",
  "https://api.platform.sabre.com",
  "https://api.cert.platform.sabre.com",
];

function b64(s) {
  return Buffer.from(s).toString("base64");
}

async function post(base, path, headers, body, label) {
  try {
    const res = await fetch(base + path, { method: "POST", headers, body });
    const t = await res.text();
    return { base, label, status: res.status, snippet: t.slice(0, 220).replace(/\n/g, " ") };
  } catch (e) {
    return { base, label, status: "ERR", snippet: String(e).slice(0, 140) };
  }
}
async function get(base, path, headers, label) {
  try {
    const res = await fetch(base + path, { headers });
    const t = await res.text();
    return { base, label, status: res.status, snippet: t.slice(0, 220).replace(/\n/g, " ") };
  } catch (e) {
    return { base, label, status: "ERR", snippet: String(e).slice(0, 140) };
  }
}

const results = [];
const form = "grant_type=client_credentials";
const FORM_H = { "Content-Type": "application/x-www-form-urlencoded" };

for (const base of BASES) {
  // A: pasted token as the Basic credential to MINT a bearer
  results.push(
    await post(base, "/v2/auth/token", { ...FORM_H, Authorization: `Basic ${token}` }, form, "mint: Basic <hackathon-token>")
  );
  // B: mint from username/pass — clientId V1:user:pcc:domain, secret pass (needs PCC)
  if (user && pass) {
    const clientId = `V1:${user}:${pcc}:${domain}`;
    const cred = b64(`${b64(clientId)}:${b64(pass)}`);
    results.push(
      await post(base, "/v2/auth/token", { ...FORM_H, Authorization: `Basic ${cred}` }, form, `mint: user/pass (pcc='${pcc}')`)
    );
  }
  // C: pasted token as Bearer on a tiny endpoint (re-confirm)
  results.push(
    await get(base, "/v1/lists/supported/countries", { Authorization: `Bearer ${token}`, Accept: "application/json" }, "bearer: countries")
  );
}

for (const r of results) {
  console.log(`\n[${r.label}] ${r.base} -> HTTP ${r.status}`);
  console.log("  " + r.snippet);
}
