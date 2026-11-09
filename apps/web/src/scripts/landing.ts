/**
 * Small progressive enhancements for the static landing (no framework): header hide-on-scroll and
 * mobile menu, reveal-on-scroll, count-up numbers, FAQ tabs and the magnetic CTA.
 */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Header: hidden while scrolling down past the hero, always shown with the menu open.
const header = document.getElementById('site-nav');
const toggle = document.getElementById('nav-toggle');
const menu = document.getElementById('nav-menu');
if (header && toggle && menu) {
  let lastY = scrollY;
  let open = false;
  const setOpen = (next: boolean) => {
    open = next;
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    if (open) header.classList.remove('nav-hidden');
  };
  const onScroll = () => {
    header.classList.toggle('nav-hidden', !open && scrollY > 240 && scrollY > lastY);
    lastY = scrollY;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toggle.addEventListener('click', () => setOpen(!open));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
}

// Language switcher: keep the reader's place. Anchors are identical across locales, so the link
// gets the id of the section currently in view (the last one whose top passed 35% of the viewport).
document.querySelectorAll<HTMLAnchorElement>('[data-locale-link]').forEach((link) => {
  link.addEventListener('click', () => {
    const inView = [...document.querySelectorAll<HTMLElement>('main section[id]')]
      .filter((s) => s.getBoundingClientRect().top <= innerHeight * 0.35)
      .pop();
    const url = new URL(link.href);
    url.hash = inView ? inView.id : '';
    link.href = url.href;
  });
});

// Count-up numbers, eased over 1.6 s once visible.
function countUp(el: HTMLElement) {
  const to = Number(el.dataset.count);
  const decimals = Number(el.dataset.decimals ?? 0);
  const suffix = el.dataset.suffix ?? '';
  const start = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - start) / 1600);
    el.textContent = `${(to * (1 - (1 - p) ** 3)).toFixed(decimals)}${suffix}`;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Reveal on scroll, once.
const observer = new IntersectionObserver(
  (entries) => {
    for (const { target, isIntersecting } of entries) {
      const el = target as HTMLElement;
      if (el.hasAttribute('data-count')) {
        if (isIntersecting) {
          observer.unobserve(el);
          if (!reduceMotion) countUp(el);
        }
        continue;
      }
      if (isIntersecting) {
        el.classList.add('in');
        observer.unobserve(el);
      }
    }
  },
  { threshold: 0.3 },
);
document
  .querySelectorAll<HTMLElement>('[data-reveal], [data-count]')
  .forEach((el) => observer.observe(el));

// FAQ tabs (WAI-ARIA tabs pattern). Without JavaScript every group stays visible with its heading.
document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((root) => {
  const list = root.querySelector<HTMLElement>('[data-tablist]');
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tablist] button')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-tabpanel]')];
  if (!list || !tabs.length || tabs.length !== panels.length) return;
  list.hidden = false;
  list.setAttribute('role', 'tablist');
  root.classList.add('tabs-on');
  const select = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, i) => {
    tab.setAttribute('role', 'tab');
    panels[i].setAttribute('role', 'tabpanel');
    panels[i].setAttribute('aria-labelledby', tab.id);
    panels[i].tabIndex = 0;
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (e) => {
      const last = tabs.length - 1;
      const next = (<Record<string, number>>{
        ArrowRight: i === last ? 0 : i + 1,
        ArrowLeft: i === 0 ? last : i - 1,
        Home: 0,
        End: last,
      })[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(next, true);
    });
  });
  select(0);
});

// CTA: the button leans toward the cursor.
if (!reduceMotion) {
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.35}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}
