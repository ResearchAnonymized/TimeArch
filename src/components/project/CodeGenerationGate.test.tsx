import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";
import CodeGenerationGate from "./CodeGenerationGate";

// Mock the Supabase client used by the gate. The gate queries stage_approvals
// for stage=15 with a JSON comment containing `package_locked: true`.
const limitMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: (...args: unknown[]) => limitMock(...args),
            }),
          }),
        }),
      }),
    }),
  },
}));

describe("CodeGenerationGate", () => {
  beforeEach(() => {
    limitMock.mockReset();
  });

  it("blocks code generation when the architecture package has not been sealed", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    render(
      <CodeGenerationGate projectId="proj-1" onGoToApproval={() => {}}>
        <div>Code Generation Workspace</div>
      </CodeGenerationGate>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Architecture Package not yet approved/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Go to Stage 15/i })).toBeInTheDocument();
    expect(screen.queryByText("Code Generation Workspace")).not.toBeInTheDocument();
  });

  it("renders children once a stage-15 approval carries package_locked: true", async () => {
    limitMock.mockResolvedValue({
      data: [{
        id: "approval-1",
        action: "locked",
        comment: JSON.stringify({ package_locked: true, signed_off_at: new Date().toISOString() }),
        created_at: new Date().toISOString(),
      }],
      error: null,
    });

    render(
      <CodeGenerationGate projectId="proj-1">
        <div>Code Generation Workspace</div>
      </CodeGenerationGate>,
    );

    await waitFor(() => {
      expect(screen.getByText("Code Generation Workspace")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Architecture Package not yet approved/i)).not.toBeInTheDocument();
  });

  it("treats a stage-15 lock without package_locked metadata as NOT sealed", async () => {
    limitMock.mockResolvedValue({
      data: [{ id: "a1", action: "locked", comment: null, created_at: new Date().toISOString() }],
      error: null,
    });
    render(
      <CodeGenerationGate projectId="proj-1" onGoToApproval={() => {}}>
        <div>Hidden</div>
      </CodeGenerationGate>,
    );
    await waitFor(() => {
      expect(screen.getByText(/Architecture Package not yet approved/i)).toBeInTheDocument();
    });
  });
});
