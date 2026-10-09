# Torn Item Market Auto Pricer

A Tampermonkey userscript for [Torn City](https://www.torn.com). It adds an
arrow button next to the price input on the Item Market page, fetches current
listings via the Torn API v2, and automatically fills in the lowest price. A
tooltip shows the minimum, median, and maximum price.

## Features

- Fetches market listings through Torn API v2 (`market` → `itemmarket`).
- Sets the lowest price into the price field (with a proper React input event).
- Tooltip summary: number of listings, Min / Mid (median) / Max.
- Button is auto-injected next to every row that has a price input.
- API key stored locally (`GM_setValue`) — entered only once.
- Tampermonkey menu entry: **Change / Enter Torn API Key**.
- API key is sent only via the `Authorization` header (never in the URL).

## Requirements

- A browser with Tampermonkey (Chrome / Firefox / Edge).
- A Torn account and an **API Key** with access to the `market` → `itemmarket`
  selection (Minimal / Limited / Full Access).

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new script and paste the contents of `torn-auto-pricer.js`, or open
   the file directly (Tampermonkey will offer to install it).
3. Confirm the installation.

## Usage

1. Open the Item Market: `https://www.torn.com/page.php?sid=ItemMarket`.
2. On the first click you will be prompted for an API key — paste it and confirm.
   You can change it later from the Tampermonkey menu.
3. Click the arrow icon next to the price input in the row you care about.
4. The script fetches listings, fills in the lowest price, and shows
   Min / Mid / Max in the tooltip.

## Configuration

The API key is stored under the name `TORN_MARKET_API_KEY` in Tampermonkey
storage. The script never sends it anywhere except `api.torn.com`.

Granular permissions declared in the script header:

| Directive                | Meaning                                      |
| ------------------------ | -------------------------------------------- |
| `GM_getValue`            | read the stored API key                      |
| `GM_setValue`            | store the API key                            |
| `GM_registerMenuCommand` | add an item to the Tampermonkey menu         |
| `GM_xmlhttpRequest`      | make API requests bypassing CORS             |
| `@connect api.torn.com`  | allowed host for `GM_xmlhttpRequest`         |

## Security

- The key is never placed in the URL — it is sent in the
  `Authorization: ApiKey <key>` header.
- The key is stored locally in the browser and is never shared.
- On an `Incorrect key` error (code 2) the stored key is removed and must be
  entered again.
- A key with access only to `market`/`itemmarket` is sufficient — do not use a
  Full Access key unless it is really needed.

## Development

The script is a single file, `torn-auto-pricer.js` (vanilla JS, no
dependencies). Syntax check:

```bash
node --check torn-auto-pricer.js
```

After making changes, bump `@version` in the header so Tampermonkey picks up
the update.

## License

Provided as-is, without warranty; use at your own risk. Comply with the
[Torn scripting rules](https://www.torn.com/rules.php).
