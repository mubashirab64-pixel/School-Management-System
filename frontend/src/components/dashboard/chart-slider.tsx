"use client"

import { useState } from "react"
import { Swiper, SwiperSlide } from "swiper/react"
import { Pagination, A11y } from "swiper/modules"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Swiper as SwiperType } from "swiper"
import "swiper/css"
import "swiper/css/pagination"

interface ChartSliderProps {
  children: React.ReactNode[]
}

export function ChartSlider({ children }: ChartSliderProps) {
  const [swiper, setSwiper] = useState<SwiperType | null>(null)
  const [isBeginning, setIsBeginning] = useState(true)
  const [isEnd, setIsEnd] = useState(false)

  const slides = children.filter(Boolean)
  if (slides.length === 0) return null

  return (
    <div className="relative mb-6 group/slider">
      {/* Prev */}
      <button
        onClick={() => swiper?.slidePrev()}
        disabled={isBeginning}
        className="absolute left-1 lg:-left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-[#2F6B8A] hover:bg-[#2F6B8A] hover:text-white transition-all duration-200 opacity-100 lg:opacity-0 lg:group-hover/slider:opacity-100 disabled:!opacity-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <Swiper
        modules={[Pagination, A11y]}
        spaceBetween={20}
        slidesPerView={1}
        breakpoints={{
          768: { slidesPerView: 2 },
          1280: { slidesPerView: 3 },
        }}
        grabCursor
        pagination={{ clickable: true, dynamicBullets: true }}
        onSwiper={setSwiper}
        onSlideChange={(s) => {
          setIsBeginning(s.isBeginning)
          setIsEnd(s.isEnd)
        }}
        className="!pb-8"
        style={
          {
            "--swiper-pagination-color": "#2F6B8A",
            "--swiper-pagination-bullet-inactive-color": "#CBD5E1",
            "--swiper-pagination-bullet-inactive-opacity": "1",
            "--swiper-pagination-bullet-size": "7px",
          } as React.CSSProperties
        }
      >
        {slides.map((child, i) => (
          <SwiperSlide key={i}>
            {child}
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Next */}
      <button
        onClick={() => swiper?.slideNext()}
        disabled={isEnd}
        className="absolute right-1 lg:-right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-[#2F6B8A] hover:bg-[#2F6B8A] hover:text-white transition-all duration-200 opacity-100 lg:opacity-0 lg:group-hover/slider:opacity-100 disabled:!opacity-0"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
