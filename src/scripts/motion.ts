/**
 * Motion layer: Lenis smooth scrolling wired into GSAP ScrollTrigger,
 * scroll reveals, gentle parallax, the glass nav state and the
 * mailto based application form.
 */
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAV_OFFSET = -110;

/* ------------------------------------------------------------------ *
 *  Smooth scrolling (Lenis) + ScrollTrigger sync
 * ------------------------------------------------------------------ */
const lenis = reduced
  ? null
  : new Lenis({ duration: 1.15, wheelMultiplier: 1, touchMultiplier: 1.5, smoothWheel: true });

if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

const scrollToId = (id: string) => {
  const target = document.getElementById(id);
  if (!target) return false;
  if (lenis) {
    lenis.scrollTo(target, { offset: NAV_OFFSET, duration: 1.4 });
  } else {
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY + NAV_OFFSET,
      behavior: 'smooth',
    });
  }
  return true;
};

document.querySelectorAll<HTMLAnchorElement>('a[href*="#"]').forEach((link) => {
  const href = link.getAttribute('href') ?? '';
  const id = href.split('#')[1];
  if (!id) return;

  link.addEventListener('click', (event) => {
    // Links such as "/#services" coming from the other page must navigate first.
    if (href.startsWith('/') && window.location.pathname !== '/') return;

    if (scrollToId(id)) {
      event.preventDefault();
      history.replaceState(null, '', `#${id}`);
    }
  });
});

/* ------------------------------------------------------------------ *
 *  Glass navigation state
 * ------------------------------------------------------------------ */
const bar = document.querySelector<HTMLElement>('[data-glass-bar]');
const setScrolled = () => {
  if (bar) bar.dataset.scrolled = window.scrollY > 24 ? 'true' : 'false';
};
setScrolled();
if (lenis) lenis.on('scroll', setScrolled);
window.addEventListener('scroll', setScrolled, { passive: true });

/* Mobile menu */
const toggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]');
const menu = document.querySelector<HTMLElement>('[data-nav-menu]');
toggle?.addEventListener('click', () => {
  if (!menu) return;
  const open = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !open);
  menu.classList.toggle('flex', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menu.classList.add('hidden');
    menu.classList.remove('flex');
    toggle?.setAttribute('aria-expanded', 'false');
  });
});

/* ------------------------------------------------------------------ *
 *  Reveals + parallax
 * ------------------------------------------------------------------ */
const reveals = gsap.utils.toArray<HTMLElement>('[data-reveal]');

try {
  if (reduced) {
    gsap.set(reveals, { clearProps: 'all' });
  } else {
    reveals.forEach((el) => {
      const delay = Number(el.dataset.revealDelay ?? 0);
      gsap.set(el, { y: 26 });
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.95,
        delay,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onComplete: () => gsap.set(el, { clearProps: 'transform' }),
      });
    });

    gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
      const amount = Number(el.dataset.parallax ?? 4);
      gsap.fromTo(
        el,
        { yPercent: -amount },
        {
          yPercent: amount,
          ease: 'none',
          scrollTrigger: {
            trigger: el.parentElement ?? el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      );
    });
  }
} catch (error) {
  // Never leave content hidden if the animation layer fails.
  console.error(error);
  gsap.set(reveals, { clearProps: 'all' });
}

/* ------------------------------------------------------------------ *
 *  Active navigation link follows the section in view (home page)
 * ------------------------------------------------------------------ */
const sectionLinks = document.querySelectorAll<HTMLAnchorElement>('[data-nav-section]');
const servicesSection = document.getElementById('services');

const activate = (section: string) => {
  sectionLinks.forEach((link) => {
    link.classList.toggle('is-active', link.dataset.navSection === section);
  });
};

if (sectionLinks.length && servicesSection) {
  ScrollTrigger.create({
    trigger: servicesSection,
    start: 'top 62%',
    end: 'bottom 45%',
    onEnter: () => activate('services'),
    onEnterBack: () => activate('services'),
    onLeaveBack: () => activate('home'),
  });
}

/* ------------------------------------------------------------------ *
 *  Barber application form — there is no backend, so the application is
 *  handed to the visitor's mail client (as the mockup promises).
 * ------------------------------------------------------------------ */
const form = document.querySelector<HTMLFormElement>('[data-application-form]');

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const labels: Record<string, string> = {
    name: 'Full Name',
    phone: 'Phone Number',
    email: 'Email Address',
    experience: 'Years of Experience',
    specialty: 'Specialty / Skills',
    instagram: 'Instagram / Portfolio',
    days: 'Preferred Working Days',
    intro: 'Short Introduction',
  };

  const data = new FormData(form);
  const lines: string[] = [];
  data.forEach((value, key) => {
    const text = String(value).trim();
    if (!text) return;
    lines.push(`${labels[key] ?? key}: ${text}`);
  });

  const mailto = form.dataset.mailto ?? '';
  const subject = encodeURIComponent(`Barber application — ${String(data.get('name') ?? '').trim()}`);
  const body = encodeURIComponent(lines.join('\n'));
  window.location.href = `mailto:${mailto}?subject=${subject}&body=${body}`;

  const note = document.querySelector<HTMLElement>('[data-form-note]');
  if (note) {
    note.textContent = 'Your mail app should now be open with your application ready to send. Thank you!';
  }
});
