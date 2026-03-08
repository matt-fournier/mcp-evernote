# SPEC — MCP Server pour Evernote

> Serveur MCP déployé comme Supabase Edge Function, permettant à un agent LLM (Claude)
> d'interagir avec Evernote : lire, créer, modifier et organiser des notes via des outils
> structurés, authentifiés et sûrs.

**Version :** 1.0.0-draft  
**Auteur :** OBLIQUES  
**Stack de référence :** [supabase-mcp-template](https://github.com/matt-fournier/supabase-mcp-template) · [effective-specs](https://github.com/matt-fournier/effective-specs)  
**API cible :** Evernote Cloud API v1 (OAuth 2.0 + ENML)

---

## Table des matières

1. [Objectif](#1-objectif)
2. [Tech Stack](#2-tech-stack)
3. [Commandes](#3-commandes)
4. [Structure du projet](#4-structure-du-projet)
5. [Style de code](#5-style-de-code)
6. [Git Workflow](#6-git-workflow)
7. [Frontières (Boundaries)](#7-frontières-boundaries)
8. [Outils MCP — Catalogue complet](#8-outils-mcp--catalogue-complet)
9. [Authentification](#9-authentification)
10. [Gestion des erreurs](#10-gestion-des-erreurs)
11. [Variables d'environnement](#11-variables-denvironnement)
12. [CORS](#12-cors)
13. [Tests](#13-tests)
14. [Déploiement](#14-déploiement)
15. [Critères de succès](#15-critères-de-succès)
16. [Plan d'implémentation par phases](#16-plan-dimplémentation-par-phases)
17. [Antipatterns à éviter](#17-antipatterns-à-éviter)

---

## 1. Objectif

Construire un serveur MCP qui expose les capacités d'Evernote à Claude, afin que l'agent puisse :

- Lire et rechercher dans les notes et carnets de l'utilisateur
- Créer et mettre à jour des notes (texte riche, tags, pièces jointes)
- Organiser les notes dans des carnets et avec des tags
- Effectuer une veille stratégique ou une gestion de connaissances entièrement pilotées par IA

**Utilisateur cible :** Mathias / OBLIQUES — consultants et knowledge workers utilisant Evernote comme base de connaissances et outil de veille stratégique (contexte Zettelkasten AI).

**Succès = ** Claude peut, en conversation naturelle, retrouver une note spécifique, en créer une à partir d'un résumé, ajouter des tags, et organiser un carnet — sans jamais ouvrir l'interface Evernote.

---

## 2. Tech Stack

| Composant | Choix | Version |
|-----------|-------|---------|
| Runtime | Deno (Supabase Edge Functions) | 1.40+ |
| SDK MCP | `@modelcontextprotocol/sdk` | latest |
| Transport | Streamable HTTP (stateless) | — |
| Validation | Zod | 3.x |
| API Evernote | Evernote Cloud API v1 (REST) | — |
| Auth MCP | API Key (`mcp_sk_...`) + Supabase JWT | via `_shared/mcp-auth/` |
| Auth Evernote | OAuth 2.0 (token stocké en secret Supabase) | — |
| Infra | Supabase Edge Functions | — |
| CI/CD | GitHub Actions | — |

---

## 3. Commandes

```bash
# Démarrage local
supabase start
supabase functions serve mcp-evernote --env-file supabase/.env.local

# Tests
deno test supabase/functions/mcp-evernote/tests/ --allow-net --allow-env

# Linting
deno lint supabase/functions/mcp-evernote/

# Formatage
deno fmt supabase/functions/mcp-evernote/

# Déploiement
supabase functions deploy mcp-evernote --no-verify-jwt

# Secrets
supabase secrets set EVERNOTE_ACCESS_TOKEN=...
supabase secrets set MCP_API_KEYS="claude-desktop:mcp_sk_XXXX"

# Validation manuelle (tools/list)
curl -X POST http://localhost:54321/functions/v1/mcp-evernote \
  -H "Authorization: Bearer mcp_sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## 4. Structure du projet

```
supabase/
├── functions/
│   ├── deno.json                        # Import map: @shared/ → ./_shared/
│   ├── _shared/
│   │   └── mcp-auth/
│   │       ├── mod.ts                   # authenticate(req) — point d'entrée
│   │       ├── api-key.ts               # Stratégie: mcp_sk_...
│   │       ├── supabase-jwt.ts          # Stratégie: JWT Supabase
│   │       └── types.ts                 # AuthIdentity, AuthResult
│   └── mcp-evernote/
│       ├── index.ts                     # Point d'entrée HTTP
│       ├── server.ts                    # Définition du serveur MCP
│       ├── auth.ts                      # Re-export de @shared/mcp-auth
│       ├── cors.ts                      # Headers CORS
│       ├── types.ts                     # Types partagés (EvernoteNote, etc.)
│       ├── evernote/
│       │   ├── client.ts                # Client HTTP Evernote (wrapper fetch)
│       │   ├── enml.ts                  # Helpers ENML → texte / texte → ENML
│       │   └── types.ts                 # Types Evernote (Note, Notebook, Tag...)
│       └── tools/
│           ├── index.ts                 # Re-export de tous les outils
│           ├── notes/
│           │   ├── search_notes.ts
│           │   ├── get_note.ts
│           │   ├── create_note.ts
│           │   ├── update_note.ts
│           │   └── delete_note.ts
│           ├── notebooks/
│           │   ├── list_notebooks.ts
│           │   ├── get_notebook.ts
│           │   └── create_notebook.ts
│           └── tags/
│               ├── list_tags.ts
│               └── tag_note.ts
├── .env.local                           # Secrets locaux (jamais commités)
└── config.toml                          # verify_jwt = false pour mcp-evernote
```

> **Convention :** chaque outil dans son propre fichier. Chaque dossier (`notes/`, `notebooks/`, `tags/`) correspond à un domaine fonctionnel Evernote.

---

## 5. Style de code

### Pattern d'outil (référence)

```typescript
// tools/notes/search_notes.ts
import { z } from "npm:zod";
import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";
import { evernoteClient } from "../../evernote/client.ts";
import type { McpTool, AuthIdentity } from "../../types.ts";

export const searchNotesTool: McpTool = {
  register(server: McpServer, identity: AuthIdentity) {
    server.tool(
      // Nom: verbe_objet en snake_case
      "search_notes",

      // Description exhaustive — critique pour que le LLM sache quand l'invoquer
      "Search Evernote notes using a full-text query. Returns matching note titles, " +
      "notebook names, tags, and creation dates. Use when the user wants to find " +
      "a specific note, look up past research, or check if a topic is already documented. " +
      "Does NOT return the full note content — use get_note for that.",

      // Schéma Zod avec descriptions
      {
        query: z.string().describe(
          "Full-text search query. Supports Evernote syntax: " +
          'notebook:\"My Notebook\" tag:research created:day-7'
        ),
        max_results: z.number().min(1).max(50).default(10).describe(
          "Maximum number of notes to return (default: 10, max: 50)"
        ),
        notebook_name: z.string().optional().describe(
          "Filter results to a specific notebook by name"
        ),
      },

      async ({ query, max_results, notebook_name }) => {
        try {
          const client = evernoteClient(identity);
          const results = await client.searchNotes({ query, max_results, notebook_name });

          return {
            content: [{
              type: "text",
              text: JSON.stringify(results, null, 2),
            }],
          };
        } catch (error) {
          console.error("[tool:search_notes]", error);
          return {
            content: [{
              type: "text",
              text: `Failed to search notes: ${(error as Error).message}`,
            }],
            isError: true,
          };
        }
      }
    );
  },
};
```

### Règles de nommage

| ✅ Bon | ❌ À éviter |
|--------|------------|
| `search_notes` | `findNotes` |
| `create_note` | `makeNote` |
| `list_notebooks` | `notebooks` |
| `tag_note` | `addTag` |

### Types partagés

```typescript
// types.ts
export interface AuthIdentity {
  id: string;
  email: string;
  role: string;
  method: "api_key" | "supabase_jwt" | "skip_auth";
}

export interface McpTool {
  register(server: McpServer, identity: AuthIdentity): void;
}

export interface EvernoteNote {
  guid: string;
  title: string;
  content?: string;           // Corps de note (texte extrait depuis ENML)
  contentRaw?: string;        // ENML brut (optionnel)
  notebookGuid: string;
  notebookName?: string;
  tagNames: string[];
  created: number;            // Unix timestamp ms
  updated: number;
  sourceUrl?: string;
}
```

---

## 6. Git Workflow

- **Branches :** `feat/nom-outil`, `fix/description`, `chore/description`
- **Commits :** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **PR :** toujours inclure un test curl de validation dans la description
- **Tags :** `v1.0.0`, `v1.1.0`, etc. (semver)

---

## 7. Frontières (Boundaries)

| Tier | Action |
|------|--------|
| ✅ **Toujours faire** | Valider tous les inputs avec Zod avant d'appeler l'API Evernote |
| ✅ **Toujours faire** | Logger les erreurs avec `console.error("[tool:nom]", error)` côté serveur |
| ✅ **Toujours faire** | Retourner des messages d'erreur lisibles au LLM (sans stack trace) |
| ✅ **Toujours faire** | Respecter la limite de résultats (jamais > 50 notes en une réponse) |
| ⚠️ **Demander d'abord** | Suppression de notes (`delete_note`) — toujours confirmer avec l'utilisateur |
| ⚠️ **Demander d'abord** | Création d'un nouveau carnet |
| ⚠️ **Demander d'abord** | Modification du titre ou du carnet d'une note existante |
| 🚫 **Jamais** | Exposer le token Evernote (`EVERNOTE_ACCESS_TOKEN`) dans une réponse |
| 🚫 **Jamais** | Retourner le contenu ENML brut au LLM (toujours convertir en texte) |
| 🚫 **Jamais** | Permettre l'accès sans authentification MCP valide |
| 🚫 **Jamais** | Supprimer un carnet entier (hors scope v1) |
| 🚫 **Jamais** | Créer des notes dans le carnet "Trash" |

---

## 8. Outils MCP — Catalogue complet

### Domaine : Notes

#### `search_notes`
**Quand :** L'utilisateur veut trouver des notes par contenu, titre ou tag.  
**Inputs :**
- `query` (string) — requête texte libre ou syntaxe Evernote
- `max_results` (number, défaut 10, max 50)
- `notebook_name` (string, optionnel) — filtre par carnet
- `tags` (string[], optionnel) — filtre par tag(s)
- `created_after` (string, optionnel) — date ISO (ex: "2024-01-01")

**Output :** Liste de notes avec `guid`, `title`, `notebookName`, `tagNames`, `created`, `updated`.  
**Ne retourne pas** le contenu complet — utiliser `get_note`.

---

#### `get_note`
**Quand :** L'utilisateur veut lire le contenu complet d'une note spécifique.  
**Inputs :**
- `guid` (string) — identifiant unique de la note (obtenu via `search_notes`)
- `include_content` (boolean, défaut true)
- `include_attachments_metadata` (boolean, défaut false)

**Output :** Note complète avec contenu converti en texte brut (ENML → plain text), tags, métadonnées.

**Note d'implémentation :** Utiliser le helper `enml.ts` pour convertir le contenu XML Evernote en texte lisible avant de retourner au LLM.

---

#### `create_note`
**Quand :** L'utilisateur veut créer une nouvelle note.  
**Inputs :**
- `title` (string, requis) — titre de la note
- `content` (string, requis) — corps en texte brut (converti automatiquement en ENML)
- `notebook_name` (string, optionnel) — carnet cible (défaut : carnet par défaut)
- `tags` (string[], optionnel) — tags à appliquer
- `source_url` (string, optionnel) — URL source si la note est issue d'un article

**Output :** `guid`, `title`, `notebookName`, `url` de la note créée.

**Note d'implémentation :** Envelopper le `content` dans un template ENML valide via `enml.ts`.

```typescript
// Template ENML minimal valide
const enml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note>${escapeXml(plainText)}</en-note>`;
```

---

#### `update_note`
**Quand :** L'utilisateur veut modifier le titre, le contenu ou les tags d'une note existante.  
**Inputs :**
- `guid` (string, requis) — identifiant de la note
- `title` (string, optionnel)
- `content` (string, optionnel) — texte brut (écrase le contenu existant)
- `append_content` (string, optionnel) — ajoute à la fin sans écraser
- `tags` (string[], optionnel) — remplace la liste de tags
- `add_tags` (string[], optionnel) — ajoute des tags sans retirer les existants

**Output :** Note mise à jour avec `guid`, `title`, `updated`.

**Règle :** Si `content` ET `append_content` sont fournis, retourner une erreur — ambiguïté intentionnelle évitée.

---

#### `delete_note`
**Quand :** L'utilisateur confirme explicitement vouloir supprimer une note.  
**Inputs :**
- `guid` (string, requis)
- `confirm` (boolean, requis) — doit être `true` pour exécuter

**Output :** Confirmation de suppression ou message d'erreur.

**Note :** Evernote déplace la note dans la Corbeille (soft delete). Une note supprimée via API peut être restaurée depuis l'interface Evernote.

---

### Domaine : Carnets (Notebooks)

#### `list_notebooks`
**Quand :** L'utilisateur veut voir la liste de ses carnets ou naviguer dans sa structure.  
**Inputs :** aucun  
**Output :** Liste de carnets avec `guid`, `name`, `noteCount` (si disponible), `isDefault`.

---

#### `get_notebook`
**Quand :** L'utilisateur veut les détails d'un carnet spécifique ou ses notes récentes.  
**Inputs :**
- `name` (string, optionnel) — nom du carnet
- `guid` (string, optionnel) — guid du carnet
- `include_recent_notes` (boolean, défaut false) — inclut les 5 notes les plus récentes

**Output :** Détails du carnet + optionnellement les notes récentes.

---

#### `create_notebook`
**Quand :** L'utilisateur demande explicitement un nouveau carnet.  
**Inputs :**
- `name` (string, requis)

**Output :** `guid`, `name` du carnet créé.

---

### Domaine : Tags

#### `list_tags`
**Quand :** L'utilisateur veut voir tous ses tags ou explorer l'organisation de sa base.  
**Inputs :** aucun  
**Output :** Liste de tags avec `guid`, `name`, `noteCount`.

---

#### `tag_note`
**Quand :** L'utilisateur veut ajouter ou retirer des tags d'une note sans modifier son contenu.  
**Inputs :**
- `guid` (string, requis) — guid de la note
- `add_tags` (string[], optionnel)
- `remove_tags` (string[], optionnel)

**Output :** Note mise à jour avec liste de tags finale.

---

### Tableau récapitulatif

| Outil | Domaine | Risque | Confirmation requise |
|-------|---------|--------|---------------------|
| `search_notes` | Notes | Lecture | Non |
| `get_note` | Notes | Lecture | Non |
| `create_note` | Notes | Écriture | Non |
| `update_note` | Notes | Écriture | Recommandée |
| `delete_note` | Notes | Destructif | **Oui (`confirm: true`)** |
| `list_notebooks` | Carnets | Lecture | Non |
| `get_notebook` | Carnets | Lecture | Non |
| `create_notebook` | Carnets | Écriture | Recommandée |
| `list_tags` | Tags | Lecture | Non |
| `tag_note` | Tags | Écriture | Non |

---

## 9. Authentification

### Architecture

Le module `_shared/mcp-auth/` centralise l'authentification (copié depuis le template). Le gateway Supabase est configuré avec `verify_jwt = false` — la validation JWT est entièrement dans le code.

### Token Evernote

L'accès à l'API Evernote se fait via un **OAuth 2.0 access token** stocké comme secret Supabase (`EVERNOTE_ACCESS_TOKEN`). Il n'est jamais exposé au client MCP.

```typescript
// evernote/client.ts
export function evernoteClient(identity: AuthIdentity) {
  const token = Deno.env.get("EVERNOTE_ACCESS_TOKEN");
  if (!token) throw new Error("EVERNOTE_ACCESS_TOKEN is not configured");

  const baseUrl = Deno.env.get("EVERNOTE_ENV") === "sandbox"
    ? "https://sandbox.evernote.com/v1"
    : "https://www.evernote.com/v1";

  return {
    async searchNotes(params: SearchParams) { /* ... */ },
    async getNote(guid: string) { /* ... */ },
    // etc.
  };
}
```

### Flux d'authentification

```
Requête HTTP → authenticate(req) [_shared/mcp-auth/]
    │
    ├─ SKIP_AUTH=true → DEV_IDENTITY (local seulement)
    ├─ Bearer mcp_sk_... → validateApiKey() vs MCP_API_KEYS
    └─ Bearer eyJ... → validateSupabaseJwt()
            │
            └─ Si succès → createMcpServer(identity) → tools
```

### `config.toml`

```toml
[functions.mcp-evernote]
verify_jwt = false
```

---

## 10. Gestion des erreurs

### Trois niveaux

```typescript
// Niveau 1 — Erreur métier (retournée au LLM pour qu'il s'adapte)
return {
  content: [{ type: "text", text: "Note not found: guid '...' does not exist." }],
  isError: true,
};

// Niveau 2 — Erreur inattendue (loggée, message générique au LLM)
catch (error) {
  console.error("[tool:create_note] Unexpected error:", error);
  return {
    content: [{ type: "text", text: "An unexpected error occurred creating the note." }],
    isError: true,
  };
}

// Niveau 3 — Auth (HTTP 401 avant la couche MCP)
if (!result.success) {
  return new Response(JSON.stringify({ error: result.error }), { status: result.status });
}
```

### Erreurs Evernote spécifiques à gérer

| Code API Evernote | Message retourné au LLM |
|-------------------|------------------------|
| `EDAMNotFoundException` | "Note not found: the specified guid does not exist." |
| `EDAMUserException: QUOTA_REACHED` | "Evernote upload quota reached for this month." |
| `EDAMUserException: LIMIT_REACHED` | "Note limit reached for this notebook." |
| `401 Unauthorized` | "Evernote authentication failed. The access token may have expired." |
| `429 Too Many Requests` | "Evernote rate limit reached. Please wait before retrying." |

---

## 11. Variables d'environnement

```bash
# Auto-injectées par Supabase
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Auth MCP (clients machine-to-machine)
MCP_API_KEYS="claude-desktop:mcp_sk_XXXX,cowork:mcp_sk_YYYY"

# Auth MCP (JWT Supabase — projets post-mai 2025)
SB_PUBLISHABLE_KEY=sb_publishable_XXXX

# Evernote
EVERNOTE_ACCESS_TOKEN=...        # OAuth 2.0 access token
EVERNOTE_ENV=production          # "sandbox" ou "production"

# Dev local uniquement
SKIP_AUTH=true
```

---

## 12. CORS

```typescript
// cors.ts
const ALLOWED_ORIGINS = [
  "https://claude.ai",
  "http://localhost:3000",
  "http://localhost:5173",
];
```

---

## 13. Tests

### Tests unitaires — par outil

```typescript
// tests/search_notes_test.ts
Deno.test("search_notes returns results for valid query", async () => {
  const response = await fetch("http://localhost:54321/functions/v1/mcp-evernote", {
    method: "POST",
    headers: {
      "Authorization": "Bearer TEST_TOKEN",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "search_notes", arguments: { query: "test", max_results: 5 } },
    }),
  });

  const data = await response.json();
  assertEquals(response.status, 200);
  assertEquals(data.result?.content?.[0]?.type, "text");
});
```

### Tests d'intégration — parcours utilisateur

| Scénario | Outils impliqués |
|----------|-----------------|
| "Retrouve mes notes sur le client XYZ" | `search_notes` → `get_note` |
| "Crée une note de réunion dans le carnet Clients" | `list_notebooks` → `create_note` |
| "Ajoute le tag #veille à cette note" | `search_notes` → `tag_note` |
| "Résume les 5 dernières notes du carnet Veille" | `get_notebook` → `get_note` × N |

### Tests ENML

Tester séparément le module `enml.ts` :
- Plain text → ENML valide
- ENML → Plain text lisible (pas de balises XML dans le résultat)
- Cas limites : caractères spéciaux, sauts de ligne, unicode

---

## 14. Déploiement

### Étapes

```bash
# 1. Générer une API key
openssl rand -hex 32
# → mcp_sk_<résultat>

# 2. Configurer les secrets
supabase secrets set MCP_API_KEYS="claude-desktop:mcp_sk_XXXX"
supabase secrets set EVERNOTE_ACCESS_TOKEN=<oauth_token>
supabase secrets set EVERNOTE_ENV=production
supabase secrets set SB_PUBLISHABLE_KEY=sb_publishable_XXXX

# 3. Déployer
supabase functions deploy mcp-evernote --no-verify-jwt

# 4. Valider
curl -X POST https://<project-ref>.supabase.co/functions/v1/mcp-evernote \
  -H "Authorization: Bearer mcp_sk_XXXX" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Configuration Claude Desktop / Cowork

```json
{
  "mcpServers": {
    "evernote": {
      "type": "http",
      "url": "https://<project-ref>.supabase.co/functions/v1/mcp-evernote",
      "headers": {
        "Authorization": "Bearer mcp_sk_XXXX"
      }
    }
  }
}
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy MCP Evernote
on:
  push:
    branches: [main]
    paths:
      - "supabase/functions/mcp-evernote/**"
      - "supabase/functions/_shared/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase functions deploy mcp-evernote --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} --no-verify-jwt
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

---

## 15. Critères de succès

| Critère | Mesure |
|---------|--------|
| `tools/list` retourne les 10 outils attendus | Test curl automatisé |
| `search_notes` répond en < 3 secondes | Test de performance |
| `create_note` crée une note lisible dans Evernote | Test d'intégration manuel |
| `delete_note` sans `confirm: true` retourne une erreur claire | Test unitaire |
| Aucun token Evernote n'apparaît dans les logs | Audit des logs Supabase |
| Claude peut retrouver une note par contenu partiel | Test de bout en bout |
| ENML → texte : aucune balise XML visible dans la réponse | Test unitaire `enml.ts` |

---

## 16. Plan d'implémentation par phases

### Phase 1 — Foundation (semaine 1)

**Objectif :** Infrastructure MCP opérationnelle, sans outils métier.

- [ ] Initialiser la structure de projet depuis le template
- [ ] Copier `_shared/mcp-auth/` et configurer `deno.json`
- [ ] Implémenter `index.ts`, `server.ts`, `auth.ts`, `cors.ts`
- [ ] Créer le client Evernote (`evernote/client.ts`) avec le helper `fetch`
- [ ] Implémenter le module ENML (`evernote/enml.ts`)
- [ ] Valider `tools/list` en local (0 outil)
- [ ] Configurer `config.toml` et déployer un shell vide

**Checkpoint :** `curl tools/list` retourne `{"tools":[]}` sans erreur.

### Phase 2 — Outils de lecture (semaine 2)

**Objectif :** Claude peut lire et chercher dans Evernote.

- [ ] `list_notebooks`
- [ ] `list_tags`
- [ ] `search_notes`
- [ ] `get_note`
- [ ] Tests unitaires pour chacun
- [ ] Test de bout en bout : "quelles sont mes notes sur [sujet] ?"

**Checkpoint :** Claude répond correctement à une recherche dans un vrai compte Evernote sandbox.

### Phase 3 — Outils d'écriture (semaine 3)

**Objectif :** Claude peut créer et organiser des notes.

- [ ] `create_note`
- [ ] `update_note`
- [ ] `tag_note`
- [ ] `get_notebook`
- [ ] `create_notebook`
- [ ] `delete_note` (avec `confirm: true`)
- [ ] Tests d'intégration des parcours complets

**Checkpoint :** Claude crée une note de réunion, l'ajoute au bon carnet, et lui applique les bons tags — tout via conversation naturelle.

### Phase 4 — Hardening (semaine 4)

**Objectif :** Prêt pour production.

- [ ] Gestion complète des erreurs Evernote (rate limiting, quota, auth expirée)
- [ ] Audit de sécurité (aucun token dans les logs)
- [ ] Performance : toutes les réponses < 5s
- [ ] Documentation `README.md` avec exemples curl
- [ ] Déploiement production + configuration Cowork/Claude Desktop
- [ ] CI/CD GitHub Actions actif

---

## 17. Antipatterns à éviter

| Antipattern | Pourquoi c'est un problème | Alternative |
|-------------|---------------------------|-------------|
| Retourner le ENML brut au LLM | Le LLM reçoit du XML illisible, génère des erreurs ou des réponses dégradées | Toujours passer par `enml.ts` avant de retourner |
| Un seul outil `manage_note` fourre-tout | Viole le principe "un outil = une action", le LLM ne sait pas quand l'utiliser | Outils séparés et spécialisés |
| Appeler l'API Evernote sans timeout | Une réponse lente peut bloquer la Edge Function jusqu'au timeout de 150s | `AbortController` avec timeout de 10s par appel |
| Cacher le token Evernote dans le code | Risque de fuite via logs, diff, ou erreur | Toujours via `Deno.env.get("EVERNOTE_ACCESS_TOKEN")` |
| Charger toutes les notes sans pagination | Evernote peut avoir des milliers de notes — timeout ou OOM | Toujours respecter `max_results` avec un plafond dur à 50 |
| Enregistrer les outils à l'intérieur du handler de requête | Les outils sont ré-enregistrés à chaque appel → doublons MCP | Enregistrer une seule fois dans `createMcpServer()` |

---

*Document vivant — mettre à jour à chaque décision technique significative. Versionner avec le code.*