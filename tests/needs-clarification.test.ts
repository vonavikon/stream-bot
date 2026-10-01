import { describe, it, expect } from "vitest";
import { needsClarification } from "../src/needs-clarification.js";

describe("needsClarification", () => {
  it("голая ссылка → true", () => {
    expect(needsClarification("https://theconsciousness.ai/")).toBe(true);
    expect(needsClarification("theconsciousness.ai")).toBe(true);
    expect(needsClarification("https://set.ki/post/mF2BxiN")).toBe(true);
    expect(needsClarification("youtu.be/fRbgzqjivk0")).toBe(true);
  });

  it("ссылка с пояснением → false", () => {
    expect(
      needsClarification("https://lowendbox.com - вот тут много дешевых vps")
    ).toBe(false);
  });

  it("маркер неопределённости → true", () => {
    expect(needsClarification("какой-то баг, ищу ещё")).toBe(true);
    expect(needsClarification("про то самое не забыть")).toBe(true);
    expect(needsClarification("не помню что хотел")).toBe(true);
  });

  it("обрывок без глагола → true", () => {
    expect(needsClarification("Качество звука аудио")).toBe(true);
    expect(needsClarification("Экономика продукта")).toBe(true);
  });

  it("ясная задача с глаголом → false", () => {
    expect(needsClarification("Изучить AI Guardrail")).toBe(false);
    expect(needsClarification("Скачать песню Runnin' Down A Dream")).toBe(false);
    expect(
      needsClarification("Починить затык с контекстом при нажатии")
    ).toBe(false);
    expect(
      needsClarification("Сделать анимацию прототипа для Selectel")
    ).toBe(false);
  });

  it("пустая строка → false", () => {
    expect(needsClarification("   ")).toBe(false);
  });
});
