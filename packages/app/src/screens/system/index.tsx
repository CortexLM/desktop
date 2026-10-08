import { Root, type ScreenDef } from "../../registry";
import { SearchScreen, CommandScreen } from "./search";
import { ProjectsScreen, ProjectScreen, MemoryScreen } from "./projects";
import { OnboardingScreen, LoginScreen, PricingScreen, ProfileScreen } from "./account";
import { ShortcutsScreen, OfflineScreen, ErrorScreen, UpdateScreen, AboutScreen } from "./misc";
import { SettingsScreen } from "./settings";
import { ComponentsScreen } from "./components";

const G = "system.group";
const V = (id: string, design?: string): [string, string, string?] => [id, `system.variant.${id}`, design];

export const SCREENS: ScreenDef[] = [
  { id: "search", name: "system.screen.search", mode: "Cortex", group: G, variants: [V("results", "resultats"), V("empty", "vide"), V("loading", "chargement"), V("recent", "recentes")], render: () => <SearchScreen /> },
  { id: "command", name: "system.screen.command", mode: "Cortex", group: G, variants: [V("open", "ouverte"), V("filtered", "filtree"), V("submenu", "sous-menu"), V("none", "aucun")], render: () => <CommandScreen /> },
  { id: "projects", name: "system.screen.projects", mode: "Cortex", group: G, variants: [V("grid", "grille"), V("empty", "vide"), V("create", "creation")], render: () => <Root id="projects"><ProjectsScreen /></Root> },
  { id: "project", name: "system.screen.project", mode: "Cortex", group: G, variants: [V("overview", "apercu"), V("files", "fichiers"), V("instructions", "instructions"), V("sharing", "partage")], render: () => <Root id="project"><ProjectScreen /></Root> },
  { id: "memory", name: "system.screen.memory", mode: "Cortex", group: G, variants: [V("list", "liste"), V("off", "desactivee"), V("empty", "vide")], render: () => <MemoryScreen /> },
  { id: "onboarding", name: "system.screen.onboarding", mode: "Cortex", group: G, variants: [["1", "system.variant.step1", "1"], ["2", "system.variant.step2", "2"], ["3", "system.variant.step3", "3"], ["4", "system.variant.step4", "4"]], render: () => <OnboardingScreen /> },
  { id: "login", name: "system.screen.login", mode: "Cortex", group: G, variants: [V("email", "email"), V("code", "code"), V("error", "erreur"), V("loading", "chargement"), V("locked", "bloque")], render: () => <Root id="login"><LoginScreen /></Root> },
  { id: "pricing", name: "system.screen.pricing", mode: "Cortex", group: G, variants: [V("plans", "offres"), V("compare", "comparatif"), V("payment", "paiement"), V("confirmed", "confirme")], render: () => <PricingScreen /> },
  { id: "profile", name: "system.screen.profile", mode: "Cortex", group: G, variants: [V("profile", "profil"), V("security", "securite"), V("delete", "suppression")], render: () => <ProfileScreen /> },
  { id: "shortcuts", name: "system.screen.shortcuts", mode: "Cortex", group: G, render: () => <ShortcutsScreen /> },
  { id: "offline", name: "system.screen.offline", mode: "Cortex", group: G, variants: [V("offline", "hors-ligne"), V("reconnecting", "reconnexion"), V("restored", "retabli")], render: () => <OfflineScreen /> },
  { id: "error", name: "system.screen.error", mode: "Cortex", group: G, variants: [["500", "system.variant.e500", "500"], V("maintenance", "maintenance"), V("session", "session"), ["403", "system.variant.e403", "403"]], render: () => <Root id="error"><ErrorScreen /></Root> },
  { id: "update", name: "system.screen.update", mode: "Cortex", group: G, variants: [V("available", "disponible"), V("downloading", "telechargement"), V("ready", "prete")], render: () => <UpdateScreen /> },
  { id: "about", name: "system.screen.about", mode: "Cortex", group: G, render: () => <AboutScreen /> },
  // Design shots: settings (Général), settings-apparence, settings-raccourcis, settings-compte — produced by clicking the section.
  { id: "settings", name: "system.screen.settings", mode: "Cortex", group: G, variants: [
    V("general", "settings"), V("appearance", "settings-apparence"), V("providers"), V("connection"), V("bot"), V("notifications"), V("privacy"), V("shortcuts", "settings-raccourcis"), V("account", "settings-compte"),
  ], render: () => <SettingsScreen /> },
  { id: "components", name: "system.screen.components", mode: "Cortex", group: G, render: () => <ComponentsScreen /> },
];
