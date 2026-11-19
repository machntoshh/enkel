<p align="center">
  <img src="docs/assets/logo-banner.png" alt="ENKEL Logo" width="460" />
</p>

<h3 align="center">Enkel — Minimalist Markdown Notes</h3>

<p align="center">
  <strong>Open. Write. Save. Nothing else gets in the way.</strong><br/>
  <em>Your knowledge. Your files. Your space.</em>
</p>

---

## Sobre o Enkel

**Enkel** (palavra norueguesa para *"simples"*) é um bloco de notas desktop minimalista e **local-first** para arquivos Markdown (`.md`).

Ele abre instantaneamente, oferece uma escrita estruturada e limpa (com comandos rápidos via `/` e modo `raw` opcional via `Ctrl + E`) e salva tudo diretamente no seu computador em arquivos `.md` reais — sem contas, sem nuvem, sem telemetria e sem processos pesados em segundo plano.

---

## Download & Instalação (Windows 10 / 11)

- **GitHub Releases (Instalador `.exe` e Versão Portátil `.exe`):**
  [Baixar última versão no GitHub Releases](https://github.com/machntoshh/enkel/releases/latest)
- **Microsoft Store:**
  [Enkel na Microsoft Store](https://apps.microsoft.com/detail/9NB10ZZDPCZ1)

---

## Funcionalidades

- **Editor Estruturado e Limpo:**
  - Digite `/` em qualquer linha para abrir o menu rápido de blocos (**Título 1/2/3**, **Lista com marcadores**, **Lista numerada**, **Lista de tarefas / Checklist**, **Citação**, **Bloco de código**, **Divisor** e **Imagem**).
  - Atalhos Markdown automáticos ao digitar (`# `, `- `, `1. `, `[] `, `> `, `---`, ```` ``` ````, `**negrito**`, `*itálico*`, `` `código` ``).
  - Barra flutuante discreta ao selecionar texto (**B**, *I*, ~~S~~, `</>` e **Link**).
- **Modo `raw` Opcional (`Ctrl + E`):** Alterne a qualquer momento entre o editor estruturado e o código Markdown puro com realce de sintaxe, numeração de linhas e recuo pendente (*hanging indent*).
- **Sem Corretor Ortográfico Intrusivo (`spellcheck="false"`):** Escreva termos técnicos, código, comandos e anotações livremente sem sublinhados vermelhos.
- **Imagens em Markdown (`Ctrl + V` ou Upload):** Cole imagens da área de transferência ou envie arquivos do computador; elas são copiadas automaticamente para `assets/imagens/` no seu espaço de trabalho com referências relativas (`![Descrição](assets/imagens/...)`).
- **Salvamento Automático Confiável (Atomic Autosave):** Salva automaticamente enquanto você digita (com escrita atômica em disco via arquivo temporário + `fsync`), protegendo seus arquivos contra perda de dados.
- **Barra Lateral Direita Recolhível (`Ctrl + \`):** Navegação simples por pastas, subpastas e arquivos `.md`.
- **100% Local-First e Privado:** Consulte a [Política de Privacidade](PRIVACY.md).

---

## Atalhos de Teclado

| Atalho | Ação |
| :--- | :--- |
| `/` | Abrir menu rápido de blocos no editor |
| `Ctrl + N` | Criar nova nota Markdown (`.md`) |
| `Ctrl + E` | Alternar entre editor estruturado e modo `raw` |
| `Ctrl + B` / `Ctrl + I` | Aplicar negrito / itálico |
| `Tab` / `Shift + Tab` | Aumentar / diminuir indentação |
| `Ctrl + V` | Colar imagem da área de transferência para `assets/imagens/` |
| `Ctrl + S` | Forçar salvamento imediato |
| `Ctrl + F` | Localizar texto no documento atual |
| `Ctrl + Shift + F` | Pesquisar em todos os arquivos do espaço de trabalho |
| `Ctrl + O` | Abrir rapidamente qualquer arquivo |
| `Ctrl + \` | Recolher ou expandir a barra lateral direita |

---

## Tecnologias Utilizadas

- **Backend:** [Rust](https://www.rust-lang.org/) (gerenciamento seguro do sistema de arquivos, escrita atômica, imagens e busca rápida)
- **Desktop Runtime:** [Tauri v2](https://v2.tauri.app/) (empacotamento nativo ultraleve e seguro)
- **Frontend:** [TypeScript](https://www.typescriptlang.org/) + [TipTap / ProseMirror](https://tiptap.dev/) + [CodeMirror 6](https://codemirror.net/) + [Vite](https://vitejs.dev/)

---

## Apoiar o Projeto

Obrigado por usar o **Enkel**! Caso queira apoiar o desenvolvimento:
- **LivePix:** [https://livepix.gg/machntossh](https://livepix.gg/machntossh)

---

## Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [`LICENSE`](LICENSE) para mais informações.
