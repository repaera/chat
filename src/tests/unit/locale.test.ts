import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveUserLocale } from "@/lib/locale";

describe("resolveUserLocale", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns English for locale 'en'", async () => {
		const { locale, ui } = await resolveUserLocale("en");
		expect(locale).toBe("en");
		expect(ui.meta.htmlLang).toBe("en");
	});

	it("returns Bahasa Indonesia for locale 'id'", async () => {
		const { locale, ui } = await resolveUserLocale("id");
		expect(locale).toBe("id");
		expect(ui.meta.htmlLang).toBe("id");
	});

	it("returns Korean for locale 'kr'", async () => {
		const { locale } = await resolveUserLocale("kr");
		expect(locale).toBe("kr");
	});

	it("returns Japanese for locale 'jp'", async () => {
		const { locale } = await resolveUserLocale("jp");
		expect(locale).toBe("jp");
	});

	it("returns Spanish for locale 'es'", async () => {
		const { locale, ui } = await resolveUserLocale("es");
		expect(locale).toBe("es");
		expect(ui.meta.htmlLang).toBe("es");
	});

	it("returns Mandarin for locale 'zh'", async () => {
		const { locale, ui } = await resolveUserLocale("zh");
		expect(locale).toBe("zh");
		expect(ui.meta.htmlLang).toBe("zh");
	});

	it("returns German for locale 'de'", async () => {
		const { locale, ui } = await resolveUserLocale("de");
		expect(locale).toBe("de");
		expect(ui.meta.htmlLang).toBe("de");
	});

	it("returns Dutch for locale 'nl'", async () => {
		const { locale, ui } = await resolveUserLocale("nl");
		expect(locale).toBe("nl");
		expect(ui.meta.htmlLang).toBe("nl");
	});

	it("returns French for locale 'fr'", async () => {
		const { locale, ui } = await resolveUserLocale("fr");
		expect(locale).toBe("fr");
		expect(ui.meta.htmlLang).toBe("fr");
	});

	it("returns Italian for locale 'it'", async () => {
		const { locale, ui } = await resolveUserLocale("it");
		expect(locale).toBe("it");
		expect(ui.meta.htmlLang).toBe("it");
	});

	it("falls back to 'en' for an unknown locale key", async () => {
		const { locale } = await resolveUserLocale("xx");
		expect(locale).toBe("en");
	});

	it("falls back to 'en' when userLocale is null and APP_LOCALE is unset", async () => {
		vi.stubEnv("APP_LOCALE", "");
		const { locale } = await resolveUserLocale(null);
		expect(locale).toBe("en");
	});

	it("falls back to 'en' when userLocale is undefined", async () => {
		vi.stubEnv("APP_LOCALE", "");
		const { locale } = await resolveUserLocale(undefined);
		expect(locale).toBe("en");
	});

	it("honours APP_LOCALE env when userLocale is null", async () => {
		vi.stubEnv("APP_LOCALE", "id");
		const { locale } = await resolveUserLocale(null);
		expect(locale).toBe("id");
	});

	it("resolves locale key case-insensitively", async () => {
		const { locale } = await resolveUserLocale("ID");
		expect(locale).toBe("id");
	});

	it("exposes ui as a convenience shortcut to t.ui", async () => {
		const { t, ui } = await resolveUserLocale("en");
		expect(ui).toBe(t.ui);
	});
});
