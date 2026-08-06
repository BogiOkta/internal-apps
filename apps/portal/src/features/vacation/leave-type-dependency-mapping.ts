import type {
  DependencyInspectorAction,
  DependencyInspectorGroup,
} from "@/components/dependency-inspector";
import type { TranslationKey } from "@/i18n/translations";
import type { DependencyInspection } from "@/types/dependency-inspection";

type Translate = (
  key: TranslationKey,
  parameters?: Record<string, string | number>,
) => string;

const statusOrder = ["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"] as const;

const statusLabelKeys: Record<
  (typeof statusOrder)[number],
  TranslationKey
> = {
  SUBMITTED: "vacation.leaveTypes.dependencyInspector.status.SUBMITTED",
  APPROVED: "vacation.leaveTypes.dependencyInspector.status.APPROVED",
  REJECTED: "vacation.leaveTypes.dependencyInspector.status.REJECTED",
  CANCELLED: "vacation.leaveTypes.dependencyInspector.status.CANCELLED",
};

export function toLeaveTypeDependencyGroups(
  inspection: DependencyInspection,
  t: Translate,
): DependencyInspectorGroup[] {
  return inspection.dependencies.map((group) => {
    if (group.code === "leave_requests") {
      const details = [...group.details]
        .sort(
          (left, right) =>
            statusOrder.indexOf(left.code as (typeof statusOrder)[number]) -
            statusOrder.indexOf(right.code as (typeof statusOrder)[number]),
        )
        .map((detail) => {
          const key =
            statusLabelKeys[detail.code as (typeof statusOrder)[number]];
          return {
            id: detail.code,
            label: key
              ? t(key, { count: detail.count })
              : `${detail.code}: ${detail.count}`,
          };
        });

      return {
        id: group.code,
        label: t("vacation.leaveTypes.dependencyInspector.leaveRequests", {
          count: group.count,
        }),
        details,
      };
    }

    if (group.code === "leave_balances") {
      return {
        id: group.code,
        label: t("vacation.leaveTypes.dependencyInspector.leaveBalances", {
          count: group.count,
        }),
      };
    }

    if (group.code === "leave_balance_entries") {
      return {
        id: group.code,
        label: t("vacation.leaveTypes.dependencyInspector.ledgerHistory", {
          count: group.count,
        }),
        note:
          group.navigation.kind === "none" &&
          group.navigation.infoCode === "historical_ledger_records"
            ? t("vacation.leaveTypes.dependencyInspector.historicalLedger")
            : undefined,
      };
    }

    return {
      id: group.code,
      label: `${group.code} (${group.count})`,
    };
  });
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

export function leaveTypeDependencyNavigationActions(
  inspection: DependencyInspection,
  options: {
    t: Translate;
    canManage: boolean;
    isActive: boolean;
    onOpen: (href: string) => void;
    onDeactivate: () => void;
  },
): DependencyInspectorAction[] {
  const actions: DependencyInspectorAction[] = [];

  for (const group of inspection.dependencies) {
    if (group.navigation.kind !== "portal_route" || !group.navigation.route) {
      continue;
    }

    const href = buildLeaveTypeDependencyHref(
      group.navigation.route,
      group.navigation.query,
    );

    if (group.code === "leave_requests") {
      actions.push({
        id: "open-leave-requests",
        label: options.t(
          "vacation.leaveTypes.dependencyInspector.openRequests",
        ),
        onClick: () => options.onOpen(href),
        variant: "primary",
      });
    }

    if (group.code === "leave_balances") {
      actions.push({
        id: "open-leave-balances",
        label: options.t(
          "vacation.leaveTypes.dependencyInspector.openBalances",
        ),
        onClick: () => options.onOpen(href),
      });
    }
  }

  if (options.canManage && options.isActive) {
    actions.push({
      id: "deactivate-leave-type",
      label: options.t("vacation.leaveTypes.dependencyInspector.deactivate"),
      onClick: options.onDeactivate,
    });
  }

  return actions;
}
