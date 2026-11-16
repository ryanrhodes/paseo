import { buildHostAgentDetailRoute, parseHostAgentRouteFromPathname } from "@/utils/host-routes";
import { normalizeWorkspaceOpaqueId } from "@/utils/workspace-identity";
import type { NavigateToWorkspaceInput } from "@/stores/navigation-active-workspace-store";

export interface NavigateToAgentInput {
  serverId: string;
  agentId: string;
  // Used as the workspace target when the agent is not yet in the session store
  // (cold deep-links). Otherwise the workspace is read from the store.
  workspaceId?: string | null;
  pin?: boolean;
  /** Opens the agent with its composer, where a compact layout would show a sheet without one. */
  asTab?: boolean;
}

export interface AgentNavTarget {
  agentWorkspaceId: string | null | undefined;
}

export interface NavigateToAgentDeps {
  readAgentNavTarget: (input: { serverId: string; agentId: string }) => AgentNavTarget;
  navigateToHostAgent: (route: string) => void;
  navigateToWorkspace: (input: NavigateToWorkspaceInput) => string;
}

export function resolveNavigateToAgent(
  input: NavigateToAgentInput,
  deps: NavigateToAgentDeps,
): string {
  const agentWorkspaceId =
    deps.readAgentNavTarget({ serverId: input.serverId, agentId: input.agentId })
      .agentWorkspaceId ?? input.workspaceId;
  const workspaceId = normalizeWorkspaceOpaqueId(agentWorkspaceId);

  if (!workspaceId) {
    const route = buildHostAgentDetailRoute(input.serverId, input.agentId);
    deps.navigateToHostAgent(route);
    return route;
  }

  return deps.navigateToWorkspace({
    serverId: input.serverId,
    workspaceId,
    target: { kind: "agent", agentId: input.agentId },
    pin: input.pin,
    asTab: input.asTab,
  });
}

export interface AgentLinkDeps {
  isKnownAgent: (input: { serverId: string; agentId: string }) => boolean;
  navigateToAgent: (input: NavigateToAgentInput) => unknown;
}

const AGENT_LINK = /^paseo:\/\/h\/[^/?#\s]+\/agent\/[^/?#\s]+$/;

/**
 * Handles a pressed `paseo://h/<serverId>/agent/<agentId>` link: navigates when the agent is known
 * on a host with a session, otherwise does nothing. Returns false for any other URL, which the
 * caller then handles as before.
 */
export function resolveAgentLink(url: string, deps: AgentLinkDeps): boolean {
  if (!AGENT_LINK.test(url)) return false;
  const route = parseHostAgentRouteFromPathname(url.slice("paseo:/".length));
  if (!route) return false;
  if (deps.isKnownAgent(route)) deps.navigateToAgent(route);
  return true;
}
