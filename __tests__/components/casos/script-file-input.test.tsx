/**
 * Tests for components/casos/script-file-input.tsx.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScriptFileInput } from "@/components/casos/script-file-input";

function makeFile(name: string, type = "text/typescript"): File {
  return new File(["content"], name, { type });
}

describe("ScriptFileInput", () => {
  it("renders the 'Seleccionar archivo' label and the help text", () => {
    render(<ScriptFileInput onChange={jest.fn()} />);
    expect(screen.getByText("Seleccionar archivo")).toBeInTheDocument();
    expect(screen.getByText(/Archivos permitidos:/)).toBeInTheDocument();
  });

  it("accepts a .spec.ts file and shows its name", async () => {
    const onChange = jest.fn();
    render(<ScriptFileInput onChange={onChange} />);

    const input = screen.getByLabelText("Seleccionar archivo");
    const file = makeFile("login.spec.ts");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("login.spec.ts")).toBeInTheDocument();
    });
    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("accepts a .test.ts file", () => {
    const onChange = jest.fn();
    render(<ScriptFileInput onChange={onChange} />);

    const input = screen.getByLabelText("Seleccionar archivo");
    const file = makeFile("flow.test.ts");
    fireEvent.change(input, { target: { files: [file] } });

    expect(onChange).toHaveBeenCalledWith(file);
    expect(screen.getByText("flow.test.ts")).toBeInTheDocument();
  });

  it("rejects a .ts file without spec/test suffix and shows a validation error", async () => {
    const onChange = jest.fn();
    render(<ScriptFileInput onChange={onChange} />);

    const input = screen.getByLabelText("Seleccionar archivo");
    fireEvent.change(input, { target: { files: [makeFile("utils.ts")] } });

    expect(
      await screen.findByText(/El archivo "utils\.ts" no es válido/),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("rejects a .txt file", async () => {
    const onChange = jest.fn();
    render(<ScriptFileInput onChange={onChange} />);

    const input = screen.getByLabelText("Seleccionar archivo");
    fireEvent.change(input, { target: { files: [makeFile("notes.txt")] } });

    expect(
      await screen.findByText(/El archivo "notes\.txt" no es válido/),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows the initial fileName when provided", () => {
    render(<ScriptFileInput fileName="uploaded.spec.ts" onChange={jest.fn()} />);
    expect(screen.getByText("uploaded.spec.ts")).toBeInTheDocument();
  });

  it("disables the input when disabled=true", () => {
    render(<ScriptFileInput disabled onChange={jest.fn()} />);
    const input = screen.getByLabelText("Seleccionar archivo");
    expect(input).toBeDisabled();
  });
});