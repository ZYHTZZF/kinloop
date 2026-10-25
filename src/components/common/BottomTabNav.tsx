import { NavLink } from 'react-router-dom'

type BottomTabNavProps = {
  items: Array<{
    to: string
    label: string
  }>
}

export function BottomTabNav({ items }: BottomTabNavProps) {
  return (
    <nav
      className="bottom-tab-nav"
      aria-label="底部导航"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bottom-tab-nav__item${isActive ? ' is-active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
