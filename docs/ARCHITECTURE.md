# Arquitetura e Compilação do Enkel

## Visão Arquitetural

O **Enkel** foi projetado com separação estrita de responsabilidades em três camadas enxutas:

1. **Backend Nativo (`src-tauri/src/` — Rust):**
   - `config.rs`: persiste a configuração do usuário (`workspace_path`, `last_open_file`, `sidebar_collapsed`) no diretório padrão de dados do sistema operacional (`%APPDATA%\Enkel\config.json` no Windows), completamente separado da pasta de instalação dos binários.
   - `fs_ops.rs`: implementa todas as operações de sistema de arquivos com validação estrita de caminhos (`resolve_safe_path`), impedindo acesso fora do diretório autorizado (`path traversal`), gravação atômica (`atomic_write_bytes` via arquivo temporário + `sync_all` + `rename`), persistência de imagens em `assets/imagens/` e busca textual rápida.
   - `lib.rs`: registra os comandos IPC do Tauri v2 e gerencia o ciclo de vida da janela nativa.

2. **Runtime Desktop (Tauri v2):**
   - Utiliza o WebView nativo do sistema operacional (WebView2 no Windows), evitando empacotar uma instância inteira do Chromium (como ocorre no Electron) e mantendo o tamanho do executável e o consumo de memória RAM extremamente baixos.

3. **Frontend (`src/` — TypeScript + Vite):**
   - Implementado em TypeScript puro (sem frameworks pesados de Virtual DOM), garantindo inicialização instantânea e consumo mínimo de CPU/RAM.
   - `core/markdown.ts`: parser e renderizador Markdown seguro contra XSS, com destaque de sintaxe para blocos de código e resolução de imagens relativas.
   - `components/editor.ts`: superfície de escrita com foco imediato, autosave com debounce (`450ms`), colagem de imagens via `Ctrl+V` e busca local (`Ctrl+F`).
   - `components/sidebar.ts`: barra lateral direita recolhível para organização hierárquica de pastas, subpastas e documentos `.md`.

---

## Como Compilar Localmente

### Pré-requisitos

- **Node.js** 20+ e `npm`
- **Rust** (`rustup`, `cargo` 1.77+)
- **Windows:** Ferramentas de compilação C/C++ (MSVC Build Tools ou LLVM-MinGW) e WebView2 Runtime (já incluso por padrão no Windows 10/11).

### Passo a Passo

```bash
# 1. Instalar dependências do frontend
npm install

# 2. Executar testes automatizados (Frontend e Rust)
npm test
cd src-tauri && cargo test && cd ..

# 3. Executar em modo de desenvolvimento
npm run tauri dev

# 4. Gerar executáveis de produção (.exe portátil e instalador)
npm run tauri build
```
