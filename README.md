# SOVARA: Sovereign AI Workbench

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

**SOVARA (Adaptive On-Premise Intelligence Workbench)** is a privacy-first, fully localized AI workbench designed to run Large Language Models (LLMs) directly on your hardware without relying on cloud APIs. Built with high performance and data sovereignty in mind.

## 🚀 Features

- **100% Local Execution**: Your data never leaves your machine. Full data privacy and security.
- **Hardware-Aware Adaptive Engine**: Automatically profiles your system hardware (CPU/GPU/RAM) to optimally configure and run models.
- **Cross-Platform Desktop App**: Built using modern web technologies (React/Vite) packaged into a lightweight native app using [Tauri](https://tauri.app/).
- **Optimized Inference**: Powered by local inference engines (ggml/llama.cpp) supporting hardware acceleration.
- **Model Registry & Manager**: Seamlessly download, manage, and switch between various quantized models (e.g., TinyLlama, Llama 3) with a built-in UI.

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend / Desktop runtime**: Rust (Tauri)
- **AI Inference**: llama.cpp binaries
- **Scripting**: Python (for model downloading utilities)

## 📦 Installation & Setup

### Prerequisites

Ensure you have the following installed on your system:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/tools/install)
- [Python 3](https://www.python.org/)

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/Yogesh-Mohan/SOVARA--Adaptive-On-Premise-Intelligence-Workbench.git
   cd SOVARA--Adaptive-On-Premise-Intelligence-Workbench/sovereign-ai-workbench
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Download Models**
   You can download the base models using the provided Python scripts:
   ```bash
   python download_tinyllama.py
   ```

4. **Run in Development Mode**
   Start the Tauri development server:
   ```bash
   npm run tauri dev
   ```

## 🏗️ Building for Production

To build the optimized native application for your operating system, run:

```bash
npm run tauri build
```

This will generate an installer in `src-tauri/target/release/bundle/`.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Feel free to check the [issues page](https://github.com/Yogesh-Mohan/SOVARA--Adaptive-On-Premise-Intelligence-Workbench/issues) if you want to contribute.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
