"use client";

import { useEffect, useRef, useState } from "react";

// Short, placeholder-length app-idea prompts that type out one after another.
const TYPED_IDEAS = [
  "AI-тренер англійської через голосові",
  "Трекер сну для людей з нічними змінами",
  "AI-щоденник мігрені та її тригерів",
  "Фінансовий календар для фрилансерів",
  "Тренажер IT-співбесід з мок-інтерв'ю",
  "Трекер спільних витрат для пар",
  "Трекер звичок для людей з ADHD",
  "AI-коуч харчування при IBS",
  "Pet health journal для ветеринара",
  "AI-тренер публічних виступів",
  "Трекер підписок: ловить зайві списання",
  "Планер сімейного меню під бюджет",
];

const TYPE_MS = 55; // per character while typing
const DELETE_MS = 28; // per character while deleting
const HOLD_MS = 1500; // pause on the full phrase
const GAP_MS = 420; // pause after clearing, before the next phrase

/**
 * Drives a typewriter-style placeholder string: types an idea out character by
 * character, holds, deletes it, then moves to the next — cycling forever. A
 * steady cursor block is appended so it reads like a machine is typing.
 *
 * `active` should be false once the user has typed something, so the animation
 * never fights real input. The hook is purely cosmetic (returns a string).
 */
export function useTypedPlaceholder(active: boolean, phrases: string[] = TYPED_IDEAS): string {
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!active) {
      if (timer.current) clearTimeout(timer.current);
      setText("");
      return;
    }

    let phrase = 0;
    let chars = 0;
    let deleting = false;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const full = phrases[phrase] ?? "";

      if (!deleting) {
        chars++;
        setText(full.slice(0, chars));
        if (chars >= full.length) {
          deleting = true;
          timer.current = setTimeout(tick, HOLD_MS);
          return;
        }
        timer.current = setTimeout(tick, TYPE_MS);
        return;
      }

      chars--;
      setText(full.slice(0, Math.max(0, chars)));
      if (chars <= 0) {
        deleting = false;
        phrase = (phrase + 1) % phrases.length;
        timer.current = setTimeout(tick, GAP_MS);
        return;
      }
      timer.current = setTimeout(tick, DELETE_MS);
    };

    timer.current = setTimeout(tick, 350);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, phrases]);

  return active ? `${text}▌` : "";
}
