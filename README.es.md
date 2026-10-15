**Language / Язык / Idioma / Langue:** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Français](README.fr.md)

---

# Bitcoin Seed Scanner

Los monederos modernos a menudo no muestran el **saldo** tras restaurar una frase seed. Un programa sencillo que **encuentra tus bitcoin** y permite **enviarlos**.

Muchos monederos solo miran el tipo de dirección más nuevo. Las monedas antiguas (sobre todo direcciones que empiezan por `3...`) pueden «desaparecer» de la vista aunque sigan en la blockchain.  
Esta herramienta comprueba **todos los tipos de dirección habituales de una vez**.

> ⚠️ **No es un monedero para el día a día.**  
> Úsala solo para recuperación. Con cantidades grandes, mejor un ordenador limpio o un live USB.

La propia app admite **English · Русский · Español · Français** (selector arriba a la derecha).

---

## Solo la fuente oficial

Descarga **solo** desde este repositorio:

**https://github.com/olegsh247-stack/Bitcoin-Seed-Scanner**

Las copias de otros sitios o de mensajeros pueden estar modificadas para robar tu seed.

---

## Cómo descargar y ejecutar

1. Abra esta página de GitHub y pulse el botón verde **Code** → **Download ZIP**.
2. Descomprima el archivo descargado: clic derecho → **«Extraer todo…»** (en Mac: doble clic).
3. En la carpeta descomprimida, haga doble clic en el archivo **`index.html`**. Se abrirá en el navegador. No hace falta tocar los demás archivos de la carpeta.
4. Internet solo hace falta para consultar saldos y enviar una transacción. Su frase semilla nunca sale del navegador.

Descargue solo desde esta página de GitHub. No use archivos recibidos por correo o chat.

---

## Cómo usarla

1. Escribe tu **frase seed**, una palabra por casilla (12 o 24: interruptor sobre las casillas). Puedes pegar la frase completa en cualquier casilla. Las casillas se ponen en **verde** si la frase es válida y en **rojo** si no lo es.
2. Introduce la **passphrase** si la usaste
3. Pulsa **Find coins**
4. Espera a que se comprueben todos los tipos de dirección
5. Pulsa **Select** en una dirección con saldo
6. Indica destino e importe → **Prepare**
7. Escribe los **últimos 6 caracteres** de la dirección de destino
8. **Sign and send**

Luego cierra la pestaña. No se guarda nada en el disco.

El botón **«Ayuda»** (arriba a la derecha en la aplicación) muestra esta guía dentro de la propia aplicación.

---

## Qué escanea

| Tipo de dirección | Aspecto | Ruta |
|-------------------|---------|------|
| Legacy | empieza por **1** | BIP44 |
| Nested SegWit | empieza por **3** | BIP49 |
| Native SegWit | empieza por **bc1q** | BIP84 |
| Taproot | empieza por **bc1p** | BIP86 |

Se escanean receive y change. Cada lista de direcciones se revisa hasta encontrar **25 direcciones sin usar seguidas** («gap limit»: valor estándar, suficiente para casi todos los monederos; **25 por defecto**, no hay nada que configurar).

**Número de cuenta** (por defecto **0**): la primera cuenta del monedero. Escribe 1, 2… solo si tu monedero tenía varias cuentas y no se encontraron monedas en la primera.

---

## Seguridad

- Seed y claves solo **en la memoria del navegador**
- Se borran al cerrar la pestaña o al pulsar Clear
- Solo se contacta con mempool.space (saldos, comisiones, envío). **No se descarga nada de internet**: todo el programa está dentro del único archivo.
- **Privacidad:** para consultar saldos, la página envía todas las direcciones derivadas a mempool.space, por lo que ese servicio (y quien observe tu conexión) puede vincularlas entre sí y ver tu IP. Usa Tor/VPN o tu propio nodo si te importa.
- Si falla la consulta de un saldo (red, límite de peticiones), la herramienta lo avisa en lugar de indicar «sin fondos». Si ves esa advertencia, repite el escaneo.
- El envío exige escribir los últimos 6 caracteres del destino
- **Nunca introduzcas la seed en un ordenador en el que no confíes**

---

## Agradecimiento

Si este programa te ayudó a recuperar tus fondos — aceptaremos con gusto tu agradecimiento voluntario. No obliga a nada y, sin duda, será tenido en cuenta por el Todopoderoso. 🙏

| Activo | Red | Dirección |
|--------|-----|-----------|
| BTC | Legacy (P2PKH) | `1GgXo15BHD2CJorJaVhhhB8AvTszr1Nrpc` |
| BTC | Nested SegWit (P2SH) | `3B6wA2Yu5nH9FYXAakkHd79ijnQ16RoD5G` |
| BTC | Native SegWit (P2WPKH) | `bc1qy9ht50kfehlxynwew20eh47c8x9pyvq7pc2umq` |
| BTC | SegWit (P2WSH) | `bc1q56kmywwmlvt6xp04zr63g9nff2ye0p7j2txhz9ccs087dxmr8gnqevee4d` |
| BTC | Taproot (P2TR) | `bc1p6wk0ecu3355m0eymwd92a7f8d99w7lyx5s4xek8nm7razg4hjvqqfxdvx9` |
| USDT | TRC-20 | `TVXzchqZdvRqTCJutjGgF1xVP5kuDfk2nx` |
| USDT | ERC-20 | `0x761B53654e2333261649eEb8857B752A60f11435` |

---

## Límites

- Solo Bitcoin (red principal)
- Un envío desde una sola dirección cada vez
- No sustituye a un monedero hardware

---

**Úsala con cuidado. Tú eres responsable de tus fondos.**

---

## Licencia

Publicado bajo la [licencia MIT](LICENSE): uso, copia y modificación libres, «tal cual», sin garantía de ningún tipo.

> Las direcciones de agradecimiento se publican **solo en este README**, no dentro de la aplicación, para que no estén junto al campo de la seed. Verifica cualquier dirección aquí, en el repositorio oficial, antes de enviar.

---

<details>
<summary>Para usuarios avanzados: comprobar el archivo / compilar</summary>

### Comprobar el archivo (opcional, recomendado)

Tras guardar `index.html`, verifica el SHA-256:

```
23b192f3c3da42a18aba3293c745f0536cc5ecf0d824a9d2c49b2ebf156ed513
```

- **Linux / macOS:** `sha256sum index.html` (o `shasum -a 256 index.html`)
- **Windows (PowerShell):** `Get-FileHash index.html -Algorithm SHA256`

Si el hash no coincide — no uses ese archivo.

*(Actualiza este hash en cada nueva versión de `index.html`.)*

### Compilar desde el código fuente (opcional)

`index.html` se genera a partir de `src/` (edita `src/template.html` y `src/app.js`, **no** `index.html`). Para reproducirlo byte a byte y compararlo con la suma de verificación de arriba:

```
npm ci
npm run build   # escribe index.html y actualiza el SHA-256 en todos los README
npm test
```

</details>
