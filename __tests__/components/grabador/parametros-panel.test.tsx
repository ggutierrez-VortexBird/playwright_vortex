/**
 * Tests for components/grabador/parametros-panel.tsx (HU-G7).
 */

import { render, screen } from "@testing-library/react";
import { ParametrosPanel } from "@/components/grabador/parametros-panel";

describe("ParametrosPanel (HU-G7)", () => {
  it("renders the panel header and an empty state when there are no params", () => {
    render(<ParametrosPanel parametros={[]} />);
    expect(screen.getByTestId("parametros-panel")).toBeInTheDocument();
    expect(screen.getByText("PARÁMETROS")).toBeInTheDocument();
    expect(screen.getByTestId("parametros-empty")).toBeInTheDocument();
    expect(screen.getByText(/Todavía no convertiste/)).toBeInTheDocument();
  });

  it("uses singular label when there is 1 param", () => {
    render(
      <ParametrosPanel
        parametros={[
          {
            id: "p1",
            nombre: "usuario",
            valorDefecto: "admin",
            origen: "manual",
            enUso: true,
          },
        ]}
      />,
    );
    expect(screen.getByText(/1 parámetro$/)).toBeInTheDocument();
  });

  it("uses plural label when there are >1 params", () => {
    render(
      <ParametrosPanel
        parametros={[
          {
            id: "p1",
            nombre: "usuario",
            valorDefecto: "admin",
            origen: "manual",
            enUso: true,
          },
          {
            id: "p2",
            nombre: "pwd",
            valorDefecto: "secret",
            origen: "credencial",
            enUso: true,
          },
        ]}
      />,
    );
    expect(screen.getByText(/2 parámetros/)).toBeInTheDocument();
  });

  it("renders a chip with {{nombre}} for each param", () => {
    render(
      <ParametrosPanel
        parametros={[
          {
            id: "p1",
            nombre: "usuario",
            valorDefecto: "admin",
            origen: "manual",
            enUso: true,
          },
        ]}
      />,
    );
    expect(screen.getByTestId("parametro-chip-usuario")).toHaveTextContent(
      "{{usuario}}",
    );
  });

  it("shows the plain valorDefecto for manual params", () => {
    render(
      <ParametrosPanel
        parametros={[
          {
            id: "p1",
            nombre: "usuario",
            valorDefecto: "admin@example.com",
            origen: "manual",
            enUso: true,
          },
        ]}
      />,
    );
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
  });

  it("shows a 'credencial' badge for origen=credencial", () => {
    render(
      <ParametrosPanel
        parametros={[
          {
            id: "p1",
            nombre: "pwd",
            valorDefecto: "supersecret",
            origen: "credencial",
            enUso: true,
          },
        ]}
      />,
    );
    expect(screen.getByText(/credencial/i)).toBeInTheDocument();
  });

  it("masks the value for credencial params (show last 4 chars)", () => {
    render(
      <ParametrosPanel
        parametros={[
          {
            id: "p1",
            nombre: "pwd",
            valorDefecto: "supersecret",
            origen: "credencial",
            enUso: true,
          },
        ]}
      />,
    );
    // 'supersecret' is 11 chars → 7 bullets + 'cret'
    const body = screen.getByTestId("parametros-panel-body");
    expect(body.textContent).toContain("cret");
    expect(body.textContent).toContain("•");
    expect(body.textContent).not.toContain("supersecret");
  });

  it("masks short credencial values entirely", () => {
    render(
      <ParametrosPanel
        parametros={[
          {
            id: "p1",
            nombre: "pwd",
            valorDefecto: "ab",
            origen: "credencial",
            enUso: true,
          },
        ]}
      />,
    );
    expect(screen.queryByText("ab")).not.toBeInTheDocument();
  });

  it("shows '—' when valorDefecto is null", () => {
    render(
      <ParametrosPanel
        parametros={[
          {
            id: "p1",
            nombre: "x",
            valorDefecto: null,
            origen: "manual",
            enUso: true,
          },
        ]}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows check_circle icon when enUso=true", () => {
    render(
      <ParametrosPanel
        parametros={[
          {
            id: "p1",
            nombre: "x",
            valorDefecto: "v",
            origen: "manual",
            enUso: true,
          },
        ]}
      />,
    );
    expect(screen.getByTestId("parametro-en-uso")).toBeInTheDocument();
  });

  it("does NOT show check_circle when enUso=false", () => {
    render(
      <ParametrosPanel
        parametros={[
          {
            id: "p1",
            nombre: "x",
            valorDefecto: "v",
            origen: "manual",
            enUso: false,
          },
        ]}
      />,
    );
    expect(screen.queryByTestId("parametro-en-uso")).not.toBeInTheDocument();
  });

  it("honors custom emptyMessage", () => {
    render(
      <ParametrosPanel
        parametros={[]}
        emptyMessage="Sin parámetros definidos aún"
      />,
    );
    expect(screen.getByText(/Sin parámetros/)).toBeInTheDocument();
  });
});
