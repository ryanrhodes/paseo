import { router, type Href } from "expo-router";
import { navigateToWorkspace } from "@/stores/navigation-active-workspace-store";
import { useSessionStore } from "@/stores/session-store";
import { resolveAgentLink, resolveNavigateToAgent, type NavigateToAgentInput } from "./resolve";

export type { NavigateToAgentInput } from "./resolve";

export function navigateToAgent(input: NavigateToAgentInput): string {
  return resolveNavigateToAgent(input, {
    readAgentNavTarget: ({ serverId, agentId }) => {
      const session = useSessionStore.getState().sessions[serverId];
      const agent = session?.agents.get(agentId) ?? session?.agentDetails.get(agentId);
      return {
        agentWorkspaceId: agent?.workspaceId,
      };
    },
    navigateToHostAgent: (route) => {
      router.navigate(route as Href);
    },
    navigateToWorkspace,
  });
}

/** Opens a pressed `paseo://h/<serverId>/agent/<agentId>` link on that agent's tab. */
export function openAgentLink(url: string): boolean {
  return resolveAgentLink(url, {
    isKnownAgent: ({ serverId, agentId }) => {
      const session = useSessionStore.getState().sessions[serverId];
      return Boolean(session?.agents.has(agentId) || session?.agentDetails.has(agentId));
    },
    navigateToAgent,
  });
}
