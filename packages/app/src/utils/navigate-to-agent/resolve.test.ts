import { describe, expect, it } from "vitest";
import {
  resolveAgentLink,
  resolveNavigateToAgent,
  type AgentLinkDeps,
  type AgentNavTarget,
  type NavigateToAgentDeps,
} from "@/utils/navigate-to-agent/resolve";
import type { NavigateToWorkspaceInput } from "@/stores/navigation-active-workspace-store";

const SERVER_ID = "server-1";
const WORKSPACE_ID = "workspace-1";
const AGENT_ID = "agent-1";

interface RecordedHostNav {
  route: string;
}

interface RecordedTabNav extends NavigateToWorkspaceInput {}

function createFakeNavigators(target: AgentNavTarget): {
  deps: NavigateToAgentDeps;
  hostNavigations: RecordedHostNav[];
  tabNavigations: RecordedTabNav[];
} {
  const hostNavigations: RecordedHostNav[] = [];
  const tabNavigations: RecordedTabNav[] = [];
  return {
    hostNavigations,
    tabNavigations,
    deps: {
      readAgentNavTarget: () => target,
      navigateToHostAgent: (route) => {
        hostNavigations.push({ route });
      },
      navigateToWorkspace: (input) => {
        tabNavigations.push(input);
        return `/h/${input.serverId}/workspace/${input.workspaceId}`;
      },
    },
  };
}

describe("resolveNavigateToAgent", () => {
  it("carries a request for a tab to the workspace navigation", () => {
    const { deps, tabNavigations } = createFakeNavigators({ agentWorkspaceId: WORKSPACE_ID });

    resolveNavigateToAgent({ serverId: SERVER_ID, agentId: AGENT_ID, asTab: true }, deps);

    expect(tabNavigations[0]).toMatchObject({ asTab: true });
  });

  it("opens the workspace tab carried by the agent's workspaceId", () => {
    const { deps, hostNavigations, tabNavigations } = createFakeNavigators({
      agentWorkspaceId: WORKSPACE_ID,
    });

    const route = resolveNavigateToAgent(
      { serverId: SERVER_ID, agentId: AGENT_ID, pin: true },
      deps,
    );

    expect(route).toBe("/h/server-1/workspace/workspace-1");
    expect(hostNavigations).toEqual([]);
    expect(tabNavigations).toEqual([
      {
        serverId: SERVER_ID,
        workspaceId: WORKSPACE_ID,
        target: { kind: "agent", agentId: AGENT_ID },
        pin: true,
      },
    ]);
  });

  it("uses the input workspaceId only when the store has no record", () => {
    const readTargets: { serverId: string; agentId: string }[] = [];
    const { deps, tabNavigations } = createFakeNavigators({ agentWorkspaceId: null });
    deps.readAgentNavTarget = (input) => {
      readTargets.push(input);
      return { agentWorkspaceId: null };
    };

    resolveNavigateToAgent(
      { serverId: SERVER_ID, agentId: AGENT_ID, workspaceId: WORKSPACE_ID },
      deps,
    );

    expect(readTargets).toEqual([{ serverId: SERVER_ID, agentId: AGENT_ID }]);
    expect(tabNavigations).toEqual([
      {
        serverId: SERVER_ID,
        workspaceId: WORKSPACE_ID,
        target: { kind: "agent", agentId: AGENT_ID },
        pin: undefined,
      },
    ]);
  });

  it("prefers the current agent workspace over a stale input workspace", () => {
    const { deps, tabNavigations } = createFakeNavigators({ agentWorkspaceId: "current" });
    resolveNavigateToAgent({ serverId: SERVER_ID, agentId: AGENT_ID, workspaceId: "stale" }, deps);
    expect(tabNavigations[0]?.workspaceId).toBe("current");
  });

  it("falls back to the host agent route when the agent has no workspaceId", () => {
    const { deps, hostNavigations, tabNavigations } = createFakeNavigators({
      agentWorkspaceId: null,
    });

    const route = resolveNavigateToAgent({ serverId: SERVER_ID, agentId: "missing-agent" }, deps);

    expect(route).toBe("/h/server-1/agent/missing-agent");
    expect(hostNavigations).toEqual([{ route: "/h/server-1/agent/missing-agent" }]);
    expect(tabNavigations).toEqual([]);
  });
});

describe("resolveAgentLink", () => {
  function createLinkDeps(known: boolean): {
    deps: AgentLinkDeps;
    navigations: { serverId: string; agentId: string }[];
  } {
    const navigations: { serverId: string; agentId: string }[] = [];
    return {
      navigations,
      deps: {
        isKnownAgent: () => known,
        navigateToAgent: (input) => {
          navigations.push({ serverId: input.serverId, agentId: input.agentId });
        },
      },
    };
  }

  it("navigates to the agent named by a paseo agent link", () => {
    const { deps, navigations } = createLinkDeps(true);

    expect(resolveAgentLink(`paseo://h/${SERVER_ID}/agent/${AGENT_ID}`, deps)).toBe(true);
    expect(navigations).toEqual([{ serverId: SERVER_ID, agentId: AGENT_ID }]);
  });

  it("consumes the link but does nothing for an agent the host doesn't know", () => {
    const { deps, navigations } = createLinkDeps(false);

    expect(resolveAgentLink(`paseo://h/${SERVER_ID}/agent/${AGENT_ID}`, deps)).toBe(true);
    expect(navigations).toEqual([]);
  });

  it("leaves malformed paseo links and other schemes to the caller", () => {
    const { deps, navigations } = createLinkDeps(true);

    for (const url of [
      `paseo://h/${SERVER_ID}/agent/`,
      `paseo://h/${SERVER_ID}/workspace/${WORKSPACE_ID}`,
      `paseo://h/${SERVER_ID}/agent/${AGENT_ID}/extra`,
      `paseo://h/${SERVER_ID}/agent/${AGENT_ID}?x=1`,
      `https://paseo.sh/h/${SERVER_ID}/agent/${AGENT_ID}`,
      "https://example.com",
    ]) {
      expect(resolveAgentLink(url, deps)).toBe(false);
    }
    expect(navigations).toEqual([]);
  });
});
