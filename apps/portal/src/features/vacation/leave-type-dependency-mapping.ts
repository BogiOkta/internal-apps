import type {
  DependencyInspectorAction,
  DependencyInspectorItem,
} from "@/components/dependency-inspector";
import type { TranslationKey } from "@/i18n/translations";
import type { DependencyInspection } from "@/types/dependency-inspection";

type Translate = (
  key: TranslationKey,
  parameters?: Record<string, string | number>,
) => string;

const labelKeys: Record<string, TranslationKey> = {
  leave_requests: "vacation.leaveTypes.dependencyInspector.leaveRequests",
  leave_balances: "vacation.leaveTypes.dependencyInspector.leaveBalances",
  leave_balance_entries: "vacation.leaveTypes.dependencyInspector.ledgerEntries",
};

/**
 * Maps the platform dependency-inspection contract into domain-neutral
 * DependencyInspector rows. Vacation owns labels, counts, navigation targets,
 * and filter payloads; the shared component remains Vacation-agnostic.
 */
export function toLeaveTypeDependencyItems(
  inspection: DependencyInspection,
  options: {
    t: Translate;
    onNavigate: (href: string) => void;
  },
): DependencyInspectorItem[] {
  return inspection.dependencies.map((group) => {
    const labelKey = labelKeys[group.code];
    const label = labelKey ? options.t(labelKey) : group.code;
    const href =
      group.navigation.kind === "portal_route" && group.navigation.route
        ? buildLeaveTypeDependencyHref(
            group.navigation.route,
            group.navigation.query,
          )
        : null;

    return {
      id: group.code,
      label,
      count: group.count,
      onNavigate: href
        ? () => options.onNavigate(href)
        : undefined,
      note: leaveTypeDependencyNote(group.navigation, options.t),
    };
  });
}

function leaveTypeDependencyNote(
  navigation: DependencyInspection["dependencies"][number]["navigation"],
  t: Translate,
): string | undefined {
  if (navigation.kind !== "none") {
    return undefined;
  }

  if (navigation.infoCode === "historical_ledger_records") {
    return t("vacation.leaveTypes.dependencyInspector.historicalLedger");
  }

  if (navigation.infoCode === "multiple_leave_balance_scopes") {
    return t("vacation.leaveTypes.dependencyInspector.multipleLeaveBalances");
  }

  return undefined;
}

export function buildLeaveTypeDependencyHref(
  route: string,
  query?: Record<string, string> | null,
): string {
  if (!query || Object.keys(query).length === 0) {
    return route;
  }

  const params = new URLSearchParams(query);
  return `${route}?${params.toString()}`;
}

export function leaveTypeDependencySecondaryActions(options: {
  t: Translate;
  canManage: boolean;
  isActive: boolean;
  onDeactivate: () => void;
}): DependencyInspectorAction[] {
  if (!options.canManage || !options.isActive) {
    return [];
  }

  return [
    {
      id: "deactivate-leave-type",
      label: options.t("vacation.leaveTypes.dependencyInspector.deactivate"),
      onClick: options.onDeactivate,
    },
  ];
}
