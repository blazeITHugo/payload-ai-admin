'use client'

import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

/** Nav-bar entry that opens the Claudia chat view. */
export function ClaudiaNavLink({ label = 'Claudia' }: { label?: string }) {
  const pathname = usePathname()
  const href = '/admin/claudia'
  const active = pathname?.startsWith(href)

  return (
    <Link
      href={href}
      className="nav__link"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontWeight: active ? 600 : 400,
      }}
    >
      <Sparkles size={16} />
      <span>{label}</span>
    </Link>
  )
}

export default ClaudiaNavLink
