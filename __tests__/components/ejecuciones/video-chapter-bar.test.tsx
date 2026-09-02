// __tests__/components/ejecuciones/video-chapter-bar.test.tsx
// HU-G18 — click-to-seek behavior del chapter bar

import { render, screen, fireEvent, act } from "@testing-library/react";
import { VideoChapterBar } from "@/components/ejecuciones/video-chapter-bar";

function makeVideoMock() {
  const video = document.createElement("video");
  // jsdom: stub methods we care about
  Object.defineProperty(video, "duration", { configurable: true, value: 10 });
  let currentTime = 0;
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (v) => {
      currentTime = v;
      video.dispatchEvent(new Event("timeupdate"));
    },
  });
  (video as unknown as { play: () => Promise<void> }).play = jest.fn(() => Promise.resolve());
  return { video, getCurrentTime: () => currentTime };
}

describe("VideoChapterBar", () => {
  it("renderiza un botón por paso con data-paso-id", () => {
    const { video } = makeVideoMock();
    const ref = { current: video };

    render(
      <VideoChapterBar
        pasos={[
          { id: "p1", numero: 1, descripcion: "Login", estado: "paso", duracionMs: 2000, videoInicioMs: 0, videoFinMs: 2000 },
          { id: "p2", numero: 2, descripcion: "Submit", estado: "paso", duracionMs: 3000, videoInicioMs: 2000, videoFinMs: 5000 },
        ]}
        videoDurationMs={5000}
        videoRef={ref}
      />,
    );

    const segments = screen.getAllByTestId("chapter-bar");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveAttribute("data-paso-id", "p1");
    expect(segments[1]).toHaveAttribute("data-paso-id", "p2");
  });

  it("click en un segmento hace seek al inicioMs del capítulo", () => {
    const { video, getCurrentTime } = makeVideoMock();
    const ref = { current: video };

    render(
      <VideoChapterBar
        pasos={[
          { id: "p1", numero: 1, descripcion: "Login", estado: "paso", duracionMs: 2000, videoInicioMs: 0, videoFinMs: 2000 },
          { id: "p2", numero: 2, descripcion: "Submit", estado: "paso", duracionMs: 3000, videoInicioMs: 2000, videoFinMs: 5000 },
        ]}
        videoDurationMs={5000}
        videoRef={ref}
      />,
    );

    const segments = screen.getAllByTestId("chapter-bar");
    fireEvent.click(segments[1]);

    // p2 starts at 2000ms = 2.0s
    expect(getCurrentTime()).toBe(2.0);
  });

  it("click llama video.play() (intenta reproducir)", () => {
    const { video } = makeVideoMock();
    const ref = { current: video };

    render(
      <VideoChapterBar
        pasos={[
          { id: "p1", numero: 1, descripcion: "X", estado: "paso", duracionMs: 1000, videoInicioMs: 0, videoFinMs: 1000 },
        ]}
        videoDurationMs={1000}
        videoRef={ref}
      />,
    );

    fireEvent.click(screen.getByTestId("chapter-bar"));
    expect(video.play).toHaveBeenCalled();
  });

  it("no renderiza nada si videoDurationMs es 0 y no hay timestamps", () => {
    const { video } = makeVideoMock();
    const ref = { current: video };

    const { container } = render(
      <VideoChapterBar
        pasos={[
          { id: "p1", numero: 1, descripcion: "X", estado: "paso", duracionMs: 1000, videoInicioMs: null, videoFinMs: null },
        ]}
        videoDurationMs={0}
        videoRef={ref}
      />,
    );

    expect(container.querySelector("[data-testid='video-chapter-bar']")).toBeNull();
    expect(container.querySelector("[data-testid='video-chapter-overlay']")).toBeNull();
  });

  it("renderiza el overlay 'Paso N · descripción' cuando hay segmento activo", () => {
    const { video } = makeVideoMock();
    const ref = { current: video };

    render(
      <VideoChapterBar
        pasos={[
          { id: "p1", numero: 1, descripcion: "Login", estado: "paso", duracionMs: 2000, videoInicioMs: 0, videoFinMs: 2000 },
          { id: "p2", numero: 2, descripcion: "Submit", estado: "fallo", duracionMs: 3000, videoInicioMs: 2000, videoFinMs: 5000 },
        ]}
        videoDurationMs={5000}
        videoRef={ref}
      />,
    );

    // Click p2 → seek to 2.0s → overlay should show "Paso 2 · Submit"
    const p2Btn = screen.getAllByTestId("chapter-bar")[1];
    act(() => {
      fireEvent.click(p2Btn);
    });

    const overlay = screen.getByTestId("video-chapter-overlay");
    expect(overlay.textContent).toContain("Paso 2");
    expect(overlay.textContent).toContain("Submit");
  });

  it("marca el segmento clickeado como active", () => {
    const { video } = makeVideoMock();
    const ref = { current: video };

    render(
      <VideoChapterBar
        pasos={[
          { id: "p1", numero: 1, descripcion: "A", estado: "paso", duracionMs: 1000, videoInicioMs: 0, videoFinMs: 1000 },
          { id: "p2", numero: 2, descripcion: "B", estado: "paso", duracionMs: 1000, videoInicioMs: 1000, videoFinMs: 2000 },
        ]}
        videoDurationMs={2000}
        videoRef={ref}
      />,
    );

    const [p1, p2] = screen.getAllByTestId("chapter-bar");
    fireEvent.click(p2);

    expect(p2).toHaveAttribute("data-active", "true");
    expect(p1).toHaveAttribute("data-active", "false");
  });
});