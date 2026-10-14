**Language / Язык / Idioma / Langue:** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Français](README.fr.md)

---

# Bitcoin Seed Scanner

Herramienta sencilla para **encontrar bitcoin que muchos monederos no muestran** al restaurar una seed — y enviarlo.

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

### Comprobar el archivo (opcional, recomendado)

Tras guardar `index.html`, verifica el SHA-256:

```
efada0854c6cb29d0bd851b1381f6fc9519d51a80327087f72737cc9e2d72730
```

- **Linux / macOS:** `sha256sum index.html` (o `shasum -a 256 index.html`)
- **Windows (PowerShell):** `Get-FileHash index.html -Algorithm SHA256`

Si el hash no coincide — no uses ese archivo.

*(Actualiza este hash en cada nueva versión de `index.html`.)*

---

## Descargar y abrir (1 minuto)

### Opción 1 — la más fácil

1. Abre **https://github.com/olegsh247-stack/Bitcoin-Seed-Scanner**
2. Botón verde **Code** → **Download ZIP**
3. Descomprime el archivo
4. Haz doble clic en **`index.html`** — se abre en el navegador

### Opción 2 — un solo archivo

1. Abre: **https://raw.githubusercontent.com/olegsh247-stack/Bitcoin-Seed-Scanner/main/index.html**
2. Clic derecho → **Guardar como…**
3. Abre el archivo guardado

Solo hace falta internet para consultar saldos y difundir la transacción. La seed no sale del navegador.

---

## Cómo usarla

1. Pega tu **frase seed** (12 o 24 palabras)
2. Introduce la **passphrase** si la usaste
3. Pulsa **Find coins**
4. Espera a que se comprueben todos los tipos de dirección
5. Pulsa **Select** en una dirección con saldo
6. Indica destino e importe → **Prepare**
7. Escribe los **últimos 6 caracteres** de la dirección de destino
8. **Sign and send**

Luego cierra la pestaña. No se guarda nada en el disco.

---

## Qué escanea

| Tipo de dirección | Aspecto | Ruta |
|-------------------|---------|------|
| Legacy | empieza por **1** | BIP44 |
| Nested SegWit | empieza por **3** | BIP49 |
| Native SegWit | empieza por **bc1q** | BIP84 |
| Taproot | empieza por **bc1p** | BIP86 |

Se escanean receive y change, cada cadena hasta encontrar **N direcciones consecutivas sin usar** («gap limit», 25 por defecto). Puedes elegir el **número de cuenta** (0 por defecto).

---

## Seguridad

- Seed y claves solo **en la memoria del navegador**
- Se borran al cerrar la pestaña o al pulsar Clear
- Solo se contacta con mempool.space (saldos, comisiones, broadcast). **No se carga código desde ningún CDN**: todas las bibliotecas están incluidas en `index.html` y una Content-Security-Policy limita la página a ese único script y a mempool.space.
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

## Compilar desde el código fuente (opcional)

`index.html` se genera a partir de `src/` (edita `src/template.html` y `src/app.js`, **no** `index.html`). Para reproducirlo byte a byte y compararlo con la suma de verificación de arriba:

```
npm ci
npm run build   # escribe index.html y actualiza el SHA-256 en todos los README
npm test
```

---

## Límites

- Solo Bitcoin (red principal)
- Un envío desde una sola dirección cada vez
- No sustituye a un monedero hardware

---

**Úsala con cuidado. Tú eres responsable de tus fondos.**
