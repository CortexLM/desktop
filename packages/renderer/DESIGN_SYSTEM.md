# Cortex IDE Design System v3

Design system complet basé sur les tokens exacts du fichier Paper Cortex V3.

## 🎨 Tokens CSS

Tous les tokens sont définis dans `styles/tokens.css` et utilisent les valeurs exactes de Cortex V3.

### Couleurs

#### Light Mode
```css
--color-page: #FCFCFC          /* App background */
--color-wash: #F6F6F6          /* Sidebar/panel background */
--color-elevated: #FFFFFF       /* Cards, dialogs */
--color-text: #262626          /* Primary text */
--color-accent: #526FFF        /* Accent color */
--color-border: rgb(38 38 38 / 7%)
```

#### Dark Mode
```css
--color-page: #0D0D0E          /* App background */
--color-wash: #141415          /* Sidebar/panel background */
--color-elevated: #1C1C1D       /* Cards, dialogs */
--color-text: #F5F5F5          /* Primary text */
--color-accent: #7F8ED6        /* Desaturated accent */
--color-border: #252628        /* Solid border */
```

### Typographie

```css
--font-sans: Figtree           /* UI font */
--font-mono: JetBrains Mono    /* Code font */

--text-xs: 12px                /* Captions */
--text-sm: 13px                /* Default UI */
--text-base: 14px              /* Body text */
--text-lg: 16px                /* Emphasized */
--text-xl: 20px                /* Titles */
--text-2xl: 24px               /* Large display */
```

### Spacing

```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-6: 24px
--space-8: 32px
--space-12: 48px
--space-16: 64px
```

### Border Radius

```css
--radius-xs: 4px               /* Inner elements */
--radius-sm: 6px               /* Nav rows, small buttons */
--radius-md: 10px              /* Cards */
--radius-lg: 16px              /* Composer */
--radius-full: 9999px          /* Pills, round buttons */
```

## 🧩 Composants

### Button

```tsx
import { Button } from '@cortex-ide/renderer';

<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### Badge

```tsx
import { Badge } from '@cortex-ide/renderer';

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="outline">Outline</Badge>
```

### Input & Textarea

```tsx
import { Input, Textarea } from '@cortex-ide/renderer';

<Input placeholder="Enter text..." />
<Textarea placeholder="Enter long text..." />
```

### Select

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cortex-ide/renderer';

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
    <SelectItem value="2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

### Dialog

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@cortex-ide/renderer';

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Tabs

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@cortex-ide/renderer';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

### Tooltip

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cortex-ide/renderer';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>Hover me</TooltipTrigger>
    <TooltipContent>Tooltip text</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Accordion

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@cortex-ide/renderer';

<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>Item 1</AccordionTrigger>
    <AccordionContent>Content 1</AccordionContent>
  </AccordionItem>
</Accordion>
```

### Avatar

```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@cortex-ide/renderer';

<Avatar>
  <AvatarImage src="/avatar.jpg" alt="User" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>
```

### Progress & Spinner

```tsx
import { Progress, Spinner } from '@cortex-ide/renderer';

<Progress value={60} />
<Spinner size="md" />
```

### Checkbox

```tsx
import { Checkbox } from '@cortex-ide/renderer';

<Checkbox id="terms" />
<label htmlFor="terms">Accept terms</label>
```

## 🌓 Système de Thème

### Hook useTheme

```tsx
import { useTheme } from '@cortex-ide/renderer';

function MyComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  
  // theme: 'light' | 'dark' | 'system'
  // resolvedTheme: 'light' | 'dark'
  
  return (
    <button onClick={() => setTheme('dark')}>
      Mode sombre
    </button>
  );
}
```

### ThemeSwitcher Component

```tsx
import { ThemeSwitcher } from '@cortex-ide/renderer';

// Variant boutons (par défaut)
<ThemeSwitcher variant="buttons" />

// Variant dropdown
<ThemeSwitcher variant="dropdown" />
```

**Fonctionnalités:**
- ✅ Switch automatique selon préférence système
- ✅ Persistence dans localStorage
- ✅ Écoute des changements de préférence système en temps réel
- ✅ Application de la classe `.dark` sur `<html>`

## 🛠️ Utilities

### cn() - Class Merge

```tsx
import { cn } from '@cortex-ide/renderer';

// Merge classes avec precedence correcte
<div className={cn('base-class', active && 'active-class', className)} />
```

## 📦 Configuration Tailwind

Le fichier `tailwind.config.js` est configuré pour utiliser tous les tokens via CSS variables :

```js
theme: {
  extend: {
    colors: {
      page: 'var(--color-page)',
      text: 'var(--color-text)',
      accent: 'var(--color-accent)',
      // ... tous les tokens
    },
    spacing: {
      1: 'var(--space-1)',
      2: 'var(--space-2)',
      // ... tous les espacements
    },
    // ... typographie, radius, etc.
  }
}
```

## 🎯 Principes de Design

### Couleurs
- **Light mode**: Fond clair #FCFCFC, texte #262626
- **Dark mode**: Fond sombre #0D0D0E, texte #F5F5F5, accent désaturé
- **Bordures**: Alpha-based en light, solid en dark pour meilleur contraste

### Typographie
- **Figtree** pour l'interface (sans-serif moderne)
- **JetBrains Mono** pour le code (mono optimisé)
- **Tailles**: 12px (captions) à 24px (display)

### Spacing
- **Échelle 4px**: Progression naturelle 4, 8, 12, 16, 24, 32, 48, 64
- **Consistance**: Même espacement pour composants similaires

### Radius
- **xs (4px)**: Éléments internes
- **sm (6px)**: Rangées de navigation, petits boutons
- **md (10px)**: Cartes, banners
- **lg (16px)**: Composer, grandes surfaces
- **full**: Pills et boutons ronds

## ✨ Prochaines Étapes

Le design system est maintenant complet et prêt pour :
- ✅ Phase 2 : Intégration Monaco Editor
- ✅ Phase 3 : Git & Workspace UI
- ✅ Phase 4 : Agents IA UI
- ✅ Toutes les autres fonctionnalités de Cortex IDE

## 📚 Références

- **Source Design**: [Cortex V3 sur Paper](https://app.paper.design/file/01KZTAQN08GVBQGXVPPQ76BJND)
- **Radix UI**: Documentation complète sur [radix-ui.com](https://www.radix-ui.com)
- **Tailwind CSS**: Configuration et utilities sur [tailwindcss.com](https://tailwindcss.com)
