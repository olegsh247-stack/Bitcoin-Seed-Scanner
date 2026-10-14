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

Se escanean receive y change.

---

## Seguridad

- Seed y claves solo **en la memoria del navegador**
- Se borran al cerrar la pestaña o al pulsar Clear
- Solo se contacta con mempool.space (saldos, comisiones, broadcast)
- El envío exige escribir los últimos 6 caracteres del destino
- **Nunca introduzcas la seed en un ordenador en el que no confíes**

---

## Agradecimiento

Si esta herramienta te ayudó a recuperar fondos, cualquier agradecimiento **voluntario** es bienvenido. Nunca es obligatorio.

---

## Límites

- Solo Bitcoin (red principal)
- Un envío desde una sola dirección cada vez
- No sustituye a un monedero hardware

---

**Úsala con cuidado. Tú eres responsable de tus fondos.**
