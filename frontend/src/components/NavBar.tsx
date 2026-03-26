import './NavBar.css'
import { NavLink, useLocation } from 'react-router-dom'
import { Wallet, ChartBarBig, WalletCards, TicketPercent } from 'lucide-react'

export default function NavBar() {
  const { pathname } = useLocation();
  const accountsActive = pathname === '/' ||
    /^\/(expense|income|transfer|adjustment)\//.test(pathname);

  return (
    <nav className="nav-bar">
      <NavLink to="/" replace className={() => accountsActive ? 'nav-item active' : 'nav-item'} end>
        <Wallet size={22} />
      </NavLink>

      <NavLink to="/reports" replace className="nav-item">
        <ChartBarBig size={22} />
      </NavLink>

      <NavLink to="/cards" replace className="nav-item">
        <WalletCards size={22} />
      </NavLink>

      <NavLink to="/promos" replace className="nav-item">
        <TicketPercent size={22} />
      </NavLink>
    </nav>
  )
}