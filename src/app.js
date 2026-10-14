// Bitcoin Seed Scanner — application logic.
// Built into a single self-contained index.html by `npm run build`.
// All crypto dependencies are bundled; nothing is loaded from a CDN at runtime.
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import {
  PATHS,
  CHAINS,
  DUST,
  MAX_FEE_RATE,
  selectUtxos,
  calcFeeAndChange,
  inputVSize,
  outputVSize,
  baseVSize,
  satsToBtc,
  btcToSats,
  isValidMainnetAddress,
  feeWarning,
} from "./lib.js";

const API = "https://mempool.space/api";

// ---------------------------------------------------------------- i18n ----
const LANGS = {
  en: {
    subtitle: "Find coins on BIP44 / 49 / 84 / 86 + send. Seed stays in browser memory only.",
    critTitle: "Critical",
    critBody:
      "Your computer may be infected. Malware can swap addresses, read the seed from browser memory, and monitor what you type.\n\nBefore you start:\n• For large amounts use a clean device: a new or reinstalled PC, a live USB, or a hardware wallet;\n• Scan the system with an up-to-date antivirus;\n• Never enter a seed on someone else's, public, or suspicious computer;\n• First only find coins; send only when you are sure the environment is safe.\n\nThis tool is for recovery, not everyday payments. You are responsible for your funds.",
    saferTitle: "Safer workflow:",
    saferBody:
      "1. First only find coins.\n2. Send only when sure, with double confirmation.\n3. Close the tab when done. Seed is never saved.",
    step1: "Seed phrase",
    seedLabel: "Seed (12 or 24 words)",
    passLabel: "Passphrase (if used)",
    passPh: "optional",
    gapLabel: "Gap limit (stop after N unused)",
    gapHint:
      "Scanning of each path stops after this many consecutive unused addresses. Default 25, range 5-100. Higher = slower, but finds coins farther along the chain.",
    accountLabel: "Account number",
    scanBtn: "Find coins",
    clearBtn: "Clear all",
    step2: "Found funds",
    noFunds: "No coins found in the scanned range.\nTry a larger gap or check the passphrase.",
    step3: "Send",
    sourceHint: "Select an address in the table above first",
    toLabel: "Recipient address",
    amountLabel: "Amount (BTC)",
    feeLabel: "Fee (sat/vB)",
    prepareBtn: "Prepare transaction",
    maxBtn: "Maximum",
    confirmHint: "Double-check everything. This cannot be undone.",
    confirmLabel: "Type the last 6 characters of the recipient address",
    broadcastBtn: "Sign and send",
    cancelBtn: "Cancel",
    donateTitle: "Gratitude",
    donateText:
      "If this program helped you recover your funds — we would gladly accept your voluntary thank-you. It is never required, and it will surely be counted by the Almighty. 🙏",
    thPath: "Path",
    thType: "Type",
    thAddr: "Address",
    thBal: "Balance",
    selectBtn: "Select",
    footer:
      "Local tool. Seed and keys exist only in browser RAM.\nClosing the tab clears them. Not a replacement for a hardware wallet.\nBIP44 = Legacy (1…) · BIP49 = Nested SegWit (3…) · BIP84 = Native SegWit (bc1q…) · BIP86 = Taproot (bc1p…)\nScans receive (/0/i) and change (/1/i).",
  },
  ru: {
    subtitle: "Поиск монет по BIP44 / 49 / 84 / 86 + отправка. Seed только в памяти браузера.",
    critTitle: "Важно",
    critBody:
      "Компьютер может быть заражён. Вредоносные программы умеют подменять адреса, читать seed из памяти браузера и следить за вводом.\n\nПеред работой:\n• для крупных сумм используйте чистое устройство: новый/переустановленный ПК, live-USB или hardware-кошелёк;\n• проверьте систему актуальным антивирусом;\n• не вводите seed на чужом, общественном или «подозрительном» компьютере;\n• сначала только найдите монеты; отправку делайте только когда уверены в безопасности окружения.\n\nЭтот инструмент — для восстановления, не для повседневных платежей. За сохранность средств отвечаете вы.",
    saferTitle: "Безопасный порядок:",
    saferBody:
      "1. Сначала только найдите монеты.\n2. Отправляйте только когда уверены, с двойным подтверждением.\n3. Закройте вкладку после работы. Seed никуда не сохраняется.",
    step1: "Seed-фраза",
    seedLabel: "Seed (12 или 24 слова)",
    passLabel: "Passphrase (если использовали)",
    passPh: "необязательно",
    gapLabel: "Gap limit (остановка после N неиспользованных)",
    gapHint:
      "Сканирование каждого пути прекращается после стольких подряд неиспользованных адресов. По умолчанию 25, диапазон 5-100. Больше — дольше, но находит монеты дальше по цепочке.",
    accountLabel: "Номер аккаунта",
    scanBtn: "Найти монеты",
    clearBtn: "Очистить всё",
    step2: "Найденные средства",
    noFunds:
      "Монет в выбранном диапазоне не найдено.\nПопробуйте больший gap или проверьте passphrase.",
    step3: "Отправка",
    sourceHint: "Сначала выберите адрес в таблице выше",
    toLabel: "Адрес получателя",
    amountLabel: "Сумма (BTC)",
    feeLabel: "Комиссия (sat/vB)",
    prepareBtn: "Подготовить транзакцию",
    maxBtn: "Максимум",
    confirmHint: "Проверьте всё ещё раз. Отменить будет нельзя.",
    confirmLabel: "Введите последние 6 символов адреса получателя",
    broadcastBtn: "Подписать и отправить",
    cancelBtn: "Отмена",
    donateTitle: "Благодарность",
    donateText:
      "Если программа помогла вам вернуть средства — мы с удовольствием примем Вашу добровольную благодарность. Это ни к чему не обязывает и обязательно зачтётся Всевышним. 🙏",
    thPath: "Путь",
    thType: "Тип",
    thAddr: "Адрес",
    thBal: "Баланс",
    selectBtn: "Выбрать",
    footer:
      "Локальный инструмент. Seed и ключи только в памяти браузера.\nЗакрытие вкладки их стирает. Не замена hardware-кошельку.\nBIP44 = Legacy (1…) · BIP49 = Nested SegWit (3…) · BIP84 = Native SegWit (bc1q…) · BIP86 = Taproot (bc1p…)\nСканируются receive (/0/i) и change (/1/i).",
  },
  es: {
    subtitle:
      "Busca monedas en BIP44 / 49 / 84 / 86 + envío. La seed solo está en la memoria del navegador.",
    critTitle: "Crítico",
    critBody:
      "El ordenador puede estar infectado. El malware puede cambiar direcciones, leer la seed de la memoria del navegador y vigilar lo que escribes.\n\nAntes de empezar:\n• Con cantidades grandes usa un dispositivo limpio: PC nuevo o reinstalado, live USB o monedero hardware;\n• Revisa el sistema con un antivirus actualizado;\n• Nunca introduzcas la seed en un ordenador ajeno, público o sospechoso;\n• Primero solo busca monedas; envía solo cuando estés seguro de que el entorno es seguro.\n\nEsta herramienta es para recuperación, no para pagos diarios. Tú eres responsable de tus fondos.",
    saferTitle: "Flujo más seguro:",
    saferBody:
      "1. Primero solo encuentra monedas.\n2. Envía solo cuando estés seguro, con doble confirmación.\n3. Cierra la pestaña al terminar. La seed nunca se guarda.",
    step1: "Frase seed",
    seedLabel: "Seed (12 o 24 palabras)",
    passLabel: "Passphrase (si la usaste)",
    passPh: "opcional",
    gapLabel: "Gap limit (parar tras N sin usar)",
    gapHint:
      "El escaneo de cada ruta se detiene tras tantas direcciones consecutivas sin usar. Por defecto 25, rango 5-100. Más alto = más lento, pero encuentra monedas más adelante en la cadena.",
    accountLabel: "Número de cuenta",
    scanBtn: "Buscar monedas",
    clearBtn: "Borrar todo",
    step2: "Fondos encontrados",
    noFunds:
      "No se encontraron monedas en el rango escaneado.\nPrueba un gap mayor o revisa la passphrase.",
    step3: "Enviar",
    sourceHint: "Selecciona primero una dirección en la tabla de arriba",
    toLabel: "Dirección de destino",
    amountLabel: "Cantidad (BTC)",
    feeLabel: "Comisión (sat/vB)",
    prepareBtn: "Preparar transacción",
    maxBtn: "Máximo",
    confirmHint: "Revisa todo otra vez. Esto no se puede deshacer.",
    confirmLabel: "Escribe los últimos 6 caracteres de la dirección de destino",
    broadcastBtn: "Firmar y enviar",
    cancelBtn: "Cancelar",
    donateTitle: "Agradecimiento",
    donateText:
      "Si este programa te ayudó a recuperar tus fondos — aceptaremos con gusto tu agradecimiento voluntario. No obliga a nada y, sin duda, será tenido en cuenta por el Todopoderoso. 🙏",
    thPath: "Ruta",
    thType: "Tipo",
    thAddr: "Dirección",
    thBal: "Saldo",
    selectBtn: "Elegir",
    footer:
      "Herramienta local. Seed y claves solo en la memoria del navegador.\nAl cerrar la pestaña se borran. No sustituye un monedero hardware.\nBIP44 = Legacy (1…) · BIP49 = Nested SegWit (3…) · BIP84 = Native SegWit (bc1q…) · BIP86 = Taproot (bc1p…)\nSe escanean receive (/0/i) y change (/1/i).",
  },
  fr: {
    subtitle:
      "Trouver des pièces sur BIP44 / 49 / 84 / 86 + envoi. La seed reste uniquement en mémoire du navigateur.",
    critTitle: "Critique",
    critBody:
      "L'ordinateur peut être infecté. Les malwares peuvent substituer des adresses, lire la seed en mémoire du navigateur et surveiller ce que vous saisissez.\n\nAvant de commencer :\n• Pour de gros montants, utilisez un appareil propre : PC neuf ou réinstallé, live USB ou portefeuille matériel ;\n• Vérifiez le système avec un antivirus à jour ;\n• N'entrez jamais une seed sur un ordinateur d'autrui, public ou suspect ;\n• D'abord uniquement trouver les pièces ; n'envoyez que lorsque vous êtes sûr de la sécurité de l'environnement.\n\nCet outil est destiné à la récupération, pas aux paiements quotidiens. Vous êtes responsable de vos fonds.",
    saferTitle: "Démarche plus sûre :",
    saferBody:
      "1. D'abord uniquement trouver les pièces.\n2. Envoyer seulement en étant sûr, avec double confirmation.\n3. Fermez l'onglet ensuite. La seed n'est jamais enregistrée.",
    step1: "Phrase seed",
    seedLabel: "Seed (12 ou 24 mots)",
    passLabel: "Passphrase (si utilisée)",
    passPh: "facultatif",
    gapLabel: "Gap limit (arrêt après N inutilisées)",
    gapHint:
      "Le scan de chaque chemin s'arrête après autant d'adresses inutilisées consécutives. Par défaut 25, plage 5-100. Plus élevé = plus lent, mais trouve des pièces plus loin dans la chaîne.",
    accountLabel: "Numéro de compte",
    scanBtn: "Trouver les pièces",
    clearBtn: "Tout effacer",
    step2: "Fonds trouvés",
    noFunds:
      "Aucune pièce trouvée dans la plage scannée.\nEssayez un gap plus grand ou vérifiez la passphrase.",
    step3: "Envoyer",
    sourceHint: "Sélectionnez d'abord une adresse dans le tableau ci-dessus",
    toLabel: "Adresse du destinataire",
    amountLabel: "Montant (BTC)",
    feeLabel: "Frais (sat/vB)",
    prepareBtn: "Préparer la transaction",
    maxBtn: "Maximum",
    confirmHint: "Vérifiez encore une fois. Cela ne peut pas être annulé.",
    confirmLabel: "Saisissez les 6 derniers caractères de l'adresse de destination",
    broadcastBtn: "Signer et envoyer",
    cancelBtn: "Annuler",
    donateTitle: "Remerciements",
    donateText:
      "Si ce programme vous a aidé à récupérer vos fonds — nous accepterons volontiers votre remerciement volontaire. Cela n'oblige à rien et sera certainement compté par le Tout-Puissant. 🙏",
    thPath: "Chemin",
    thType: "Type",
    thAddr: "Adresse",
    thBal: "Solde",
    selectBtn: "Choisir",
    footer:
      "Outil local. Seed et clés uniquement en mémoire du navigateur.\nLa fermeture de l'onglet les efface. Ne remplace pas un portefeuille matériel.\nBIP44 = Legacy (1…) · BIP49 = Nested SegWit (3…) · BIP84 = Native SegWit (bc1q…) · BIP86 = Taproot (bc1p…)\nScan receive (/0/i) et change (/1/i).",
  },
};

// localStorage can throw (blocked site data, some sandboxed contexts). The app
// must keep working without it, so every access is guarded.
function storeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}
function storeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {}
}

let lang = storeGet("bss_lang") || (navigator.language || "en").slice(0, 2);
if (!LANGS[lang]) lang = "en";

function applyLang() {
  const L = LANGS[lang];
  const s = document.getElementById("subtitle");
  if (s) s.textContent = L.subtitle;
  const dt = document.getElementById("donateTitle");
  if (dt) dt.textContent = L.donateTitle;
  const dx = document.getElementById("donateText");
  if (dx) dx.textContent = L.donateText;
  const crit = document.getElementById("critBox");
  if (crit)
    crit.innerHTML = "<strong>" + L.critTitle + "</strong><br>" + L.critBody.replace(/\n/g, "<br>");
  const safer = document.getElementById("saferBox");
  if (safer)
    safer.innerHTML =
      "<strong>" + L.saferTitle + "</strong><br>" + L.saferBody.replace(/\n/g, "<br>");
  const map = [
    ["accountLabel", L.accountLabel],
    ["step1Title", L.step1],
    ["seedLabel", L.seedLabel],
    ["passLabel", L.passLabel],
    ["gapLabel", L.gapLabel],
    ["gapHint", L.gapHint],
    ["scanBtn", L.scanBtn],
    ["clearBtn", L.clearBtn],
    ["step2Title", L.step2],
    ["noFunds", L.noFunds],
    ["step3Title", L.step3],
    ["sourceInfo", L.sourceHint],
    ["toLabel", L.toLabel],
    ["amountLabel", L.amountLabel],
    ["feeLabel", L.feeLabel],
    ["prepareBtn", L.prepareBtn],
    ["maxBtn", L.maxBtn],
    ["confirmHint", L.confirmHint],
    ["confirmLabel", L.confirmLabel],
    ["broadcastBtn", L.broadcastBtn],
    ["cancelSendBtn", L.cancelBtn],
    ["thPath", L.thPath],
    ["thType", L.thType],
    ["thAddr", L.thAddr],
    ["thBal", L.thBal],
    ["footerText", L.footer],
  ];
  for (const [id, text] of map) {
    const el = document.getElementById(id);
    if (!el || text == null) continue;
    if (id === "noFunds" || id === "footerText" || id === "sourceInfo")
      el.innerHTML = text.replace(/\n/g, "<br>");
    else el.textContent = text;
  }
  const pass = document.getElementById("passphrase");
  if (pass) pass.placeholder = L.passPh;
  document
    .querySelectorAll(".lang-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  document.documentElement.lang = lang;
  window._selectLabel = L.selectBtn;
}
document.querySelectorAll(".lang-btn").forEach(
  (b) =>
    (b.onclick = () => {
      lang = b.dataset.lang;
      storeSet("bss_lang", lang);
      applyLang();
    }),
);
applyLang();

// ------------------------------------------------------------ DOM refs ----
const $ = (id) => document.getElementById(id);
const mnemonicEl = $("mnemonic"),
  passphraseEl = $("passphrase"),
  gapEl = $("gap"),
  accountEl = $("account"),
  scanBtn = $("scanBtn"),
  clearBtn = $("clearBtn"),
  statusEl = $("status"),
  progress = $("progress"),
  progressBar = $("progressBar"),
  resultsCard = $("resultsCard"),
  tbody = $("tbody"),
  summary = $("summary"),
  noFunds = $("noFunds"),
  sendCard = $("sendCard"),
  toAddressEl = $("toAddress"),
  amountEl = $("amount"),
  feeRateEl = $("feeRate"),
  prepareBtn = $("prepareBtn"),
  maxBtn = $("maxBtn"),
  confirmArea = $("confirmArea"),
  confirmTo = $("confirmTo"),
  confirmAmount = $("confirmAmount"),
  confirmFee = $("confirmFee"),
  confirmText = $("confirmText"),
  broadcastBtn = $("broadcastBtn"),
  cancelSendBtn = $("cancelSendBtn"),
  sendStatus = $("sendStatus"),
  sourceInfo = $("sourceInfo"),
  feeHints = $("feeHints");

let foundFunds = [],
  selectedSource = null,
  preparedTx = null,
  rootKey = null;

// -------------------------------------------------------------- helpers ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hardClear() {
  mnemonicEl.value = "";
  passphraseEl.value = "";
  toAddressEl.value = "";
  amountEl.value = "";
  confirmText.value = "";
  resultsCard.style.display = "none";
  sendCard.classList.remove("active");
  confirmArea.style.display = "none";
  tbody.innerHTML = "";
  summary.innerHTML = "";
  statusEl.textContent = "";
  statusEl.className = "status";
  sendStatus.textContent = "";
  progress.classList.remove("active");
  progressBar.style.width = "0%";
  sourceInfo.textContent = LANGS[lang].sourceHint;
  // Overwrite key material in place before dropping references.
  for (const f of foundFunds) {
    try {
      f.privateKey?.fill(0);
    } catch (_) {}
  }
  foundFunds = [];
  selectedSource = null;
  preparedTx = null;
  if (rootKey) {
    try {
      rootKey.wipePrivateData?.();
    } catch (_) {}
    rootKey = null;
  }
}
clearBtn.onclick = () => {
  if (confirm("Clear all data (seed, results, send form)?")) hardClear();
};

// ------------------------------------------------------------- network ----
// Retries on network errors, HTTP 429 and 5xx with exponential backoff.
// Other 4xx responses fail immediately.
async function fetchRetry(url, init, tries = 4) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) {
      lastErr = e;
    }
    await sleep(500 * 2 ** attempt);
  }
  throw lastErr;
}

// Balance plus "has this address ever been used" (needed for the gap limit).
async function fetchAddressInfo(addr) {
  const data = await (await fetchRetry(`${API}/address/${addr}`)).json();
  const chain = data.chain_stats || {},
    mem = data.mempool_stats || {};
  const balance =
    (chain.funded_txo_sum || 0) +
    (mem.funded_txo_sum || 0) -
    ((chain.spent_txo_sum || 0) + (mem.spent_txo_sum || 0));
  const used = (chain.tx_count || 0) + (mem.tx_count || 0) > 0;
  return { balance, used };
}

async function fetchUtxos(addr) {
  return await (await fetchRetry(`${API}/address/${addr}/utxo`)).json();
}

// Legacy (P2PKH) inputs must be signed against the full previous transaction.
async function fetchRawTx(txid) {
  const text = (await (await fetchRetry(`${API}/tx/${txid}/hex`)).text()).trim();
  if (!/^[0-9a-f]+$/i.test(text)) throw new Error("Unexpected raw transaction response");
  return hex.decode(text);
}

async function fetchFeeHints() {
  try {
    const res = await fetch(`${API}/v1/fees/recommended`);
    if (!res.ok) return;
    const f = await res.json();
    feeHints.textContent = `Hints: fast ${f.fastestFee} · halfHour ${f.halfHourFee} · hour ${f.hourFee} sat/vB`;
    if (!feeRateEl.value || feeRateEl.value === "5") feeRateEl.value = f.halfHourFee || 5;
  } catch (_) {}
}

// ---------------------------------------------------------------- scan ----
scanBtn.onclick = async () => {
  const mnemonic = mnemonicEl.value.trim().replace(/\s+/g, " ");
  const passphrase = passphraseEl.value || "";
  // Gap limit: stop a chain after this many CONSECUTIVE unused addresses.
  const gap = Math.min(100, Math.max(5, parseInt(gapEl.value) || 25));
  const account = Math.min(99, Math.max(0, parseInt(accountEl.value) || 0));
  const MAX_PER_CHAIN = 500; // hard safety cap per path/chain
  const MAX_CONSECUTIVE_FAILURES = 10; // API down: stop instead of hammering it

  const fail = (msg) => {
    statusEl.textContent = msg;
    statusEl.className = "status err";
  };
  if (!mnemonic) return fail("Enter a seed phrase");
  const words = mnemonic.split(" ");
  if (words.length !== 12 && words.length !== 24) return fail("Need 12 or 24 words");
  if (!bip39.validateMnemonic(mnemonic, wordlist)) return fail("Invalid seed phrase (checksum)");

  statusEl.textContent = "Generating seed...";
  statusEl.className = "status";
  progress.classList.add("active");
  progressBar.style.width = "5%";
  scanBtn.disabled = true;
  foundFunds = [];
  tbody.innerHTML = "";
  noFunds.style.display = "none";
  resultsCard.style.display = "none";
  sendCard.classList.remove("active");

  try {
    const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
    rootKey = HDKey.fromMasterSeed(seed);
    const combos = PATHS.length * CHAINS.length;
    let comboIdx = 0,
      lookups = 0,
      failedLookups = 0;

    for (const p of PATHS) {
      for (const change of CHAINS) {
        const chainLabel = change === 0 ? "receive" : "change";
        let streak = 0, // consecutive unused addresses
          consecutiveFailures = 0;
        for (let i = 0; i < MAX_PER_CHAIN && streak < gap; i++) {
          statusEl.textContent = `Scanning ${p.name} (${p.type}, ${chainLabel}) #${i}...`;
          progressBar.style.width = `${Math.round(((comboIdx + Math.min(1, streak / gap)) / combos) * 100)}%`;
          const path = `m/${p.purpose}'/0'/${account}'/${change}/${i}`;
          const child = rootKey.derive(path);
          const payment = child.privateKey ? p.makePayment(child.publicKey) : null;
          const address = payment && payment.address;
          if (!address) {
            streak++;
            continue;
          }
          lookups++;
          let info = null;
          try {
            info = await fetchAddressInfo(address);
            consecutiveFailures = 0;
          } catch (_) {
            // Never read a failed lookup as "empty": count it and keep scanning.
            failedLookups++;
            consecutiveFailures++;
            streak = 0;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES)
              throw new Error(
                "mempool.space is not responding (network blocked or rate-limited). Try again later or use a VPN.",
              );
          }
          if (info) {
            streak = info.used ? 0 : streak + 1;
            if (info.balance > 0) {
              foundFunds.push({
                path,
                type: p.type,
                name: p.name,
                address,
                balanceSats: info.balance,
                privateKey: child.privateKey,
                payment,
                pub: child.publicKey,
              });
            }
          }
          await sleep(80);
        }
        comboIdx++;
      }
    }
    progressBar.style.width = "100%";

    resultsCard.style.display = "block";
    sendCard.classList.add("active");

    if (foundFunds.length === 0) {
      noFunds.style.display = "block";
      summary.innerHTML = "";
    } else {
      noFunds.style.display = "none";
      const totalSats = foundFunds.reduce((s, f) => s + f.balanceSats, 0);
      summary.innerHTML = `<strong>Addresses found: ${foundFunds.length}</strong> · total <span class="bal">${satsToBtc(totalSats)} BTC</span>`;
      tbody.innerHTML = foundFunds
        .map(
          (f, idx) =>
            `<tr class="found"><td class="path">${f.path}</td><td>${f.name}<br><small style="color:var(--muted)">${f.type}</small></td><td class="addr">${f.address}</td><td class="bal">${satsToBtc(f.balanceSats)}</td><td><button class="btn-secondary" style="padding:6px 12px;font-size:0.82rem" data-idx="${idx}">${window._selectLabel || "Select"}</button></td></tr>`,
        )
        .join("");
      tbody.querySelectorAll("button[data-idx]").forEach((btn) => {
        btn.onclick = () => {
          selectedSource = foundFunds[parseInt(btn.dataset.idx)];
          sourceInfo.innerHTML = `Source: <strong>${selectedSource.address}</strong><br>${selectedSource.type} · ${selectedSource.path} · balance <strong class="bal">${satsToBtc(selectedSource.balanceSats)} BTC</strong>`;
          sendStatus.textContent = "";
          confirmArea.style.display = "none";
        };
      });
    }

    if (failedLookups > 0) {
      statusEl.textContent = `Warning: ${failedLookups} of ${lookups} address lookups failed (network or rate limit). The result may be incomplete — run the scan again.`;
      statusEl.className = "status err";
    } else if (foundFunds.length === 0) {
      statusEl.textContent = "Done. No funds found.";
      statusEl.className = "status";
    } else {
      statusEl.textContent = `Done. Found ${foundFunds.length} address(es) with balance.`;
      statusEl.className = "status ok";
    }
  } catch (e) {
    statusEl.textContent = "Error: " + e.message;
    statusEl.className = "status err";
  } finally {
    scanBtn.disabled = false;
    setTimeout(() => {
      progress.classList.remove("active");
      progressBar.style.width = "0%";
    }, 600);
  }
};

// ---------------------------------------------------------------- send ----
prepareBtn.onclick = async () => {
  const fail = (msg) => {
    sendStatus.textContent = msg;
    sendStatus.className = "status err";
  };
  if (!selectedSource) return fail("Select a source address first");
  const to = toAddressEl.value.trim();
  const amountStr = amountEl.value.trim();
  const feeRate = parseInt(feeRateEl.value) || 5;
  if (!to || !amountStr) return fail("Enter address and amount");
  if (!isValidMainnetAddress(to))
    return fail("Not a valid Bitcoin mainnet address (checksum or format error)");
  const amountSats = btcToSats(amountStr);
  if (amountSats === null) return fail("Amount must be a number with up to 8 decimals");
  if (amountSats <= 0n) return fail("Amount must be greater than zero");
  if (amountSats <= DUST) return fail("Amount is below the dust limit (546 sats)");
  if (feeRate > MAX_FEE_RATE)
    return fail(`Fee rate above ${MAX_FEE_RATE} sat/vB looks like a typo`);

  sendStatus.textContent = "Fetching UTXOs...";
  sendStatus.className = "status";
  prepareBtn.disabled = true;
  try {
    const utxos = await fetchUtxos(selectedSource.address);
    if (!utxos.length) throw new Error("No UTXOs on this address");
    const { selected, sum: inputSum } = selectUtxos(
      utxos,
      amountSats,
      feeRate,
      selectedSource.name,
    );
    const {
      fee: feeSats,
      change: changeSats,
      ok,
      vsize,
    } = calcFeeAndChange(inputSum, amountSats, selected.length, feeRate, selectedSource.name);
    if (!ok || changeSats < 0n)
      throw new Error(
        `Not enough funds. Need ~${satsToBtc(amountSats + feeSats)} BTC (amount + fee). On address: ${satsToBtc(inputSum)} BTC`,
      );

    const isLegacy = selectedSource.name === "BIP44";
    if (isLegacy) sendStatus.textContent = "Fetching previous transactions...";
    const inputs = [];
    for (const u of selected) {
      const input = { ...selectedSource.payment, txid: u.txid, index: u.vout };
      if (isLegacy) {
        // P2PKH has no witness data: signing requires the whole previous tx.
        input.nonWitnessUtxo = await fetchRawTx(u.txid);
      } else {
        input.witnessUtxo = {
          script: selectedSource.payment.script,
          amount: BigInt(u.value),
        };
      }
      inputs.push(input);
    }

    const tx = new btc.Transaction();
    for (const inp of inputs) tx.addInput(inp);
    tx.addOutputAddress(to, amountSats);
    if (changeSats > DUST) tx.addOutputAddress(selectedSource.address, changeSats);
    preparedTx = {
      tx,
      amountSats: Number(amountSats),
      feeSats: Number(feeSats),
      changeSats: Number(changeSats),
      inputs,
      vsize,
      utxoCount: selected.length,
    };

    confirmTo.textContent = to;
    confirmAmount.textContent = amountStr + " BTC";
    const warn = feeWarning(feeSats, amountSats);
    confirmFee.textContent = `~${satsToBtc(feeSats)} BTC (${feeRate} sat/vB, ~${vsize} vB, UTXO: ${selected.length})${warn ? " ⚠ " + warn : ""}`;
    confirmFee.style.color = warn ? "var(--danger)" : "";
    confirmArea.style.display = "block";
    confirmText.value = "";
    broadcastBtn.disabled = true;
    sendStatus.textContent = "";
    sendStatus.className = "status";
  } catch (e) {
    sendStatus.textContent = "Prepare error: " + e.message;
    sendStatus.className = "status err";
  } finally {
    prepareBtn.disabled = false;
  }
};

maxBtn.onclick = async () => {
  const fail = (msg) => {
    sendStatus.textContent = msg;
    sendStatus.className = "status err";
  };
  if (!selectedSource) return fail("Select a source address first");
  const feeRate = parseInt(feeRateEl.value) || 5;
  try {
    const utxos = await fetchUtxos(selectedSource.address);
    if (!utxos.length) return fail("No UTXOs on this address");
    const inputSum = utxos.reduce((s, u) => s + BigInt(u.value), 0n);
    const vs = baseVSize() + utxos.length * inputVSize(selectedSource.name) + outputVSize();
    const fee = BigInt(Math.ceil(vs * feeRate));
    const maxSats = inputSum > fee ? inputSum - fee : 0n;
    amountEl.value = satsToBtc(maxSats);
    sendStatus.textContent = "";
    sendStatus.className = "status";
  } catch (e) {
    fail("Could not compute maximum: " + e.message);
  }
};

confirmText.oninput = () => {
  const to = toAddressEl.value.trim();
  const needed = to.slice(-6).toLowerCase();
  broadcastBtn.disabled = confirmText.value.trim().toLowerCase() !== needed;
};

cancelSendBtn.onclick = () => {
  confirmArea.style.display = "none";
  confirmText.value = "";
  broadcastBtn.disabled = true;
  preparedTx = null;
  sendStatus.textContent = "";
};

broadcastBtn.onclick = async () => {
  if (!preparedTx || !selectedSource) return;
  if (!confirm("Really sign and broadcast this transaction?\n\nThis cannot be undone.")) return;
  sendStatus.textContent = "Signing...";
  sendStatus.className = "status";
  broadcastBtn.disabled = true;
  try {
    const { tx } = preparedTx;
    tx.sign(selectedSource.privateKey);
    tx.finalize();
    const txHex = hex.encode(tx.extract());

    sendStatus.textContent = "Broadcasting...";
    const res = await fetch(`${API}/tx`, { method: "POST", body: txHex });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || res.statusText);
    }
    const txid = (await res.text()).trim();

    if (!/^[0-9a-f]{64}$/i.test(txid)) {
      // The node accepted the request but did not return a txid. Do not offer a
      // retry (it could double-send); show the response as plain text only.
      sendStatus.textContent = `Broadcast returned an unexpected response — check mempool.space before retrying: ${txid.slice(0, 200)}`;
      sendStatus.className = "status err";
      confirmArea.style.display = "none";
      preparedTx = null;
      return;
    }

    // Built with DOM APIs (not innerHTML) so network data can never inject markup.
    sendStatus.textContent = "Sent successfully!";
    sendStatus.append(document.createElement("br"), "TXID: ");
    const link = document.createElement("a");
    link.href = `https://mempool.space/tx/${txid}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.style.color = "var(--accent)";
    link.textContent = txid;
    sendStatus.append(link);
    sendStatus.className = "status ok";

    selectedSource.balanceSats = Math.max(
      0,
      selectedSource.balanceSats - preparedTx.amountSats - preparedTx.feeSats,
    );
    sourceInfo.innerHTML = `Source: <strong>${selectedSource.address}</strong><br>${selectedSource.type} · ${selectedSource.path} · balance <strong class="bal">${satsToBtc(selectedSource.balanceSats)} BTC</strong>`;
    confirmArea.style.display = "none";
    preparedTx = null;
    amountEl.value = "";
  } catch (e) {
    sendStatus.textContent = "Send error: " + e.message;
    sendStatus.className = "status err";
    broadcastBtn.disabled = false;
  }
};

window.addEventListener("beforeunload", () => {
  hardClear();
});
fetchFeeHints();
