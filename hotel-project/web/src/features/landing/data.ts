import type { IconName } from "./components/icon";

/*
 * All landing-page content in one place. Layout and styling never hard-code copy — edit here.
 *
 * Section structure and images come from the Mellow template; the template's placeholder
 * content (lorem ipsum, "+666 333 9999", "Relaxingland", one description repeated on every
 * service card…) has been replaced with DEMO data. Swap in the real hotel's details before launch.
 */

export const brand = {
  name: "Mellow",
  fullName: "Hotel Mellow",
  tagline: "Where comfort meets tranquility.",
};

export const contact = {
  // Demo contact details: 555-01xx numbers are reserved for fiction.
  phone: "+1 (555) 014-2290",
  phoneAlt: "+1 (555) 014-2291",
  email: "stay@hotelmellow.com",
  addressLines: ["Mellow Hotel & Resort", "48 Serenity Avenue", "Palm Harbor, FL 34683", "United States"],
  topBarAddress: "48 Serenity Avenue, Palm Harbor",
};

export type Social = { name: "facebook" | "twitter" | "linkedin" | "instagram" | "youtube"; label: string; href: string };

export const socials: Social[] = [
  { name: "facebook", label: "Facebook", href: "#" },
  { name: "twitter", label: "X (Twitter)", href: "#" },
  { name: "linkedin", label: "LinkedIn", href: "#" },
  { name: "instagram", label: "Instagram", href: "#" },
  { name: "youtube", label: "YouTube", href: "#" },
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
  title: "Hotel Mellow Your Gateway To Serenity.",
  cta: { label: "Explore Rooms", href: "#rooms" },
  image: "/images/slider-image.jpg",
};

export const booking = {
  title: "Check Availability",
  roomOptions: [1, 2, 3, 4],
  guestOptions: [1, 2, 3, 4, 5, 6],
  defaultGuests: 2,
  submitLabel: "Check Availability",
};

export const about = {
  title: "Mellow: Your Gateway To Serenity",
  body:
    "Welcome to Hotel Mellow, where comfort meets tranquility. Tucked into a quiet corner of a lively " +
    "coastal city, our hotel is a peaceful retreat for business and leisure travelers alike. Sunlit rooms, " +
    "thoughtful amenities and a warm, attentive team are all here to make your stay effortless.",
  cta: { label: "Read About Us", href: "#about-us" },
  images: {
    wide: { src: "/images/about-img1.jpg", alt: "Arched poolside terrace with white loungers" },
    main: { src: "/images/about-img2.jpg", alt: "Bright guest room with a king bed and wooden accents" },
    small: { src: "/images/about-img3.jpg", alt: "Guest relaxing with breakfast in bed" },
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
    image: "/images/room1.jpg",
    price: 269,
    size: "38 m²",
    capacity: "Max 2 guests",
    bed: "1 King bed",
    services: "Wi-Fi, Smart TV, Minibar, Rain shower",
  },
  {
    name: "Sweet Family Room",
    description: "Two connected sleeping areas and a cosy lounge corner — space for everyone to unwind.",
    image: "/images/room3.jpg",
    price: 360,
    size: "56 m²",
    capacity: "Max 4 guests",
    bed: "1 King + 2 Single beds",
    services: "Wi-Fi, Smart TV, Sofa bed, Bathtub",
  },
  {
    name: "Perfect Double Room",
    description: "A light-filled retreat with soft linens and a writing desk overlooking the garden.",
    image: "/images/room2.jpg",
    price: 219,
    size: "30 m²",
    capacity: "Max 2 guests",
    bed: "1 Queen bed",
    services: "Wi-Fi, Smart TV, Coffee station",
  },
  {
    name: "Serenity Suite",
    description: "Our signature suite: a separate living room, soaking tub and private balcony.",
    image: "/images/item2.jpg",
    price: 450,
    size: "72 m²",
    capacity: "Max 3 guests",
    bed: "1 King bed",
    services: "Wi-Fi, Balcony, Soaking tub, Butler",
  },
  {
    name: "Poolside Twin Room",
    description: "Step straight from your terrace onto the pool deck — sun loungers included.",
    image: "/images/about-img1.jpg",
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
    { src: "/images/item3.jpg", alt: "Marble bathroom with a round mirror" },
    { src: "/images/item2.jpg", alt: "Bedroom with white linens and a blue woven throw" },
    { src: "/images/item1.jpg", alt: "White arched villas along the resort pool" },
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
  { tag: "Hotels", title: "A Day In The Life Of A Hotel Mellow Guest", date: "12 Sep, 2026", image: "/images/post3.jpg" },
  { tag: "Activities", title: "Guide To Seasonal Activities In The City", date: "3 Sep, 2026", image: "/images/post2.jpg" },
  { tag: "Rooms", title: "A Look Inside Hotel Mellow's Suites", date: "27 Aug, 2026", image: "/images/post1.jpg" },
  {
    tag: "Activities",
    title: "Why Hotel Mellow Is The Perfect Staycation Destination",
    date: "18 Aug, 2026",
    image: "/images/post5.jpg",
    wide: true,
  },
  { tag: "Rooms", title: "The Benefits Of Booking Directly With Hotel Mellow", date: "9 Aug, 2026", image: "/images/post4.jpg" },
];

export const footer = {
  about:
    "Welcome to Hotel Mellow, where comfort meets tranquility. A peaceful coastal retreat for business and " +
    "leisure travelers alike.",
  newsletter: {
    title: "Join Our Newsletter",
    body: "Sign up to our newsletter to receive the latest news and offers.",
    submit: "Subscribe Now",
    success: "Thank you — you're on the list!",
  },
  infoTitle: "Our Info",
  columns: [
    {
      title: "Quick Links",
      links: [
        { label: "Home", href: "#home" },
        { label: "About Us", href: "#about-us" },
        { label: "Our Services", href: "#services" },
        { label: "Privacy Policy", href: "#" },
        { label: "Contact Us", href: "#contact" },
        { label: "Support", href: "#" },
      ],
    },
    {
      title: "Services",
      links: [
        { label: "Spa", href: "#services" },
        { label: "Pool", href: "#services" },
        { label: "Yoga", href: "#services" },
        { label: "Gym", href: "#services" },
        { label: "News", href: "#blog" },
        { label: "Terms & Conditions", href: "#" },
      ],
    },
  ],
  copyright: `© ${new Date().getFullYear()} Hotel Mellow. All rights reserved.`,
  credit: { label: "TemplatesJungle", href: "https://templatesjungle.com/" },
};
