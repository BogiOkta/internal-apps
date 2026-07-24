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
  "grid.filters": "active filters",
  "grid.showFilters": "Show filters",
  "grid.hideFilters": "Hide filters",
  "grid.clearFilters": "Clear filters",
  "grid.sortAscending": "Sort {column} ascending",
  "grid.sortDescending": "Sort {column} descending",
  "grid.clearSorting": "Clear sorting for {column}",
  "grid.export": "Export",
  "grid.exportExcel": "Export Excel",
  "grid.exportCsv": "Export CSV",
  "grid.noExportRows": "There are no displayed rows to export.",
  "grid.exportFailure": "The export could not be created.",
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
  "vacation.workspace.leaveTypes": "Leave types",
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
  "vacation.employees.exportSheet": "Employees",
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
  "vacation.employees.employeeNumberFilter": "Filter by employee number",
  "vacation.employees.nameFilter": "Filter by full name",
  "vacation.employees.emailFilter": "Filter by email",
  "vacation.employees.statusFilter": "Filter by status",
  "vacation.employees.allStatuses": "All statuses",
  "vacation.employees.details": "Employee details",
  "vacation.employees.edit": "Edit employee",
  "vacation.employees.activate": "Activate",
  "vacation.employees.deactivate": "Deactivate",
  "vacation.employees.selectForDetails": "Select an employee to view details.",
  "vacation.employees.firstName": "First name",
  "vacation.employees.lastName": "Last name",
  "vacation.employees.chooseDepartment": "Choose a department",
  "vacation.employees.initiallyActive": "Initially active",
  "vacation.employees.codeReadOnly": "The employee number cannot be changed after creation.",
  "vacation.employees.save": "Save",
  "vacation.employees.saving": "Saving…",
  "vacation.employees.cancel": "Cancel",
  "vacation.employees.validationRequired": "Complete all required fields with valid values.",
  "vacation.employees.duplicateNumber": "An employee with this employee number already exists.",
  "vacation.employees.duplicateEmail": "An employee with this email already exists.",
  "vacation.employees.invalidDepartment": "The selected department is not valid.",
  "vacation.employees.saveFailed": "The employee could not be saved.",
  "vacation.employees.createSuccess": "Employee created.",
  "vacation.employees.updateSuccess": "Employee updated.",
  "vacation.employees.activateSuccess": "Employee activated.",
  "vacation.employees.deactivateSuccess": "Employee deactivated.",
  "vacation.employees.activateConfirmation": "Activate this employee?",
  "vacation.employees.deactivateConfirmation": "Deactivate this employee? Historical references remain available.",
  "vacation.employees.confirm": "Confirm",
  "vacation.employees.sortAscending": "Sort {column} ascending",
  "vacation.employees.sortDescending": "Sort {column} descending",
  "vacation.leaveTypes.title": "Leave types",
  "vacation.leaveTypes.description":
    "Review the leave categories available to Vacation workflows.",
  "vacation.leaveTypes.searchLabel": "Search leave types",
  "vacation.leaveTypes.searchPlaceholder":
    "Search code, name, or description…",
  "vacation.leaveTypes.statusFilter": "Filter by status",
  "vacation.leaveTypes.filterAll": "All",
  "vacation.leaveTypes.filterActive": "Active",
  "vacation.leaveTypes.filterInactive": "Inactive",
  "vacation.leaveTypes.recordActive": "Active",
  "vacation.leaveTypes.recordInactive": "Inactive",
  "vacation.leaveTypes.sortByLabel": "Sort leave types by",
  "vacation.leaveTypes.sortDisplayOrder": "Display order",
  "vacation.leaveTypes.sortCode": "Code",
  "vacation.leaveTypes.sortName": "Name",
  "vacation.leaveTypes.sortStatus": "Status",
  "vacation.leaveTypes.sortDirectionLabel": "Sort direction",
  "vacation.leaveTypes.sortAscending": "Ascending",
  "vacation.leaveTypes.sortDescending": "Descending",
  "vacation.leaveTypes.refresh": "Refresh",
  "vacation.leaveTypes.refreshing": "Refreshing…",
  "vacation.leaveTypes.tableLabel": "Leave type list",
  "vacation.leaveTypes.code": "Code",
  "vacation.leaveTypes.name": "Name",
  "vacation.leaveTypes.balance": "Counts against balance",
  "vacation.leaveTypes.approval": "Approval required",
  "vacation.leaveTypes.status": "Status",
  "vacation.leaveTypes.codeFilter": "Filter by code",
  "vacation.leaveTypes.nameFilter": "Filter by localized name",
  "vacation.leaveTypes.balanceFilter": "Filter by balance behavior",
  "vacation.leaveTypes.approvalFilter": "Filter by approval requirement",
  "vacation.leaveTypes.displayOrderFilter": "Filter by exact display order",
  "vacation.leaveTypes.exportDescription": "Description",
  "vacation.leaveTypes.exportSheet": "Leave types",
  "vacation.leaveTypes.yes": "Yes",
  "vacation.leaveTypes.no": "No",
  "vacation.leaveTypes.loading": "Loading leave types…",
  "vacation.leaveTypes.error":
    "Leave types could not be loaded. Check the filters and try again.",
  "vacation.leaveTypes.emptyTitle": "No leave types found",
  "vacation.leaveTypes.emptyDescription":
    "No leave types match the current search and status filter.",
  "vacation.leaveTypes.records": "Records: {count}",
  "vacation.leaveTypes.selected": "Selected: {name}",
  "vacation.leaveTypes.selectionHint": "Select a row to view details.",
  "vacation.leaveTypes.selectRecord": "Select {name}",
  "vacation.leaveTypes.detailsLabel": "Selected leave type details",
  "vacation.leaveTypes.details": "Details",
  "vacation.leaveTypes.selectForDetails":
    "Select a leave type to view its details.",
  "vacation.leaveTypes.noDescription": "No description is available.",
  "vacation.leaveTypes.calendarColor": "Calendar color",
  "vacation.leaveTypes.notSet": "Not set",
  "vacation.leaveTypes.displayOrder": "Display order",
  "vacation.leaveTypes.new": "New leave type",
  "vacation.leaveTypes.edit": "Edit",
  "vacation.leaveTypes.save": "Save",
  "vacation.leaveTypes.saving": "Saving…",
  "vacation.leaveTypes.cancel": "Cancel",
  "vacation.leaveTypes.activate": "Activate",
  "vacation.leaveTypes.deactivate": "Deactivate",
  "vacation.leaveTypes.activating": "Activating…",
  "vacation.leaveTypes.deactivating": "Deactivating…",
  "vacation.leaveTypes.confirm": "Confirm",
  "vacation.leaveTypes.createTitle": "New leave type",
  "vacation.leaveTypes.editTitle": "Edit leave type",
  "vacation.leaveTypes.loadingDetails": "Loading…",
  "vacation.leaveTypes.loadDetailsFailed":
    "The complete leave type details could not be loaded.",
  "vacation.leaveTypes.duplicateCode":
    "A leave type with this code already exists.",
  "vacation.leaveTypes.forbidden":
    "You do not have permission to administer leave types.",
  "vacation.leaveTypes.saveFailed":
    "The leave type could not be saved. Review the values and try again.",
  "vacation.leaveTypes.stateChangeFailed":
    "The leave type status could not be changed.",
  "vacation.leaveTypes.createSuccess": "Leave type created.",
  "vacation.leaveTypes.updateSuccess": "Leave type updated.",
  "vacation.leaveTypes.activateSuccess": "Leave type activated.",
  "vacation.leaveTypes.deactivateSuccess": "Leave type deactivated.",
  "vacation.leaveTypes.activateConfirmation":
    "Activate this leave type for future use?",
  "vacation.leaveTypes.deactivateConfirmation":
    "Deactivate this leave type? Existing historical references are preserved.",
  "vacation.leaveTypes.form.code": "Code",
  "vacation.leaveTypes.form.codeGuidance":
    "Use uppercase letters, digits, and single underscores.",
  "vacation.leaveTypes.form.codeReadOnly":
    "The stable technical code cannot be changed after creation.",
  "vacation.leaveTypes.form.nameSr": "Serbian name",
  "vacation.leaveTypes.form.nameEn": "English name",
  "vacation.leaveTypes.form.descriptionSr":
    "Serbian description (optional)",
  "vacation.leaveTypes.form.descriptionEn":
    "English description (optional)",
  "vacation.leaveTypes.form.calendarColor": "Calendar color",
  "vacation.leaveTypes.form.calendarColorGuidance":
    "Optional hexadecimal color in #RRGGBB format.",
  "vacation.leaveTypes.form.displayOrder": "Display order",
  "vacation.leaveTypes.form.behavior": "Leave type behavior",
  "vacation.leaveTypes.form.countsAgainstBalance":
    "Counts against annual vacation balance",
  "vacation.leaveTypes.form.requiresApproval": "Requires approval",
  "vacation.leaveTypes.form.initiallyActive": "Initially active",
  "vacation.leaveTypes.validation.codeRequired": "Code is required.",
  "vacation.leaveTypes.validation.codeLength":
    "Code must not exceed 50 characters.",
  "vacation.leaveTypes.validation.codeFormat":
    "Use uppercase letters, digits, and single underscores only.",
  "vacation.leaveTypes.validation.nameSrRequired":
    "Serbian name is required.",
  "vacation.leaveTypes.validation.nameEnRequired":
    "English name is required.",
  "vacation.leaveTypes.validation.nameLength":
    "Name must not exceed 150 characters.",
  "vacation.leaveTypes.validation.descriptionLength":
    "Description must not exceed 500 characters.",
  "vacation.leaveTypes.validation.colorFormat":
    "Use a hexadecimal color in #RRGGBB format.",
  "vacation.leaveTypes.validation.displayOrder":
    "Display order must be a nonnegative whole number.",
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
  "grid.filters": "aktivnih filtera",
  "grid.showFilters": "Prikaži filtere",
  "grid.hideFilters": "Sakrij filtere",
  "grid.clearFilters": "Očisti filtere",
  "grid.sortAscending": "Sortiraj {column} rastuće",
  "grid.sortDescending": "Sortiraj {column} opadajuće",
  "grid.clearSorting": "Ukloni sortiranje za {column}",
  "grid.export": "Izvoz",
  "grid.exportExcel": "Izvezi Excel",
  "grid.exportCsv": "Izvezi CSV",
  "grid.noExportRows": "Nema prikazanih redova za izvoz.",
  "grid.exportFailure": "Izvoz nije moguće napraviti.",
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
  "vacation.workspace.leaveTypes": "Vrste odsustava",
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
  "vacation.employees.exportSheet": "Zaposleni",
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
  "vacation.employees.employeeNumberFilter": "Filtriraj po broju zaposlenog",
  "vacation.employees.nameFilter": "Filtriraj po imenu i prezimenu",
  "vacation.employees.emailFilter": "Filtriraj po e-adresi",
  "vacation.employees.statusFilter": "Filtriraj po statusu",
  "vacation.employees.allStatuses": "Svi statusi",
  "vacation.employees.details": "Detalji zaposlenog",
  "vacation.employees.edit": "Izmeni zaposlenog",
  "vacation.employees.activate": "Aktiviraj",
  "vacation.employees.deactivate": "Deaktiviraj",
  "vacation.employees.selectForDetails": "Izaberite zaposlenog da biste videli detalje.",
  "vacation.employees.firstName": "Ime",
  "vacation.employees.lastName": "Prezime",
  "vacation.employees.chooseDepartment": "Izaberite odeljenje",
  "vacation.employees.initiallyActive": "Odmah aktivan",
  "vacation.employees.codeReadOnly": "Broj zaposlenog se ne može menjati nakon kreiranja.",
  "vacation.employees.save": "Sačuvaj",
  "vacation.employees.saving": "Čuvanje…",
  "vacation.employees.cancel": "Otkaži",
  "vacation.employees.validationRequired": "Popunite sva obavezna polja ispravnim vrednostima.",
  "vacation.employees.duplicateNumber": "Zaposleni sa ovim brojem već postoji.",
  "vacation.employees.duplicateEmail": "Zaposleni sa ovom e-adresom već postoji.",
  "vacation.employees.invalidDepartment": "Izabrano odeljenje nije važeće.",
  "vacation.employees.saveFailed": "Zaposlenog nije moguće sačuvati.",
  "vacation.employees.createSuccess": "Zaposleni je kreiran.",
  "vacation.employees.updateSuccess": "Zaposleni je izmenjen.",
  "vacation.employees.activateSuccess": "Zaposleni je aktiviran.",
  "vacation.employees.deactivateSuccess": "Zaposleni je deaktiviran.",
  "vacation.employees.activateConfirmation": "Aktivirati ovog zaposlenog?",
  "vacation.employees.deactivateConfirmation": "Deaktivirati ovog zaposlenog? Istorijske reference ostaju dostupne.",
  "vacation.employees.confirm": "Potvrdi",
  "vacation.employees.sortAscending": "Sortiraj {column} rastuće",
  "vacation.employees.sortDescending": "Sortiraj {column} opadajuće",
  "vacation.leaveTypes.title": "Vrste odsustava",
  "vacation.leaveTypes.description":
    "Pregledajte vrste odsustava dostupne u procesima modula.",
  "vacation.leaveTypes.searchLabel": "Pretraga vrsta odsustava",
  "vacation.leaveTypes.searchPlaceholder":
    "Pretražite šifru, naziv ili opis…",
  "vacation.leaveTypes.statusFilter": "Filtriranje prema statusu",
  "vacation.leaveTypes.filterAll": "Sve",
  "vacation.leaveTypes.filterActive": "Aktivne",
  "vacation.leaveTypes.filterInactive": "Neaktivne",
  "vacation.leaveTypes.recordActive": "Aktivna",
  "vacation.leaveTypes.recordInactive": "Neaktivna",
  "vacation.leaveTypes.sortByLabel": "Sortiranje vrsta odsustava prema",
  "vacation.leaveTypes.sortDisplayOrder": "Redosledu prikaza",
  "vacation.leaveTypes.sortCode": "Šifri",
  "vacation.leaveTypes.sortName": "Nazivu",
  "vacation.leaveTypes.sortStatus": "Statusu",
  "vacation.leaveTypes.sortDirectionLabel": "Smer sortiranja",
  "vacation.leaveTypes.sortAscending": "Rastuće",
  "vacation.leaveTypes.sortDescending": "Opadajuće",
  "vacation.leaveTypes.refresh": "Osveži",
  "vacation.leaveTypes.refreshing": "Osvežavanje…",
  "vacation.leaveTypes.tableLabel": "Lista vrsta odsustava",
  "vacation.leaveTypes.code": "Šifra",
  "vacation.leaveTypes.name": "Naziv",
  "vacation.leaveTypes.balance": "Umanjuje saldo odmora",
  "vacation.leaveTypes.approval": "Potrebno odobrenje",
  "vacation.leaveTypes.status": "Status",
  "vacation.leaveTypes.codeFilter": "Filtriraj prema šifri",
  "vacation.leaveTypes.nameFilter": "Filtriraj prema lokalizovanom nazivu",
  "vacation.leaveTypes.balanceFilter": "Filtriraj prema umanjenju salda",
  "vacation.leaveTypes.approvalFilter": "Filtriraj prema obaveznom odobrenju",
  "vacation.leaveTypes.displayOrderFilter": "Filtriraj prema tačnom redosledu prikaza",
  "vacation.leaveTypes.exportDescription": "Opis",
  "vacation.leaveTypes.exportSheet": "Vrste odsustava",
  "vacation.leaveTypes.yes": "Da",
  "vacation.leaveTypes.no": "Ne",
  "vacation.leaveTypes.loading": "Učitavanje vrsta odsustava…",
  "vacation.leaveTypes.error":
    "Vrste odsustava nije moguće učitati. Proverite filtere i pokušajte ponovo.",
  "vacation.leaveTypes.emptyTitle": "Nema pronađenih vrsta odsustava",
  "vacation.leaveTypes.emptyDescription":
    "Nijedna vrsta odsustva ne odgovara trenutnoj pretrazi i filteru statusa.",
  "vacation.leaveTypes.records": "Zapisa: {count}",
  "vacation.leaveTypes.selected": "Izabrano: {name}",
  "vacation.leaveTypes.selectionHint":
    "Izaberite red za pregled detalja.",
  "vacation.leaveTypes.selectRecord": "Izaberi: {name}",
  "vacation.leaveTypes.detailsLabel": "Detalji izabrane vrste odsustva",
  "vacation.leaveTypes.details": "Detalji",
  "vacation.leaveTypes.selectForDetails":
    "Izaberite vrstu odsustva da biste pregledali detalje.",
  "vacation.leaveTypes.noDescription": "Opis nije unet.",
  "vacation.leaveTypes.calendarColor": "Boja u kalendaru",
  "vacation.leaveTypes.notSet": "Nije podešeno",
  "vacation.leaveTypes.displayOrder": "Redosled prikaza",
  "vacation.leaveTypes.new": "Nova vrsta",
  "vacation.leaveTypes.edit": "Izmeni",
  "vacation.leaveTypes.save": "Sačuvaj",
  "vacation.leaveTypes.saving": "Čuvanje…",
  "vacation.leaveTypes.cancel": "Otkaži",
  "vacation.leaveTypes.activate": "Aktiviraj",
  "vacation.leaveTypes.deactivate": "Deaktiviraj",
  "vacation.leaveTypes.activating": "Aktiviranje…",
  "vacation.leaveTypes.deactivating": "Deaktiviranje…",
  "vacation.leaveTypes.confirm": "Potvrdi",
  "vacation.leaveTypes.createTitle": "Nova vrsta odsustva",
  "vacation.leaveTypes.editTitle": "Izmena vrste odsustva",
  "vacation.leaveTypes.loadingDetails": "Učitavanje…",
  "vacation.leaveTypes.loadDetailsFailed":
    "Nije moguće učitati potpune podatke o vrsti odsustva.",
  "vacation.leaveTypes.duplicateCode":
    "Vrsta odsustva sa ovom šifrom već postoji.",
  "vacation.leaveTypes.forbidden":
    "Nemate dozvolu za upravljanje vrstama odsustava.",
  "vacation.leaveTypes.saveFailed":
    "Vrstu odsustva nije moguće sačuvati. Proverite podatke i pokušajte ponovo.",
  "vacation.leaveTypes.stateChangeFailed":
    "Status vrste odsustva nije moguće promeniti.",
  "vacation.leaveTypes.createSuccess": "Vrsta odsustva je kreirana.",
  "vacation.leaveTypes.updateSuccess": "Vrsta odsustva je izmenjena.",
  "vacation.leaveTypes.activateSuccess": "Vrsta odsustva je aktivirana.",
  "vacation.leaveTypes.deactivateSuccess": "Vrsta odsustva je deaktivirana.",
  "vacation.leaveTypes.activateConfirmation":
    "Aktivirati ovu vrstu odsustva za buduću upotrebu?",
  "vacation.leaveTypes.deactivateConfirmation":
    "Deaktivirati ovu vrstu odsustva? Postojeće istorijske reference ostaju sačuvane.",
  "vacation.leaveTypes.form.code": "Šifra",
  "vacation.leaveTypes.form.codeGuidance":
    "Koristite velika slova, cifre i pojedinačne donje crte.",
  "vacation.leaveTypes.form.codeReadOnly":
    "Stabilna tehnička šifra se ne može menjati nakon kreiranja.",
  "vacation.leaveTypes.form.nameSr": "Naziv na srpskom",
  "vacation.leaveTypes.form.nameEn": "Naziv na engleskom",
  "vacation.leaveTypes.form.descriptionSr": "Opis na srpskom (opciono)",
  "vacation.leaveTypes.form.descriptionEn": "Opis na engleskom (opciono)",
  "vacation.leaveTypes.form.calendarColor": "Boja u kalendaru",
  "vacation.leaveTypes.form.calendarColorGuidance":
    "Opciona heksadecimalna boja u formatu #RRGGBB.",
  "vacation.leaveTypes.form.displayOrder": "Redosled prikaza",
  "vacation.leaveTypes.form.behavior": "Ponašanje vrste odsustva",
  "vacation.leaveTypes.form.countsAgainstBalance":
    "Umanjuje saldo godišnjeg odmora",
  "vacation.leaveTypes.form.requiresApproval": "Potrebno odobrenje",
  "vacation.leaveTypes.form.initiallyActive": "Odmah aktivna",
  "vacation.leaveTypes.validation.codeRequired": "Šifra je obavezna.",
  "vacation.leaveTypes.validation.codeLength":
    "Šifra može imati najviše 50 znakova.",
  "vacation.leaveTypes.validation.codeFormat":
    "Koristite samo velika slova, cifre i pojedinačne donje crte.",
  "vacation.leaveTypes.validation.nameSrRequired":
    "Naziv na srpskom je obavezan.",
  "vacation.leaveTypes.validation.nameEnRequired":
    "Naziv na engleskom je obavezan.",
  "vacation.leaveTypes.validation.nameLength":
    "Naziv može imati najviše 150 znakova.",
  "vacation.leaveTypes.validation.descriptionLength":
    "Opis može imati najviše 500 znakova.",
  "vacation.leaveTypes.validation.colorFormat":
    "Koristite heksadecimalnu boju u formatu #RRGGBB.",
  "vacation.leaveTypes.validation.displayOrder":
    "Redosled prikaza mora biti ceo broj koji nije negativan.",
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
