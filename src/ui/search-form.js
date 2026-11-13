import { toDatetimeLocal } from "../lib/format.js";

/** The trip form: where from, when, how far, how sunny. */
export class SearchForm {
  /** @type {(values: object) => void} */ onSubmit = () => {};
  /** @type {() => void} */ onLocate = () => {};

  #form;
  #els;

  constructor(form, formConfig) {
    this.#form = form;
    const find = (name) => form.querySelector(`[data-el="${name}"]`);
    this.#els = {
      place: find("place"), originLabel: find("origin-label"), start: find("start"),
      clouds: find("clouds"), cloudsValue: find("clouds-value"),
      submit: find("submit"), submitLabel: find("submit-label"), status: find("status"),
    };

    this.#renderChoices(find("drive-options"), "maxDriveHours", formConfig.driveHourOptions, formConfig.maxDriveHours);
    this.#renderChoices(find("stay-options"), "stayHours", formConfig.stayHourOptions, formConfig.stayHours);
    this.#setUpCloudSlider(formConfig);
    this.#setUpStartTime();

    this.#els.place.value = formConfig.from;
    find("locate").addEventListener("click", () => this.onLocate());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.onSubmit(this.values);
    });
  }

  get values() {
    const data = new FormData(this.#form);
    return {
      place: this.#els.place.value.trim(),
      start: new Date(this.#els.start.value),
      maxDriveHours: Number(data.get("maxDriveHours")),
      stayHours: Number(data.get("stayHours")),
      maxCloudPct: Number(this.#els.clouds.value),
    };
  }

  setPlace(text) {
    this.#els.place.value = text;
  }

  setOriginLabel(text) {
    this.#els.originLabel.textContent = text;
  }

  setStatus(message, { error = false } = {}) {
    this.#els.status.textContent = message;
    this.#els.status.classList.toggle("is-error", error);
  }

  setBusy(busy) {
    this.#els.submit.disabled = busy;
    this.#els.submit.classList.toggle("is-busy", busy);
    this.#els.submitLabel.textContent = busy ? "Searching" : "Find the sun";
  }

  /** A segmented control built from radio buttons. */
  #renderChoices(container, name, options, selected) {
    container.innerHTML = options.map((hours) => `
      <label class="seg-item">
        <input class="sr-only" type="radio" name="${name}" value="${hours}" ${hours === selected ? "checked" : ""} />
        <span>${hours}<small>h</small></span>
      </label>`).join("");
  }

  #setUpCloudSlider({ cloudRange, maxCloudPct }) {
    const { clouds, cloudsValue } = this.#els;
    Object.assign(clouds, { min: cloudRange.min, max: cloudRange.max, step: cloudRange.step, value: maxCloudPct });

    const sync = () => {
      const fill = ((clouds.value - clouds.min) / (clouds.max - clouds.min)) * 100;
      clouds.style.setProperty("--fill", `${fill}%`);
      cloudsValue.textContent = `≤ ${clouds.value}%`;
    };
    clouds.addEventListener("input", sync);
    sync();
  }

  /** Default to the next full hour; quick-pick chips jump to common times. */
  #setUpStartTime() {
    const nextHour = () => {
      const date = new Date();
      date.setHours(date.getHours() + 1, 0, 0, 0);
      return date;
    };
    const presets = {
      now: () => new Date(),
      "next-hour": nextHour,
      "tomorrow-9": () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(9, 0, 0, 0);
        return date;
      },
    };

    this.#els.start.value = toDatetimeLocal(nextHour());
    this.#form.querySelectorAll("[data-start-preset]").forEach((chip) => {
      chip.addEventListener("click", () => {
        this.#els.start.value = toDatetimeLocal(presets[chip.dataset.startPreset]());
      });
    });
  }
}
