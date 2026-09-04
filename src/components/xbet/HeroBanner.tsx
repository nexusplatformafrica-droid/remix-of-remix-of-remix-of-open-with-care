import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import aresPoster from "@/assets/sword-of-ares.jpg";
import aviatorPoster from "@/assets/aviator-poster.jpg";
import royalPoster from "@/assets/royal-fortune.jpg";
import { SlideCarousel } from "@/components/xbet/SlideCarousel";
import { useSiteContent } from "@/components/admin/AdminDataContext";
import { visibleSlides } from "@/lib/slides";

/** Home hero — shows only slides published by the admin. */
export function HeroBanner() {
  const { content, ready } = useSiteContent();
  const slides = useMemo(() => visibleSlides(content.heroSlides), [content.heroSlides]);

  return (
    <SlideCarousel
      slides={slides}
      ready={ready}
      heightClass="h-[150px] sm:h-[195px] md:h-[250px]"
    />
  );
}

const games = [
  {
    name: "Sword of Ares",
    to: "/slot",
    img: aresPoster,
    alt: "Sword of Ares slot game poster",
  },
  {
    name: "Royal Fortune",
    to: "/royal-fortune",
    img: royalPoster,
    alt: "Royal Fortune slot game poster with crowns and gems",
  },
  {
    name: "Aviator",
    to: "/aviator",
    img: aviatorPoster,
    alt: "Aviator crash game poster with a red propeller plane and rising multiplier curve",
  },
];

export function GameTiles() {
  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5 px-1.5 sm:gap-2 sm:px-0 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 font-xb">
      {games.map((g) => (
        <Link
          key={g.name}
          to={g.to}
          className="overflow-hidden rounded-md bg-xb-panel pb-0.5 text-left md:pb-2 shadow-sm ring-1 ring-xb-line transition-transform hover:-translate-y-0.5 hover:ring-xb-blue-light"
        >
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={g.img}
              alt={g.alt}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </div>
          <div className="flex items-center gap-1 px-1.5 py-1 md:gap-1.5 md:px-2 md:py-1.5">
            <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-sm bg-xb-odds text-[8px] font-black text-xb-blue">
              B
            </span>
            <span className="truncate text-[10px] font-bold leading-tight text-xb-text md:text-[11.5px]">
              {g.name}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
