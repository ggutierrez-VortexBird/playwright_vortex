import { render, screen, fireEvent } from "@testing-library/react";
import { GrabadorTopbar } from "@/components/grabador/grabador-topbar";
import type { GrabadorTopbarMeta } from "@/components/grabador/grabador-topbar";

const baseMeta: GrabadorTopbarMeta = {
  nombre: "Consulta de saldo",
  sesionShortId: "SES-A1B2",
  ambiente: "QA",
  navegador: "Chromium",
  credencialNombre: "usuario funcional",
};

describe("GrabadorTopbar", () => {
  it("renders the case name in a headline", () => {
    render(
      <GrabadorTopbar
        meta={baseMeta}
        onDescartar={jest.fn()}
        onDetener={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Consulta de saldo" }),
    ).toBeInTheDocument();
  });

  it("renders the meta line with session id, ambiente and credencial", () => {
    render(
      <GrabadorTopbar
        meta={baseMeta}
        onDescartar={jest.fn()}
        onDetener={jest.fn()}
      />,
    );
    expect(
      screen.getByText(/SES-A1B2 · Ambiente QA · Credencial: usuario funcional/),
    ).toBeInTheDocument();
  });

  it("falls back to 'Manual' when credencialNombre is empty", () => {
    render(
      <GrabadorTopbar
        meta={{ ...baseMeta, credencialNombre: "" }}
        onDescartar={jest.fn()}
        onDetener={jest.fn()}
      />,
    );
    expect(screen.getByText(/Credencial: Manual/)).toBeInTheDocument();
  });

  it("shows Entorno + Navegador chips", () => {
    render(
      <GrabadorTopbar
        meta={baseMeta}
        onDescartar={jest.fn()}
        onDetener={jest.fn()}
      />,
    );
    expect(screen.getByText("QA")).toBeInTheDocument();
    expect(screen.getByText("Chromium")).toBeInTheDocument();
  });

  it("invokes onDescartar when Descartar is clicked", () => {
    const onDescartar = jest.fn();
    render(
      <GrabadorTopbar
        meta={baseMeta}
        onDescartar={onDescartar}
        onDetener={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("topbar-descartar"));
    expect(onDescartar).toHaveBeenCalledTimes(1);
  });

  it("invokes onDetener when Detener y revisar is clicked", () => {
    const onDetener = jest.fn();
    render(
      <GrabadorTopbar
        meta={baseMeta}
        onDescartar={jest.fn()}
        onDetener={onDetener}
      />,
    );
    fireEvent.click(screen.getByTestId("topbar-detener"));
    expect(onDetener).toHaveBeenCalledTimes(1);
  });

  it("disables action buttons when actionsDisabled is true", () => {
    render(
      <GrabadorTopbar
        meta={baseMeta}
        onDescartar={jest.fn()}
        onDetener={jest.fn()}
        actionsDisabled
      />,
    );
    expect(screen.getByTestId("topbar-descartar")).toBeDisabled();
    expect(screen.getByTestId("topbar-detener")).toBeDisabled();
  });
});
