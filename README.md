# Argon

**A modern Minecraft Java Edition launcher for macOS.**

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-blue)

## Installation

Download the latest release from the [releases page](../../releases).

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (stable toolchain)

### Steps

```bash
git clone https://github.com/mattiasmicu/Argon.git
cd Argon
npm install
npm run tauri build
```

For development with hot reload:

```bash
npm run tauri dev
```

## Features

- Sign in with your Microsoft account
- Download and manage multiple Minecraft instances
- Automatic Java setup
- Support for vanilla and modded instances
- Lightweight and fast, built with Tauri

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

Argon is not affiliated with Mojang Studios or Microsoft.
