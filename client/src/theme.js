// Chart colors that follow the active theme. SVG chart attributes can't
// use CSS variables, so charts call this at render time instead.
export function chartTheme() {
  const light = document.body.classList.contains("light");
  return {
    axis: light ? "#6f6f6f" : "#9a9a9a",
    grid: light ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)",
    panelBg: light ? "#ffffff" : "#000000",
    panelLine: light ? "#000000" : "#ffffff",
    // mirrors --accent / --accent2: orange leads in dark, blue in light
    strength: light ? "#1a6aff" : "#fb4b00",
    cardio: light ? "#c94000" : "#1a6aff",
  };
}
