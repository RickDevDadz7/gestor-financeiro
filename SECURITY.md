# Segurança do Gestor Financeiro

## Proteções implementadas

| Ameaça | Proteção |
|---|---|
| Vazamento de senhas | Senhas com bcrypt (custo 12); o banco nunca guarda a senha em texto |
| Força bruta no login | 5 senhas erradas bloqueiam o e-mail por 15 min; 30 tentativas por IP em 15 min |
| Descobrir quais e-mails têm conta | Mensagens genéricas e tempo de resposta igual, exista o e-mail ou não |
| Senhas fracas | Mínimo 10 caracteres, com letras e números |
| Roubo de sessão (XSS) | Cookie `httpOnly` (JavaScript não lê), `Secure` (só HTTPS) e `SameSite=Lax` |
| Celular perdido / cookie roubado | Sessão vale 14 dias, é conferida no banco a cada acesso, e o botão "Sair de todos os aparelhos" invalida todas na hora |
| Ver dados de outro usuário (IDOR) | Toda consulta e alteração filtra pelo `userId` da sessão, nunca por um id vindo do navegador |
| SQL injection | Drizzle ORM com consultas parametrizadas |
| XSS | React escapa todo conteúdo; nenhum `dangerouslySetInnerHTML`; CSP bloqueia scripts de outros domínios |
| Fórmulas maliciosas nas planilhas | Motor próprio, sem `eval()` |
| CSRF | Server Actions do Next.js checam a origem da requisição, e o cookie usa `SameSite=Lax` |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| Downgrade para HTTP | HSTS (2 anos) |
| Entradas absurdas | Limites de tamanho em todos os campos, valores até R$ 10 milhões, planilhas até 2.000 células |
| Endpoint do cron exposto | Exige `CRON_SECRET` comparado em tempo constante |
| Dependências vulneráveis | `npm audit` sem vulnerabilidades (com `overrides` de postcss e uuid) |

## Checklist do dono do app

- [ ] `AUTH_SECRET` e `CRON_SECRET` gerados por você, com 32+ caracteres, **nunca** colados em chat, print ou GitHub
- [ ] Trocar os segredos se algum dia vazarem (trocar o `AUTH_SECRET` desloga todo mundo, e é isso que se quer)
- [ ] `ALLOW_SIGNUP=false` enquanto o app for só seu
- [ ] Conta na Vercel, no Neon e no GitHub com autenticação em 2 fatores
- [ ] Rodar `npm audit` de vez em quando e atualizar as dependências

Gerar um segredo:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Antes de virar produto (com usuários pagantes)

- Verificação de e-mail e recuperação de senha
- 2FA (TOTP) opcional para usuários
- Backups automáticos e testados do banco (o Neon tem point-in-time restore)
- Logs de auditoria (login, exclusões) e alertas
- Política de privacidade e adequação à LGPD (exportar e excluir conta)
- Rate limit distribuído (Upstash/Redis) se o tráfego crescer
- CSP com nonce (remove o `'unsafe-inline'`)
