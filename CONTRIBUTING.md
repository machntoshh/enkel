# Como Contribuir com o Enkel

Obrigado pelo interesse em contribuir com o **Enkel**!

## Filosofia do Projeto

> **Open. Write. Save. Nothing else gets in the way.**

Antes de propor uma nova funcionalidade, reflita sobre a diretriz central do projeto:
- Se uma funcionalidade não melhorar diretamente a experiência de **escrever, ler ou organizar anotações Markdown locais**, ela provavelmente não deve existir no Enkel.
- Não aceitamos PRs que introduzam telemetria, contas de usuário, sincronização proprietária em nuvem, IA embutida, sistemas de plugins complexos ou dependências pesadas sem justificativa técnica comprovada.

## Fluxo de Desenvolvimento

1. Faça um fork do repositório e crie uma branch descritiva (`git checkout -b feat/minha-melhoria` ou `fix/correcao`).
2. Instale as dependências do frontend:
   ```bash
   npm install
   ```
3. Execute os testes automatizados (Frontend e Rust):
   ```bash
   npm test
   cd src-tauri && cargo test
   ```
4. Verifique se a compilação de produção conclui sem avisos:
   ```bash
   npm run build
   ```
5. Abra um Pull Request descrevendo de forma clara e objetiva a alteração realizada.
