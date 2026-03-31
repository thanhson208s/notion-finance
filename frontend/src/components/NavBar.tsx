import './NavBar.css'
import { NavLink, useLocation } from 'react-router-dom'
import { Wallet, ChartBarBig, WalletCards, TicketPercent } from 'lucide-react'

export default function NavBar() {
  const { pathname } = useLocation();
  const accountsActive = pathname === '/' ||
    /^\/(expense|income|transfer|adjustment)\//.test(pathname);

  const reportsActive = pathname === '/reports'
  const cardsActive = pathname === '/cards'
  const promosActive = pathname === '/promos'

  const activeIndex = accountsActive ? 0 : reportsActive ? 1 : cardsActive ? 2 : 3

  return (
    <nav className="nav-bar">
      <div className="nav-pill" style={{ left: `${activeIndex * 25}%` }} />
      <NavLink to="/" replace className={() => accountsActive ? 'nav-item active' : 'nav-item'} end>
        <Wallet size={accountsActive ? 28 : 24} />
      </NavLink>

      <NavLink to="/reports" replace className="nav-item">
        <ChartBarBig size={reportsActive ? 28 : 24} />
      </NavLink>

      <NavLink to="/cards" replace className="nav-item">
        <WalletCards size={cardsActive ? 28 : 24} />
      </NavLink>

      <NavLink to="/promos" replace className="nav-item">
        <TicketPercent size={promosActive ? 28 : 24} />
      </NavLink>
    </nav>
  )
}
