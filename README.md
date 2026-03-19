# Sistema de Agendamentos para Pet Shop

Projeto web completo para leitura de agendas publicas do Google Calendar via `.ics`, calculo de pontuacao operacional por agenda e visualizacao de horarios disponiveis para banho e tosa.

## Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- API Routes do Next.js
- Parser `.ics` proprio, sem depender da logica do titulo do evento

## O que o sistema faz

- Le eventos das agendas publicas do Google Calendar
- Usa apenas o nome e a configuracao da agenda para definir pontuacao
- Considera eventos recorrentes
- Mostra Dashboard com pontos do dia, semana e mes
- Mostra relatorios com filtros e exportacao CSV
- Mostra aba de agendamento com vagas simultaneas e proxima vaga disponivel
- Mostra divisao sugerida por profissional e exportacao dessa divisao
- Mostra fila de confirmacoes de WhatsApp com mensagem e horario aleatorios
- Respeita o fuso `America/Sao_Paulo`
- Ignora a pausa operacional entre `11:30` e `13:00`

## Estrutura principal

- `lib/config.ts`: cadastro central das agendas, pontos, cores, URLs, duracoes e status ativo/inativo
- `lib/ics.ts`: parser de `.ics` e expansao de recorrencias
- `lib/calendar.ts`: leitura das agendas publicas
- `lib/metrics.ts`: calculo de pontos, status operacional, ranking e disponibilidade
- `app/api/metrics/route.ts`: endpoint para alimentar a interface
- `app/api/export/route.ts`: exportacao CSV
- `components/pet-shop-dashboard.tsx`: interface com as 3 abas principais

## Como rodar localmente

1. Instale o Node.js 20 ou superior.
2. Crie um arquivo `.env.local` com a senha de acesso:

```bash
APP_ACCESS_PASSWORD=sua-senha-forte
APP_ACCESS_SECRET=uma-chave-opcional-para-reforcar-a-sessao
```

3. No diretorio do projeto, rode:

```bash
npm install
npm run dev
```

4. Abra [http://localhost:3000](http://localhost:3000)

## Acesso protegido por senha

O sistema agora exige login por senha para abrir o painel e usar as APIs.

- `APP_ACCESS_PASSWORD`: senha obrigatoria para entrar no sistema
- `APP_ACCESS_SECRET`: chave adicional para reforcar a sessao por cookie

Na Vercel, configure essas duas variaveis em `Project Settings` > `Environment Variables`.

## Versao Windows .exe

Tambem deixei o projeto preparado para virar aplicativo Windows com instalador `.exe`.

### Como gerar o instalador

1. Instale as dependencias:

```bash
npm install
```

2. Gere a versao desktop:

```bash
npm run dist:win
```

3. O instalador sera criado na pasta:

```bash
release/
```

### Identidade do aplicativo desktop

Ja deixei preparado:

- nome do aplicativo: `Pet Shop Agendamentos`
- nome do instalador: `Instalador-Pet-Shop-Agendamentos`
- splash screen de abertura
- pasta padrao de instalacao baseada no nome do produto no Windows

Os arquivos principais dessa parte sao:

- `electron/main.cjs`
- `electron/splash.html`
- `assets/app-icon.svg`

### Sobre o icone do Windows

O projeto ja usa um icone visual editavel em SVG para identidade do app e da splash.

Se voce quiser um icone nativo oficial no instalador e no executavel do Windows, depois basta substituir por um arquivo `.ico` proprio e apontar esse arquivo no `package.json`.

### Como testar em modo desktop no computador de desenvolvimento

1. Em um terminal:

```bash
npm run dev
```

2. Em outro terminal:

```bash
npm run desktop:dev
```

## Posso editar no outro computador?

Sim. Ha duas formas:

- instalar o `.exe` para uso normal
- copiar a pasta completa do projeto para o outro computador e continuar editando o codigo-fonte quando precisar

Ou seja: o `.exe` serve para instalar e usar, e o projeto continua editavel separadamente.

## Configuracao central das agendas

As agendas ficam em `lib/config.ts` com esta estrutura:

```ts
{
  id: "porte-pequeno",
  name: "Porte Pequeno até 10kg",
  url: "https://calendar.google.com/calendar/ical/...",
  points: 1,
  color: "#1D4ED8",
  active: true,
  serviceLabel: "Porte Pequeno",
  durationMinutes: 60
}
```

Voce pode:

- adicionar novas agendas
- alterar os pontos por agenda
- trocar cores da interface
- ativar ou desativar agendas
- ajustar a duracao usada no calculo de disponibilidade

## Regras de negocio implementadas

- A pontuacao e sempre baseada na agenda, nunca no titulo do evento
- Eventos com texto como `taxi` continuam contando pontos normalmente
- Limite diario de `40` pontos
- Capacidade simultanea maxima de `4` atendimentos
- Status do dia:
  - `0 a 28`: confortavel
  - `28 a 34`: atencao
  - `34 a 40`: quase cheio
  - `acima de 40`: lotado

## Observacao importante

O projeto esta configurado com os tempos informados para cada agenda:

- Porte Pequeno: 80 min
- Porte Medio: 150 min
- Porte Grande: 180 min
- Tosa na Maquina: 120 min
- Tosa na Tesoura: 180 min

Tambem foi incluida a distribuicao operacional da equipe em `lib/config.ts`:

- Bruna: banho e tosa na tesoura
- Angelita: banho
- Ana: banho
- Tais: banho e tosa na maquina

## Regras operacionais adicionais

- Sabado: atendimento das 08:00 as 12:00
- Domingo: sem atendimento
- Dias uteis: limite de 15 pontos no primeiro periodo e 25 pontos no segundo periodo
- Sabado: limite total de 20 pontos
- Pode haver sobreposicao quando necessario, desde que o periodo nao ultrapasse o teto de pontos
- O sistema gera uma divisao sugerida dos compromissos por profissional na data analisada

## Confirmacoes por WhatsApp

- A aba `WhatsApp` prepara confirmacoes para os proximos 7 dias
- Cada mensagem e programada para 1 dia antes do compromisso
- O horario do envio e sorteado de forma deterministica para nao mudar a cada recarga
- O texto tambem varia entre varios modelos para reduzir repeticao
- Quando existe telefone no titulo do agendamento, o painel ja monta o link para abrir no WhatsApp Web
- Quando o telefone nao estiver no titulo, ele pode ser cadastrado manualmente na aba `WhatsApp`
- No ambiente online, esse cadastro compartilhado usa `Vercel Postgres`

### Worker local para WhatsApp Web

O envio automatico pelo seu proprio WhatsApp precisa rodar em um computador local, nao na Vercel.

Instale as dependencias novas:

```bash
npm install
```

Conecte seu WhatsApp Web uma vez:

```bash
npm run whatsapp:connect
```

Depois de escanear o QR code com o celular, a sessao fica salva no proprio computador.

Para enviar os lembretes que estiverem `Prontos agora`:

```bash
npm run whatsapp:send
```

O worker:

- le os compromissos elegiveis
- usa as mensagens aleatorias ja preparadas pelo sistema
- envia apenas os lembretes prontos
- registra em `data/whatsapp-sent-log.json` para evitar envio duplicado

Para automatizar, voce pode agendar `npm run whatsapp:send` no Agendador de Tarefas do Windows a cada 10 ou 15 minutos.

### Telefones compartilhados na Vercel

Para que os telefones cadastrados na aba `WhatsApp` fiquem salvos para todos os computadores:

1. No projeto da Vercel, abra a aba `Storage`
2. Crie um banco `Postgres`
3. Conecte esse banco ao projeto
4. A Vercel vai adicionar automaticamente as variaveis de ambiente do Postgres

Depois disso, a rota `/api/contacts` passa a salvar e ler os telefones no banco, em vez de depender apenas do navegador local.
