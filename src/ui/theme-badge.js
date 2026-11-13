/**
 * Shows which theme the browser asked for. The theme itself is pure CSS
 * (`color-scheme` + `light-dark()`); this only keeps the little label in sync.
 */
export class ThemeBadge {
  #element;
  #query = window.matchMedia("(prefers-color-scheme: dark)");

  constructor(element) {
    this.#element = element;
    this.#query.addEventListener("change", () => this.#render());
    this.#render();
  }

  #render() {
    this.#element.textContent = `auto · ${this.#query.matches ? "dark" : "light"}`;
  }
}
