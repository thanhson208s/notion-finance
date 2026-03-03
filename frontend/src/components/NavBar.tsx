import './NavBar.css'
import { NavLink, useLocation } from 'react-router-dom'
import { Wallet, ChartBarBig, WalletCards, TicketPercent } from 'lucide-react'

export default function NavBar() {
  const { pathname } = useLocation();
  const accountsActive = pathname === '/' ||
    /^\/(expense|income|transfer|adjustment)\//.test(pathname);

  return (
    <nav className="nav-bar">
      <NavLink to="/" className={() => accountsActive ? 'nav-item active' : 'nav-item'} end>
        <Wallet size={22} />
      </NavLink>

      <NavLink to="/reports" className="nav-item">
        <ChartBarBig size={22} />
      </NavLink>

      <NavLink to="/cards" className="nav-item">
        <WalletCards size={22} />
      </NavLink>

      <NavLink to="/promos" className="nav-item">
        <TicketPercent size={22} />
      </NavLink>
    </nav>
  )
}