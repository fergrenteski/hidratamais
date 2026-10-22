# HidrataMais

Controle de consumo de água: defina uma meta diária, registre cada copo com um toque e veja uma **proveta graduada** encher ao longo do dia. Cada marca da proveta é uma dose, com o volume em ml de um lado e o horário sugerido do outro. Sem login: o usuário informa só o nome.

- **Frontend:** React 19 + Vite + TypeScript, React Router, Recharts
- **Backend:** Node.js 20+ com Express 5, Zod, helmet, CORS, morgan, express-rate-limit
- **Banco:** Azure Cosmos DB for NoSQL (free tier), com o driver em memória (`DB_DRIVER=memory`) como alternativa
- **Deploy:** imagem Docker única (front + API na porta 8080), pronta para Docker Hub, Azure Web App, Azure Container Apps e Red Hat OpenShift

---

## Rodar localmente

Requisitos: Node.js 20.12+ (ou só Docker).

```bash
cp .env.example .env
npm run setup
npm run dev
```

Abra **http://localhost:5173**. O Vite encaminha `/api` para o backend em `:8080`. Por padrão o `.env` usa `DB_DRIVER=memory`, então você testa tudo sem Azure (os dados somem ao reiniciar).

Com Docker, já como a imagem de produção:

```bash
cp .env.example .env
docker compose up --build
```

Abra **http://localhost:8080**.

Testes do backend (lógica de streak, % da meta, próxima dose e fluxo da API):

```bash
npm test
```

---

## Arquitetura

```
hidratamais/
├─ client/                 # React + Vite (TypeScript)
│  └─ src/
│     ├─ pages/            # Welcome, Today, History, Goals, Settings
│     ├─ components/       # Cylinder (a proveta), Celebrate (gotas ao bater a meta)
│     ├─ api.ts            # cliente da API + tipos
│     └─ styles.css        # tokens de cor/tipo, modo claro e escuro
├─ server/                 # Node + Express
│  ├─ src/
│  │  ├─ config/           # leitura das variáveis de ambiente
│  │  ├─ routes/           # mapa de rotas /api
│  │  ├─ controllers/      # HTTP ↔ serviço (validação Zod)
│  │  ├─ services/         # regras de negócio + stats.logic.js (funções puras)
│  │  ├─ repositories/     # driver memory e driver cosmos (mesma interface)
│  │  └─ middlewares/      # tratamento centralizado de erros
│  ├─ scripts/init-cosmos.js
│  └─ test/
├─ openshift/              # manifestos para o Developer Sandbox
├─ Dockerfile              # multi-stage, imagem única
└─ docker-compose.yml
```

Em produção o Express serve os arquivos do React buildado e a API na mesma porta. Qualquer rota fora de `/api` devolve `index.html` (fallback de SPA).

### Modelo de dados (Cosmos DB)

Banco `hidratamais`, com throughput **compartilhado de 400 RU/s** no nível do banco.

| Container | Partition key | Documento |
|---|---|---|
| `users` | `/id` | `id, name, nameLower, timezone, goals { dailyGoalMl, dosesPerDay, window { start, end }, defaultCupMl, weightKg }, createdAt` |
| `intakes` | `/userId` | `id, userId, amountMl, timestamp (ISO UTC), localDate (YYYY-MM-DD no fuso do usuário)` |

O agrupamento por dia usa o `timezone` do perfil (padrão `America/Sao_Paulo`; na criação o app envia o fuso do navegador). Todas as consultas de registros usam a partition key `userId`. A única consulta entre partições é a busca por nome em `users`, que é pequena.

### API

Todas as respostas são JSON. Os erros seguem o formato `{ "error": { "code", "message" } }`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Health check (verifica o banco). `?probe=liveness` não consulta o banco |
| POST | `/api/users` | Cria usuário `{ name, timezone? }` com metas padrão. Nome repetido → 409 `NAME_TAKEN` |
| GET | `/api/users/search?name=` | Busca por nome (sem diferenciar maiúsculas) para retomar o perfil |
| GET | `/api/users/:userId` | Dados do usuário + metas |
| PATCH | `/api/users/:userId` | Edita `{ name?, timezone? }` |
| PUT | `/api/users/:userId/goals` | Atualiza `{ dailyGoalMl, dosesPerDay, window: { start, end }, defaultCupMl, weightKg? }` |
| DELETE | `/api/users/:userId` | Remove o usuário e todos os registros |
| POST | `/api/users/:userId/intakes` | Registra `{ amountMl, timestamp? }` |
| GET | `/api/users/:userId/intakes?date=YYYY-MM-DD` | Registros de um dia (padrão: hoje) |
| DELETE | `/api/users/:userId/intakes/:intakeId` | Remove um registro |
| GET | `/api/users/:userId/stats/today` | Total, %, doses, ml restantes, cronograma e próxima dose |
| GET | `/api/users/:userId/stats/history?days=7\|30` | Série diária para os gráficos |
| GET | `/api/users/:userId/stats/summary` | Streak, melhor streak, média, melhor dia, mês (heatmap), badges |

Validações: nome com 2–40 caracteres, `amountMl` entre 1 e 2000, meta entre 500 e 10000 ml, doses entre 1 e 24, janela `HH:MM` com o fim depois do início. O rate limit padrão é de 120 req/min por IP (`RATE_LIMIT_PER_MINUTE`).

**Próxima dose:** a meta é dividida em `dosesPerDay` porções, distribuídas igualmente entre o início e o fim da janela. A próxima dose é o primeiro horário cujo volume acumulado ainda não foi coberto. Se esse horário já passou, o app sugere "agora".

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `DB_DRIVER` | `cosmos` se houver `COSMOS_ENDPOINT`, senão `memory` | `memory` ou `cosmos` |
| `COSMOS_ENDPOINT` | — | URI da conta Cosmos |
| `COSMOS_KEY` | — | PRIMARY KEY da conta |
| `COSMOS_DATABASE` | `hidratamais` | Nome do banco |
| `PORT` | `8080` | Porta HTTP |
| `CORS_ORIGIN` | vazio (só a mesma origem) | Origens permitidas, separadas por vírgula, ou `*` |

As credenciais ficam só no `.env`, que está no `.gitignore`, ou nas configurações da nuvem. Nunca faça commit delas.

---

## Azure Cosmos DB com free tier (passo a passo)

O free tier dá **1000 RU/s e 25 GB grátis** para sempre. Só é permitida **uma conta free tier por assinatura**, e a opção precisa ser marcada **na criação** da conta (não dá para ligar depois).

1. Entre em **https://portal.azure.com** → **Criar um recurso** → pesquise **Azure Cosmos DB** → **Criar**.
2. Escolha **Azure Cosmos DB for NoSQL** → **Criar**.
3. Na aba **Básico**:
   - **Assinatura:** a sua.
   - **Grupo de recursos:** **Criar novo** → `rg-hidratamais`.
   - **Nome da conta:** um nome único, em minúsculas (ex.: `hidratamais-seunome`).
   - **Local:** `Brazil South` (ou a região mais próxima).
   - **Modo de capacidade:** **Taxa de transferência provisionada** (*Provisioned throughput*).
   - **Aplicar desconto do nível gratuito** (*Apply Free Tier Discount*): **Aplicar**. Se a opção não aparecer, outra conta da assinatura já usa o free tier.
   - **Limitar a taxa de transferência total da conta** (*Limit total account throughput*): deixe **marcado**. Isso trava a conta em 1000 RU/s e evita cobrança.
4. **Distribuição global:** redundância geográfica e gravações em várias regiões **desabilitadas**.
5. **Rede:** **Todas as redes** (o mais simples para Web App/OpenShift).
6. **Backup:** mantenha o padrão.
7. **Revisar + criar** → **Criar**. Leva uns 5 minutos.
8. Abra o recurso → menu **Configurações → Chaves** (*Keys*), aba **Chaves de leitura e gravação**:
   - **URI** → `COSMOS_ENDPOINT` (ex.: `https://hidratamais-seunome.documents.azure.com:443/`)
   - **CHAVE PRIMÁRIA** (*PRIMARY KEY*) → `COSMOS_KEY`
9. No seu `.env`:

   ```
   DB_DRIVER=cosmos
   COSMOS_ENDPOINT=<URI copiada>
   COSMOS_KEY=<PRIMARY KEY copiada>
   COSMOS_DATABASE=hidratamais
   ```

10. Suba o app (`npm run dev` ou `docker compose up`). No boot, `scripts/init-cosmos.js` cria o banco `hidratamais` com 400 RU/s compartilhados e os containers `users` (`/id`) e `intakes` (`/userId`), se ainda não existirem. Para rodar só o script: `npm run init:cosmos --prefix server`.
11. Confira em **Data Explorer**: o banco `hidratamais` aparece com os dois containers, e em **Scale** com 400 RU/s.

> Se o boot falhar com `Local Authorization is disabled`, a sua organização desligou o acesso por chave. Habilite-o na conta ou use uma assinatura pessoal.

---

## Publicação

> **Mac com Apple Silicon (M1/M2/M3…):** Azure e OpenShift rodam `linux/amd64`. Gere a imagem com `--platform linux/amd64`, como nos comandos abaixo. Uma imagem `arm64` não sobe lá.

### 1. Docker Hub

Crie a conta em https://hub.docker.com e troque `SEU_USUARIO` pelo seu usuário.

```bash
docker login
```

```bash
docker build --platform linux/amd64 -t hidratamais:1.0.0 .
```

```bash
docker tag hidratamais:1.0.0 SEU_USUARIO/hidratamais:1.0.0
docker tag hidratamais:1.0.0 SEU_USUARIO/hidratamais:latest
```

```bash
docker push SEU_USUARIO/hidratamais:1.0.0
docker push SEU_USUARIO/hidratamais:latest
```

A imagem fica pública por padrão em repositórios gratuitos: **https://hub.docker.com/r/SEU_USUARIO/hidratamais**.

Testes antes de publicar, incluindo um UID arbitrário como no OpenShift:

```bash
docker run --rm -p 8080:8080 --env-file .env SEU_USUARIO/hidratamais:1.0.0
```

```bash
docker run --rm --user 12345:0 -p 8080:8080 --env-file .env SEU_USUARIO/hidratamais:1.0.0
```

### 2. Azure Web App for Containers (Linux)

#### Pelo Portal

1. **Criar um recurso** → **Aplicativo Web** (*Web App*).
2. **Básico:** grupo `rg-hidratamais`, nome `hidratamais-seunome` (vira `https://hidratamais-seunome.azurewebsites.net`), **Publicar: Contêiner**, **Sistema operacional: Linux**, região `Brazil South`. No **Plano do Serviço de Aplicativo**, crie um novo com o SKU **F1 (Gratuito)** ou **B1**.
3. Aba **Contêiner:** **Origem da imagem: Outro registro de contêiner** (ou **Docker Hub**), **Tipo de acesso: Público**, servidor `https://index.docker.io`, **Imagem e marca:** `SEU_USUARIO/hidratamais:1.0.0`.
4. **Revisar + criar** → **Criar**.
5. Abra o Web App → **Configurações → Variáveis de ambiente** (*Environment variables*) → **Configurações de aplicativo** e adicione:
   `DB_DRIVER=cosmos`, `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE=hidratamais`, `WEBSITES_PORT=8080`. Clique em **Aplicar** e confirme.
6. Opcional: em **Monitoramento → Verificação de integridade** (*Health check*), use o caminho `/api/health`.
7. Em **Visão geral** → **Reiniciar** e abra a URL padrão.

#### Pela Azure CLI

```bash
az login
```

```bash
az group create --name rg-hidratamais --location brazilsouth
```

```bash
az appservice plan create --name plan-hidratamais --resource-group rg-hidratamais --is-linux --sku B1
```

```bash
az webapp create --resource-group rg-hidratamais --plan plan-hidratamais --name hidratamais-seunome --container-image-name docker.io/SEU_USUARIO/hidratamais:1.0.0
```

(Em versões antigas da CLI, o parâmetro chama `--deployment-container-image-name`.)

```bash
az webapp config appsettings set --resource-group rg-hidratamais --name hidratamais-seunome --settings DB_DRIVER=cosmos COSMOS_ENDPOINT="<URI>" COSMOS_KEY="<PRIMARY KEY>" COSMOS_DATABASE=hidratamais WEBSITES_PORT=8080
```

```bash
az webapp config set --resource-group rg-hidratamais --name hidratamais-seunome --generic-configurations '{"healthCheckPath": "/api/health"}'
```

```bash
az webapp restart --resource-group rg-hidratamais --name hidratamais-seunome
```

```bash
az webapp log tail --resource-group rg-hidratamais --name hidratamais-seunome
```

URL: `https://hidratamais-seunome.azurewebsites.net`. Para publicar uma nova versão, envie a nova tag ao Docker Hub e rode `az webapp config container set --resource-group rg-hidratamais --name hidratamais-seunome --container-image-name docker.io/SEU_USUARIO/hidratamais:1.0.1`.

### 3. Alternativa: Azure Container Apps

```bash
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

```bash
az containerapp env create --name env-hidratamais --resource-group rg-hidratamais --location brazilsouth
```

```bash
az containerapp create --name hidratamais --resource-group rg-hidratamais --environment env-hidratamais --image docker.io/SEU_USUARIO/hidratamais:1.0.0 --target-port 8080 --ingress external --min-replicas 0 --max-replicas 1 --cpu 0.25 --memory 0.5Gi --secrets cosmos-key="<PRIMARY KEY>" --env-vars DB_DRIVER=cosmos COSMOS_ENDPOINT="<URI>" COSMOS_DATABASE=hidratamais COSMOS_KEY=secretref:cosmos-key
```

```bash
az containerapp show --name hidratamais --resource-group rg-hidratamais --query properties.configuration.ingress.fqdn -o tsv
```

Com `--min-replicas 0`, a primeira requisição depois de um tempo parado demora alguns segundos (*cold start*).

### 4. Red Hat OpenShift (Developer Sandbox, gratuito)

#### Pré-requisitos

1. Crie a conta gratuita em **https://console.redhat.com/openshift/sandbox** e clique em **Launch** no card do Red Hat OpenShift. Você recebe um projeto pronto (algo como `seunome-dev`).
2. Instale a CLI `oc`. No console web, clique em **?** → **Command Line Tools** e baixe para o seu sistema. No Mac também dá para usar:

   ```bash
   brew install openshift-cli
   ```

3. Login: no console, clique no **seu nome (canto superior direito)** → **Copy login command** → **Display Token**. Copie a linha `oc login --token=sha256~... --server=https://api.sandbox-...:6443` e cole no terminal. O token é seu: não grave em arquivos do projeto.
4. Confira o projeto:

   ```bash
   oc project
   ```

#### Opção A: manifestos prontos (`openshift/`)

1. Crie o Secret a partir do seu `.env`, que precisa ter `DB_DRIVER=cosmos` e as credenciais:

   ```bash
   oc create secret generic hidratamais-secrets --from-env-file=.env
   ```

   Outra opção é copiar `openshift/secret.example.yaml` para `secret.yaml` (fora do git), preencher e aplicar com `oc apply -f secret.yaml`.

2. Em `openshift/deployment.yaml`, troque `SEU_USUARIO` pelo seu usuário do Docker Hub.
3. Aplique o Deployment, o Service e a Route. Não aplique a pasta inteira, porque o `secret.example.yaml` sobrescreveria o Secret real com valores fictícios:

   ```bash
   oc apply -f openshift/deployment.yaml -f openshift/service.yaml -f openshift/route.yaml
   ```

4. Pegue a URL pública (HTTPS, com redirecionamento de HTTP):

   ```bash
   oc get route hidratamais -o jsonpath='https://{.spec.host}{"\n"}'
   ```

O Deployment usa `containerPort: 8080`, variáveis via `envFrom` do Secret, readiness em `/api/health`, liveness em `/api/health?probe=liveness` e recursos de 50m CPU/128Mi (requests) e 250m CPU/256Mi (limits). Não há `securityContext` com UID fixo: o OpenShift atribui um UID aleatório, e a imagem já está preparada para isso.

#### Opção B: caminho rápido só com `oc`

```bash
oc new-app --image=docker.io/SEU_USUARIO/hidratamais:1.0.0 --name=hidratamais
```

```bash
oc create secret generic hidratamais-secrets --from-env-file=.env
```

```bash
oc set env deployment/hidratamais --from=secret/hidratamais-secrets
```

```bash
oc set probe deployment/hidratamais --readiness --liveness --get-url=http://:8080/api/health
```

```bash
oc set resources deployment/hidratamais --requests=cpu=50m,memory=128Mi --limits=cpu=250m,memory=256Mi
```

Para a URL, escolha **uma** das duas formas. HTTPS (recomendado):

```bash
oc create route edge hidratamais --service=hidratamais --insecure-policy=Redirect
```

Ou só HTTP:

```bash
oc expose service/hidratamais
```

#### Verificação e troubleshooting

```bash
oc get pods
```

```bash
oc logs -f deploy/hidratamais
```

```bash
oc describe pod <nome-do-pod>
```

```bash
oc get route
```

- `ImagePullBackOff`: o nome da imagem está errado, o repositório é privado ou a imagem foi gerada só para `arm64`.
- `CrashLoopBackOff` com "Falha ao inicializar o banco": confira `COSMOS_ENDPOINT` e `COSMOS_KEY` no Secret (`oc get secret hidratamais-secrets -o yaml`).
- Pod sem ficar *Ready*: `/api/health` está devolvendo 503 porque o Cosmos não responde. Veja os logs.

Atualizar a imagem:

```bash
oc rollout restart deploy/hidratamais
```

Esse comando puxa de novo a mesma tag (`imagePullPolicy: Always`). Para uma tag nova:

```bash
oc set image deployment/hidratamais hidratamais=docker.io/SEU_USUARIO/hidratamais:1.0.1
```

```bash
oc rollout status deploy/hidratamais
```

#### Lembretes do Sandbox

- A cota do namespace é pequena. Mantenha 1 réplica e os recursos modestos do manifesto.
- Os pods são **hibernados** (escalados a zero) depois de algumas horas, e a conta expira após um período (é possível renovar). Antes de tirar os prints, **acorde o app**:

  ```bash
  oc scale deploy/hidratamais --replicas=1
  ```

  Depois aguarde `oc get pods` mostrar `1/1 Running` e abra a URL da Route uma vez.

---

## Checklist de evidências

- [ ] **Docker Hub:** print da página do repositório mostrando a tag `1.0.0`, e a URL pública `https://hub.docker.com/r/SEU_USUARIO/hidratamais`.
- [ ] **Azure Cosmos DB:** print da conta com o **free tier** aplicado (Visão geral) e do **Data Explorer** mostrando o banco `hidratamais` com `users` e `intakes` (de preferência com alguns documentos).
- [ ] **Azure Web App** (se usar): prints da **Visão geral** com o status *Running* e a URL padrão, da tela de **Variáveis de ambiente** (com os valores ocultos) e do **Centro de implantação** mostrando a imagem do Docker Hub.
- [ ] **OpenShift** (se usar):
  - **Topology** com o círculo do pod azul (rodando);
  - **detalhes do Deployment** (`hidratamais`, imagem `docker.io/SEU_USUARIO/hidratamais:1.0.0`, 1 de 1 pod);
  - **Networking → Routes** com a URL pública `https://...apps.sandbox...`;
  - **aba Logs** do pod mostrando `HidrataMais ouvindo na porta 8080 (db: cosmos)`.
- [ ] **Site publicado:** URL (Azure ou OpenShift) aberta no navegador com o dashboard funcionando.
- [ ] Opcional: `https://<sua-url>/api/health` mostrando `{"status":"ok","db":"cosmos"}`.
