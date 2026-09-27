/**
 * The Hotel Nayel demo property — a four-star Nile-side hotel in Garden City, Cairo (the public
 * site is hotel-project/web; room types here are the five rooms that site shows). Names are
 * realistic Egyptian names; money is EGP. The dataset grows slice by slice with the domain, and
 * every row is created through a real domain service, never by raw inserts that skip invariants.
 */
export const DEMO_ORG = {
  name: "Hotel Nayel",
  slug: "hotel-nayel",
} as const;

export const DEMO_PASSWORD = "demo-password-2026";

export const DEMO_SETTINGS = {
  hotelName: "Hotel Nayel",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  taxRate: 0.14,
  address: "12 Corniche El Nil, Garden City, Cairo, Egypt",
  phone: "+20 2 2795 4410",
  email: "stay@hotelnayel.com",
};

export interface DemoStaffMember {
  key: string;
  name: string;
  email: string;
  /** HotelOS role key (app/hotel/shared/roles.ts). */
  roleKey: string;
  membershipRole: "owner" | "member";
}

/** The first entry is the organization owner and the demo login. */
export const DEMO_STAFF: DemoStaffMember[] = [
  {
    key: "owner",
    name: "Ahmed Nabil",
    email: "ahmed.nabil@hotelnayel.com",
    roleKey: "owner",
    membershipRole: "owner",
  },
  {
    key: "manager",
    name: "Mona Farid",
    email: "mona.farid@hotelnayel.com",
    roleKey: "manager",
    membershipRole: "member",
  },
  {
    key: "reception1",
    name: "Youssef Adly",
    email: "youssef.adly@hotelnayel.com",
    roleKey: "receptionist",
    membershipRole: "member",
  },
  {
    key: "reception2",
    name: "Rania Kamal",
    email: "rania.kamal@hotelnayel.com",
    roleKey: "receptionist",
    membershipRole: "member",
  },
  {
    key: "accountant",
    name: "Dina Samir",
    email: "dina.samir@hotelnayel.com",
    roleKey: "accountant",
    membershipRole: "member",
  },
  {
    key: "housekeeping1",
    name: "Hassan Ali",
    email: "hassan.ali@hotelnayel.com",
    roleKey: "housekeeping",
    membershipRole: "member",
  },
  {
    key: "housekeeping2",
    name: "Salma Mahmoud",
    email: "salma.mahmoud@hotelnayel.com",
    roleKey: "housekeeping",
    membershipRole: "member",
  },
  {
    key: "maintenance",
    name: "Omar Tarek",
    email: "omar.tarek@hotelnayel.com",
    roleKey: "maintenance",
    membershipRole: "member",
  },
];

export interface DemoRoomType {
  code: string;
  name: string;
  description: string;
  capacity: number;
  beds: string;
  baseRate: number;
  amenities: string[];
}

/** The five rooms the public Nayel site shows, priced in EGP per night. */
export const DEMO_ROOM_TYPES: DemoRoomType[] = [
  {
    code: "DBL",
    name: "Perfect Double Room",
    description:
      "A light-filled retreat with soft linens and a writing desk overlooking the garden.",
    capacity: 2,
    beds: "1 Queen bed",
    baseRate: 4200,
    amenities: ["Wi-Fi", "Smart TV", "Coffee station", "30 m²"],
  },
  {
    code: "TWN",
    name: "Poolside Twin Room",
    description: "Step straight from your terrace onto the pool deck — sun loungers included.",
    capacity: 2,
    beds: "2 Single beds",
    baseRate: 4600,
    amenities: ["Wi-Fi", "Pool access", "Terrace", "34 m²"],
  },
  {
    code: "DLX",
    name: "Grand Deluxe Room",
    description: "Floor-to-ceiling windows, a plush king bed and a marble rain shower.",
    capacity: 2,
    beds: "1 King bed",
    baseRate: 5400,
    amenities: ["Wi-Fi", "Smart TV", "Minibar", "Rain shower", "Nile view", "38 m²"],
  },
  {
    code: "FAM",
    name: "Sweet Family Room",
    description: "Two connected sleeping areas and a cosy lounge corner.",
    capacity: 4,
    beds: "1 King + 2 Single beds",
    baseRate: 6900,
    amenities: ["Wi-Fi", "Smart TV", "Sofa bed", "Bathtub", "56 m²"],
  },
  {
    code: "STE",
    name: "Serenity Suite",
    description: "Our signature suite: a separate living room, soaking tub and private balcony.",
    capacity: 3,
    beds: "1 King bed",
    baseRate: 9800,
    amenities: ["Wi-Fi", "Balcony", "Soaking tub", "Butler", "Nile view", "72 m²"],
  },
];

/** 40 rooms over five floors: [number, floor, room type code]. */
export const DEMO_ROOMS: Array<[string, number, string]> = [
  ...["101", "102", "103", "104"].map((n) => [n, 1, "TWN"] as [string, number, string]),
  ...["105", "106", "107", "108"].map((n) => [n, 1, "DBL"] as [string, number, string]),
  ...["201", "202", "203", "204", "205", "206", "207", "208"].map(
    (n) => [n, 2, "DBL"] as [string, number, string],
  ),
  ...["301", "302", "303", "304", "305", "306", "307", "308"].map(
    (n) => [n, 3, "DLX"] as [string, number, string],
  ),
  ...["401", "402", "403", "404"].map((n) => [n, 4, "FAM"] as [string, number, string]),
  ...["405", "406", "407", "408"].map((n) => [n, 4, "DLX"] as [string, number, string]),
  ...["501", "502", "503", "504"].map((n) => [n, 5, "STE"] as [string, number, string]),
  ...["505", "506", "507", "508"].map((n) => [n, 5, "FAM"] as [string, number, string]),
];

export interface DemoGuest {
  key: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  idDocumentType: "national_id" | "passport" | null;
  idDocumentNumber: string | null;
  preferences: string | null;
  vip: boolean;
  notes?: string[];
}

export const DEMO_GUESTS: DemoGuest[] = [
  {
    key: "g01",
    fullName: "Ahmed Mohamed",
    phone: "+20 100 234 5567",
    email: "ahmed.mohamed@gmail.com",
    nationality: "EG",
    idDocumentType: "national_id",
    idDocumentNumber: "28903150102347",
    preferences: "High floor, non-smoking, extra pillows.",
    vip: true,
    notes: ["Regular business guest — prefers a quiet room away from the lift."],
  },
  {
    key: "g02",
    fullName: "Sara El-Sayed",
    phone: "+20 122 987 1123",
    email: "sara.elsayed@outlook.com",
    nationality: "EG",
    idDocumentType: "national_id",
    idDocumentNumber: "29211040105512",
    preferences: "Late checkout whenever possible.",
    vip: false,
    notes: ["Travels for work; invoices go to her company."],
  },
  {
    key: "g03",
    fullName: "Karim Fathy",
    phone: "+20 111 456 7890",
    email: "karim.fathy@yahoo.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: null,
    vip: false,
  },
  {
    key: "g04",
    fullName: "Nourhan Adel",
    phone: "+20 106 334 2290",
    email: "nourhan.adel@gmail.com",
    nationality: "EG",
    idDocumentType: "national_id",
    idDocumentNumber: "29507220104418",
    preferences: "Nile view. Allergic to feathers — synthetic pillows only.",
    vip: true,
    notes: ["Loyal guest — upgrade to a suite when available."],
  },
  {
    key: "g05",
    fullName: "Mostafa Hassan",
    phone: "+20 128 771 0045",
    email: "mostafa.hassan@gmail.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: null,
    vip: false,
  },
  {
    key: "g06",
    fullName: "Yasmin Ibrahim",
    phone: "+20 109 552 8871",
    email: "yasmin.ibrahim@gmail.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: "Travelling with two children; needs a baby cot.",
    vip: false,
  },
  {
    key: "g07",
    fullName: "Omar Khaled",
    phone: "+20 101 888 2231",
    email: "omar.khaled@hotmail.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: null,
    vip: false,
  },
  {
    key: "g08",
    fullName: "Mariam Youssef",
    phone: "+20 115 670 4412",
    email: "mariam.youssef@gmail.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: "Vegetarian breakfast.",
    vip: false,
  },
  {
    key: "g09",
    fullName: "Tarek Abdel Rahman",
    phone: "+20 100 912 7788",
    email: "tarek.abdelrahman@gmail.com",
    nationality: "EG",
    idDocumentType: "national_id",
    idDocumentNumber: "28208110101193",
    preferences: null,
    vip: true,
  },
  {
    key: "g10",
    fullName: "Heba Mostafa",
    phone: "+20 122 445 9031",
    email: null,
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: null,
    vip: false,
  },
  {
    key: "g11",
    fullName: "Mahmoud Saleh",
    phone: "+20 111 203 5566",
    email: "mahmoud.saleh@gmail.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: null,
    vip: false,
  },
  {
    key: "g12",
    fullName: "Dalia Hamdy",
    phone: "+20 106 778 1290",
    email: "dalia.hamdy@outlook.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: "Early check-in requested on most stays.",
    vip: false,
  },
  {
    key: "g13",
    fullName: "Amr Sherif",
    phone: "+20 127 330 6654",
    email: "amr.sherif@gmail.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: null,
    vip: false,
  },
  {
    key: "g14",
    fullName: "Laila Mansour",
    phone: "+20 100 663 4420",
    email: "laila.mansour@gmail.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: null,
    vip: false,
  },
  {
    key: "g15",
    fullName: "Khaled Mahmoud",
    phone: "+971 50 412 7789",
    email: "khaled.mahmoud@emirates.net",
    nationality: "AE",
    idDocumentType: "passport",
    idDocumentNumber: "A7781204",
    preferences: "Airport transfer on arrival.",
    vip: true,
  },
  {
    key: "g16",
    fullName: "Faisal Al-Otaibi",
    phone: "+966 55 318 2094",
    email: "faisal.alotaibi@gmail.com",
    nationality: "SA",
    idDocumentType: "passport",
    idDocumentNumber: "P5520917",
    preferences: "Family of four, connecting rooms.",
    vip: false,
  },
  {
    key: "g17",
    fullName: "Emma Schneider",
    phone: "+49 151 2208 4471",
    email: "emma.schneider@web.de",
    nationality: "DE",
    idDocumentType: "passport",
    idDocumentNumber: "C4J7R2291",
    preferences: "Nile view; interested in a Pyramids day tour.",
    vip: false,
  },
  {
    key: "g18",
    fullName: "James Carter",
    phone: "+44 7700 900 412",
    email: "james.carter@btinternet.com",
    nationality: "GB",
    idDocumentType: "passport",
    idDocumentNumber: "533017742",
    preferences: null,
    vip: false,
  },
  {
    key: "g19",
    fullName: "Rana Fouad",
    phone: "+20 109 223 8810",
    email: "rana.fouad@gmail.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: null,
    vip: false,
  },
  {
    key: "g20",
    fullName: "Hany Gamal",
    phone: "+20 128 114 6603",
    email: "hany.gamal@gmail.com",
    nationality: "EG",
    idDocumentType: null,
    idDocumentNumber: null,
    preferences: null,
    vip: false,
  },
];

/** Rate rules. Egypt's hotel weekend is Thursday and Friday nights. */
export const DEMO_RATE_RULES = [
  {
    name: "Weekend",
    kind: "weekend" as const,
    roomTypeCode: null,
    startDate: null,
    endDate: null,
    daysOfWeek: [4, 5],
    adjustmentType: "percent" as const,
    adjustmentValue: 15,
    minNights: null,
    priority: 2,
  },
  {
    name: "Autumn high season",
    kind: "seasonal" as const,
    roomTypeCode: null,
    startDate: "2026-10-15",
    endDate: "2026-11-30",
    daysOfWeek: null,
    adjustmentType: "percent" as const,
    adjustmentValue: 20,
    minNights: null,
    priority: 1,
  },
  {
    name: "New Year's Eve",
    kind: "seasonal" as const,
    roomTypeCode: null,
    startDate: "2026-12-30",
    endDate: "2027-01-01",
    daysOfWeek: null,
    adjustmentType: "percent" as const,
    adjustmentValue: 40,
    minNights: 3,
    priority: 5,
  },
];

export const DEMO_DISCOUNTS = [
  { code: "NILE10", description: "Direct-booking thank-you", percentOff: 10 },
  { code: "CORP15", description: "Corporate partners", percentOff: 15 },
];

export interface DemoReservation {
  guestKey: string;
  roomTypeCode: string;
  /** Room number, or null to let the engine assign one. */
  room: string | null;
  /** Arrival as days from the hotel's "today" at seed time. */
  arriveIn: number;
  nights: number;
  adults: number;
  children?: number;
  source: "direct" | "phone" | "walk_in" | "website" | "booking_com" | "expedia";
  confirm: boolean;
  discountCode?: string;
  notes?: string;
  cancel?: string;
}

/** Upcoming business, relative to seed day. In-house and past stays arrive with the front desk. */
export const DEMO_RESERVATIONS: DemoReservation[] = [
  {
    guestKey: "g01",
    roomTypeCode: "DLX",
    room: "305",
    arriveIn: 0,
    nights: 3,
    adults: 2,
    source: "website",
    confirm: true,
    notes: "Arriving late, around 9 PM.",
  },
  {
    guestKey: "g06",
    roomTypeCode: "FAM",
    room: "402",
    arriveIn: 0,
    nights: 3,
    adults: 2,
    children: 2,
    source: "website",
    confirm: true,
    notes: "Baby cot requested.",
  },
  {
    guestKey: "g15",
    roomTypeCode: "STE",
    room: "502",
    arriveIn: 0,
    nights: 4,
    adults: 2,
    source: "phone",
    confirm: true,
    notes: "Airport transfer at 16:30.",
  },
  {
    guestKey: "g17",
    roomTypeCode: "DBL",
    room: null,
    arriveIn: 0,
    nights: 2,
    adults: 1,
    source: "booking_com",
    confirm: true,
  },
  {
    guestKey: "g05",
    roomTypeCode: "STE",
    room: null,
    arriveIn: 1,
    nights: 3,
    adults: 2,
    source: "expedia",
    confirm: false,
    notes: "Awaiting payment confirmation.",
  },
  {
    guestKey: "g08",
    roomTypeCode: "DBL",
    room: null,
    arriveIn: 1,
    nights: 2,
    adults: 2,
    source: "direct",
    confirm: true,
    discountCode: "NILE10",
  },
  {
    guestKey: "g16",
    roomTypeCode: "FAM",
    room: null,
    arriveIn: 2,
    nights: 5,
    adults: 2,
    children: 2,
    source: "phone",
    confirm: true,
    notes: "Connecting rooms if possible.",
  },
  {
    guestKey: "g09",
    roomTypeCode: "DLX",
    room: null,
    arriveIn: 2,
    nights: 2,
    adults: 1,
    source: "direct",
    confirm: true,
    discountCode: "CORP15",
  },
  {
    guestKey: "g18",
    roomTypeCode: "TWN",
    room: null,
    arriveIn: 3,
    nights: 4,
    adults: 2,
    source: "booking_com",
    confirm: true,
  },
  {
    guestKey: "g12",
    roomTypeCode: "DBL",
    room: null,
    arriveIn: 4,
    nights: 1,
    adults: 2,
    source: "phone",
    confirm: false,
  },
  {
    guestKey: "g14",
    roomTypeCode: "DLX",
    room: null,
    arriveIn: 5,
    nights: 3,
    adults: 2,
    source: "website",
    confirm: true,
  },
  {
    guestKey: "g19",
    roomTypeCode: "TWN",
    room: null,
    arriveIn: 6,
    nights: 2,
    adults: 2,
    source: "expedia",
    confirm: true,
  },
  {
    guestKey: "g20",
    roomTypeCode: "DBL",
    room: null,
    arriveIn: 7,
    nights: 3,
    adults: 1,
    source: "direct",
    confirm: true,
  },
  {
    guestKey: "g13",
    roomTypeCode: "DLX",
    room: null,
    arriveIn: 9,
    nights: 4,
    adults: 2,
    source: "booking_com",
    confirm: true,
  },
  {
    guestKey: "g11",
    roomTypeCode: "FAM",
    room: null,
    arriveIn: 12,
    nights: 3,
    adults: 2,
    children: 1,
    source: "phone",
    confirm: false,
  },
  {
    guestKey: "g03",
    roomTypeCode: "DBL",
    room: null,
    arriveIn: 14,
    nights: 2,
    adults: 1,
    source: "expedia",
    confirm: true,
    cancel: "Flight cancelled.",
  },
  {
    guestKey: "g02",
    roomTypeCode: "DLX",
    room: null,
    arriveIn: 16,
    nights: 3,
    adults: 1,
    source: "direct",
    confirm: true,
    notes: "Late checkout requested.",
  },
  {
    guestKey: "g04",
    roomTypeCode: "STE",
    room: null,
    arriveIn: 20,
    nights: 5,
    adults: 2,
    source: "phone",
    confirm: true,
    notes: "Anniversary — flowers in room.",
  },
];
