import type { IconName } from "./components/icon";

/*
 * All landing-page content in one place. Layout and styling never hard-code copy — edit here.
 *
 * Photos are CC0 (rawpixel, see public/images/CREDITS.md). Names, prices, contact details and
 * copy below are DEMO data — swap in the real hotel's details before launch.
 */

export const brand = {
  name: "Nayel",
  fullName: "Hotel Nayel",
  tagline: "Where comfort meets tranquility.",
};

export const contact = {
  // Demo contact details (Cairo landline format) — replace with the hotel's real ones before launch.
  phone: "+20 2 2795 4410",
  phoneAlt: "+20 2 2795 4411",
  email: "stay@hotelnayel.com",
  addressLines: ["Nayel Hotel & Resort", "12 Corniche El Nil", "Garden City, Cairo", "Egypt"],
  topBarAddress: "12 Corniche El Nil, Cairo, Egypt",
};

// `href: ""` renders the icon without a link (no dead "#" jump) until the real profile URL is known.
export type Social = { name: "instagram" | "facebook" | "tiktok" | "x" | "youtube"; label: string; href: string };

export const socials: Social[] = [
  { name: "instagram", label: "Instagram", href: "" },
  { name: "facebook", label: "Facebook", href: "" },
  { name: "tiktok", label: "TikTok", href: "" },
  { name: "x", label: "X", href: "" },
  { name: "youtube", label: "YouTube", href: "" },
];

export const navLinks = [
  { label: "Home", href: "#home" },
  { label: "About Us", href: "#about-us" },
  { label: "Rooms", href: "#rooms" },
  { label: "Services", href: "#services" },
  { label: "News", href: "#blog" },
  { label: "Contact", href: "#contact" },
];

export const hero = {
  title: "Hotel Nayel Your Gateway To Serenity.",
  cta: { label: "Explore Rooms", href: "#rooms" },
  image: "/images/hero.jpg",
};

export const booking = {
  title: "Check Availability",
  roomOptions: [1, 2, 3, 4],
  guestOptions: [1, 2, 3, 4, 5, 6],
  defaultGuests: 2,
  submitLabel: "Check Availability",
};

export const about = {
  title: "Nayel: Your Gateway To Serenity",
  body:
    "Welcome to Hotel Nayel, where comfort meets tranquility. Tucked into a quiet corner of lively " +
    "Cairo, right on the Nile, our hotel is a peaceful retreat for business and leisure travelers alike. Sunlit rooms, " +
    "thoughtful amenities and a warm, attentive team are all here to make your stay effortless.",
  cta: { label: "Read About Us", href: "#about-us" },
  images: {
    wide: { src: "/images/about-pool.jpg", width: 1024, height: 685, alt: "Palm-fringed resort pool under a clear sky" },
    main: { src: "/images/about-room.jpg", width: 1024, height: 666, alt: "Bright, modern guest room with a wide bed and a work corner" },
    small: { src: "/images/about-breakfast.jpg", width: 1024, height: 683, alt: "Silver tea service on a tray, set on a quilted bed" },
  },
};

export const stats = [
  { value: 25, suffix: "k", label: "Happy Clients" },
  { value: 160, suffix: "", label: "Total Rooms" },
  { value: 28, suffix: "", label: "Awards Won" },
  { value: 100, suffix: "", label: "Team Members" },
];

export type Room = {
  name: string;
  description: string;
  image: string;
  price: number;
  size: string;
  capacity: string;
  bed: string;
  services: string;
};

export const roomsSection = {
  title: "Explore Our Rooms",
  cta: { label: "Explore Rooms", href: "#rooms" },
  detailsLabel: "Browse Now",
};

export const rooms: Room[] = [
  {
    name: "Grand Deluxe Room",
    description: "Floor-to-ceiling windows, a plush king bed and a marble rain shower for slow, easy mornings.",
    image: "/images/room-deluxe.jpg",
    price: 269,
    size: "38 m²",
    capacity: "Max 2 guests",
    bed: "1 King bed",
    services: "Wi-Fi, Smart TV, Minibar, Rain shower",
  },
  {
    name: "Sweet Family Room",
    description: "Two connected sleeping areas and a cosy lounge corner — space for everyone to unwind.",
    image: "/images/room-family.jpg",
    price: 360,
    size: "56 m²",
    capacity: "Max 4 guests",
    bed: "1 King + 2 Single beds",
    services: "Wi-Fi, Smart TV, Sofa bed, Bathtub",
  },
  {
    name: "Perfect Double Room",
    description: "A light-filled retreat with soft linens and a writing desk overlooking the garden.",
    image: "/images/room-double.jpg",
    price: 219,
    size: "30 m²",
    capacity: "Max 2 guests",
    bed: "1 Queen bed",
    services: "Wi-Fi, Smart TV, Coffee station",
  },
  {
    name: "Serenity Suite",
    description: "Our signature suite: a separate living room, soaking tub and private balcony.",
    image: "/images/room-suite.jpg",
    price: 450,
    size: "72 m²",
    capacity: "Max 3 guests",
    bed: "1 King bed",
    services: "Wi-Fi, Balcony, Soaking tub, Butler",
  },
  {
    name: "Poolside Twin Room",
    description: "Step straight from your terrace onto the pool deck — sun loungers included.",
    image: "/images/room-poolside.jpg",
    price: 245,
    size: "34 m²",
    capacity: "Max 2 guests",
    bed: "2 Single beds",
    services: "Wi-Fi, Pool access, Terrace",
  },
];

export const gallery = {
  title: "Our Gallery",
  body:
    "Take a look around our well-appointed rooms, modern amenities and calm, stylish spaces. Admire the " +
    "sweeping views from the rooftop pool, where you can relax and unwind after a day of exploring the city.",
  images: [
    { src: "/images/gallery-villa.jpg", alt: "Private pool villa opening onto the beach" },
    { src: "/images/gallery-suite.jpg", alt: "Suite living area with floor-to-ceiling city views" },
    { src: "/images/gallery-spa.jpg", alt: "Spa towels dressed with white frangipani flowers" },
  ],
};

export type Service = { icon: IconName; title: string; body: string };

export const servicesSection = { title: "Our Services & Facilities", readMore: "Read More" };

export const services: Service[] = [
  {
    icon: "meditation",
    title: "Yoga & Meditation",
    body:
      "Rejuvenate body and mind with daily yoga and meditation sessions led by experienced instructors. " +
      "Beginner or advanced, every class offers a peaceful escape from the bustle of the city.",
  },
  {
    icon: "chefHat",
    title: "Dining",
    body:
      "Indulge in a culinary journey at our on-site restaurant, where seasonal menus are built around " +
      "fresh local ingredients. From a relaxed breakfast to a romantic dinner, every meal is an occasion.",
  },
  {
    icon: "swimming",
    title: "Rooftop Pool",
    body:
      "Relax and unwind at our heated rooftop pool with panoramic views of the city skyline. Take a " +
      "refreshing swim, soak up the sun on a lounger or enjoy a cocktail as the evening lights come on.",
  },
  {
    icon: "dumbbells",
    title: "Fitness Center",
    body:
      "Stay on track in our 24-hour fitness center, fully equipped with modern cardio machines, free " +
      "weights and a stretching area. Personal training sessions are available on request.",
  },
  {
    icon: "armchair",
    title: "Event Spaces",
    body:
      "Host your next meeting, celebration or wedding in our flexible event spaces. Our dedicated events " +
      "team and state-of-the-art technology make every occasion run smoothly.",
  },
  {
    icon: "wifi",
    title: "Free Wi-Fi",
    body:
      "Stay connected throughout your visit with complimentary high-speed Wi-Fi in every room and public " +
      "area — ideal for catching up on work or streaming your favorite shows.",
  },
];

export type Post = { tag: string; title: string; date: string; image: string; wide?: boolean };

export const blogSection = { title: "Our Blogs & Events", cta: { label: "More Blog", href: "#blog" } };

export const posts: Post[] = [
  { tag: "Hotels", title: "A Day In The Life Of A Hotel Nayel Guest", date: "12 Sep, 2026", image: "/images/post-guest.jpg" },
  { tag: "Activities", title: "Guide To Seasonal Activities In The City", date: "3 Sep, 2026", image: "/images/post-activities.jpg" },
  { tag: "Rooms", title: "A Look Inside Hotel Nayel's Suites", date: "27 Aug, 2026", image: "/images/post-suites.jpg" },
  {
    tag: "Activities",
    title: "Why Hotel Nayel Is The Perfect Staycation Destination",
    date: "18 Aug, 2026",
    image: "/images/post-staycation.jpg",
    wide: true,
  },
  { tag: "Rooms", title: "The Benefits Of Booking Directly With Hotel Nayel", date: "9 Aug, 2026", image: "/images/post-booking.jpg" },
];

export const footer = {
  about:
    "A calm Nile-side retreat in the heart of Cairo, where sunlit rooms, slow mornings and warm, attentive service come together. " +
    "We look forward to welcoming you.",
  newsletter: {
    eyebrow: "Letters from Nayel",
    title: "Seasonal Offers & Quiet News, Straight To Your Inbox.",
    body: "One thoughtful email a month — member rates, new experiences and the occasional recipe from our kitchen.",
    placeholder: "Your email address",
    submit: "Subscribe",
    success: "Thank you — you're on the list. Watch your inbox for our next letter.",
  },
  infoTitle: "Visit Us",
  hours: "Reception open 24/7 · Check-in 3 PM · Check-out 11 AM",
  columns: [
    {
      title: "Explore",
      links: [
        { label: "Home", href: "#home" },
        { label: "About Us", href: "#about-us" },
        { label: "Rooms & Suites", href: "#rooms" },
        { label: "Gallery", href: "#gallery" },
        { label: "News & Events", href: "#blog" },
      ],
    },
    {
      title: "Experiences",
      links: [
        { label: "Spa & Wellness", href: "#services" },
        { label: "Rooftop Pool", href: "#services" },
        { label: "Yoga & Meditation", href: "#services" },
        { label: "Dining", href: "#services" },
        { label: "Event Spaces", href: "#services" },
      ],
    },
  ],
  legal: [
    { label: "Privacy Policy", href: "" },
    { label: "Terms & Conditions", href: "" },
  ],
  copyright: `© ${new Date().getFullYear()} Hotel Nayel. All rights reserved.`,
  poweredBy: "AURIC",
};
