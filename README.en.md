# ModuWeb (Web Accessibility Tools)

[![License](https://img.shields.io/github/license/Daegu-Cyber-University/ModuWeb.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/release/Daegu-Cyber-University/ModuWeb.svg)](https://github.com/Daegu-Cyber-University/ModuWeb/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/Daegu-Cyber-University/ModuWeb/ci.yml?branch=main&label=CI)](https://github.com/Daegu-Cyber-University/ModuWeb/actions/workflows/ci.yml)
[![jsDelivr hits](https://img.shields.io/jsdelivr/gh/hm/Daegu-Cyber-University/ModuWeb)](https://www.jsdelivr.com/package/gh/Daegu-Cyber-University/ModuWeb)

> A drop-in web accessibility widget for any website — add screen reading (TTS), voice commands (STT), magnification, color adjustment and more with a single script tag.
>
> 한국어 문서: **[README.md](README.md)**

**🔗 Live Demo: <https://daegu-cyber-university.github.io/ModuWeb/>**

[![ModuWeb accessibility panel screenshot](docs/assets/screenshots/panel-main.png)](https://daegu-cyber-university.github.io/ModuWeb/)

## Why ModuWeb?

- **One-line install** — a single `<script>` tag with `data-wat-auto`. No build step, no framework required.
- **Works offline / in air-gapped networks** — `webAccTools.standalone.min.js` inlines CSS, icons and Korean locale data into **one file**. No external network needed.
- **TTS & STT without API keys** — screen reading and voice commands run on the browser's Web Speech API. Nothing to sign up for, nothing to pay.
- **WCAG 2.1 AA · KWCAG 2.1** — designed for both the international standard and the Korean government accessibility standard, making it a fit for Korean public-sector sites. The panel UI itself is checked against WCAG 2.2 AA, including measured 24×24 CSS px target sizes across all 166 controls.
- **6 UI languages** — Korean, English (US/GB), Japanese, Chinese, German.
- **Accessibility profiles** — one-click presets for low vision, color blindness, and dyslexia.

| Dark mode + 1.5× font applied | Accessibility profiles |
|---|---|
| ![Page with dark color theme and enlarged font](docs/assets/screenshots/panel-styled.png) | ![Profile settings for low vision, color blindness, dyslexia](docs/assets/screenshots/panel-settings.png) |

## Quick Start

### Option 1 — CDN (simplest)

```html
<script src="https://cdn.jsdelivr.net/gh/Daegu-Cyber-University/ModuWeb@main/dist/webAccTools.js" data-wat-auto></script>
```

Pin a release tag (e.g. `@v2.1.0`) instead of `@main` for production. Configure declaratively with `data-wat-*` attributes:

```html
<script src=".../dist/webAccTools.js" data-wat-auto
	data-wat-language="en-US"
	data-wat-config='{"branding": {"copyrightUrl": "https://example.com"}}'></script>
```

| Attribute | Description |
|---|---|
| `data-wat-auto` | Enable auto-initialization (required switch) |
| `data-wat-config` | Path to config.json (relative to the script) or inline JSON (starts with `{`) |
| `data-wat-language` | Default language (`ko`, `en-US`, `en-GB`, `ja`, `zh`, `de`) |
| `data-wat-container` | Container CSS selector |
| `data-wat-inject-css` | Set `"false"` to manage the stylesheet with your own `<link>` |

### Option 2 — Single file (offline / air-gapped)

Copy **one file**, `dist/webAccTools.standalone.min.js`, to your server. CSS, icons and Korean locale data are bundled inside — no assets folder, no config file, no network access required.

```html
<script src="/path/to/webAccTools.standalone.min.js" data-wat-auto></script>
```

> For languages other than Korean, also deploy the `assets/locales/` folder (Korean is built in).

### Option 3 — Self-hosted folder

1. Download the zip from the [releases page](https://github.com/Daegu-Cyber-University/ModuWeb/releases)
2. Copy the `dist/` folder to your web server **as-is** (the JS resolves CSS/icons/locales under `assets/` by relative path)
3. Add one line to your HTML

```html
<script src="/path/to/dist/webAccTools.js" data-wat-auto></script>
```

### Option 4 — Manual initialization

```html
<link rel="stylesheet" href="path/to/dist/assets/css/webAccTools.css">
<script src="path/to/dist/webAccTools.js"></script>
<script>
	document.addEventListener('DOMContentLoaded', () => {
		const wat = new WAT({ configPath: './config.json' });
		window.watPlugin = wat;
		wat.init();
	});
</script>
```

## Features

| Category | Features |
|---|---|
| Visual | Font size / typeface, text alignment & spacing, full-page magnification |
| Color | High-contrast themes, color inversion, saturation control |
| Focus | Cursor highlighting, reading guide, media & animation control |
| Audio | TTS screen reading (auto / focus / keyboard modes), STT voice commands |
| Extras | Dictionary lookup, simplified reading mode, page structure viewer |
| Keyboard | Full keyboard navigation, focus indicators, shortcuts |
| Profiles | One-click presets per disability type, settings persistence, export/import |

## Documentation

Full documentation (configuration options, API reference, developer guide) currently lives in the Korean [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md). The library UI itself supports 6 languages. Contributions translating the docs are very welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE) © [Daegu Cyber University](https://www.dcu.ac.kr)
