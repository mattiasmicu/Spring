# Spring

**A modern Minecraft Java Edition launcher for macOS, Windows, and Linux.**

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-blue)
![React](https://img.shields.io/badge/frontend-React-61DAFB)
![Rust](https://img.shields.io/badge/backend-Rust-orange)

Spring is a fast, lightweight Minecraft launcher built with [Tauri](https://tauri.app/) (Rust + React). It features a modern UI, seamless Microsoft authentication, and easy instance management.

![Spring Launcher](public/Trysomethingnew.png)

## Features

- **Microsoft Authentication** - Secure OAuth2 login with automatic browser redirect
- **Multiple Instances** - Create and manage separate Minecraft installations
- **Mod Support** - Install Forge, Fabric, and Quilt mod loaders
- **Mod Browser** - Search and install mods directly from Modrinth
- **Auto Java Setup** - Automatic Java detection and download
- **Skin Management** - Change your Minecraft skin from the launcher
- **Instance Settings** - Per-instance memory allocation, Java args, and more
- **Cross-Platform** - Works on macOS, Windows, and Linux
- **Lightning Fast** - Native performance with Rust backend

## Installation

Download the latest release from the [releases page](../../releases).

### Supported Platforms

- **macOS** 10.15+ (Intel & Apple Silicon)
- **Windows** 10/11
- **Linux** (most distributions)

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (stable toolchain)

### Steps

```bash
git clone https://github.com/mattiasmicu/Spring.git
cd Spring
npm install
npm run tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

### Development

For development with hot reload:

```bash
npm run tauri dev
```

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS + Framer Motion
- **Backend:** Rust + Tauri
- **Authentication:** OAuth2 + PKCE (Microsoft OAuth)
- **HTTP Client:** reqwest
- **State Management:** Zustand

## Project Structure

```
Spring/
├── src/                    # React frontend
│   ├── panels/            # UI panels (Home, Instances, Settings, etc.)
│   ├── components/        # Reusable UI components
│   └── store/             # Zustand state management
├── src-tauri/             # Rust backend
│   └── src/commands/      # Tauri commands (auth, launch, download, etc.)
└── public/                # Static assets
```

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- I have got alot of inspo from [PandoraLauncher](https://github.com/Moulberry/PandoraLauncher)
- Minecraft version metadata from [Mojang](https://launchermeta.mojang.com/)
- Mods from [Modrinth](https://modrinth.com/)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

Spring is not affiliated with Mojang Studios or Microsoft. Minecraft is a trademark of Microsoft Corporation.
