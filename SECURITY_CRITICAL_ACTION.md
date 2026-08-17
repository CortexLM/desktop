# Action Immédiate Requise - Sécurité Critique

## 🚨 RÉVOCATION DE CLÉ API OBLIGATOIRE

Une clé API OpenLux a été exposée dans le code source :

```
sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj
```

### Actions immédiates (< 24h)

1. **Se connecter à OpenLux** (https://openlux.ai)
2. **Révoquer la clé immédiatement** dans les paramètres API
3. **Générer une nouvelle clé API**
4. **Créer fichier `.env`** à la racine du projet :
   ```bash
   cp .env.example .env
   ```
5. **Ajouter la nouvelle clé** :
   ```bash
   # Dans .env
   OPENLUX_API_KEY=votre-nouvelle-cle-ici
   ```
6. **Vérifier que `.env` est dans `.gitignore`** ✅ (déjà fait)

### Pourquoi c'est critique

- ❌ Utilisation frauduleuse possible
- ❌ Coûts non contrôlés
- ❌ Accès non autorisé aux services IA
- ❌ Violation de sécurité

### Fichiers corrigés

Les fichiers suivants ont été sécurisés et nécessitent maintenant la variable d'environnement :
- `packages/test-harness/examples/test-grok.ts`
- `packages/test-harness/examples/custom-test.ts`

Sans le fichier `.env` avec la clé, ils afficheront :
```
Error: OPENLUX_API_KEY environment variable is required. Please set it in your .env file.
```

---

**NE PAS IGNORER CETTE ÉTAPE**
