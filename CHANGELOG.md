# Changelog

Todas as alterações relevantes do projeto **Enkel** serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto adere ao [Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-11-10

### Adicionado

- **Arquitetura Local-First (Tauri v2 + Rust + TypeScript):** aplicativo desktop leve, rápido e independente, sem dependências de nuvem, contas ou telemetria.
- **Identidade Visual Enkel:** tema escuro em preto acinzentado (`#161616`), tipografia confortável e logotipo pixel art em gradiente verde-azulado inspirado na estética minimalista do Omarchy.
- **Editor Markdown Minimalista:** suporte a títulos, negrito, itálico, listas ordenadas/não ordenadas, checklists interativas, blocos de código com destaque de sintaxe, citações, tabelas, links, separadores e alternância rápida para Preview (`Ctrl+E`).
- **Barra Lateral Direita Recolhível:** organização hierárquica de pastas, subpastas e arquivos `.md`, com criação, renomeação e exclusão segura mediante confirmação.
- **Salvamento Automático Atômico (Autosave):** persistência automática com debounce e escrita atômica em disco via arquivo temporário e `sync_all`, protegendo os arquivos contra corrupção.
- **Suporte a Imagens Locais:** colagem direta via `Ctrl+V` da área de transferência e upload de arquivos de imagem para `assets/imagens/` com referências Markdown relativas e portáteis.
- **Pesquisa e Atalhos:** busca rápida no documento atual (`Ctrl+F`), pesquisa global entre documentos (`Ctrl+Shift+F` / `Ctrl+O`), restauração automática do último documento aberto e seleção flexível do diretório de trabalho.
- **Distribuição Windows:** executável portátil (`.exe`) e instalador Windows independente dos dados do usuário.
