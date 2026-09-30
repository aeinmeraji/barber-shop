export type IconName =
  | 'scissors'
  | 'razor'
  | 'beard'
  | 'drop'
  | 'towels'
  | 'crown'
  | 'pin'
  | 'phone'
  | 'mail'
  | 'person'
  | 'briefcase'
  | 'instagram'
  | 'calendar'
  | 'document'
  | 'chevron-right'
  | 'arrow-right'
  | 'paper-plane'
  | 'menu'
  | 'close';

export interface Service {
  title: string;
  price: string;
  description: string;
  icon: IconName;
}

export const site = {
  name: 'Aein Barbers',
  tagline: 'More than a haircut',
  location: 'Downtown District, Main Street',
  locationLines: ['Downtown District', 'Main Street'],
  phone: '0915 880 6772',
  phoneHref: 'tel:+989158806772',
  email: 'acinmoraji2007@gmail.com',
  emailHref: 'mailto:acinmoraji2007@gmail.com',
};

/** Header links: left group + right link, logo sits in the middle. */
export const headerLeft = [
  { label: 'Home', href: '/#home', section: 'home', page: 'home' as const },
  { label: 'Services', href: '/#services', section: 'services', page: 'home' as const },
];

export const headerRight = { label: 'Barbers', href: '/barbers', page: 'barbers' as const };

/** Footer links — `Location` and `Contact` both jump to the location block. */
export const footerHome = [
  { label: 'Home', href: '/#home' },
  { label: 'Services', href: '/#services' },
  { label: 'Location', href: '/#location' },
  { label: 'Contact', href: '/#location' },
];

export const footerBarbers = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/#services' },
  { label: 'Barbers', href: '/barbers' },
  { label: 'Contact', href: '/#location' },
];

/** Six services exactly as listed on `first page p2`. */
export const services: Service[] = [
  {
    title: 'Classic Haircut',
    price: '$25',
    description: 'A timeless cut tailored to your style and face shape.',
    icon: 'scissors',
  },
  {
    title: 'Skin Fade',
    price: '$30',
    description: 'A clean, modern fade with sharp precision.',
    icon: 'razor',
  },
  {
    title: 'Beard Trim',
    price: '$18',
    description: 'Expert beard shaping for a clean, refined look.',
    icon: 'beard',
  },
  {
    title: 'Hair Wash & Styling',
    price: '$15',
    description: 'Refreshing wash with premium products and expert styling.',
    icon: 'drop',
  },
  {
    title: 'Hot Towel Shave',
    price: '$22',
    description: 'A traditional straight razor shave with hot towel treatment.',
    icon: 'towels',
  },
  {
    title: 'Full Grooming Package',
    price: '$55',
    description: 'Haircut, beard trim, hot towel shave and styling for the complete look.',
    icon: 'crown',
  },
];

/** Options for the two <select> fields of the application form. */
export const experienceOptions = [
  'Select experience',
  'Less than 1 year',
  '1 - 3 years',
  '3 - 5 years',
  '5 - 10 years',
  'More than 10 years',
];

export const workingDaysOptions = [
  'e.g. Monday - Friday, Weekends, Flexible...',
  'Monday - Friday',
  'Weekends only',
  'Thursday - Sunday',
  'Flexible / Full time',
];
