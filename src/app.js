// Bitcoin Seed Scanner — application logic.
// Built into a single self-contained index.html by `npm run build`.
// All crypto dependencies are bundled; nothing is loaded from a CDN at runtime.
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import { initAddressCheck } from "./addrcheck.js";
import { initAddrList } from "./addrlist.js";
import { createNet, reasonText } from "./net.js";
import {
  PATHS,
  CHAINS,
  DUST,
  MAX_FEE_RATE,
  selectUtxos,
  calcFeeAndChange,
  inputVSize,
  outputVSizeFor,
  changeVSize,
  feeFor,
  parseFeeRate,
  validateUtxos,
  verifyPrevOutput,
  auditTransaction,
  checkFinalFeeRate,
  baseVSize,
  satsToBtc,
  btcToSats,
  isValidMainnetAddress,
  feeWarning,
} from "./lib.js";


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
      'What it does\nChecks one seed phrase against all four common Bitcoin address types — BIP44 Legacy (1…), BIP49 Nested SegWit (3…), BIP84 Native SegWit (bc1q…), BIP86 Taproot (bc1p…) — on both the receive and change chains, and lets you send coins from a found address. Many wallets only look at the newest type, so older coins can look "missing".\n\nHow to use\n1. Enter your 12 or 24 words, one per box (you can paste the whole phrase into any box). All boxes turn green when the phrase is valid and red when it is not.\n2. Add the passphrase if you used one.\n3. Press "Find coins" and wait.\n4. Press "Select" next to an address with a balance, enter the destination and amount, press "Prepare", type the last 6 characters of the destination, then "Sign and send".\n5. Close the tab when you are done.\n\nSettings\n• Gap limit: how many unused addresses in a row to see before a chain is considered finished (default 25).\n• Account number: normally 0.\n• Address type: if you know which types you need, switch off the others — scanning will be faster.\n\nSecurity and privacy\n• The seed lives only in this tab\'s memory. It is never saved and never sent anywhere.\n• Only three public servers are contacted, one at a time: mempool.space, then blockstream.info, then btcscan.org if the first does not answer (balances, fees, broadcast). The server in use is shown under \"Data source\" and can be chosen by hand. Whichever one is used can see the addresses you check and your IP address; use Tor/VPN if that matters.\n• No code is loaded from the internet: every library is inside this single file.\n• For large amounts use a clean device. This is not a replacement for a hardware wallet.\n\nSource and license\nhttps://github.com/olegsh247-stack/Bitcoin-Seed-Scanner — MIT license, provided "as is" without warranty. Compare this file\'s SHA-256 with the one in the README.',
    passLabel: "Passphrase (if used)",
    passPh: "optional",
    gapLabel: "Gap limit",
    gapHint:
      "Default 25, range 5-100. Higher = slower, but finds coins farther along the chain.",
    accountLabel: "Account number",
    passHint: "Leave empty if you did not set this phrase when creating the wallet.",
    accountHint: "Default 0. If no coins were found, try 1, 2…",
    scanBtn: "Find coins",
    addrTitle: "Check an address (if known)",
    alTitle: "Addresses of this seed phrase",
    alHint: "Public addresses only (no keys). Compare them with your wallet. Nothing is saved.",
    alThStatus: "Status",
    alStFunded: "Balance {b} BTC",
    alStUsed: "Had transactions, balance 0",
    alStUnused: "No transactions",
    alStUnknown: "Could not be checked",
    alCopy: "Copy",
    alCopied: "Copied",
    alCopyFail: "Could not copy — select the text and copy it manually",
    srcLabel: "Data source",
    srcAuto: "Auto",
    srcNow: "Using",
    srcHint: "Auto picks the first server that answers and switches by itself if it stops. Each server sees the addresses you check and your IP.",
    altSend: "Send via another server",
    dustNote: "Leftover of {n} sats (below the network minimum) was added to the fee.",
    addrPh: "Paste a Bitcoin address",
    addrBtn: "Check",
    addrRowAddr: "Address",
    addrRowType: "Type",
    addrRowBal: "Balance",
    addrInvalid: "Invalid address (check for typos; mainnet only)",
    addrBalFail: "Could not get the balance, try again",
    addrChecking: "Checking…",
    addrCaption: "Check the address type and balance",
    typeLabel: "Address type",
    noType: "Select at least one address type",
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
      "Что делает\nПроверяет одну seed-фразу сразу по всем четырём типам биткоин-адресов — BIP44 Legacy (1…), BIP49 Nested SegWit (3…), BIP84 Native SegWit (bc1q…), BIP86 Taproot (bc1p…) — по цепочкам receive и change, и позволяет отправить монеты с найденного адреса. Многие кошельки смотрят только новейший тип, поэтому старые монеты могут «пропадать».\n\nКак пользоваться\n1. Введите 12 или 24 слова по одному в окошко (можно вставить всю фразу целиком в любое окошко). Если фраза верна, все окошки станут зелёными, если нет — красными.\n2. Введите passphrase, если он был.\n3. Нажмите «Найти монеты» и дождитесь результата.\n4. Нажмите «Выбрать» у адреса с балансом, укажите получателя и сумму, нажмите «Подготовить», введите последние 6 символов адреса получателя и «Подписать и отправить».\n5. Закройте вкладку, когда закончите.\n\nНастройки\n• Gap limit: сколько неиспользованных адресов подряд нужно увидеть, чтобы считать цепочку законченной (по умолчанию 25).\n• Номер аккаунта: обычно 0.\n• Тип адреса: если знаете, какие типы вам нужны, отключите остальные — сканирование пойдёт быстрее.\n\nБезопасность и приватность\n• Seed живёт только в памяти этой вкладки. Он нигде не сохраняется и никуда не отправляется.\n• В сеть уходят запросы только к трём публичным серверам, по одному за раз: mempool.space, затем blockstream.info, затем btcscan.org, если предыдущий не отвечает (балансы, комиссии, отправка). Используемый сервер показан в «Источнике данных», его можно выбрать вручную. Любой из них видит проверяемые адреса и ваш IP; если это важно — используйте Tor/VPN.\n• Код из интернета не загружается: все библиотеки находятся внутри этого единственного файла.\n• Для крупных сумм используйте чистое устройство. Это не замена hardware-кошельку.\n\nИсточник и лицензия\nhttps://github.com/olegsh247-stack/Bitcoin-Seed-Scanner — лицензия MIT, «как есть», без гарантий. Сверьте SHA-256 этого файла с указанным в README.",
    passLabel: "Passphrase (если использовали)",
    passPh: "необязательно",
    gapLabel: "Gap limit",
    gapHint:
      "По умолчанию 25, диапазон 5-100. Больше — дольше, но находит монеты дальше по цепочке.",
    accountLabel: "Номер аккаунта",
    passHint: "Оставьте пустым, если не задавали эту фразу при создании кошелька.",
    accountHint: "По умолчанию 0. Если монеты не найдены, попробуйте 1, 2…",
    scanBtn: "Найти монеты",
    addrTitle: "Проверка адреса (если известен)",
    alTitle: "Адреса этой seed-фразы",
    alHint: "Только публичные адреса (без ключей). Сверьте их с вашим кошельком. Ничего не сохраняется.",
    alThStatus: "Статус",
    alStFunded: "Баланс {b} BTC",
    alStUsed: "Были операции, баланс 0",
    alStUnused: "Операций не было",
    alStUnknown: "Не удалось проверить",
    alCopy: "Копировать",
    alCopied: "Скопировано",
    alCopyFail: "Не удалось скопировать — выделите текст и скопируйте вручную",
    srcLabel: "Источник данных",
    srcAuto: "Авто",
    srcNow: "Используется",
    srcHint: "«Авто» берёт первый отвечающий сервер и сам переключается, если он перестал отвечать. Каждый сервер видит проверяемые адреса и ваш IP.",
    altSend: "Отправить через другой сервер",
    dustNote: "Остаток {n} сатоши (меньше минимума сети) добавлен к комиссии.",
    addrPh: "Вставьте адрес Bitcoin",
    addrBtn: "Проверить",
    addrRowAddr: "Адрес",
    addrRowType: "Тип",
    addrRowBal: "Баланс",
    addrInvalid: "Неверный адрес (проверьте опечатки; только основная сеть)",
    addrBalFail: "Баланс не удалось получить, повторите",
    addrChecking: "Проверяю…",
    addrCaption: "Проверьте тип адреса и баланс",
    typeLabel: "Тип адреса",
    noType: "Выберите хотя бы один тип адреса",
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
      "Qué hace\nComprueba una frase seed en los cuatro tipos habituales de dirección Bitcoin — BIP44 Legacy (1…), BIP49 Nested SegWit (3…), BIP84 Native SegWit (bc1q…), BIP86 Taproot (bc1p…) — en las cadenas receive y change, y permite enviar monedas desde una dirección encontrada. Muchos monederos solo miran el tipo más nuevo, así que las monedas antiguas pueden parecer «perdidas».\n\nCómo usarla\n1. Escribe las 12 o 24 palabras, una por casilla (puedes pegar la frase completa en cualquier casilla). Todas las casillas se ponen en verde si la frase es válida y en rojo si no lo es.\n2. Añade la passphrase si la usaste.\n3. Pulsa «Buscar monedas» y espera.\n4. Pulsa «Elegir» junto a una dirección con saldo, indica destino e importe, pulsa «Preparar», escribe los últimos 6 caracteres del destino y «Firmar y enviar».\n5. Cierra la pestaña al terminar.\n\nAjustes\n• Gap limit: cuántas direcciones sin usar seguidas deben aparecer para dar por terminada una cadena (25 por defecto).\n• Número de cuenta: normalmente 0.\n• Tipo de dirección: si sabe qué tipos necesita, desactive los demás: el escaneo será más rápido.\n\nSeguridad y privacidad\n• La seed solo existe en la memoria de esta pestaña. Nunca se guarda ni se envía a ningún sitio.\n• Solo se contacta con tres servidores públicos, uno cada vez: mempool.space, luego blockstream.info y luego btcscan.org si el anterior no responde (saldos, comisiones, envío). El servidor en uso se muestra en «Fuente de datos» y puede elegirse a mano. Cualquiera de ellos puede ver las direcciones que consultas y tu IP; usa Tor/VPN si te importa.\n• No se carga código de internet: todas las bibliotecas están dentro de este único archivo.\n• Con cantidades grandes usa un dispositivo limpio. No sustituye a un monedero hardware.\n\nFuente y licencia\nhttps://github.com/olegsh247-stack/Bitcoin-Seed-Scanner — licencia MIT, «tal cual», sin garantía. Compara el SHA-256 de este archivo con el del README.",
    passLabel: "Passphrase (si la usaste)",
    passPh: "opcional",
    gapLabel: "Gap limit",
    gapHint:
      "Por defecto 25, rango 5-100. Más alto = más lento, pero encuentra monedas más adelante en la cadena.",
    accountLabel: "Número de cuenta",
    passHint: "Déjelo vacío si no estableció esta frase al crear la billetera.",
    accountHint: "Por defecto 0. Si no se encontraron monedas, pruebe 1, 2…",
    scanBtn: "Buscar monedas",
    addrTitle: "Comprobar una dirección (si la conoce)",
    alTitle: "Direcciones de esta frase seed",
    alHint: "Solo direcciones públicas (sin claves). Compárelas con su monedero. No se guarda nada.",
    alThStatus: "Estado",
    alStFunded: "Saldo {b} BTC",
    alStUsed: "Hubo operaciones, saldo 0",
    alStUnused: "Sin operaciones",
    alStUnknown: "No se pudo comprobar",
    alCopy: "Copiar",
    alCopied: "Copiado",
    alCopyFail: "No se pudo copiar: seleccione el texto y cópielo a mano",
    srcLabel: "Fuente de datos",
    srcAuto: "Auto",
    srcNow: "En uso",
    srcHint: "«Auto» elige el primer servidor que responde y cambia solo si deja de responder. Cada servidor ve las direcciones consultadas y tu IP.",
    altSend: "Enviar por otro servidor",
    dustNote: "Un resto de {n} sats (por debajo del mínimo de la red) se añadió a la comisión.",
    addrPh: "Pegue una dirección Bitcoin",
    addrBtn: "Comprobar",
    addrRowAddr: "Dirección",
    addrRowType: "Tipo",
    addrRowBal: "Saldo",
    addrInvalid: "Dirección no válida (compruebe errores; solo mainnet)",
    addrBalFail: "No se pudo obtener el saldo, inténtelo de nuevo",
    addrChecking: "Comprobando…",
    addrCaption: "Compruebe el tipo de dirección y el saldo",
    typeLabel: "Tipo de dirección",
    noType: "Seleccione al menos un tipo de dirección",
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
      "À quoi ça sert\nVérifie une phrase seed sur les quatre types d'adresses Bitcoin courants — BIP44 Legacy (1…), BIP49 Nested SegWit (3…), BIP84 Native SegWit (bc1q…), BIP86 Taproot (bc1p…) — sur les chaînes receive et change, et permet d'envoyer des pièces depuis une adresse trouvée. Beaucoup de portefeuilles ne regardent que le type le plus récent : les anciennes pièces peuvent sembler « disparues ».\n\nMode d'emploi\n1. Saisissez vos 12 ou 24 mots, un par case (vous pouvez coller toute la phrase dans n'importe quelle case). Toutes les cases deviennent vertes si la phrase est valide, rouges sinon.\n2. Ajoutez la passphrase si vous en avez utilisé une.\n3. Cliquez sur « Trouver les pièces » et attendez.\n4. Cliquez sur « Choisir » à côté d'une adresse avec un solde, indiquez destinataire et montant, cliquez sur « Préparer », tapez les 6 derniers caractères de l'adresse de destination, puis « Signer et envoyer ».\n5. Fermez l'onglet quand vous avez terminé.\n\nRéglages\n• Gap limit : combien d'adresses inutilisées consécutives il faut voir pour considérer une chaîne terminée (25 par défaut).\n• Numéro de compte : normalement 0.\n• Type d’adresse : si vous savez quels types vous utilisez, désactivez les autres — le scan sera plus rapide.\n\nSécurité et confidentialité\n• La seed n'existe que dans la mémoire de cet onglet. Elle n'est jamais enregistrée ni envoyée.\n• Seuls trois serveurs publics sont contactés, un à la fois : mempool.space, puis blockstream.info, puis btcscan.org si le précédent ne répond pas (soldes, frais, diffusion). Le serveur utilisé est indiqué sous « Source des données » et peut être choisi à la main. Chacun voit les adresses vérifiées et votre IP ; utilisez Tor/VPN si cela compte pour vous.\n• Aucun code n'est chargé depuis Internet : toutes les bibliothèques sont dans ce fichier unique.\n• Pour de gros montants, utilisez un appareil propre. Ce n'est pas un remplacement d'un portefeuille matériel.\n\nSource et licence\nhttps://github.com/olegsh247-stack/Bitcoin-Seed-Scanner — licence MIT, « en l'état », sans garantie. Comparez le SHA-256 de ce fichier à celui du README.",
    passLabel: "Passphrase (si utilisée)",
    passPh: "facultatif",
    gapLabel: "Gap limit",
    gapHint:
      "Par défaut 25, plage 5-100. Plus élevé = plus lent, mais trouve des pièces plus loin dans la chaîne.",
    accountLabel: "Numéro de compte",
    passHint: "Laissez vide si vous n’avez pas défini cette phrase lors de la création du portefeuille.",
    accountHint: "Par défaut 0. Si aucune pièce n’est trouvée, essayez 1, 2…",
    scanBtn: "Trouver les pièces",
    addrTitle: "Vérifier une adresse (si vous la connaissez)",
    alTitle: "Adresses de cette phrase seed",
    alHint: "Adresses publiques uniquement (sans clés). Comparez-les avec votre portefeuille. Rien n’est enregistré.",
    alThStatus: "État",
    alStFunded: "Solde {b} BTC",
    alStUsed: "Des opérations ont eu lieu, solde 0",
    alStUnused: "Aucune opération",
    alStUnknown: "Vérification impossible",
    alCopy: "Copier",
    alCopied: "Copié",
    alCopyFail: "Copie impossible : sélectionnez le texte et copiez-le à la main",
    srcLabel: "Source des données",
    srcAuto: "Auto",
    srcNow: "Utilisé",
    srcHint: "« Auto » choisit le premier serveur qui répond et change seul s’il s’arrête. Chaque serveur voit les adresses vérifiées et votre IP.",
    altSend: "Envoyer via un autre serveur",
    dustNote: "Un reste de {n} sats (sous le minimum du réseau) a été ajouté aux frais.",
    addrPh: "Collez une adresse Bitcoin",
    addrBtn: "Vérifier",
    addrRowAddr: "Adresse",
    addrRowType: "Type",
    addrRowBal: "Solde",
    addrInvalid: "Adresse invalide (vérifiez les fautes de frappe ; mainnet uniquement)",
    addrBalFail: "Impossible d’obtenir le solde, réessayez",
    addrChecking: "Vérification…",
    addrCaption: "Vérifiez le type d’adresse et le solde",
    typeLabel: "Type d’adresse",
    noType: "Sélectionnez au moins un type d’adresse",
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

let addressCheck = null; // set up below, once the network helpers exist
let addrList = null;
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
    ["passHint", L.passHint],
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
    ["addrTitle", L.addrTitle],
    ["addrCaption", L.addrCaption],
    ["typeLabel", L.typeLabel],
    ["addrCheckBtn", L.addrBtn],
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
    ["srcLabel", L.srcLabel],
    ["srcAutoOpt", L.srcAuto],
    ["srcHint", L.srcHint],
    ["altSendBtn", L.altSend],
  ];
  for (const [id, text] of map) {
    const el = document.getElementById(id);
    if (!el || text == null) continue;
    if (id === "noFunds" || id === "footerText" || id === "sourceInfo" || id === "helpBody")
      el.innerHTML = text.replace(/\n/g, "<br>");
    else el.textContent = text;
  }
  const addrIn = document.getElementById("addrInput");
  if (addrIn) addrIn.placeholder = L.addrPh;
  if (addressCheck) addressCheck.refresh();
  if (addrList) addrList.refresh();
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
      showSource();
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
  confirmDust = $("confirmDust"),
  confirmText = $("confirmText"),
  broadcastBtn = $("broadcastBtn"),
  cancelSendBtn = $("cancelSendBtn"),
  sendStatus = $("sendStatus"),
  sourceInfo = $("sourceInfo"),
  feeHints = $("feeHints"),
  altSendBtn = $("altSendBtn"),
  sourceSel = $("sourceSel"),
  sourceNow = $("sourceNow");

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

// Address types to scan (not remembered: every page load starts with all four on).
const typeOn = (name) =>
  document.querySelector(`.bip-btn[data-bip="${name}"]`)?.classList.contains("active") ?? true;
const setTypeBtn = (b, on) => {
  b.classList.toggle("active", on);
  b.setAttribute("aria-pressed", String(on));
};
document.querySelectorAll(".bip-btn").forEach((b) => {
  b.onclick = () => setTypeBtn(b, !b.classList.contains("active"));
});

document.querySelectorAll(".wc-btn").forEach((b) => {
  b.onclick = () => buildBoxes(Number(b.dataset.count));
});
helpBtn.onclick = () => {
  const open = helpCard.style.display === "none";
  helpCard.style.display = open ? "block" : "none";
  helpBtn.setAttribute("aria-expanded", String(open));
  helpBtn.classList.toggle("active", open);
};
buildBoxes(12);

// Forget everything tied to the previous scan: key material, the chosen source and any
// prepared (not yet sent) transaction. Used by "Clear all" and before every new scan.
function resetSendState() {
  if (addrList) addrList.clear();
  // Overwrite key material in place before dropping references.
  for (const f of foundFunds) {
    try {
      f.privateKey?.fill(0);
    } catch (_) {}
  }
  foundFunds = [];
  selectedSource = null;
  preparedTx = null;
  confirmArea.style.display = "none";
  confirmText.value = "";
  broadcastBtn.disabled = true;
  if (rootKey) {
    try {
      rootKey.wipePrivateData?.();
    } catch (_) {}
    rootKey = null;
  }
}

// The confirmation belongs to one exact prepared transaction. Any change to the form
// (recipient, amount, fee) or to the source cancels it: the user must prepare again.
function invalidatePrepared() {
  if (!preparedTx && confirmArea.style.display === "none") return;
  const was = !!preparedTx;
  preparedTx = null;
  confirmArea.style.display = "none";
  confirmText.value = "";
  broadcastBtn.disabled = true;
  if (was) {
    sendStatus.textContent = "Details changed — press Prepare again before sending.";
    sendStatus.className = "status";
  }
}

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
  resetSendState();
}
clearBtn.onclick = () => {
  if (confirm("Clear all data (seed, results, send form)?")) {
    hardClear();
    document.querySelectorAll(".bip-btn").forEach((b) => setTypeBtn(b, true));
  }
};

// ------------------------------------------------------------- network ----
// Three Esplora servers in trust order (see net.js). One is used at a time; the app moves to
// the next when it stops answering, is rate-limited or blocked, or is behind the chain.
const net = createNet({
  sleep: (ms) => sleep(ms),
  onChange: () => showSource(),
});

// Balance plus "has this address ever been used" (needed for the gap limit).
async function fetchAddressInfo(addr) {
  return net.request(`/address/${addr}`, {
    parse: (text) => {
      const data = JSON.parse(text);
      // Fail closed: an answer without real address data must never be read as "empty".
      const chain = data && data.chain_stats;
      if (
        !chain ||
        typeof chain !== "object" ||
        !Number.isFinite(chain.funded_txo_sum) ||
        !Number.isFinite(chain.spent_txo_sum) ||
        !Number.isFinite(chain.tx_count)
      )
        throw new Error("Unexpected address response");
      const mem = data.mempool_stats || {};
      const balance =
        (chain.funded_txo_sum || 0) +
        (mem.funded_txo_sum || 0) -
        ((chain.spent_txo_sum || 0) + (mem.spent_txo_sum || 0));
      const used = (chain.tx_count || 0) + (mem.tx_count || 0) > 0;
      return { balance, used };
    },
  });
}

addressCheck = initAddressCheck({ fetchAddressInfo, getText: () => LANGS[lang] });
addrList = initAddrList({ getText: () => LANGS[lang] });

async function fetchUtxos(addr) {
  // strict: any malformed entry stops the preparation
  return net.request(`/address/${addr}/utxo`, { parse: (t) => validateUtxos(JSON.parse(t)) });
}

// Legacy (P2PKH) inputs must be signed against the full previous transaction.
async function fetchRawTx(txid) {
  return net.request(`/tx/${txid}/hex`, {
    parse: (t) => {
      const h = t.trim();
      if (!/^[0-9a-f]+$/i.test(h)) throw new Error("Unexpected raw transaction response");
      return hex.decode(h);
    },
  });
}

async function fetchFeeHints() {
  const f = await net.fees();
  if (!f) return;
  feeHints.textContent = `Hints: fast ${f.fast} · halfHour ${f.halfHour} · hour ${f.hour} sat/vB`;
  if (!feeRateEl.value || feeRateEl.value === "5") feeRateEl.value = f.halfHour;
}

// Shows which server is in use and lets the user pin one.
function showSource() {
  const a = net.getActive();
  if (sourceNow)
    sourceNow.textContent = a ? `${LANGS[lang].srcNow}: ${a.host}` : "";
}
sourceSel.onchange = () => {
  net.setMode(sourceSel.value);
  showSource();
  feeHints.textContent = "";
  fetchFeeHints();
};

// ---------------------------------------------------------------- scan ----
scanBtn.onclick = async () => {
  const mnemonic = seedWords().join(" ").replace(/\s+/g, " ").trim();
  const passphrase = passphraseEl.value || "";
  // Gap limit: stop a chain after this many CONSECUTIVE unused addresses.
  const gap = Math.min(100, Math.max(5, parseInt(gapEl.value) || 25));
  const activePaths = PATHS.filter((p) => typeOn(p.name));
  const account = Math.min(99, Math.max(0, parseInt(accountEl.value) || 0));
  const MAX_PER_CHAIN = 500; // hard safety cap per path/chain
  const MAX_CONSECUTIVE_FAILURES = 5; // this many failures in a row (all servers tried) -> pause and wait
  const MAX_COOLDOWNS = 5; // give up only after this many waits in a row without any success

  const stopMessage = (e) =>
    `${reasonText(e)}. None of the servers (${net.providers.map((x) => x.host).join(", ")}) answered properly. Try again later or use a VPN.`;
  const fail = (msg) => {
    statusEl.textContent = msg;
    statusEl.className = "status err";
  };
  if (!mnemonic) return fail("Enter a seed phrase");
  const words = mnemonic.split(" ");
  if (words.length !== wordCount) return fail(`Enter all ${wordCount} words`);
  if (!bip39.validateMnemonic(mnemonic, wordlist)) return fail("Invalid seed phrase (checksum)");
  if (activePaths.length === 0) return fail(LANGS[lang].noType);

  statusEl.textContent = "Generating seed...";
  statusEl.className = "status";
  progress.classList.add("active");
  progressBar.style.width = "5%";
  scanBtn.disabled = true;
  sourceSel.disabled = true;
  resetSendState();
  sendStatus.textContent = "";
  tbody.innerHTML = "";
  noFunds.style.display = "none";
  resultsCard.style.display = "none";
  sendCard.classList.remove("active");

  let known = new Map(), // every address looked at, for the "Addresses of this seed phrase" block
    where = ""; // where the scan is now, to tell the user where it stopped
  // Shows what has been found so far (also used when a scan stops early).
  const renderResults = () => {
    resultsCard.style.display = "block";
    sendCard.classList.add("active");
    // First receive address of each scanned type + every address with history.
    addrList.show(
      [...known.values()].filter(
        (e) => e.first || e.status === "funded" || e.status === "used",
      ),
    );

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
          invalidatePrepared();
          sendStatus.textContent = "";
          confirmArea.style.display = "none";
        };
      });
    }
  };

  try {
    const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
    rootKey = HDKey.fromMasterSeed(seed);
    const combos = activePaths.length * CHAINS.length;
    let comboIdx = 0,
      lookups = 0,
      failed = [], // addresses whose lookup failed; re-checked after the main scan
      cooldowns = 0; // consecutive waits because the service stopped answering
    net.revive(); // measure the servers afresh for every scan
    showSource();
    const recordFound = (f, info) => {
      const k = known.get(f.address);
      if (k) {
        k.status = info.balance > 0 ? "funded" : info.used ? "used" : "unused";
        k.balanceSats = info.balance;
      }
      if (info.balance > 0) foundFunds.push({ ...f, balanceSats: info.balance });
    };

    for (const p of activePaths) {
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
          where = `${p.name}, ${chainLabel} #${i}`;
          known.set(address, {
            name: p.name,
            type: p.type,
            path,
            address,
            first: change === 0 && i === 0,
            status: "unknown", // until the lookup succeeds
            balanceSats: 0,
          });
          let info = null;
          try {
            info = await fetchAddressInfo(address);
            consecutiveFailures = 0;
            cooldowns = 0;
          } catch (err) {
            // Never read a failed lookup as "empty": count it and keep scanning.
            failed.push({ p, path, address, child, payment });
            consecutiveFailures++;
            streak = 0;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              // No server answers (rate limit, block or outage): wait and carry on
              // instead of giving up. Failed addresses are re-checked at the end.
              if (++cooldowns > MAX_COOLDOWNS) throw new Error(stopMessage(err));
              const waitSec = Math.min(60, 20 + 10 * cooldowns);
              for (let s = waitSec; s > 0; s--) {
                statusEl.textContent = `Servers are busy or not responding (${reasonText(err)}). Waiting ${s}s, then continuing (pause ${cooldowns} of ${MAX_COOLDOWNS})...`;
                await sleep(1000);
              }
              net.revive(); // forget "down" marks and measure again
              consecutiveFailures = MAX_CONSECUTIVE_FAILURES - 1; // next failure pauses again
            }
          }
          if (info) {
            streak = info.used ? 0 : streak + 1;
            recordFound(
              {
                path,
                type: p.type,
                name: p.name,
                address,
                privateKey: child.privateKey,
                payment,
                pub: child.publicKey,
              },
              info,
            );
          }
          await sleep(80 + net.getPenalty());
        }
        comboIdx++;
      }
    }
    // Second chance for failed lookups: wait, then ask again (only those addresses).
    for (let round = 1; round <= 3 && failed.length > 0; round++) {
      const waitSec = 5 * round;
      for (let s = waitSec; s > 0; s--) {
        statusEl.textContent = `Re-checking ${failed.length} address(es) that failed — retry ${round} of 3 in ${s}s...`;
        await sleep(1000);
      }
      net.revive(); // servers marked "down" may have recovered: measure again
      const still = [];
      for (const f of failed) {
        statusEl.textContent = `Re-checking ${failed.length} address(es) that failed — retry ${round} of 3...`;
        try {
          const info = await fetchAddressInfo(f.address);
          recordFound(
            {
              path: f.path,
              type: f.p.type,
              name: f.p.name,
              address: f.address,
              privateKey: f.child.privateKey,
              payment: f.payment,
              pub: f.child.publicKey,
            },
            info,
          );
        } catch (_) {
          still.push(f);
        }
        await sleep(80 + net.getPenalty());
      }
      failed = still;
    }
    const failedLookups = failed.length;
    progressBar.style.width = "100%";

    renderResults();

    if (failedLookups > 0) {
      statusEl.textContent = `Warning: ${failedLookups} of ${lookups} address lookups could not be checked even after retrying (network or rate limit). The result may be incomplete — wait a minute and run the scan again.`;
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
    if (rootKey && known.size > 0) {
      // Keep what was found so far, and say where the scan stopped.
      renderResults();
      noFunds.style.display = "none"; // "no funds" would be misleading for an unfinished scan
      statusEl.textContent += ` Scan stopped at ${where || "the start"}. The result is incomplete.`;
    }
    statusEl.className = "status err";
  } finally {
    scanBtn.disabled = false;
    sourceSel.disabled = false;
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
  const fr = parseFeeRate(feeRateEl.value);
  if (!fr.ok) return fail(fr.error);
  const feeRate = fr.rate;
  if (!to || !amountStr) return fail("Enter address and amount");
  if (!isValidMainnetAddress(to))
    return fail("Not a valid Bitcoin mainnet address (checksum or format error)");
  const amountSats = btcToSats(amountStr);
  if (amountSats === null) return fail("Amount must be a number with up to 8 decimals");
  if (amountSats <= 0n) return fail("Amount must be greater than zero");
  if (amountSats <= DUST) return fail("Amount is below the dust limit (546 sats)");

  sendStatus.textContent = "Fetching UTXOs...";
  sendStatus.className = "status";
  prepareBtn.disabled = true;
  invalidatePrepared();
  sendStatus.textContent = "Fetching UTXOs...";
  sendStatus.className = "status";
  const source = selectedSource; // the transaction is prepared for exactly this source
  const snapshot = [toAddressEl.value.trim(), amountEl.value.trim(), feeRateEl.value.trim()];
  try {
    const utxos = await fetchUtxos(source.address);
    if (!utxos.length) throw new Error("No UTXOs on this address");
    const toVs = outputVSizeFor(to);
    const changeVs = changeVSize(source.name);
    const { selected, sum: inputSum } = selectUtxos(
      utxos,
      amountSats,
      feeRate,
      source.name,
      toVs,
      changeVs,
    );
    const {
      fee: feeSats,
      change: changeSats,
      ok,
      vsize,
      minFee,
    } = calcFeeAndChange(inputSum, amountSats, selected.length, feeRate, source.name, toVs, changeVs);
    if (!ok || changeSats < 0n)
      throw new Error(
        `Not enough funds. Need ~${satsToBtc(amountSats + feeSats)} BTC (amount + fee). On address: ${satsToBtc(inputSum)} BTC`,
      );

    const isLegacy = source.name === "BIP44";
    if (isLegacy) sendStatus.textContent = "Fetching previous transactions...";
    const inputs = [];
    for (const u of selected) {
      const input = { ...source.payment, txid: u.txid, index: u.vout };
      if (isLegacy) {
        // P2PKH has no witness data: signing requires the whole previous tx. It must be
        // the one the input names, and its output must match the amount and address.
        const raw = await fetchRawTx(u.txid);
        verifyPrevOutput(raw, u.txid, u.vout, u.value, source.payment.script);
        input.nonWitnessUtxo = raw;
      } else {
        input.witnessUtxo = {
          script: source.payment.script,
          amount: BigInt(u.value),
        };
      }
      inputs.push(input);
    }

    const tx = new btc.Transaction();
    for (const inp of inputs) tx.addInput(inp);
    tx.addOutputAddress(to, amountSats);
    if (changeSats > DUST) tx.addOutputAddress(source.address, changeSats);
    const audit = {
      to,
      amountSats,
      changeSats: changeSats > DUST ? changeSats : 0n,
      sourceScript: source.payment.script,
      feeSats,
      minFee,
      inputs: selected.map((u) => ({ txid: u.txid, vout: u.vout, value: u.value })),
    };
    auditTransaction(tx, audit); // independent check before the user is asked to confirm
    if (
      selectedSource !== source ||
      toAddressEl.value.trim() !== snapshot[0] ||
      amountEl.value.trim() !== snapshot[1] ||
      feeRateEl.value.trim() !== snapshot[2]
    )
      throw new Error("Details changed while preparing — press Prepare again");
    preparedTx = {
      tx,
      to,
      source,
      audit,
      feeRate,
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
    const leftover = changeSats === 0n ? feeSats - minFee : 0n; // dust that went into the fee
    confirmDust.textContent = leftover > 0n ? LANGS[lang].dustNote.replace("{n}", String(leftover)) : "";
    confirmDust.style.display = leftover > 0n ? "block" : "none";
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
  const fr = parseFeeRate(feeRateEl.value);
  if (!fr.ok) return fail(fr.error);
  try {
    const utxos = await fetchUtxos(selectedSource.address);
    if (!utxos.length) return fail("No UTXOs on this address");
    const inputSum = utxos.reduce((s, u) => s + BigInt(u.value), 0n);
    // Size by the real recipient type when it is entered; otherwise the largest type.
    const toVs = isValidMainnetAddress(toAddressEl.value.trim())
      ? outputVSizeFor(toAddressEl.value)
      : 43;
    const vs = baseVSize() + utxos.length * inputVSize(selectedSource.name) + toVs;
    const fee = feeFor(vs, fr.rate);
    const maxSats = inputSum > fee ? inputSum - fee : 0n;
    invalidatePrepared();
    amountEl.value = satsToBtc(maxSats);
    sendStatus.textContent = "";
    sendStatus.className = "status";
  } catch (e) {
    fail("Could not compute maximum: " + e.message);
  }
};

// The confirmation is checked against the prepared transaction, never the live form.
confirmText.oninput = () => {
  if (!preparedTx) {
    broadcastBtn.disabled = true;
    return;
  }
  const needed = preparedTx.to.slice(-6).toLowerCase();
  broadcastBtn.disabled = confirmText.value.trim().toLowerCase() !== needed;
};
// Any edit of the form cancels the prepared transaction.
for (const el of [toAddressEl, amountEl, feeRateEl]) el.addEventListener("input", invalidatePrepared);

cancelSendBtn.onclick = () => {
  confirmArea.style.display = "none";
  confirmText.value = "";
  broadcastBtn.disabled = true;
  preparedTx = null;
  sendStatus.textContent = "";
};

// Sends the signed transaction. Never retried blindly: with no answer we cannot know whether
// it went through. Another server is used automatically only after an explicit refusal; with no
// answer the user decides (button "send via another server"). Re-sending the same signed
// transaction is harmless: it has the same id and the network accepts it only once.
async function sendVia(ctx, manual) {
  altSendBtn.style.display = "none";
  let r;
  try {
    r = await net.broadcast(ctx.txHex, { exclude: ctx.tried, manual });
  } catch (e) {
    if (e.kind === "noanswer") {
      ctx.tried.push(e.provider.id);
      sendStatus.textContent = `No response from ${e.provider.host}. The transaction may already have been sent — check your address on ${e.provider.host} before trying again.`;
      sendStatus.className = "status err";
      if (ctx.tried.length < net.providers.length) {
        altCtx = ctx;
        altSendBtn.style.display = "";
      }
      return;
    }
    if (e.kind === "rejected")
      throw new Error(
        `${e.provider.host} refused the transaction: ${e.message}. Nothing was sent; press Prepare again.`,
      );
    throw new Error(`${reasonText(e)}. Nothing was sent; press Prepare again.`);
  }
  const txid = r.txid;
  if (!/^[0-9a-f]{64}$/i.test(txid)) {
    // The node accepted the request but did not return a txid. Do not offer a
    // retry (it could double-send); show the response as plain text only.
    sendStatus.textContent = `Broadcast returned an unexpected response — check ${r.provider.host} before retrying: ${txid.slice(0, 200)}`;
    sendStatus.className = "status err";
    return;
  }
  // Built with DOM APIs (not innerHTML) so network data can never inject markup.
  sendStatus.textContent = `Sent successfully via ${r.provider.host}!`;
  sendStatus.append(document.createElement("br"), "TXID: ");
  const link = document.createElement("a");
  link.href = net.txLink(txid, r.provider);
  link.target = "_blank";
  link.rel = "noopener";
  link.style.color = "var(--accent)";
  link.textContent = txid;
  sendStatus.append(link);
  sendStatus.className = "status ok";
  ctx.source.balanceSats = Math.max(0, ctx.source.balanceSats - ctx.spent);
  if (ctx.source === selectedSource)
    sourceInfo.innerHTML = `Source: <strong>${selectedSource.address}</strong><br>${selectedSource.type} · ${selectedSource.path} · balance <strong class="bal">${satsToBtc(selectedSource.balanceSats)} BTC</strong>`;
  amountEl.value = "";
  altCtx = null;
}
let altCtx = null;
altSendBtn.onclick = async () => {
  if (!altCtx) return;
  sendStatus.textContent = "Broadcasting via another server...";
  sendStatus.className = "status";
  try {
    await sendVia(altCtx, true);
  } catch (e) {
    sendStatus.textContent = "Send error: " + e.message;
    sendStatus.className = "status err";
  }
};

broadcastBtn.onclick = async () => {
  if (!preparedTx || !selectedSource) return;
  if (
    selectedSource !== preparedTx.source ||
    toAddressEl.value.trim() !== preparedTx.to ||
    confirmText.value.trim().toLowerCase() !== preparedTx.to.slice(-6).toLowerCase()
  ) {
    invalidatePrepared();
    return;
  }
  if (!confirm("Really sign and broadcast this transaction?\n\nThis cannot be undone.")) return;
  sendStatus.textContent = "Signing...";
  sendStatus.className = "status";
  broadcastBtn.disabled = true;
  try {
    const { tx, source, audit, feeRate } = preparedTx;
    auditTransaction(tx, audit); // once more, right before the key is used
    tx.sign(source.privateKey);
    tx.finalize();
    checkFinalFeeRate(audit.feeSats, tx.vsize, feeRate);
    const txHex = hex.encode(tx.extract());

    sendStatus.textContent = "Broadcasting...";
    const ctx = {
      txHex,
      tried: [], // servers that already got this transaction
      spent: preparedTx.amountSats + preparedTx.feeSats,
      source: selectedSource,
    };
    confirmArea.style.display = "none";
    preparedTx = null;
    await sendVia(ctx, false);
  } catch (e) {
    sendStatus.textContent = "Send error: " + e.message;
    sendStatus.className = "status err";
    if (String(e.message).startsWith("Transaction check failed")) {
      // Nothing was sent. The prepared transaction is not trusted any more.
      preparedTx = null;
      confirmArea.style.display = "none";
      confirmText.value = "";
    } else {
      broadcastBtn.disabled = false;
    }
  }
};

window.addEventListener("beforeunload", () => {
  hardClear();
});
fetchFeeHints();
