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
    helpBtn: "Help",
    helpTitle: "About this tool",
    seedOk: "✓ Valid seed phrase",
    seedBad: "✗ Checksum mismatch — a word is wrong or in the wrong order",
    seedWord: "✗ Not a valid BIP39 word",
    helpBody:
      'What it does\nChecks one seed phrase against all four common Bitcoin address types — BIP44 Legacy (1…), BIP49 Nested SegWit (3…), BIP84 Native SegWit (bc1q…), BIP86 Taproot (bc1p…) — on both the receive and change chains, and lets you send coins from a found address. Many wallets only look at the newest type, so older coins can look "missing".\n\nHow to use\n1. Enter your 12 or 24 words, one per box (you can paste the whole phrase into any box). All boxes turn green when the phrase is valid and red when it is not.\n2. Add the passphrase if you used one.\n3. Press "Find coins" and wait.\n4. Press "Select" next to an address with a balance, enter the destination and amount, press "Prepare", type the last 6 characters of the destination, then "Sign and send".\n5. Close the tab when you are done.\n\nSettings\n• Gap limit: how many unused addresses in a row to see before a chain is considered finished (default 25).\n• Account number: normally 0.\n\nSecurity and privacy\n• The seed lives only in this tab\'s memory. It is never saved and never sent anywhere.\n• Only mempool.space is contacted (balances, fees, broadcast). It can see the addresses you check and your IP address; use Tor/VPN if that matters.\n• No code is loaded from the internet: every library is inside this single file.\n• For large amounts use a clean device. This is not a replacement for a hardware wallet.\n\nSource and license\nhttps://github.com/olegsh247-stack/Bitcoin-Seed-Scanner — MIT license, provided "as is" without warranty. Compare this file\'s SHA-256 with the one in the README.',
    passLabel: "Passphrase (if used)",
    passPh: "optional",
    gapLabel: "Gap limit (stop after N unused)",
    gapHint:
      "Scanning of each path stops after this many consecutive unused addresses. Default 25, range 5-100. Higher = slower, but finds coins farther along the chain.",
    accountLabel: "Account number",
    accountHint: "Normally 0. If no coins were found and you are sure they are there, try 1, 2…",
    scanBtn: "Find coins",
    scanNote: "Scanning can take up to several hours.",
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
    helpBtn: "Справка",
    helpTitle: "О программе",
    seedOk: "✓ Фраза верна",
    seedBad: "✗ Контрольная сумма не сходится — неверное слово или порядок слов",
    seedWord: "✗ Такого слова нет в списке BIP39",
    helpBody:
      "Что делает\nПроверяет одну seed-фразу сразу по всем четырём типам биткоин-адресов — BIP44 Legacy (1…), BIP49 Nested SegWit (3…), BIP84 Native SegWit (bc1q…), BIP86 Taproot (bc1p…) — по цепочкам receive и change, и позволяет отправить монеты с найденного адреса. Многие кошельки смотрят только новейший тип, поэтому старые монеты могут «пропадать».\n\nКак пользоваться\n1. Введите 12 или 24 слова по одному в окошко (можно вставить всю фразу целиком в любое окошко). Если фраза верна, все окошки станут зелёными, если нет — красными.\n2. Введите passphrase, если он был.\n3. Нажмите «Найти монеты» и дождитесь результата.\n4. Нажмите «Выбрать» у адреса с балансом, укажите получателя и сумму, нажмите «Подготовить», введите последние 6 символов адреса получателя и «Подписать и отправить».\n5. Закройте вкладку, когда закончите.\n\nНастройки\n• Gap limit: сколько неиспользованных адресов подряд нужно увидеть, чтобы считать цепочку законченной (по умолчанию 25).\n• Номер аккаунта: обычно 0.\n\nБезопасность и приватность\n• Seed живёт только в памяти этой вкладки. Он нигде не сохраняется и никуда не отправляется.\n• В сеть уходят только запросы к mempool.space (балансы, комиссии, отправка). Он видит проверяемые адреса и ваш IP; если это важно — используйте Tor/VPN.\n• Код из интернета не загружается: все библиотеки находятся внутри этого единственного файла.\n• Для крупных сумм используйте чистое устройство. Это не замена hardware-кошельку.\n\nИсточник и лицензия\nhttps://github.com/olegsh247-stack/Bitcoin-Seed-Scanner — лицензия MIT, «как есть», без гарантий. Сверьте SHA-256 этого файла с указанным в README.",
    passLabel: "Passphrase (если использовали)",
    passPh: "необязательно",
    gapLabel: "Gap limit (остановка после N неиспользованных)",
    gapHint:
      "Сканирование каждого пути прекращается после стольких подряд неиспользованных адресов. По умолчанию 25, диапазон 5-100. Больше — дольше, но находит монеты дальше по цепочке.",
    accountLabel: "Номер аккаунта",
    accountHint: "Обычно 0. Если монеты не найдены, а вы уверены что они там есть, попробуйте 1, 2…",
    scanBtn: "Найти монеты",
    scanNote: "Сканирование может занять до нескольких часов.",
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
    helpBtn: "Ayuda",
    helpTitle: "Acerca de esta herramienta",
    seedOk: "✓ Frase seed válida",
    seedBad: "✗ La suma de comprobación no coincide: hay una palabra incorrecta o en otro orden",
    seedWord: "✗ No es una palabra BIP39 válida",
    helpBody:
      "Qué hace\nComprueba una frase seed en los cuatro tipos habituales de dirección Bitcoin — BIP44 Legacy (1…), BIP49 Nested SegWit (3…), BIP84 Native SegWit (bc1q…), BIP86 Taproot (bc1p…) — en las cadenas receive y change, y permite enviar monedas desde una dirección encontrada. Muchos monederos solo miran el tipo más nuevo, así que las monedas antiguas pueden parecer «perdidas».\n\nCómo usarla\n1. Escribe las 12 o 24 palabras, una por casilla (puedes pegar la frase completa en cualquier casilla). Todas las casillas se ponen en verde si la frase es válida y en rojo si no lo es.\n2. Añade la passphrase si la usaste.\n3. Pulsa «Buscar monedas» y espera.\n4. Pulsa «Elegir» junto a una dirección con saldo, indica destino e importe, pulsa «Preparar», escribe los últimos 6 caracteres del destino y «Firmar y enviar».\n5. Cierra la pestaña al terminar.\n\nAjustes\n• Gap limit: cuántas direcciones sin usar seguidas deben aparecer para dar por terminada una cadena (25 por defecto).\n• Número de cuenta: normalmente 0.\n\nSeguridad y privacidad\n• La seed solo existe en la memoria de esta pestaña. Nunca se guarda ni se envía a ningún sitio.\n• Solo se contacta con mempool.space (saldos, comisiones, envío). Puede ver las direcciones que consultas y tu IP; usa Tor/VPN si te importa.\n• No se carga código de internet: todas las bibliotecas están dentro de este único archivo.\n• Con cantidades grandes usa un dispositivo limpio. No sustituye a un monedero hardware.\n\nFuente y licencia\nhttps://github.com/olegsh247-stack/Bitcoin-Seed-Scanner — licencia MIT, «tal cual», sin garantía. Compara el SHA-256 de este archivo con el del README.",
    passLabel: "Passphrase (si la usaste)",
    passPh: "opcional",
    gapLabel: "Gap limit (parar tras N sin usar)",
    gapHint:
      "El escaneo de cada ruta se detiene tras tantas direcciones consecutivas sin usar. Por defecto 25, rango 5-100. Más alto = más lento, pero encuentra monedas más adelante en la cadena.",
    accountLabel: "Número de cuenta",
    accountHint: "Normalmente 0. Si no se encontraron monedas y está seguro de que existen, pruebe 1, 2…",
    scanBtn: "Buscar monedas",
    scanNote: "El escaneo puede tardar hasta varias horas.",
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
    helpBtn: "Aide",
    helpTitle: "À propos de cet outil",
    seedOk: "✓ Phrase seed valide",
    seedBad: "✗ Somme de contrôle invalide — un mot est faux ou dans le mauvais ordre",
    seedWord: "✗ Mot absent de la liste BIP39",
    helpBody:
      "À quoi ça sert\nVérifie une phrase seed sur les quatre types d'adresses Bitcoin courants — BIP44 Legacy (1…), BIP49 Nested SegWit (3…), BIP84 Native SegWit (bc1q…), BIP86 Taproot (bc1p…) — sur les chaînes receive et change, et permet d'envoyer des pièces depuis une adresse trouvée. Beaucoup de portefeuilles ne regardent que le type le plus récent : les anciennes pièces peuvent sembler « disparues ».\n\nMode d'emploi\n1. Saisissez vos 12 ou 24 mots, un par case (vous pouvez coller toute la phrase dans n'importe quelle case). Toutes les cases deviennent vertes si la phrase est valide, rouges sinon.\n2. Ajoutez la passphrase si vous en avez utilisé une.\n3. Cliquez sur « Trouver les pièces » et attendez.\n4. Cliquez sur « Choisir » à côté d'une adresse avec un solde, indiquez destinataire et montant, cliquez sur « Préparer », tapez les 6 derniers caractères de l'adresse de destination, puis « Signer et envoyer ».\n5. Fermez l'onglet quand vous avez terminé.\n\nRéglages\n• Gap limit : combien d'adresses inutilisées consécutives il faut voir pour considérer une chaîne terminée (25 par défaut).\n• Numéro de compte : normalement 0.\n\nSécurité et confidentialité\n• La seed n'existe que dans la mémoire de cet onglet. Elle n'est jamais enregistrée ni envoyée.\n• Seul mempool.space est contacté (soldes, frais, diffusion). Il voit les adresses vérifiées et votre IP ; utilisez Tor/VPN si cela compte pour vous.\n• Aucun code n'est chargé depuis Internet : toutes les bibliothèques sont dans ce fichier unique.\n• Pour de gros montants, utilisez un appareil propre. Ce n'est pas un remplacement d'un portefeuille matériel.\n\nSource et licence\nhttps://github.com/olegsh247-stack/Bitcoin-Seed-Scanner — licence MIT, « en l'état », sans garantie. Comparez le SHA-256 de ce fichier à celui du README.",
    passLabel: "Passphrase (si utilisée)",
    passPh: "facultatif",
    gapLabel: "Gap limit (arrêt après N inutilisées)",
    gapHint:
      "Le scan de chaque chemin s'arrête après autant d'adresses inutilisées consécutives. Par défaut 25, plage 5-100. Plus élevé = plus lent, mais trouve des pièces plus loin dans la chaîne.",
    accountLabel: "Numéro de compte",
    accountHint: "Normalement 0. Si aucune pièce n’est trouvée et que vous êtes sûr qu’elles existent, essayez 1, 2…",
    scanBtn: "Trouver les pièces",
    scanNote: "L'analyse peut prendre jusqu'à plusieurs heures.",
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
    ["accountHint", L.accountHint],
    ["step1Title", L.step1],
    ["seedLabel", L.seedLabel],
    ["helpBtn", L.helpBtn],
    ["helpTitle", L.helpTitle],
    ["helpBody", L.helpBody],
    ["passLabel", L.passLabel],
    ["gapLabel", L.gapLabel],
    ["gapHint", L.gapHint],
    ["scanBtn", L.scanBtn],
    ["scanNote", L.scanNote],
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
    if (id === "noFunds" || id === "footerText" || id === "sourceInfo" || id === "helpBody")
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
      refreshSeedUI();
    }),
);
applyLang();

// ------------------------------------------------------------ DOM refs ----
const $ = (id) => document.getElementById(id);
const passphraseEl = $("passphrase"),
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

// ----------------------------------------------------------- seed boxes ----
const WORDSET = new Set(wordlist);
const seedGrid = $("seedGrid"),
  seedState = $("seedState"),
  helpBtn = $("helpBtn"),
  helpCard = $("helpCard");
let wordCount = 12;

const boxes = () => [...seedGrid.querySelectorAll("input")];
const seedWords = () => boxes().map((b) => b.value.trim().toLowerCase());

// "aban" -> "abandon" when exactly one BIP39 word starts with it.
function completeWord(v) {
  const w = v.trim().toLowerCase();
  if (!w || WORDSET.has(w)) return w;
  const hits = wordlist.filter((x) => x.startsWith(w));
  return hits.length === 1 ? hits[0] : w;
}

function buildBoxes(n) {
  const old = seedWords();
  wordCount = n;
  seedGrid.textContent = "";
  for (let i = 0; i < n; i++) {
    const wrap = document.createElement("div");
    wrap.className = "sw";
    const num = document.createElement("span");
    num.textContent = String(i + 1);
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = old[i] || "";
    inp.setAttribute("autocomplete", "off");
    inp.setAttribute("autocapitalize", "none");
    inp.setAttribute("autocorrect", "off");
    inp.setAttribute("spellcheck", "false");
    inp.setAttribute("aria-label", `Word ${i + 1}`);
    inp.dataset.i = String(i);
    inp.addEventListener("input", () => onWordInput(i));
    inp.addEventListener("blur", () => {
      inp.value = completeWord(inp.value);
      refreshSeedUI();
    });
    inp.addEventListener("keydown", (e) => {
      const list = boxes();
      if (e.key === "Enter") {
        e.preventDefault();
        list[Math.min(i + 1, list.length - 1)].focus();
      } else if (e.key === "Backspace" && inp.value === "" && i > 0) {
        e.preventDefault();
        list[i - 1].focus();
      }
    });
    inp.addEventListener("paste", (e) => {
      const text = (e.clipboardData && e.clipboardData.getData("text")) || "";
      if (!/[\s,]/.test(text.trim())) return; // single word: let the browser paste it
      e.preventDefault();
      placeWords(i, text);
    });
    wrap.append(num, inp);
    seedGrid.append(wrap);
  }
  document
    .querySelectorAll(".wc-btn")
    .forEach((b) => b.classList.toggle("active", Number(b.dataset.count) === n));
  refreshSeedUI();
}

// Put several words into consecutive boxes starting at `start` (paste, or typing a space).
function placeWords(start, text, terminated = true) {
  const tokens = text
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t, k, a) => (k < a.length - 1 || terminated ? completeWord(t) : t));
  if (!tokens.length) return;
  if (start + tokens.length > wordCount && wordCount === 12 && start + tokens.length <= 24)
    buildBoxes(24);
  const list = boxes();
  let last = start;
  tokens.forEach((t, k) => {
    if (start + k < list.length) {
      list[start + k].value = t;
      last = start + k;
    }
  });
  refreshSeedUI();
  boxes()[Math.min(last + (terminated ? 1 : 0), list.length - 1)].focus();
}

function onWordInput(i) {
  const inp = boxes()[i];
  if (/[\s,]/.test(inp.value)) {
    const terminated = /[\s,]$/.test(inp.value);
    placeWords(i, inp.value, terminated);
  } else refreshSeedUI();
}

// Green on every box for a valid phrase, red for an invalid one; a single bad word is red.
function refreshSeedUI() {
  const bs = boxes();
  if (!bs.length) return;
  const ws = bs.map((b) => b.value.trim().toLowerCase());
  const L = LANGS[lang];
  bs.forEach((b) => b.classList.remove("ok", "bad"));
  let cls = "",
    msg = "";
  if (ws.every((w) => WORDSET.has(w))) {
    const valid = bip39.validateMnemonic(ws.join(" "), wordlist);
    cls = valid ? "ok" : "bad";
    bs.forEach((b) => b.classList.add(cls));
    msg = valid ? L.seedOk : L.seedBad;
  } else {
    let badWord = false;
    bs.forEach((b, i) => {
      const w = ws[i];
      if (!w) return;
      const typing = document.activeElement === b;
      const possible = typing ? wordlist.some((x) => x.startsWith(w)) : WORDSET.has(w);
      if (!possible) {
        b.classList.add("bad");
        badWord = true;
      }
    });
    cls = badWord ? "bad" : "";
    msg = badWord ? L.seedWord : `${ws.filter(Boolean).length} / ${wordCount}`;
  }
  seedState.textContent = msg;
  seedState.className = "seed-state" + (cls ? " " + cls : "");
}

function clearSeedBoxes() {
  boxes().forEach((b) => (b.value = ""));
  refreshSeedUI();
}

document.querySelectorAll(".wc-btn").forEach((b) => {
  b.onclick = () => buildBoxes(Number(b.dataset.count));
});
helpBtn.onclick = () => {
  const open = helpCard.style.display === "none";
  helpCard.style.display = open ? "block" : "none";
  helpBtn.setAttribute("aria-expanded", String(open));
};
buildBoxes(12);

function hardClear() {
  clearSeedBoxes();
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
  const mnemonic = seedWords().join(" ").replace(/\s+/g, " ").trim();
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
  if (words.length !== wordCount) return fail(`Enter all ${wordCount} words`);
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
