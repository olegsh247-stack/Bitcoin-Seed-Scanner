// "Check an address" block: paste an address -> show address, type and balance.
// Standalone: it knows nothing about the seed and sends nothing but the address
// itself (to look up its balance).
import { describeAddress, satsToBtc } from "./lib.js";

// deps: { fetchAddressInfo(addr) -> {balance(sats), used}, getText() -> current language strings }
export function initAddressCheck({ fetchAddressInfo, getText }) {
  const input = document.getElementById("addrInput");
  const btn = document.getElementById("addrCheckBtn");
  const out = document.getElementById("addrResult");
  let state = null; // { kind: "checking"|"invalid"|"ok", addr, type, balance: sats | null | undefined }
  let token = 0;

  const row = (label, value, cls) => {
    const r = document.createElement("div");
    r.className = "addr-row";
    const l = document.createElement("div");
    l.className = "addr-label";
    l.textContent = label;
    const v = document.createElement("div");
    v.className = "addr-value" + (cls ? " " + cls : "");
    v.textContent = value; // textContent: never interpret user input as HTML
    r.append(l, v);
    return r;
  };

  function render() {
    const L = getText();
    out.replaceChildren();
    if (!state) return;
    if (state.kind === "checking") {
      out.append(row("", L.addrChecking));
      return;
    }
    if (state.kind === "invalid") {
      const e = document.createElement("div");
      e.className = "addr-error";
      e.textContent = L.addrInvalid;
      out.append(e);
      return;
    }
    out.append(row(L.addrRowAddr, state.addr, "addr"), row(L.addrRowType, state.type));
    if (state.balance === undefined) out.append(row(L.addrRowBal, L.addrChecking));
    else if (state.balance === null) out.append(row(L.addrRowBal, L.addrBalFail, "addr-error"));
    else out.append(row(L.addrRowBal, `${satsToBtc(state.balance)} BTC`, "bal"));
  }

  async function check() {
    const addr = input.value.trim();
    const my = ++token;
    if (!addr) {
      state = null;
      return render();
    }
    const type = describeAddress(addr);
    if (!type) {
      state = { kind: "invalid" };
      return render();
    }
    state = { kind: "ok", addr, type, balance: undefined };
    render();
    try {
      const info = await fetchAddressInfo(addr);
      if (my !== token) return; // a newer check replaced this one
      state.balance = info.balance;
    } catch (_) {
      if (my !== token) return;
      state.balance = null;
    }
    render();
  }

  btn.onclick = check;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") check();
  });
  return { refresh: render };
}
