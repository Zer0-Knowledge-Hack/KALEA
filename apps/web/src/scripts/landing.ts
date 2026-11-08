/**
 * Small progressive enhancements for the static landing (no framework): header hide-on-scroll and
 * mobile menu, reveal-on-scroll, count-up numbers, the merchant card spotlight and the magnetic CTA.
 */
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Header: solid once scrolled, hidden while scrolling down past the hero, always shown with the menu open.
const header = document.getElementById("site-nav");
const toggle = document.getElementById("nav-toggle");
const menu = document.getElementById("nav-menu");
if (header && toggle && menu) {
  let lastY = scrollY;
  let open = false;
  const setOpen = (next: boolean) => {
    open = next;
    toggle.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
    header.toggleAttribute("data-solid", open || scrollY > 24);
    if (open) header.classList.remove("nav-hidden");
  };
  const onScroll = () => {
    header.classList.toggle("nav-hidden", !open && scrollY > 240 && scrollY > lastY);
    header.toggleAttribute("data-solid", open || scrollY > 24);
    lastY = scrollY;
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toggle.addEventListener("click", () => setOpen(!open));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
}

// Count-up numbers, eased over 1.6 s once visible.
function countUp(el: HTMLElement) {
  const to = Number(el.dataset.count);
  const decimals = Number(el.dataset.decimals ?? 0);
  const suffix = el.dataset.suffix ?? "";
  const start = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - start) / 1600);
    el.textContent = `${(to * (1 - (1 - p) ** 3)).toFixed(decimals)}${suffix}`;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Reveal on scroll. `data-reveal-repeat` toggles both ways (how-it-works steps); others reveal once.
const observer = new IntersectionObserver(
  (entries) => {
    for (const { target, isIntersecting } of entries) {
      const el = target as HTMLElement;
      if (el.hasAttribute("data-count")) {
        if (isIntersecting) { observer.unobserve(el); if (!reduceMotion) countUp(el); }
        continue;
      }
      if (el.hasAttribute("data-reveal-repeat")) el.classList.toggle("in", isIntersecting);
      else if (isIntersecting) { el.classList.add("in"); observer.unobserve(el); }
    }
  },
  { threshold: 0.3 },
);
document.querySelectorAll<HTMLElement>("[data-reveal], [data-count]").forEach((el) => observer.observe(el));

// Merchant cards: a cursor-following spotlight through CSS variables.
document.querySelectorAll<HTMLElement>("[data-spotlight]").forEach((card) => {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--x", `${e.clientX - r.left}px`);
    card.style.setProperty("--y", `${e.clientY - r.top}px`);
  });
});

// CTA: the button leans toward the cursor.
if (!reduceMotion) {
  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.35}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    el.addEventListener("mouseleave", () => { el.style.transform = ""; });
  });
}
