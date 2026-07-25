import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "./LanguageContext";

function Probe() {
  const { t, toggleLanguage } = useLanguage();
  return <button onClick={toggleLanguage}>{t("navTools")}</button>;
}

describe("LanguageProvider", () => {
  beforeEach(() => localStorage.clear());

  it("switches language and persists the preference", () => {
    Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByRole("button")).toHaveTextContent("Tools");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("工具");
    expect(localStorage.getItem("imgskills-language")).toBe("zh");
  });
});
