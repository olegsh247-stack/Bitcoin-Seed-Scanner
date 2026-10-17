// "Addresses of this seed phrase" block: shown after a scan. Public data only (no keys).
// Lists the first receive address of every scanned type plus every address that has
// history. Built with DOM APIs (textContent), never innerHTML. Nothing is stored.
import { satsToBtc } from "./lib.js";

// deps: { getText() -> current language strings }
export function initAddrList({ getText }) {
  const card = document.getElementById("addrListCard");
  const title = document.getElementById("alTitle");
  const hint = document.getElementById("alHint");
  const body = document.getElementById("alBody");
  const copyBtn = document.getElementById("alCopy");
  const copied = document.getElementById("alCopied");
  const heads = ["alThPath", "alThType", "alThAddr", "alThStatus"].map((id) =>
    document.getElementById(id),
  );
  let entries = []; // { name, type, path, address, status: funded|used|unused|unknown, balanceSats }
  let timer = null;

  const statusText = (L, e) => {
    if (e.status === "funded") return L.alStFunded.replace("{b}", satsToBtc(e.balanceSats));
    if (e.status === "used") return L.alStUsed;
    if (e.status === "unused") return L.alStUnused;
    return L.alStUnknown;
  };

  function render() {
    const L = getText();
    title.textContent = L.alTitle;
    hint.textContent = L.alHint;
    copyBtn.textContent = L.alCopy;
    [L.thPath, L.thType, L.thAddr, L.alThStatus].forEach((t, i) => (heads[i].textContent = t));
    body.replaceChildren();
    for (const e of entries) {
      const tr = document.createElement("tr");
      if (e.status === "funded") tr.className = "found";
      const cells = [
        [e.path, "path"],
        [`${e.name} · ${e.type}`, ""],
        [e.address, "addr"],
        [statusText(L, e), e.status === "funded" ? "bal" : ""],
      ];
      for (const [text, cls] of cells) {
        const td = document.createElement("td");
        if (cls) td.className = cls;
        td.textContent = text;
        tr.append(td);
      }
      body.append(tr);
    }
  }

  const plainText = () => {
    const L = getText();
    return entries
      .map((e) => `${e.name} ${e.type} | ${e.path} | ${e.address} | ${statusText(L, e)}`)
      .join("\n");
  };

  const say = (msg) => {
    copied.textContent = msg;
    clearTimeout(timer);
    timer = setTimeout(() => (copied.textContent = ""), 3000);
  };

  copyBtn.onclick = async () => {
    const L = getText();
    const text = plainText();
    try {
      await navigator.clipboard.writeText(text);
      return say(L.alCopied);
    } catch (_) {
      // Fallback for browsers that refuse the clipboard API on local files.
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      const okCopy = document.execCommand("copy");
      ta.remove();
      say(okCopy ? L.alCopied : L.alCopyFail);
    } catch (_) {
      say(L.alCopyFail);
    }
  };

  return {
    show(list) {
      entries = list.map((e) => ({ ...e }));
      render();
      card.style.display = entries.length ? "block" : "none";
    },
    clear() {
      entries = [];
      body.replaceChildren();
      copied.textContent = "";
      card.style.display = "none";
    },
    refresh() {
      if (entries.length) render();
    },
    text: plainText,
  };
}
