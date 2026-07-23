import type { AssignedApplication } from "@/types/application";

export const supportedLocales = ["sr-Latn", "en"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "sr-Latn";

export const localeDisplayNames: Record<SupportedLocale, string> = {
  "sr-Latn": "Srpski",
  en: "English",
};

export const browserLocales: Record<SupportedLocale, string> = {
  "sr-Latn": "sr-Latn-RS",
  en: "en-GB",
};

const englishTranslations = {
  "common.productName": "Internal Apps Platform",
  "common.shortProductName": "Internal Apps",
  "common.companyPortal": "Company Portal",
  "common.metaDescription": "Internal business applications portal",
  "common.loading": "Loading…",
  "common.comingSoon": "Coming soon",
  "language.label": "Language",
  "navigation.primary": "Primary navigation",
  "navigation.open": "Open navigation",
  "navigation.close": "Close navigation",
  "navigation.dashboard": "Dashboard",
  "navigation.applications": "Applications",
  "navigation.pageCommands": "Page commands",
  "navigation.pageNavigation": "Page navigation",
  "shell.loadingPortal": "Loading portal…",
  "shell.loadingApplications": "Loading applications…",
  "shell.applicationsUnavailable": "Applications are temporarily unavailable.",
  "shell.noApplications": "No applications assigned.",
  "shell.noRole": "No role assigned",
  "shell.logout": "Logout",
  "shell.loggingOut": "Logging out…",
  "login.instruction": "Sign in to continue.",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Login",
  "login.submitting": "Signing in…",
  "login.usernameRequired": "Username is required.",
  "login.passwordRequired": "Password is required.",
  "login.authenticationError": "Username or password is incorrect.",
  "login.genericError": "Login failed. Please try again.",
  "dashboard.title": "Dashboard",
  "dashboard.description": "Open the internal applications assigned to your account.",
  "dashboard.welcome": "Welcome back, {name}",
  "dashboard.availableApplications": "Your available internal applications",
  "dashboard.loadingApplications": "Loading applications…",
  "dashboard.applicationsError": "Applications could not be loaded. Please try again later.",
  "dashboard.emptyTitle": "No applications assigned",
  "dashboard.emptyDescription":
    "Your account does not currently have access to an internal application. Contact your administrator if you need access.",
  "dashboard.assignedApplications": "Assigned applications",
  "dashboard.openApplication": "Open application",
  "applications.vacation.name": "Vacation",
  "applications.vacation.description": "Vacation and absence management",
  "vacation.title": "Vacation",
  "vacation.description": "Vacation and absence management",
  "vacation.foundation": "Module foundation",
  "vacation.workspaceTitle": "Planned Vacation workspace",
  "vacation.workspaceDescription":
    "Employee and leave-management functions will be introduced in upcoming sprints using this shared business-page structure.",
  "vacation.noActions": "No actions available yet",
  "vacation.area": "Area",
  "vacation.purpose": "Purpose",
  "vacation.status": "Status",
  "vacation.upcoming": "Upcoming",
  "vacation.plannedAreasLabel": "Planned Vacation areas",
  "vacation.employees": "Employees",
  "vacation.employeesDescription": "Employee records and leave-related context.",
  "vacation.requests": "Requests",
  "vacation.requestsDescription": "Create, review, and approve absence requests.",
  "vacation.calendar": "Calendar",
  "vacation.calendarDescription": "Team availability and approved absence overview.",
  "vacation.configuration": "Configuration",
  "vacation.configurationDescription": "Vacation types and module settings.",
  "vacation.workspace.navigationLabel": "Vacation workspace navigation",
  "vacation.workspace.overview": "Overview",
  "vacation.workspace.employees": "Employees",
  "vacation.workspace.departments": "Departments",
  "vacation.workspace.leaveTypes": "Leave Types",
  "vacation.workspace.requests": "Requests",
  "vacation.workspace.calendar": "Calendar",
  "vacation.overview.heading": "Workspace overview",
  "vacation.overview.description":
    "Manage employee absence workflows from one shared workspace.",
  "vacation.overview.quickStatistics": "Quick statistics",
  "vacation.overview.employeeStatistics": "Employees",
  "vacation.overview.requestStatistics": "Leave requests",
  "vacation.overview.availabilityStatistics": "Team availability",
  "vacation.overview.statisticsPlaceholder": "Statistics will be available in a future sprint.",
  "vacation.overview.recentActivity": "Recent activity",
  "vacation.overview.activityPlaceholder":
    "Recent Vacation activity will appear here when workflows are implemented.",
  "vacation.overview.shortcuts": "Shortcuts",
  "vacation.overview.employeeShortcut": "Employee directory",
  "vacation.overview.employeeShortcutDescription":
    "Browse employees and filter them by department.",
  "vacation.overview.openEmployees": "Open Employees",
  "vacation.employees.title": "Employees",
  "vacation.employees.description":
    "Browse the employee directory used by Vacation workflows.",
  "vacation.employees.new": "New Employee",
  "vacation.employees.searchLabel": "Search employees",
  "vacation.employees.searchPlaceholder": "Search name, employee number, email…",
  "vacation.employees.departmentFilter": "Department",
  "vacation.employees.allDepartments": "All departments",
  "vacation.employees.refresh": "Refresh",
  "vacation.employees.refreshing": "Refreshing…",
  "vacation.employees.export": "Export",
  "vacation.employees.tableLabel": "Employee directory",
  "vacation.employees.employeeNumber": "Employee No.",
  "vacation.employees.name": "Name",
  "vacation.employees.department": "Department",
  "vacation.employees.email": "Email",
  "vacation.employees.status": "Status",
  "vacation.employees.active": "Active",
  "vacation.employees.inactive": "Inactive",
  "vacation.employees.loading": "Loading employees…",
  "vacation.employees.error":
    "Employees could not be loaded. Check the filters and try again.",
  "vacation.employees.departmentError":
    "Department filters are temporarily unavailable.",
  "vacation.employees.emptyTitle": "No employees found",
  "vacation.employees.emptyDescription":
    "No employees match the current search and department filter.",
  "vacation.employees.records": "Records: {count}",
  "vacation.employees.selected": "Selected: {name}",
  "vacation.employees.selectionHint":
    "Select a row to prepare it for the future details panel.",
  "vacation.employees.sortAscending": "Sort {column} ascending",
  "vacation.employees.sortDescending": "Sort {column} descending",
  "apiStatus.title": "API status",
  "apiStatus.status": "Status",
  "apiStatus.available": "Available",
  "apiStatus.environment": "Environment",
  "apiStatus.version": "Version",
  "apiStatus.unavailable":
    "The API is unavailable. Start it on the configured API base URL and refresh this page.",
} as const;

export type TranslationKey = keyof typeof englishTranslations;
export type TranslationDictionary = Record<TranslationKey, string>;
export type TranslationParameters = Record<string, string | number>;
export type Translate = (
  key: TranslationKey,
  parameters?: TranslationParameters,
) => string;

const serbianLatinTranslations: TranslationDictionary = {
  "common.productName": "Platforma internih aplikacija",
  "common.shortProductName": "Interne aplikacije",
  "common.companyPortal": "Kompanijski portal",
  "common.metaDescription": "Portal internih poslovnih aplikacija",
  "common.loading": "Učitavanje…",
  "common.comingSoon": "Uskoro",
  "language.label": "Jezik",
  "navigation.primary": "Glavna navigacija",
  "navigation.open": "Otvori navigaciju",
  "navigation.close": "Zatvori navigaciju",
  "navigation.dashboard": "Početna",
  "navigation.applications": "Aplikacije",
  "navigation.pageCommands": "Komande stranice",
  "navigation.pageNavigation": "Navigacija stranice",
  "shell.loadingPortal": "Učitavanje portala…",
  "shell.loadingApplications": "Učitavanje aplikacija…",
  "shell.applicationsUnavailable": "Aplikacije trenutno nisu dostupne.",
  "shell.noApplications": "Nema dodeljenih aplikacija.",
  "shell.noRole": "Uloga nije dodeljena",
  "shell.logout": "Odjava",
  "shell.loggingOut": "Odjava je u toku…",
  "login.instruction": "Prijavite se da biste nastavili.",
  "login.username": "Korisničko ime",
  "login.password": "Lozinka",
  "login.submit": "Prijava",
  "login.submitting": "Prijava je u toku…",
  "login.usernameRequired": "Korisničko ime je obavezno.",
  "login.passwordRequired": "Lozinka je obavezna.",
  "login.authenticationError": "Korisničko ime ili lozinka nisu ispravni.",
  "login.genericError": "Prijava nije uspela. Pokušajte ponovo.",
  "dashboard.title": "Početna",
  "dashboard.description": "Otvorite interne aplikacije dodeljene vašem nalogu.",
  "dashboard.welcome": "Dobro došli, {name}",
  "dashboard.availableApplications": "Vaše dostupne interne aplikacije",
  "dashboard.loadingApplications": "Učitavanje aplikacija…",
  "dashboard.applicationsError":
    "Aplikacije nije moguće učitati. Pokušajte ponovo kasnije.",
  "dashboard.emptyTitle": "Nema dodeljenih aplikacija",
  "dashboard.emptyDescription":
    "Vaš nalog trenutno nema pristup internim aplikacijama. Obratite se administratoru ako vam je potreban pristup.",
  "dashboard.assignedApplications": "Dostupne aplikacije",
  "dashboard.openApplication": "Otvori aplikaciju",
  "applications.vacation.name": "Odmori i odsustva",
  "applications.vacation.description":
    "Upravljanje godišnjim odmorima i drugim odsustvima",
  "vacation.title": "Odmori i odsustva",
  "vacation.description": "Upravljanje godišnjim odmorima i odsustvima",
  "vacation.foundation": "Osnova modula",
  "vacation.workspaceTitle": "Planirani radni prostor za odmore i odsustva",
  "vacation.workspaceDescription":
    "Funkcije za zaposlene i upravljanje odsustvima biće uvedene u narednim sprintovima kroz ovu zajedničku strukturu poslovnih stranica.",
  "vacation.noActions": "Akcije još nisu dostupne",
  "vacation.area": "Oblast",
  "vacation.purpose": "Namena",
  "vacation.status": "Status",
  "vacation.upcoming": "U pripremi",
  "vacation.plannedAreasLabel": "Planirane oblasti modula Odmori i odsustva",
  "vacation.employees": "Zaposleni",
  "vacation.employeesDescription":
    "Podaci o zaposlenima i informacije povezane sa odsustvima.",
  "vacation.requests": "Zahtevi",
  "vacation.requestsDescription":
    "Kreiranje, pregled i odobravanje zahteva za odsustvo.",
  "vacation.calendar": "Kalendar",
  "vacation.calendarDescription":
    "Pregled dostupnosti tima i odobrenih odsustava.",
  "vacation.configuration": "Podešavanja",
  "vacation.configurationDescription":
    "Vrste odmora i podešavanja modula.",
  "vacation.workspace.navigationLabel":
    "Navigacija radnog prostora Odmori i odsustva",
  "vacation.workspace.overview": "Pregled",
  "vacation.workspace.employees": "Zaposleni",
  "vacation.workspace.departments": "Organizacione jedinice",
  "vacation.workspace.leaveTypes": "Vrste odmora",
  "vacation.workspace.requests": "Zahtevi",
  "vacation.workspace.calendar": "Kalendar",
  "vacation.overview.heading": "Pregled radnog prostora",
  "vacation.overview.description":
    "Upravljajte procesima odsustava zaposlenih iz jednog zajedničkog radnog prostora.",
  "vacation.overview.quickStatistics": "Brza statistika",
  "vacation.overview.employeeStatistics": "Zaposleni",
  "vacation.overview.requestStatistics": "Zahtevi za odsustvo",
  "vacation.overview.availabilityStatistics": "Dostupnost tima",
  "vacation.overview.statisticsPlaceholder":
    "Statistika će biti dostupna u narednom sprintu.",
  "vacation.overview.recentActivity": "Nedavne aktivnosti",
  "vacation.overview.activityPlaceholder":
    "Nedavne aktivnosti modula Odmori i odsustva biće prikazane kada se uvedu poslovni procesi.",
  "vacation.overview.shortcuts": "Prečice",
  "vacation.overview.employeeShortcut": "Imenik zaposlenih",
  "vacation.overview.employeeShortcutDescription":
    "Pregledajte zaposlene i filtrirajte ih prema organizacionoj jedinici.",
  "vacation.overview.openEmployees": "Otvori Zaposlene",
  "vacation.employees.title": "Zaposleni",
  "vacation.employees.description":
    "Pregledajte imenik zaposlenih koji se koristi u procesima odsustava.",
  "vacation.employees.new": "Novi zaposleni",
  "vacation.employees.searchLabel": "Pretraga zaposlenih",
  "vacation.employees.searchPlaceholder":
    "Pretražite ime, broj zaposlenog, e-poštu…",
  "vacation.employees.departmentFilter": "Organizaciona jedinica",
  "vacation.employees.allDepartments": "Sve organizacione jedinice",
  "vacation.employees.refresh": "Osveži",
  "vacation.employees.refreshing": "Osvežavanje…",
  "vacation.employees.export": "Izvoz",
  "vacation.employees.tableLabel": "Imenik zaposlenih",
  "vacation.employees.employeeNumber": "Broj zaposlenog",
  "vacation.employees.name": "Ime i prezime",
  "vacation.employees.department": "Organizaciona jedinica",
  "vacation.employees.email": "E-pošta",
  "vacation.employees.status": "Status",
  "vacation.employees.active": "Aktivan",
  "vacation.employees.inactive": "Neaktivan",
  "vacation.employees.loading": "Učitavanje zaposlenih…",
  "vacation.employees.error":
    "Zaposlene nije moguće učitati. Proverite filtere i pokušajte ponovo.",
  "vacation.employees.departmentError":
    "Filter organizacionih jedinica trenutno nije dostupan.",
  "vacation.employees.emptyTitle": "Nema pronađenih zaposlenih",
  "vacation.employees.emptyDescription":
    "Nijedan zaposleni ne odgovara trenutnoj pretrazi i filteru organizacione jedinice.",
  "vacation.employees.records": "Zapisa: {count}",
  "vacation.employees.selected": "Izabrano: {name}",
  "vacation.employees.selectionHint":
    "Izaberite red da biste ga pripremili za budući panel sa detaljima.",
  "vacation.employees.sortAscending": "Sortiraj {column} rastuće",
  "vacation.employees.sortDescending": "Sortiraj {column} opadajuće",
  "apiStatus.title": "Status API-ja",
  "apiStatus.status": "Status",
  "apiStatus.available": "Dostupan",
  "apiStatus.environment": "Okruženje",
  "apiStatus.version": "Verzija",
  "apiStatus.unavailable":
    "API nije dostupan. Pokrenite ga na podešenoj osnovnoj adresi i osvežite stranicu.",
};

export const translations: Record<SupportedLocale, TranslationDictionary> = {
  "sr-Latn": serbianLatinTranslations,
  en: englishTranslations,
};

const applicationTranslationKeys: Partial<
  Record<
    string,
    {
      name: TranslationKey;
      description: TranslationKey;
    }
  >
> = {
  vacation: {
    name: "applications.vacation.name",
    description: "applications.vacation.description",
  },
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale);
}

export function localizeApplication(
  application: AssignedApplication,
  translate: Translate,
): AssignedApplication {
  const keys = applicationTranslationKeys[application.code];
  if (!keys) {
    return application;
  }

  return {
    ...application,
    name: translate(keys.name),
    description: translate(keys.description),
  };
}
