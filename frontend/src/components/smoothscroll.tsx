'use client'

import { ReactLenis } from 'lenis/react'
import { ReactNode } from 'react'

interface SmoothScrollProps {
    children: ReactNode
    /** When true, Lenis drives the window/document scroll.
     *  When false (default), it drives this element's own scroll container. */
    root?: boolean
    className?: string
}

export default function SmoothScroll({ children, root = false, className }: SmoothScrollProps) {
    return (
        <ReactLenis
            root={root}
            className={className}
            options={{
                lerp: 0.09,
                duration: 1.2,
                smoothWheel: true,
                wheelMultiplier: 1.1,
                touchMultiplier: 2,
                infinite: false,
                // Let nested scroll containers (modals, dropdowns, sheets) scroll natively
                // instead of Lenis hijacking the wheel for the whole page.
                allowNestedScroll: true,
            }}
        >
            {children}
        </ReactLenis>
    )
}
